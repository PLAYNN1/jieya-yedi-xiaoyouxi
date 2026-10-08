'use strict';
const assert=require('node:assert/strict');
const {Session,readSave}=require('../src/session');
const {Simulation,color,partType}=require('../src/simulation');
const s=new Session();
for(let i=0;i<6;i++)s.event('merge');
assert.equal(s.score,70);assert.equal(s.multiplier,2);
assert.equal(s.event('merge',{mixed:true}),25);
assert.equal(s.event('coalesce'),40);
assert.equal(s.event('detach'),100);
s.event('miss',{released:true});assert.equal(s.combo,7);
s.event('miss');assert.equal(s.combo,0);assert.equal(s.multiplier,1);assert.equal(s.score,235);
assert.equal(readSave({version:1,best:NaN}).best,0);
assert.deepEqual(readSave(null).records,[]);
const sim=new Simulation();
function advance(t){for(let i=0;i<Math.round(t*120);i++)sim.update(1/120);}
sim.fire(195,195,1,{mix:true});advance(.8);
assert(sim.primary.pigment[0]>0&&sim.primary.pigment[1]>0);
assert.notEqual(color(sim.primary.pigment),color([1,0,0]));
assert.equal(partType(sim.primary.parts[0].pigment),3);
sim.fire(195,195,2);advance(.8);assert.equal(sim.drops.length,2,'red hangs below green');
assert.equal(sim.drops[1].parentId,sim.primary.id);assert(sim.geometry(sim.drops[1]).bottom>sim.geometry(sim.primary).bottom);
sim.fire(70,70,2);advance(.8);assert.equal(sim.drops.length,3);
assert(sim.drops.some(d=>d.pigment[2]>0));
assert(Math.abs(sim.snapshot().expectedMass-sim.snapshot().accountedMass)<1e-6);
// Two nearby anchors coalesce without losing mass or either pigment.
sim.drops=[sim.makeDrop(180,500,[500,0,0]),sim.makeDrop(200,500,[500,0,0])];
advance(.02);assert.equal(sim.drops.length,1);assert.equal(sim.mass,1000);assert.deepEqual(sim.primary.pigment,[1000,0,0]);
console.log('PASS: score, combo, mixed-color bonus, missed/interrupted shots, save validation, multi-attachment and coalescence.');
