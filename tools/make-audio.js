'use strict';
// v2: short excerpts of the user's reference recording retain liquid resonance.
// No oscillator tones or external runtime dependencies.
const fs = require('node:fs'), path = require('node:path');
const dir = path.join(__dirname, '../audio'), rate = 22050;
const volumes = require('../src/audio-config');
function readWav(file) {
  const b = fs.readFileSync(file); let offset = 12, data, sampleRate, format, channels, bits;
  if (b.toString('ascii', 0, 4) !== 'RIFF') throw Error('Expected PCM WAV');
  while (offset + 8 <= b.length) {
    const id = b.toString('ascii', offset, offset + 4), size = b.readUInt32LE(offset + 4);
    if (id === 'fmt ') { format = b.readUInt16LE(offset + 8); channels = b.readUInt16LE(offset + 10); sampleRate = b.readUInt32LE(offset + 12); bits = b.readUInt16LE(offset + 22); }
    if (id === 'data') data = b.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  if (!data || format !== 1 || channels !== 1 || bits !== 16 || sampleRate !== rate) throw Error('Expected mono 22050 Hz 16-bit source');
  return Float64Array.from({ length: data.length / 2 }, (_, i) => data.readInt16LE(i * 2) / 32768);
}
function wav(samples) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((x, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x)) * 32767), 44 + i * 2));
  return b;
}
function processClip(source, speed, cutoff, echoDelay, echoGain) {
  const delay = Math.round(echoDelay * rate);
  const out = new Float64Array(Math.ceil(source.length / speed) + delay + Math.round(rate * 0.04));
  const alpha = 1 - Math.exp(-2 * Math.PI * cutoff / rate); let low = 0;
  for (let i = 0; i < Math.ceil(source.length / speed); i++) {
    const f = i * speed, index = Math.floor(f), frac = f - index;
    const x = (source[index] || 0) * (1 - frac) + (source[index + 1] || 0) * frac;
    low += alpha * (x - low); out[i] += low;
    if (delay) out[i + delay] += low * echoGain;
  }
  let peak = 0; for (const x of out) peak = Math.max(peak, Math.abs(x));
  const gain = peak ? 0.68 / peak : 0;
  for (let i = 0; i < out.length; i++) out[i] *= gain * Math.min(1, i / (rate * 0.002)) * Math.min(1, (out.length - 1 - i) / (rate * 0.02));
  return out;
}
const pop = readWav(path.join(dir, 'source-pop.wav'));
const pull = readWav(path.join(dir, 'source-pull.wav'));
const sounds = {
  launch: processClip(pop, 1.12, 2400, 0, 0),
  merge: processClip(pop, 0.72, 2000, 0.045, 0.10),
  detach: processClip(pull, 0.60, 2400, 0.032, 0.06),
  land: processClip(pop, 0.58, 1300, 0, 0)
};
for (const [name, samples] of Object.entries(sounds)) fs.writeFileSync(path.join(dir, name + '.wav'), wav(samples));
if (process.argv.includes('--demo')) {
  const timeline = [['launch', 0, 0.14], ['merge', 0.55, 0.52], ['launch', 1.2, 0.14], ['merge', 1.75, 0.52], ['detach', 2.5, 0.4], ['land', 3.35, 0.25]];
  const demo = new Float64Array(Math.round(rate * 4.3));
  timeline.forEach(([name, time]) => sounds[name].forEach((x, i) => { const at = Math.round(time * rate) + i; if (at < demo.length) demo[at] += x * volumes[name]; }));
  const output = path.join(__dirname, '../outputs'); fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, '音效试听-v2.wav'), wav(demo));
  fs.copyFileSync(path.join(dir, 'merge.wav'), path.join(output, '融合声-v2.wav'));
}
console.log('Generated v2 liquid sample effects from local reference excerpts.');
