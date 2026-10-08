/* Fixed-step area-mass model. Different materials hang as separate nodes of
 * a suspension tree: the first surface hit occludes everything behind it. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./obstacles'));else root.YediSimulation=factory(root.YediObstacles);
})(typeof globalThis!=='undefined'?globalThis:this,function(obstacles){
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const DEFAULTS=Object.freeze({threshold:2.35,tension:150,damping:4.6,shotRadius:12,gravity:700});
  const PALETTE=[[41,139,232],[231,200,95],[223,106,102],[84,165,132],[153,126,191],[231,158,83]];
  const SPECS=[{key:'threshold',name:'脱落阈值',min:1.6,max:3.6,unit:'×'},{key:'tension',name:'膜线张力',min:70,max:230,unit:''},{key:'damping',name:'振动阻尼',min:2,max:9,unit:''},{key:'shotRadius',name:'小滴大小',min:9,max:15,unit:''}];
  function partType(p){const a=p.map((v,i)=>v>1e-6?i:-1).filter(i=>i>=0);return a.length===1?a[0]:a.length===2?(a[0]===0?(a[1]===1?3:4):5):6;}
  function color(p){const type=partType(p),rgb=type<3?PALETTE[type]:type===3?[84,165,132]:type===4?[153,126,191]:type===5?[231,158,83]:[138,145,139];return 'rgb('+rgb.join(',')+')';}
  function joinParts(parts,incoming){let mixed=false;for(const p of incoming){const type=partType(p.pigment);let target=parts.find(a=>partType(a.pigment)===type);if(!target&&type<3){target=parts.find(a=>partType(a.pigment)<3);mixed=!!target||mixed;}if(target){target.mass+=p.mass;target.pigment=target.pigment.map((v,i)=>v+p.pigment[i]);}else parts.push({mass:p.mass,pigment:p.pigment.slice()});}return mixed;}
  class Simulation{
    constructor(params,onEvent){this.params=Object.assign({},DEFAULTS,params);this.onEvent=onEvent||(()=>{});this.challenge=true;this.reset();}
    makeDrop(x,mass,pigment,parentId,offset){return {id:this.nextId++,x,mass,seedMass:mass,visualMass:mass,pigment:pigment.slice(),parts:[{mass,pigment:pigment.slice()}],parentId:parentId||null,offset:offset||0,phase:'attached',phaseTime:0,deform:0,deformV:0,sway:0,swayV:0,loadMass:mass};}
    reset(){
      this.t=0;this.accumulator=0;this.shots=[];this.falling=[];this.ripples=[];this.wallEffects=[];this.nextId=1;this.bounces=0;this.progress=0;this.obstacles=new obstacles.Director();
      this.nodes=new Float64Array(65);this.velocities=new Float64Array(65);this.initialMass=676;this.drops=[this.makeDrop(195,676,[676,0,0])];
      this.cooldown=0;this.hits=0;this.releases=0;this.pressure=0;this.overloadStrikes=0;this.pendingOverload=false;this.overloads=0;
      this.stats={emittedMass:0,lostMass:0,drainedMass:0,steps:0};
      for(let pass=0;pass<240;pass++)for(let i=1;i<64;i++)this.nodes[i]=(this.load(i)+this.params.tension*28*(this.nodes[i-1]+this.nodes[i+1]))/(55+2*this.params.tension*28);
    }
    get primary(){return this.drops[0];}get mass(){return this.drops.reduce((a,d)=>a+d.mass,0);}set mass(v){if(this.primary)this.primary.mass=v;}
    get visualMass(){return this.primary?this.primary.visualMass:0;}get phase(){return this.primary?this.primary.phase:'attached';}get phaseTime(){return this.primary?this.primary.phaseTime:0;}get deform(){return this.primary?this.primary.deform:0;}get sway(){return this.primary?this.primary.sway:0;}
    setParam(key,value){const s=SPECS.find(s=>s.key===key);if(s&&Number.isFinite(value))this.params[key]=clamp(value,s.min,s.max);}
    branch(d){const list=[d],seen=new Set([d.id]);for(let i=0;i<list.length;i++)for(const child of this.drops)if(child.parentId===list[i].id&&!seen.has(child.id)){seen.add(child.id);list.push(child);}return list;}
    parent(d){return d.parentId==null?null:this.drops.find(p=>p.id===d.parentId);}
    root(d){let count=0,p;while((p=this.parent(d))&&count++<64)d=p;return d;}
    depth(d){let n=0;while(this.parent(d)&&n<64){d=this.parent(d);n++;}return n;}
    lineY(x){const f=clamp((x-28)/334*64,0,64),i=Math.floor(f);return 229+this.nodes[i]*(1-(f-i))+this.nodes[Math.min(64,i+1)]*(f-i);}
    load(i){return this.drops.filter(d=>!d.parentId).reduce((sum,d)=>sum+850*d.loadMass/676*Math.exp(-Math.pow((i-(d.x-28)/334*64)/7,2)),0);}
    impulse(amount,x){const center=(x-28)/334*64;for(let i=1;i<64;i++)this.velocities[i]+=amount*Math.exp(-Math.pow((i-center)/3.6,2));}
    geometry(d,depth){
      d=d||this.primary;if(!d)return {x:195,y:229,r:0,width:0,height:0,pinch:0,bottom:229};
      const parent=(depth||0)<64?this.parent(d):null,pg=parent?this.geometry(parent,(depth||0)+1):null;
      const r=Math.sqrt(Math.max(1,d.visualMass)),p=d.phase==='stretch'?clamp(d.phaseTime/1.05,0,1):0;
      const x=pg?clamp(pg.x+d.offset*pg.width*.72+d.sway,18,372):d.x+d.sway;
      const y=pg?pg.bottom-4:this.lineY(d.x),height=r*(pg?1.65:1)*(1-d.deform*.3)+p*p*(pg?55:82);
      return {x,y,r,width:r*(pg?.79:1)*(1+d.deform*.24)*(1-p*.1),height,pinch:p,bottom:y+height,hanging:!!pg};
    }
    aim(x){return clamp(x,-600,990);}
    shotPlan(startX,targetX){
      const x=clamp(startX==null?195:startX,55,335),target=clamp(targetX==null?195:targetX,-600,990),r=this.params.shotRadius;
      const span=390-2*r,mod=((target-r)%(2*span)+2*span)%(2*span),folded=r+(mod>span?2*span-mod:mod);
      // Aim is purely ballistic. It never selects or steers toward a drop.
      return {x,y:640,r,target:folded,vx:(target-x)/.57,vy:(245+r-640-.5*this.params.gravity*.57*.57)/.57};
    }
    trajectory(startX,targetX){const s=this.shotPlan(startX,targetX),points=[{x:s.x,y:s.y}],dt=1/120;for(let i=0;i<150;i++){s.vy+=this.params.gravity*dt;this.travel(s,dt,null,true,points);points.push({x:s.x,y:s.y});if(s.y<235||s.y>690)break;}return points;}
    travel(s,dt,segment,preview,points){
      let remaining=dt;
      for(let iteration=0;iteration<6&&remaining>1e-7;iteration++){
        const dx=s.vx*remaining,dy=s.vy*remaining;let hit=null;
        if(s.x<s.r)hit={t:0,nx:1,ny:0,wall:0,push:s.r-s.x};
        else if(s.x>390-s.r)hit={t:0,nx:-1,ny:0,wall:390,push:s.x-(390-s.r)};
        else if(dx<0&&s.x+dx<s.r)hit={t:Math.max(0,(s.r-s.x)/dx),nx:1,ny:0,wall:0};
        else if(dx>0&&s.x+dx>390-s.r)hit={t:Math.max(0,(390-s.r-s.x)/dx),nx:-1,ny:0,wall:390};
        for(const b of this.obstacles.active){const h=obstacles.sweep(s,dx,dy,b);if(h&&(!hit||h.t<hit.t))hit=Object.assign(h,{board:b});}
        const fraction=hit?hit.t:1,x=s.x+dx*fraction,y=s.y+dy*fraction;
        if(segment&&segment(s.x,s.y,x,y))return true;
        s.x=x;s.y=y;if(!hit)break;
        if(points)points.push({x:s.x,y:s.y});
        s.x+=hit.nx*((hit.push||0)+.02);s.y+=hit.ny*((hit.push||0)+.02);
        const surfaceV=hit.board?hit.board.vx||0:0,dot=(s.vx-surfaceV)*hit.nx+s.vy*hit.ny;
        if(dot<0){s.vx-=1.92*dot*hit.nx;s.vy-=1.92*dot*hit.ny;}
        s.squash=1;
        if(hit.board){
          s.obstacleBounces=(s.obstacleBounces||0)+1;
          // Detached drops roll toward the nearer edge instead of resting on a board.
          if(s.mass&&s.age!=null&&!s.pigmentShot&&hit.ny<-.5&&Math.abs(s.vx)<65)s.vx=(s.x<hit.board.x?-1:1)*85;
          if(!preview){hit.board.flash=1;this.onEvent('obstacleBounce',{x:s.x,y:s.y});}
        }else{
          s.bounces=(s.bounces||0)+1;
          if(!preview){this.bounces++;this.wallEffects.push({x:hit.wall,y:s.y,age:0});this.onEvent('bounce',{x:hit.wall,y:s.y});}
        }
        remaining*=1-fraction;
      }
      return false;
    }
    shotContact(s,surfaces,x0,y0,x1,y1){
      if(s.vy>=0)return false;
      const samples=Math.max(1,Math.ceil(Math.hypot(x1-x0,y1-y0)/3));
      for(let k=0;k<=samples;k++){
        const x=x0+(x1-x0)*k/samples,y=y0+(y1-y0)*k/samples;
        for(const item of surfaces){const g=item.g;if(y<g.y-s.r*.2)continue;
          const cy=g.y+g.height*(g.hanging?.55:.25),ry=g.height*(g.hanging?.5:.75)+s.r;
          if(Math.pow((x-g.x)/(g.width+s.r*.8),2)+Math.pow((y-cy)/ry,2)<=1){s.x=x;s.y=y;return this.catchShot(item.d,s);}
        }
        if(y-s.r<=this.lineY(x)&&y>180&&x>=38&&x<=352&&this.drops.length<64){
          s.x=x;s.y=y;const near=this.drops.filter(d=>!d.parentId).find(d=>Math.abs(d.x-x)<Math.sqrt(d.mass)+s.r);
          if(near)return this.catchShot(near,s);
          const d=this.makeDrop(clamp(x,42,348),s.mass,s.pigment);d.deformV=5;this.drops.push(d);this.hits++;this.impulse(-44,d.x);
          this.onEvent('attach',{x:d.x,y:this.geometry(d).bottom,bank:s.bounces>0,obstacle:s.obstacleBounces||0});return true;
        }
      }
      return false;
    }
    reflect(s){let wall=null;if(s.x<s.r){s.x=2*s.r-s.x;s.vx=Math.abs(s.vx)*.92;wall=0;}else if(s.x>390-s.r){s.x=2*(390-s.r)-s.x;s.vx=-Math.abs(s.vx)*.92;wall=390;}return wall;}
    rebound(s){const wall=this.reflect(s);if(wall!=null){s.squash=1;s.bounces=(s.bounces||0)+1;this.bounces++;this.wallEffects.push({x:wall,y:s.y,age:0});this.onEvent('bounce',{x:wall,y:s.y});}}
    fire(startX,targetX,pigment,options){
      if(this.cooldown>0||this.shots.length>=16)return false;
      const plan=this.shotPlan(startX,targetX),mass=2*plan.r*plan.r,p=[0,0,0],type=clamp(Math.round(pigment||0),0,5);
      if(type<3)p[type]=mass;else{const pair=type===3?[0,1]:type===4?[0,2]:[1,2];p[pair[0]]=mass/2;p[pair[1]]=mass/2;}
      this.shots.push(Object.assign({},plan,{prevX:plan.x,prevY:plan.y,mass,pigment:p,pigmentShot:true,age:0,squash:0,bounces:0,obstacleBounces:0,mix:!!(options&&options.mix)}));
      this.stats.emittedMass+=mass;this.cooldown=.26;
      if(this.challenge&&this.pressure>=1){this.overloadStrikes++;if(this.overloadStrikes>=3)this.pendingOverload=true;}
      this.onEvent('launch');return true;
    }
    update(elapsed){this.accumulator+=clamp(elapsed,0,.1);const dt=1/120;while(this.accumulator+1e-10>=dt){this.step(dt);this.accumulator-=dt;}}
    catchShot(d,s){
      const same=partType(d.pigment)===partType(s.pigment),canMix=s.mix&&partType(d.pigment)<3&&partType(s.pigment)<3&&!same;
      if(same||canMix){
        d.mass+=s.mass;d.pigment=d.pigment.map((v,i)=>v+s.pigment[i]);d.parts=[{mass:d.mass,pigment:d.pigment.slice()}];d.deformV+=7;
        d.swayV+=clamp((s.x-this.geometry(d).x)*1.1,-28,28);this.hits++;this.impulse(-62,this.root(d).x);
        this.onEvent('merge',{x:this.geometry(d).x,y:this.geometry(d).bottom,mixed:canMix,resultType:partType(d.pigment),bank:s.bounces>0,obstacle:s.obstacleBounces||0});return true;
      }
      if(this.drops.length>=64||this.depth(d)>=14){s.vy=Math.abs(s.vy)*.45;s.vx+=s.x<this.geometry(d).x?-80:80;s.squash=1;return false;}
      const g=this.geometry(d),offset=clamp((s.x-g.x)/Math.max(1,g.width),-.85,.85);
      const child=this.makeDrop(g.x,s.mass,s.pigment,d.id,offset);child.deformV=4;child.swayV=clamp(s.vx*.1,-28,28);this.drops.push(child);this.hits++;
      this.impulse(-36,this.root(d).x);this.onEvent('hang',{x:g.x,y:this.geometry(child).bottom,bank:s.bounces>0,obstacle:s.obstacleBounces||0});return true;
    }
    mergeInto(d,mass,pigment,x){return this.catchShot(d,{mass,pigment,x,bounces:0,mix:false,vx:0});}
    detachBranch(d,overload){
      const group=this.branch(d),ids=new Set(group.map(n=>n.id)),root=this.root(d),keepRoot=!d.parentId;
      const rescue=!overload&&this.pressure>.78,share=keepRoot?Math.min(.32*676/d.mass,.8):0;
      const rootX=root.x,positions=group.map(n=>({d:n,g:this.geometry(n)}));
      for(const {d:n,g} of positions){
        const fraction=n===d?1-share:1,mass=n.mass*fraction,pigment=n.pigment.map(v=>v*fraction);
        if(mass>0)this.falling.push({x:g.x,y:g.bottom-Math.sqrt(mass/2),vx:d.swayV*.15,vy:65,mass,r:Math.sqrt(mass/2),pigment,parts:[{mass,pigment}],age:0});
      }
      this.drops=this.drops.filter(n=>!ids.has(n.id)||(keepRoot&&n===d));
      if(keepRoot){d.mass*=share;d.visualMass=d.mass;d.pigment=d.pigment.map(v=>v*share);d.parts=[{mass:d.mass,pigment:d.pigment.slice()}];d.phase='regrow';d.phaseTime=0;d.deform=-.35;d.deformV=0;}
      this.shots.forEach(s=>{if(Math.abs(s.x-rootX)<80)s.released=true;});
      this.impulse(overload?-170:-130,rootX);this.overloadStrikes=0;
      if(overload){this.overloads++;this.onEvent('overload',{x:rootX,y:positions[0].g.bottom,count:group.length});}
      else{this.releases+=group.length;this.onEvent('detach',{x:positions[0].g.x,y:positions[0].g.bottom,count:group.length,rescue});}
    }
    step(dt){
      this.t+=dt;this.stats.steps++;this.cooldown=Math.max(0,this.cooldown-dt);const p=this.params;
      for(const d of this.drops)if(!d.parentId)d.loadMass=this.branch(d).reduce((sum,n)=>sum+n.mass,0);
      for(let i=1;i<64;i++){const curve=this.nodes[i-1]+this.nodes[i+1]-2*this.nodes[i];this.velocities[i]+=(this.load(i)-55*this.nodes[i]+p.tension*28*curve-p.damping*.72*this.velocities[i])*dt;}
      for(let i=1;i<64;i++)this.nodes[i]+=this.velocities[i]*dt;
      for(const d of this.drops){d.phaseTime+=dt;d.visualMass+=(d.mass-d.visualMass)*(1-Math.exp(-12*dt));d.deformV+=(-110*d.deform-8*d.deformV)*dt;d.deform=clamp(d.deform+d.deformV*dt,-.9,.9);d.swayV+=(-65*d.sway-5*d.swayV)*dt;d.sway+=d.swayV*dt;}
      const areas=this.drops.map(d=>{const g=this.geometry(d);return {x:g.x,y:g.y+g.height/2,w:g.width*2,h:g.height};});
      const notice=this.obstacles.update(dt,this.progress,areas,this.shots.concat(this.falling));
      if(notice)this.onEvent('obstacleChange',notice);
      // Test surfaces in travel order, not array order: a lower child blocks its parent.
      for(let i=this.shots.length-1;i>=0;i--){
        const surfaces=this.drops.map(d=>({d,g:this.geometry(d)})).sort((a,b)=>b.g.bottom-a.g.bottom);
        const s=this.shots[i];s.age+=dt;s.squash=Math.max(0,s.squash-dt*7);s.prevX=s.x;s.prevY=s.y;s.vy+=p.gravity*dt;
        if(this.travel(s,dt,(x0,y0,x1,y1)=>this.shotContact(s,surfaces,x0,y0,x1,y1),false))this.shots.splice(i,1);
        else if(s.y>870||s.age>3){this.stats.lostMass+=s.mass;this.onEvent('miss',{released:s.released===true});this.shots.splice(i,1);}
      }
      // Only compatible roots coalesce automatically. Heterogeneous roots remain separate.
      const roots=this.drops.filter(d=>!d.parentId);
      for(let i=roots.length-1;i>=0;i--)for(let j=i-1;j>=0;j--){
        const a=roots[j],b=roots[i];if(!this.drops.includes(a)||!this.drops.includes(b)||a.phase!=='attached'||b.phase!=='attached')continue;
        const gap=Math.abs(a.x-b.x),r=Math.sqrt(a.mass)+Math.sqrt(b.mass),sign=Math.sign(b.x-a.x)||1;
        if(gap<r*.8&&partType(a.pigment)===partType(b.pigment)){
          a.x=(a.x*a.mass+b.x*b.mass)/(a.mass+b.mass);a.mass+=b.mass;a.pigment=a.pigment.map((v,k)=>v+b.pigment[k]);a.parts=[{mass:a.mass,pigment:a.pigment.slice()}];a.deformV+=5;
          this.drops.forEach(n=>{if(n.parentId===b.id)n.parentId=a.id;});this.drops=this.drops.filter(n=>n!==b);this.onEvent('coalesce',{x:a.x,y:this.geometry(a).bottom});break;
        }else if(gap<r*.8){const push=Math.min(1,(r*.8-gap)*dt*8);a.x=clamp(a.x-sign*push,42,348);b.x=clamp(b.x+sign*push,42,348);}
      }
      // A successful dye reaction can make adjacent materials identical again.
      for(const d of this.drops.slice()){
        const parent=this.parent(d);
        if(parent&&d.phase==='attached'&&parent.phase==='attached'&&partType(parent.pigment)===partType(d.pigment)){
          parent.mass+=d.mass;parent.pigment=parent.pigment.map((v,k)=>v+d.pigment[k]);parent.parts=[{mass:parent.mass,pigment:parent.pigment.slice()}];parent.deformV+=5;
          this.drops.forEach(child=>{if(child.parentId===d.id)child.parentId=parent.id;});this.drops=this.drops.filter(n=>n!==d);this.onEvent('coalesce',{x:this.geometry(parent).x,y:this.geometry(parent).bottom});
        }
      }
      for(const d of this.drops.slice()){
        if(!this.drops.includes(d))continue;
        if(d.phase==='attached'&&d.mass>=d.seedMass*p.threshold){d.phase='stretch';d.phaseTime=0;}
        else if(d.phase==='stretch'&&d.phaseTime>=1.05)this.detachBranch(d,false);
        else if(d.phase==='regrow'&&d.phaseTime>=.7){d.phase='attached';d.phaseTime=0;}
      }
      let bottom=250;this.drops.forEach(d=>{bottom=Math.max(bottom,this.geometry(d).bottom);});this.pressure=Math.max(this.mass/10500,(bottom-250)/270);
      if(this.pressure<.9)this.overloadStrikes=0;
      if(this.pendingOverload){this.pendingOverload=false;if(this.pressure>=1&&this.challenge){const heaviest=this.drops.filter(d=>!d.parentId).sort((a,b)=>this.branch(b).reduce((s,n)=>s+n.mass,0)-this.branch(a).reduce((s,n)=>s+n.mass,0))[0];if(heaviest)this.detachBranch(heaviest,true);}}
      for(let i=this.falling.length-1;i>=0;i--){const f=this.falling[i];f.age+=dt;f.vy+=p.gravity*dt;this.travel(f,dt,null,false);if(f.y+f.r>591){this.stats.drainedMass+=f.mass;this.falling.splice(i,1);this.ripples.push({x:f.x,y:591,age:0,color:color(f.pigment)});this.onEvent('land');}}
      this.ripples.forEach(r=>r.age+=dt);this.ripples=this.ripples.filter(r=>r.age<1.2);this.wallEffects.forEach(r=>r.age+=dt);this.wallEffects=this.wallEffects.filter(r=>r.age<.35);
    }
    snapshot(){return {phase:this.phase,hits:this.hits,releases:this.releases,mass:this.mass,shots:this.shots.length,falling:this.falling.length,attachments:this.drops.length,bounces:this.bounces,pressure:this.pressure,overloads:this.overloads,maxDepth:Math.max(0,...this.drops.map(d=>this.depth(d))),displacement:Math.max(...Array.from(this.nodes,Math.abs)),accountedMass:this.mass+this.shots.reduce((a,s)=>a+s.mass,0)+this.falling.reduce((a,f)=>a+f.mass,0)+this.stats.lostMass+this.stats.drainedMass,expectedMass:676+this.stats.emittedMass};}
  }
  return {Simulation,DEFAULTS,SPECS,PALETTE,color,partType,joinParts,clamp};
});
