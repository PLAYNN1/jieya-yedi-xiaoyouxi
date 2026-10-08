(function () {
  'use strict';
  const canvas = document.getElementById('game'), stage = document.getElementById('stage');
  const buffers = {}, sources = new Set();
  let audioContext = null,masterGain = null;
  function setVolume(value) { if(masterGain)masterGain.gain.setTargetAtTime(value,audioContext.currentTime,.015); }
  function stopAudio() { sources.forEach(s => { try { s.stop(); } catch (_) {} }); sources.clear(); }
  const app = YediApp.createApp(canvas, {
    load: () => JSON.parse(localStorage.getItem('yedi-save-v1') || 'null'),
    save: data => localStorage.setItem('yedi-save-v1', JSON.stringify(data)),
    announce: message => { const status = document.getElementById('status'); if (status) status.textContent = message; },
    requestFrame: callback => requestAnimationFrame(callback), cancelFrame: id => cancelAnimationFrame(id), stopAudio, setVolume,
    unlockAudio: function () {
      if (!audioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) { app.ui.audioError = true; return; }
        audioContext = new AudioContext();
        masterGain=audioContext.createGain();masterGain.gain.value=app.ui.muted?0:app.ui.volume;masterGain.connect(audioContext.destination);
        ['launch', 'merge', 'detach', 'land'].forEach(name => {
          fetch('audio/' + name + '.wav').then(r => {
            if (!r.ok) throw Error('Audio unavailable'); return r.arrayBuffer();
          }).then(b => audioContext.decodeAudioData(b)).then(b => { buffers[name] = b; }).catch(() => { app.ui.audioError = true; });
        });
      }
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => { app.ui.audioError = true; });
    },
    sound: function (name,volume) {
      if (!audioContext || !buffers[name] || audioContext.state !== 'running') return;
      setVolume(Number.isFinite(volume)?volume:1);
      const source = audioContext.createBufferSource(), gain = audioContext.createGain();
      source.buffer = buffers[name]; gain.gain.value = YediAudio[name];
      source.connect(gain); gain.connect(masterGain); sources.add(source);
      source.onended = () => { sources.delete(source); source.disconnect(); gain.disconnect(); }; source.start();
    }
  });
  function fit() { app.resize(stage.clientWidth, stage.clientHeight, window.devicePixelRatio); }
  function local(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  let activePointer = null;
  canvas.addEventListener('pointerdown', e => {
    if (activePointer != null) return; activePointer = e.pointerId;
    canvas.setPointerCapture(e.pointerId); app.down(...local(e)); e.preventDefault();
  });
  canvas.addEventListener('pointermove', e => { if (e.pointerId === activePointer) app.move(...local(e)); });
  canvas.addEventListener('pointerup', e => { if (e.pointerId === activePointer) { app.up(...local(e)); activePointer = null; } });
  function cancelPointer(e) { if (e.pointerId === activePointer) { app.cancel(); activePointer = null; } }
  canvas.addEventListener('pointercancel', cancelPointer);
  canvas.addEventListener('lostpointercapture', cancelPointer);
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.code === 'Space') e.preventDefault();
    if (e.key.toLowerCase() === 'f') app.ui.debug = !app.ui.debug;
    app.key(e.key.toLowerCase());
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { app.pause(); activePointer = null; } else app.start(); });
  window.addEventListener('resize', fit);
  window.addEventListener('blur', () => { app.cancel(); activePointer = null; });
  window.addEventListener('pagehide', () => app.pause());
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.yedi = app; fit(); app.start();
})();
