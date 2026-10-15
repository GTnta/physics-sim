// Install the pinned build dependencies under .tmp/monkey-build before rebuilding.
// npm install --prefix .tmp/monkey-build three@0.180.0 lucide@0.468.0 esbuild@0.25.10
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const modules = path.join(root, '.tmp/monkey-build/node_modules');
const esbuild = require(path.join(modules, 'esbuild'));
esbuild.buildSync({
  absWorkingDir: root,
  entryPoints: ['monkey-hunting/monkey-scenes.js'],
  outfile: 'monkey-hunting/monkey-scenes.bundle.js',
  bundle: true, minify: true, format: 'iife', target: ['es2020'],
  legalComments: 'eof', nodePaths: [modules]
});
const bundlePath = path.join(root, 'monkey-hunting/monkey-scenes.bundle.js');
fs.writeFileSync(bundlePath, fs.readFileSync(bundlePath, 'utf8').replace(/[\t ]+$/gm, ''));
const licenses = [
  '# Bundled dependencies',
  'Three.js 0.180.0: https://github.com/mrdoob/three.js/tree/r180',
  fs.readFileSync(path.join(modules, 'three/LICENSE'), 'utf8'),
  'Lucide 0.468.0: https://github.com/lucide-icons/lucide/tree/0.468.0',
  fs.readFileSync(path.join(modules, 'lucide/LICENSE'), 'utf8')
];
fs.writeFileSync(path.join(root, 'monkey-hunting/THIRD-PARTY-LICENSES.txt'), licenses.join('\n\n'));
console.log('Built monkey-scenes.bundle.js and bundled licenses.');
