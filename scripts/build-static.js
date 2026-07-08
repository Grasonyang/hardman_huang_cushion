const { copyFile, mkdir, rm } = require('node:fs/promises');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

async function copy(source, target) {
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
}

async function main() {
  await rm(dist, { recursive: true, force: true });

  await copy(path.join(root, 'public', 'index.html'), path.join(dist, 'index.html'));
  await copy(path.join(root, 'public', 'main.js'), path.join(dist, 'public', 'main.js'));
  await copy(path.join(root, 'public', 'styles.css'), path.join(dist, 'public', 'styles.css'));

  await copy(
    path.join(root, 'node_modules', 'three', 'build', 'three.webgpu.js'),
    path.join(dist, 'vendor', 'three.webgpu.js'),
  );
  await copy(
    path.join(root, 'node_modules', 'three', 'build', 'three.core.js'),
    path.join(dist, 'vendor', 'three.core.js'),
  );
  await copy(
    path.join(root, 'node_modules', 'three', 'examples', 'jsm', 'controls', 'OrbitControls.js'),
    path.join(dist, 'vendor', 'OrbitControls.js'),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
