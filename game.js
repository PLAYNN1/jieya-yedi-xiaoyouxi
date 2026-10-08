'use strict';
// Native WeChat Mini Game entry. No DOM / browser adapter / npm build needed.
const createApp = require('./src/app').createApp;
const volumes = require('./src/audio-config');
const canvas = wx.createCanvas();
const pools = {}, indices = {};
let audioFailed = false;
['launch', 'merge', 'detach', 'land'].forEach(name => {
  pools[name] = [];
  for (let i = 0; i < 3; i++) {
    try {
      const audio = wx.createInnerAudioContext();
      audio.src = 'audio/' + name + '.wav'; audio.volume = volumes[name];
      audio.onError(err => { audioFailed = true; console.warn('[YEDI audio]', name, err.errMsg); });
      pools[name].push(audio);
    } catch (e) { audioFailed = true; console.warn('[YEDI audio]', e.message); }
  }
  indices[name] = 0;
});
function stopAudio() { Object.keys(pools).forEach(k => pools[k].forEach(a => a.stop())); }
const app = createApp(canvas, {
  load: () => wx.getStorageSync ? wx.getStorageSync('yedi-save-v1') : null,
  save: data => { if (wx.setStorageSync) wx.setStorageSync('yedi-save-v1', data); },
  requestFrame: callback => requestAnimationFrame(callback),
  cancelFrame: id => cancelAnimationFrame(id),
  unlockAudio: function () { app.ui.audioError = audioFailed; },
  stopAudio,
  sound: function (name) {
    const pool = pools[name]; if (!pool || !pool.length || audioFailed) return;
    const audio = pool[indices[name]++ % pool.length]; audio.stop(); audio.play();
  }
});
function fit() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const safe = info.safeArea;
  let safeTop = safe ? safe.top : 0;
  // Reserve space for WeChat's top-right capsule when present.
  if (wx.getMenuButtonBoundingClientRect) {
    const menu = wx.getMenuButtonBoundingClientRect();
    if (menu && menu.bottom > 0) safeTop = Math.max(safeTop, menu.bottom + 8);
  }
  const bottom = safe ? Math.max(0, info.windowHeight - safe.bottom) : 0;
  app.resize(info.windowWidth, info.windowHeight, info.pixelRatio, safeTop, bottom);
}
let activeTouch = null;
wx.onTouchStart(event => {
  if (activeTouch != null || !event.changedTouches.length) return;
  const p = event.changedTouches[0]; activeTouch = p.identifier;
  app.down(p.clientX, p.clientY);
});
wx.onTouchMove(event => {
  const p = event.touches.find(t => t.identifier === activeTouch); if (p) app.move(p.clientX, p.clientY);
});
wx.onTouchEnd(event => {
  if (event.changedTouches.some(t => t.identifier === activeTouch)) { app.up(); activeTouch = null; }
});
wx.onTouchCancel(() => { app.cancel(); activeTouch = null; });
wx.onHide(() => { app.pause(); activeTouch = null; });
wx.onShow(() => { fit(); app.start(); });
if (wx.onWindowResize) wx.onWindowResize(fit);
fit(); app.start();
console.info('[YEDI] Native Canvas prototype ready. Tap below the drop to launch.');
