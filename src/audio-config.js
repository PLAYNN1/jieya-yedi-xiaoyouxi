(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YediAudio = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return Object.freeze({ launch: 0.14, merge: 0.52, detach: 0.40, land: 0.25 });
});
