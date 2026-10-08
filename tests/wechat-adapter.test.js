'use strict';
// A contract smoke test, NOT the real WeChat simulator. Runs the unmodified
// native entry with explicit wx stubs and the actual shared app implementation.
const assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs');
const { createApp } = require('../src/app');
const handlers = {}, audios = [], pendingFrames = new Map();
let app, nextFrame = 1, cancelled = 0;
const ctx = new Proxy({}, { get(target, key) { return target[key] || (() => {}); } });
const canvas = { width: 0, height: 0, getContext(type) { assert.equal(type, '2d'); return ctx; } };
const wx = {
  createCanvas: () => canvas,
  createInnerAudioContext() {
    const a = { stops: 0, plays: 0, onError(fn) { this.error = fn; }, stop() { this.stops++; }, play() { this.plays++; } };
    audios.push(a); return a;
  },
  getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 3, safeArea: { top: 47, bottom: 810 } }),
  getMenuButtonBoundingClientRect: () => ({ bottom: 80 })
};
['TouchStart', 'TouchMove', 'TouchEnd', 'TouchCancel', 'Hide', 'Show', 'WindowResize'].forEach(name => { wx['on' + name] = fn => { handlers[name] = fn; }; });
const sandbox = {
  wx, console,
  require(name) {
    if (name === './src/audio-config') return require('../src/audio-config');
    assert.equal(name, './src/app'); return { createApp: (c, host) => { app = createApp(c, host); return app; } };
  },
  requestAnimationFrame(fn) { const id = nextFrame++; pendingFrames.set(id, fn); return id; },
  cancelAnimationFrame(id) { cancelled++; pendingFrames.delete(id); }
};
vm.runInNewContext(fs.readFileSync(require.resolve('../game.js'), 'utf8'), sandbox, { filename: 'game.js' });
assert.equal(audios.length, 12); assert.equal(canvas.width, 780, 'DPR capped at 2');
assert.equal(audios[0].volume, 0.14); assert.equal(audios[3].volume, 0.52);
assert.equal(app.view().top, 88, 'capsule safe area reserved');
const view = app.view(), point = { identifier: 1, clientX: view.left + 195 * view.scale, clientY: view.top + 400 * view.scale };
handlers.TouchStart({ changedTouches: [point] });
handlers.TouchStart({ changedTouches: [{ ...point, identifier: 2 }] });
handlers.TouchEnd({ changedTouches: [{ ...point, identifier: 2 }] });
assert.equal(app.sim.shots.length, 0, 'secondary finger cannot end primary gesture');
handlers.TouchEnd({ changedTouches: [point] }); assert.equal(app.sim.shots.length, 1);
assert(audios.some(a => a.plays === 1));
for (let i = 0; i < 100; i++) {
  const [id, fn] = pendingFrames.entries().next().value;
  pendingFrames.delete(id); fn(i * 1000 / 60);
}
assert.equal(app.sim.hits, 1);
handlers.Hide(); assert.equal(pendingFrames.size, 0); assert(cancelled > 0);
handlers.Show(); assert.equal(pendingFrames.size, 1);
handlers.WindowResize(); app.draw();
handlers.TouchStart({ changedTouches: [point] }); handlers.TouchCancel();
const before = app.sim.stats.emittedMass; handlers.TouchEnd({ changedTouches: [point] });
assert.equal(app.sim.stats.emittedMass, before, 'cancelled touches do not launch');
handlers.Hide();
console.log('PASS: native entry loads without DOM, local audio pool, safe area, DPR cap, single touch, merge, cancel, resize, hide/show. This is an API-stub test, not WeChat runtime verification.');
