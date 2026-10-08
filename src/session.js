(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YediSession = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const valid = x => Number.isSafeInteger(x) && x >= 0 ? x : 0;
  class Session {
    constructor(mode) { this.reset(mode); }
    reset(mode) {
      this.mode = mode === 'practice' ? 'practice' : 'classic';
      this.score = 0; this.peakScore = 0; this.obstacleHits = 0; this.combo = 0; this.maxCombo = 0; this.multiplier = 1;
      this.shots = 0; this.hits = 0; this.misses = 0; this.drops = 0; this.elapsed = 0;
      this.charges=1;this.chargeProgress=0;this.bankHits=0;this.overloads=0;this.goalIndex=0;this.goalProgress=0;this.lastGoalReward=0;
      this.unlocked=[0,1,2];this.lastUnlocked=null;
    }
    goal(){const index=this.goalIndex%3,cycle=Math.floor(this.goalIndex/3);return index===0?{kind:'bank',target:Math.min(5,3+cycle),label:'借墙命中'}:index===1?{kind:'cascade',target:Math.min(5,3+cycle),label:'一次带落'}:{kind:'mix',target:1,label:'成功调色'};}
    event(name, detail) {
      detail=detail||{};this.lastGoalReward=0;this.lastUnlocked=null;
      let points = 0;
      if (name === 'launch') this.shots++;
      if(name==='hang'||name==='attach'){this.hits++;points=2;if(name==='hang'){this.combo=0;this.multiplier=1;}}
      if (name === 'merge') {
        this.hits++; this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.multiplier = Math.min(5, 1 + Math.floor((this.combo - 1) / 5));
        points = 10 * this.multiplier + (detail && detail.mixed ? 5 : 0);
        if(detail.mixed&&[3,4,5].includes(detail.resultType)&&!this.unlocked.includes(detail.resultType)){this.unlocked.push(detail.resultType);this.lastUnlocked=detail.resultType;}
      }
      if (name === 'detach') {
        const count=detail.count||1;this.drops+=count;
        points=50*this.multiplier+Math.max(0,count-1)*25+(detail.rescue?75:0);
        this.chargeProgress+=count;this.charges=Math.min(3,this.charges+Math.floor(this.chargeProgress/3));this.chargeProgress%=3;
      }
      if (name === 'coalesce') points = 20 * this.multiplier;
      if (name === 'miss' && !(detail && detail.released)) { this.misses++; this.combo = 0; this.multiplier = 1; }
      if(['merge','hang','attach'].includes(name)&&detail.bank){this.bankHits++;points+=10;}
      if(['merge','hang','attach'].includes(name)&&detail.obstacle>0){this.obstacleHits++;points+=15+(detail.obstacle>=2?10:0);}
      if(name==='overload'){this.overloads++;this.combo=0;this.multiplier=1;points=-Math.min(200,Math.max(30,Math.ceil(this.score*.15)));}
      const goal=this.goal();
      if(goal.kind==='bank'&&['merge','hang','attach'].includes(name)&&detail.bank)this.goalProgress++;
      if(goal.kind==='cascade'&&name==='detach')this.goalProgress=Math.max(this.goalProgress,detail.count||1);
      if(goal.kind==='mix'&&name==='merge'&&detail.mixed)this.goalProgress++;
      if(this.goalProgress>=goal.target){this.lastGoalReward=[80,120,100][this.goalIndex%3];points+=this.lastGoalReward;this.charges=Math.min(3,this.charges+1);this.goalIndex++;this.goalProgress=0;}
      this.score = Math.max(0,Math.min(Number.MAX_SAFE_INTEGER, this.score + points));
      this.peakScore = Math.max(this.peakScore,this.score);
      return points;
    }
    summary() {
      return { score: this.score, drops: this.drops, maxCombo: this.maxCombo, hits: this.hits,
        shots: this.shots, elapsed: Math.round(this.elapsed), mode: this.mode,bankHits:this.bankHits,obstacleHits:this.obstacleHits,overloads:this.overloads,challenges:this.goalIndex };
    }
  }
  function readSave(data) {
    if (!data || typeof data !== 'object' || data.version !== 1) return { version: 1, best: 0, muted: false, volume: 1, records: [] };
    const volume=Number.isFinite(data.volume)&&data.volume>=0&&data.volume<=1?data.volume:1;
    return { version: 1, best: valid(data.best), muted: data.muted === true||volume===0, volume,
      records: Array.isArray(data.records) ? data.records.slice(0, 5).filter(r => r && r.mode === 'classic').map(r => ({
        score: valid(r.score), drops: valid(r.drops), maxCombo: valid(r.maxCombo), hits: valid(r.hits), shots: valid(r.shots), elapsed: valid(r.elapsed), mode: 'classic'
      })) : [] };
  }
  return { Session, readSave };
});
