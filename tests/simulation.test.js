'use strict';
const assert = require('node:assert/strict');
const { Simulation, SPECS } = require('../src/simulation');
function advance(sim, seconds, frame) { for (let t = 0; t < seconds - 1e-9; t += frame || 1 / 60) sim.update(Math.min(frame || 1 / 60, seconds - t)); }
function finite(sim) {
  for (const x of [...sim.nodes, ...sim.velocities, sim.mass, sim.visualMass, sim.deform, sim.sway]) assert(Number.isFinite(x));
  assert(sim.snapshot().displacement < 150, 'membrane must remain bounded');
  assert(Math.abs(sim.snapshot().accountedMass - sim.snapshot().expectedMass) < 1e-6, 'area mass must be conserved');
}
const events = [];
const sim = new Simulation(null, name => events.push(name));
assert.equal(sim.geometry().height, 26);
assert(sim.fire()); assert(!sim.fire(), 'rate limit'); advance(sim, 0.8);
assert.equal(sim.hits, 1); assert(sim.mass > sim.initialMass); finite(sim);
for (let i = 0; i < 5; i++) { sim.fire(); advance(sim, 0.8); }
assert(sim.phase === 'stretch' || sim.releases > 0, 'threshold should trigger elongation');
advance(sim, 3);
assert.equal(sim.releases, 1); assert(events.includes('detach')); assert(events.includes('land'));
assert.equal(sim.phase, 'attached'); finite(sim);
assert(sim.mass < sim.initialMass, 'residue should seed next round');
const remaining = sim.mass;
sim.fire(55, 355); sim.shots[0].vy = 1000; advance(sim, 3);
assert.equal(sim.mass, remaining, 'aimed miss should not merge');
assert(sim.stats.lostMass > 0); finite(sim);
// Load removal excites a local wave which subsequently decays.
const wave = new Simulation(); advance(wave, 3); wave.mass = 0; wave.impulse(-48, 195);
advance(wave, 0.1); const early = wave.snapshot().displacement;
advance(wave, 6); assert(wave.snapshot().displacement < early * 0.05, 'wave must decay');
// Fixed timestep should produce the same result across rendering rates.
const a = new Simulation(), b = new Simulation(); a.fire(); b.fire();
advance(a, 2, 1 / 30); advance(b, 2, 1 / 120);
assert.equal(a.hits, b.hits); assert(Math.abs(a.nodes[32] - b.nodes[32]) < 1e-7);
// Worst-case controls + sustained fire over 90 simulated seconds.
for (const extreme of [0, 1]) {
  const stress = new Simulation();
  SPECS.forEach(s => stress.setParam(s.key, extreme ? s.max : s.min));
  for (let frame = 0; frame < 5400; frame++) {
    if (frame % 16 === 0) stress.fire(55 + (frame % 280), 195);
    stress.update(1 / 60); if (frame % 60 === 0) finite(stress);
  }
  assert(stress.releases > 3); assert(stress.shots.length <= 16); finite(stress);
}
sim.setParam('threshold', 999); assert.equal(sim.params.threshold, 3.6);
sim.reset(); assert.equal(sim.hits, 0); assert.equal(sim.releases, 0); assert.equal(sim.shots.length, 0); assert.equal(sim.mass, sim.initialMass);
console.log('PASS: merge, threshold, detach, gravity, wave decay, miss, area conservation, frame-rate independence, parameter extremes, reset.');
