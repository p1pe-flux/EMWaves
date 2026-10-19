import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const desktopRuntimeFiles = ['electron/main.cjs', 'electron/external-navigation.cjs'];
export const desktopIconFiles = ['electron/assets/icon.png', 'electron/assets/icon.ico', 'electron/assets/icon.icns'];

export function desktopManifest(config) {
  const { name, version, description, author, license } = config;
  return { name, version, description, author, license, private: true, main: 'electron/main.cjs' };
}

export async function stageDesktopApp(root = projectRoot) {
  const config = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  // Require a completed web build and its dependency notices before replacing
  // a previous staging tree. Vite produces notices from the bundled modules.
  await readFile(path.join(root, 'dist/index.html'));
  const notices = await readFile(path.join(root, 'dist/THIRD-PARTY-NOTICES.md'));
  if (!notices.length) throw new Error('The frontend dependency notices are empty. Run npm run build first.');
  const destination = path.join(root, '.desktop/app');
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(path.join(root, 'dist'), path.join(destination, 'dist'), { recursive: true });
  for (const relative of [...desktopRuntimeFiles, ...desktopIconFiles, 'LICENSE']) {
    await mkdir(path.dirname(path.join(destination, relative)), { recursive: true });
    await cp(path.join(root, relative), path.join(destination, relative));
  }
  await writeFile(path.join(destination, 'THIRD-PARTY-NOTICES.md'), notices);
  await writeFile(path.join(destination, 'package.json'), JSON.stringify(desktopManifest(config), null, 2) + '\n');
  return destination;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log(await stageDesktopApp());
}
