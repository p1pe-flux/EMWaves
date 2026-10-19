const { access, readFile } = require('node:fs/promises');
const path = require('node:path');

module.exports = async function beforeDesktopBuild({ appDir }) {
  const manifest = JSON.parse(await readFile(path.join(appDir, 'package.json'), 'utf8'));
  if (manifest.main !== 'electron/main.cjs' || Object.keys(manifest.dependencies ?? {}).length || Object.keys(manifest.devDependencies ?? {}).length) {
    throw new Error('Package the generated dependency-free desktop staging tree, not the development manifest.');
  }
  try {
    await access(path.join(appDir, 'node_modules'));
    throw new Error('The desktop staging tree must not contain node_modules.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  // This documented electron-builder hook declares dependency handling complete.
  // Without it, builder 26 searches the repository's node_modules when the staged
  // app has none, even though the staged manifest has no runtime dependencies.
  return false;
};
