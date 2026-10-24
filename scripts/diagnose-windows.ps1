<#
Read-only EMWaves installation report. Does not launch executables, repair
shortcuts, change security settings, or restore quarantined files.

Example, from PowerShell in this repository:
  .\scripts\diagnose-windows.ps1 -InstallerPath 'C:\Users\me\Downloads\EMWaves-1.0.1-Windows-arm64-Setup.exe'
For a custom installation location, also pass -InstallDirectory 'D:\Apps\EMWaves'.
#>
[CmdletBinding()]
param(
    [string]$InstallDirectory,
    [string]$InstallerPath
)

$ErrorActionPreference = 'Stop'
$emwavesProblems = [System.Collections.Generic.List[string]]::new()

function Get-EmwavesFileReport([string]$FilePath) {
    if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
        return [pscustomobject]@{ Path = $FilePath; Exists = $false }
    }
    $emwavesMachine = 'Unknown'
    $emwavesStream = $null
    $emwavesReader = $null
    try {
        $emwavesStream = [System.IO.File]::OpenRead($FilePath)
        $emwavesReader = [System.IO.BinaryReader]::new($emwavesStream)
        if ($emwavesReader.ReadUInt16() -ne 0x5a4d) { throw 'Not an MZ executable.' }
        $emwavesStream.Position = 0x3c
        $emwavesPeOffset = $emwavesReader.ReadUInt32()
        $emwavesStream.Position = $emwavesPeOffset
        if ($emwavesReader.ReadUInt32() -ne 0x00004550) { throw 'Invalid PE signature.' }
        $emwavesMachineCode = $emwavesReader.ReadUInt16()
        $emwavesMachine = switch ($emwavesMachineCode) {
            0xaa64 { 'ARM64' }
            0x8664 { 'x64' }
            0x014c { 'x86 (normal for the NSIS setup wrapper)' }
            default { '0x{0:x4}' -f $emwavesMachineCode }
        }
    } catch {
        $emwavesProblems.Add("PE read failed for ${FilePath}: $($_.Exception.Message)")
    } finally {
        if ($null -ne $emwavesReader) { $emwavesReader.Dispose() }
        elseif ($null -ne $emwavesStream) { $emwavesStream.Dispose() }
    }
    $emwavesSignatureStatus = 'Unavailable'
    $emwavesHash = $null
    try {
        $emwavesSignatureStatus = [string](Get-AuthenticodeSignature -LiteralPath $FilePath).Status
    } catch {
        $emwavesProblems.Add("Signature query failed for ${FilePath}: $($_.Exception.Message)")
    }
    try {
        $emwavesHash = (Get-FileHash -LiteralPath $FilePath -Algorithm SHA256).Hash
    } catch {
        $emwavesProblems.Add("Hash query failed for ${FilePath}: $($_.Exception.Message)")
    }
    return [pscustomobject]@{
        Path = $FilePath
        Exists = $true
        PeMachine = $emwavesMachine
        Sha256 = $emwavesHash
        SignatureStatus = $emwavesSignatureStatus
    }
}

try {
    $emwavesCpu = @(Get-CimInstance Win32_Processor | ForEach-Object {
        [pscustomobject]@{
            Name = $_.Name
            NativeArchitecture = switch ($_.Architecture) {
                12 { 'ARM64' }
                9 { 'x64' }
                0 { 'x86' }
                default { [string]$_.Architecture }
            }
        }
    })
} catch {
    $emwavesCpu = @()
    $emwavesProblems.Add("CPU query unavailable: $($_.Exception.Message)")
}
try {
    $emwavesOsArchitecture = [string][System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
} catch {
    # Older PowerShell/.NET installations may lack RuntimeInformation; CIM above
    # reports the platform's processor architecture, not the emulated shell's.
    $emwavesOsArchitecture = 'Unavailable; see native processor architecture'
}

$emwavesInstallations = @()
foreach ($emwavesRegistry in @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)) {
    $emwavesInstallations += @(Get-ItemProperty $emwavesRegistry -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -like 'EMWaves*' } |
        Select-Object DisplayName, DisplayVersion, InstallLocation)
}

$emwavesShortcutFiles = @()
foreach ($emwavesFolder in @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('CommonDesktopDirectory'),
    [Environment]::GetFolderPath('StartMenu'),
    [Environment]::GetFolderPath('CommonStartMenu')
)) {
    if ($emwavesFolder -and (Test-Path -LiteralPath $emwavesFolder)) {
        $emwavesShortcutFiles += @(Get-ChildItem -LiteralPath $emwavesFolder -Filter '*EMWaves*.lnk' -File -Recurse -ErrorAction SilentlyContinue)
    }
}
$emwavesShell = New-Object -ComObject WScript.Shell
$emwavesShortcuts = @($emwavesShortcutFiles | Sort-Object FullName -Unique | ForEach-Object {
    # Existing shortcuts are read into COM objects; Save is deliberately never called.
    $emwavesLink = $emwavesShell.CreateShortcut($_.FullName)
    [pscustomobject]@{
        Shortcut = $_.FullName
        Target = $emwavesLink.TargetPath
        TargetExists = [bool]($emwavesLink.TargetPath -and (Test-Path -LiteralPath $emwavesLink.TargetPath -PathType Leaf))
    }
})

$emwavesCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\EMWaves\EMWaves.exe'),
    (Join-Path $env:ProgramFiles 'EMWaves\EMWaves.exe')
)
if ($InstallDirectory) { $emwavesCandidates += Join-Path $InstallDirectory 'EMWaves.exe' }
if ($env:ProgramW6432) { $emwavesCandidates += Join-Path $env:ProgramW6432 'EMWaves\EMWaves.exe' }
foreach ($emwavesInstallation in $emwavesInstallations) {
    if ($emwavesInstallation.InstallLocation) {
        $emwavesCandidates += Join-Path $emwavesInstallation.InstallLocation 'EMWaves.exe'
    }
}
$emwavesCandidates += @($emwavesShortcuts | Where-Object { $_.Target -like '*EMWaves.exe' } | ForEach-Object { $_.Target })
$emwavesExecutables = @($emwavesCandidates | Sort-Object -Unique | ForEach-Object { Get-EmwavesFileReport $_ })

try {
    $emwavesDetections = @(Get-MpThreatDetection | Where-Object {
        ($_.Resources -join ' ') -match '(?i)EMWaves'
    } | Select-Object ThreatID, InitialDetectionTime, LastThreatStatusChangeTime, ActionSuccess, Resources)
} catch {
    $emwavesDetections = @()
    $emwavesProblems.Add("Defender history unavailable: $($_.Exception.Message). Check Windows Security > Protection history manually.")
}

$emwavesInstaller = $null
if ($InstallerPath) { $emwavesInstaller = Get-EmwavesFileReport $InstallerPath }
[pscustomobject]@{
    Cpu = $emwavesCpu
    OsArchitecture = $emwavesOsArchitecture
    Installer = $emwavesInstaller
    RegisteredInstallations = $emwavesInstallations
    Shortcuts = $emwavesShortcuts
    Executables = $emwavesExecutables
    EmwavesDefenderDetections = $emwavesDetections
    Limitations = @(
        'Only standard locations, registered installs, shortcut targets and the optional custom directory were checked.',
        'No matching Defender record does not rule out other security products, expired history, or a failed extraction.',
        'Paths in this report can contain your Windows user name; review before sharing.'
    )
    QueryProblems = $emwavesProblems.ToArray()
} | ConvertTo-Json -Depth 6
