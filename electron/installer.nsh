; electron-builder's ARM64-only template otherwise accepts a non-ARM PC,
; then selects no payload. Reject that case before creating any shortcuts.
!macro customInit
  !ifdef APP_ARM64
    !ifndef APP_64
      !ifndef APP_32
        ${IfNot} ${IsNativeARM64}
          MessageBox MB_OK|MB_ICONSTOP "Este instalador requiere Windows ARM64. Para una PC Intel o AMD, utiliza el instalador Windows x64.$\r$\n$\r$\nThis installer requires Windows ARM64. Use the Windows x64 installer on an Intel or AMD PC."
          SetErrorLevel 2
          Quit
        ${EndIf}
      !endif
    !endif
  !endif
!macroend

; This hook runs immediately after extraction, before registering the app or
; creating shortcuts. Do not report a successful install if the app is missing.
!macro verifyEmwavesExecutable
  ${IfNot} ${FileExists} "$appExe"
    MessageBox MB_OK|MB_ICONSTOP "No se encontro EMWaves.exe despues de extraer los archivos. La instalacion no puede continuar. Revisa la carpeta de destino y el Historial de proteccion de Seguridad de Windows.$\r$\n$\r$\nEMWaves.exe was not found after extraction. Setup cannot continue. Check the destination folder and Windows Security Protection history."
    SetErrorLevel 2
    Abort
  ${EndIf}
!macroend

!macro customFiles_arm64
  !insertmacro verifyEmwavesExecutable
!macroend

!macro customFiles_x64
  !insertmacro verifyEmwavesExecutable
!macroend
