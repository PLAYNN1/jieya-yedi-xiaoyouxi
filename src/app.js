(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./simulation'),require('./renderer'),require('./session'));
  else root.YediApp=factory(root.YediSimulation,root.YediRenderer,root.YediSession);
})(typeof globalThis!=='undefined'?globalThis:this,function(model,renderer,scoring){
  'use strict';
  function createApp(canvas,host){
    const c=canvas.getContext('2d');let saved;
    try{saved=scoring.readSave(host.load?host.load():null);}catch(_){saved=scoring.readSave(null);}
    const session=new scoring.Session('classic');
    const ui={muted:saved.muted,audioError:false,fps:60,panel:false,launchX:195,targetX:195,aiming:false,color:0,overlay:null,best:saved.best,records:saved.records,effects:[],toast:'',toastTime:0,debug:false,storageError:false,mixArmed:false};
    const random=host.random||Math.random;
    function randomColor(){const pool=session.unlocked;return pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];}
    function fillQueue(){ui.queue=[randomColor(),randomColor(),randomColor()];ui.color=ui.queue[0];}
    fillQueue();
    function persist(){try{if(host.save)host.save({version:1,best:ui.best,muted:ui.muted,records:ui.records});}catch(_){ui.storageError=true;}}
    const sim=new model.Simulation(null,(event,detail)=>{
      const points=session.event(event,detail);
      if(points){ui.effects.push({x:detail?detail.x:195,y:detail?detail.y+20:330,text:(points>0?'+':'')+points+(detail&&detail.count>1?' 连带'+detail.count:detail&&detail.obstacle>1?' 连环反弹':detail&&detail.obstacle?' 借板':detail&&detail.mixed?' 调色':detail&&detail.bank?' 借墙':''),age:0});
        if(session.mode==='classic'&&session.score>ui.best){ui.best=session.score;persist();}
        if(host.announce)host.announce('得分 '+session.score+'，连击 '+session.combo);
      }
      if(event==='obstacleChange')notify('障碍预告 · '+detail.name+'，虚线变实后反弹');
      else if(event==='overload')notify('超载崩落 · 扣分后继续，先清理再堆积');
      else if(session.lastGoalReward)notify('挑战完成 +'+session.lastGoalReward+' · 调色次数 +1');
      else if(session.lastUnlocked!=null)notify('解锁'+['蓝','黄','红','绿','紫','橙'][session.lastUnlocked]+'色 · 之后随机出滴也会出现');
      else if(event==='detach'&&detail&&detail.count>1)notify('切断上层，连带落下 '+detail.count+' 滴'+(detail.rescue?' · 救场奖励 +75':''));
      const sound=['attach','hang','coalesce'].includes(event)?'merge':['bounce','obstacleBounce'].includes(event)?'launch':event==='overload'?'detach':event;
      if(!ui.muted&&['launch','merge','detach','land'].includes(sound))host.sound(sound);
    });
    let width=390,height=844,dpr=1,scale=1,left=0,top=0,last=null,frame=null,running=false,frames=0,fpsTime=0,pressed=null;
    const active=()=>!ui.overlay;
    function notify(message){ui.toast=message;ui.toastTime=2.2;}
    function reset(mode){
      if(session.shots&&session.mode==='classic'){ui.records.unshift(session.summary());ui.records=ui.records.slice(0,5);}
      session.reset(mode||session.mode);sim.params=Object.assign({},model.DEFAULTS);sim.reset();
      sim.challenge=session.mode==='classic';ui.mixArmed=false;
      ui.effects=[];ui.overlay=null;ui.panel=false;ui.launchX=195;ui.targetX=195;fillQueue();cancel();host.stopAudio();persist();
    }
    function overlay(name){cancel();ui.overlay=name;ui.panel=name==='settings';host.stopAudio();last=null;draw();}
    function mute(){ui.muted=!ui.muted;if(ui.muted)host.stopAudio();persist();draw();}
    function fire(){
      if(!active())return false;host.unlockAudio();
      const mix=ui.mixArmed&&session.charges>0;
      const launched=sim.fire(ui.launchX,ui.targetX,ui.color,{mix});
      if(launched){if(mix)session.charges--;ui.mixArmed=false;ui.queue.shift();ui.queue.push(randomColor());ui.color=ui.queue[0];}
      return launched;
    }
    function armMix(){if(session.charges<=0){notify('落下累计 3 滴或完成挑战可补充调色');return;}ui.mixArmed=!ui.mixArmed;notify(ui.mixArmed?'下一发调色，射出即消耗 · 也可按 C 取消':'已取消调色');}
    function resize(w,h,ratio,safeTop,safeBottom){width=w;height=h;dpr=Math.min(ratio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
      scale=Math.min(w/390,(h-(safeTop||0)-(safeBottom||0))/844);left=(w-390*scale)/2;top=(safeTop||0)+(h-(safeTop||0)-(safeBottom||0)-844*scale)/2;draw();}
    function point(x,y){return {x:(x-left)/scale,y:(y-top)/scale};}
    function setSlider(i,x){const s=model.SPECS[i];sim.setParam(s.key,s.min+model.clamp((x-142)/183,0,1)*(s.max-s.min));}
    function down(x,y){
      const p=point(x,y);if(p.x<0||p.x>390||p.y<0||p.y>844)return;host.unlockAudio();
      if(ui.overlay){
        if(ui.overlay==='settings'){
          if(p.y>304&&p.y<348&&p.x>300){overlay(null);return;}
          if(p.y>364&&p.y<414){reset(session.mode==='classic'?'practice':'classic');notify(session.mode==='practice'?'练习模式 · 自由调节参数':'计分模式 · 标准物理');return;}
          if(session.mode==='practice'&&p.x>120&&p.x<352){for(let i=0;i<4;i++)if(Math.abs(p.y-(459+i*48))<20){pressed={slider:i};setSlider(i,p.x);return;}}
        }else if(ui.overlay==='restart'){
          if(p.y>524&&p.y<580){if(p.x<195)overlay(null);else reset();return;}
        }else if(p.y>620&&p.y<686){overlay(null);return;}
        return;
      }
      if(p.y>26&&p.y<76&&p.x>230){if(p.x<306)mute();else overlay('pause');return;}
      if(p.x>278&&p.y>680&&p.y<724){armMix();return;}
      if(p.y>753&&p.y<801){if(p.x<140)overlay('help');else if(p.x>264)overlay('restart');else overlay('settings');return;}
      if(p.y>305&&p.y<674){
        ui.launchX=model.clamp(p.x,55,335);ui.targetX=sim.aim(p.x);ui.aiming=true;
        pressed={x:p.x,y:p.y,dragged:false,age:0,repeating:false,since:0};
      }
    }
    function move(x,y){if(!pressed)return;const p=point(x,y);if(pressed.slider!=null){setSlider(pressed.slider,p.x);return;}
      if(Math.hypot(p.x-pressed.x,p.y-pressed.y)>9)pressed.dragged=true;
      if(pressed.dragged)ui.targetX=sim.aim(ui.launchX+(p.x-ui.launchX)*411/Math.max(90,640-p.y),false);
    }
    function up(){if(pressed&&pressed.slider==null&&!pressed.repeating)fire();cancel();}
    function cancel(){pressed=null;ui.aiming=false;}
    function draw(){c.setTransform(1,0,0,1,0,0);c.fillStyle='#edf3f1';c.fillRect(0,0,canvas.width,canvas.height);
      c.setTransform(dpr*scale,0,0,dpr*scale,dpr*left,dpr*top);c.save();c.beginPath();c.rect(0,0,390,844);c.clip();renderer.render(c,sim,ui,model.SPECS,session,model);c.restore();}
    function tick(timestamp){if(!running)return;const now=Number.isFinite(timestamp)?timestamp:Date.now();const dt=last==null?0:model.clamp((now-last)/1000,0,.1);last=now;
      if(active()){
        if(pressed&&pressed.slider==null&&!pressed.dragged){pressed.age+=dt;pressed.since+=dt;if(pressed.age>.38&&pressed.since>.28){pressed.repeating=true;fire();pressed.since=0;}}
        sim.progress=Math.max(session.peakScore,session.score);sim.update(dt);session.elapsed+=dt;ui.effects.forEach(e=>e.age+=dt);ui.effects=ui.effects.filter(e=>e.age<1.05);ui.toastTime=Math.max(0,ui.toastTime-dt);
      }
      frames++;fpsTime+=dt;if(fpsTime>=.5){ui.fps=Math.round(frames/fpsTime);frames=0;fpsTime=0;}draw();frame=host.requestFrame(tick);
    }
    function start(){if(!running){running=true;last=null;frame=host.requestFrame(tick);}}
    function pause(){running=false;if(frame!=null)host.cancelFrame(frame);frame=null;last=null;cancel();host.stopAudio();persist();}
    function key(key){
      if(key==='m'){mute();return;}
      if(key==='escape'){overlay(ui.overlay?null:'pause');return;}
      if(key==='p'){overlay(ui.overlay==='settings'?null:'settings');return;}
      if(key==='h'){overlay(ui.overlay==='help'?null:'help');return;}
      if(key==='r'){overlay('restart');return;}
      if(key==='c'&&active()){armMix();return;}
      if(key===' '){if(ui.overlay&&ui.overlay!=='restart')overlay(null);else fire();}
    }
    return {sim,session,ui,resize,down,move,up,cancel,draw,start,pause,fire,key,reset,mute,overlay,view:()=>({width,height,scale,left,top,dpr})};
  }
  return {createApp};
});
