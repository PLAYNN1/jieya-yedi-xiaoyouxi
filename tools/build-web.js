'use strict';
// Publish only the browser runtime; scratch files, raw source clips and local
// development paths never enter the website artifact. No build dependencies.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'dist');
const files = ['index.html', 'preview.js', 'src/obstacles.js', 'src/simulation.js', 'src/session.js', 'src/renderer.js', 'src/app.js', 'src/audio-config.js',
  'audio/launch.wav', 'audio/merge.wav', 'audio/detach.wav', 'audio/land.wav'];
fs.mkdirSync(output, { recursive: true });
for (const file of files) {
  const target = path.join(output, file); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, file), target);
}
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log('Static website ready in dist/ (no server or installation needed by visitors).');
