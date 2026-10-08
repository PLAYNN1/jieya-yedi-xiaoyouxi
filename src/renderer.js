(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.YediRenderer=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const BLUE='#298be8',INK='#253e4b',MUTED='#82959d';
  function text(c,str,x,y,size,color,align){c.fillStyle=color||INK;c.font=size+'px sans-serif';c.textAlign=align||'left';c.fillText(String(str),x,y);}
  function line(c,x1,y1,x2,y2,color,width){c.strokeStyle=color;c.lineWidth=width||1;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
  function circle(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,Math.max(.01,r),0,Math.PI*2);c.fill();}
  function box(c,x,y,w,h,color,r){r=r||14;c.fillStyle=color;c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.fill();}
  function button(c,label,x,y,w,primary){box(c,x,y,w,48,primary?INK:'#edf3f1',12);text(c,label,x+w/2,y+30,13,primary?'#fff':INK,'center');}
  function fillParts(c,parts,x1,y1,w,h,model){
    const total=parts.reduce((sum,p)=>sum+p.mass,0)||1;let x=x1;
    for(let i=0;i<parts.length;i++){
      const width=w*parts[i].mass/total;c.fillStyle=model.color(parts[i].pigment);c.fillRect(x,y1,width+.3,h);
      if(i)line(c,x,y1,x,y1+h,'rgba(37,62,75,0.35)',1);
      x+=width;
    }
  }
  function drop(c,sim,d,model){
    const g=sim.geometry(d),x=g.x,y=g.y,w=g.width,h=g.height,p=g.pinch;
    if(g.hanging){
      const neck=w*Math.max(.06,.30-p*.26);
      c.fillStyle=model.color(d.pigment);c.beginPath();c.moveTo(x-neck,y);c.lineTo(x+neck,y);
      c.bezierCurveTo(x+neck,y+h*.24,x+w,y+h*.32,x+w*.95,y+h*.64);
      c.bezierCurveTo(x+w*.92,y+h*.88,x+w*.45,y+h,x,y+h);
      c.bezierCurveTo(x-w*.45,y+h,x-w*.92,y+h*.88,x-w*.95,y+h*.64);
      c.bezierCurveTo(x-w,y+h*.32,x-neck,y+h*.24,x-neck,y);c.closePath();c.fill();
      line(c,x-neck,y+1,x+neck,y+1,'rgba(37,62,75,0.4)',.8);return;
    }
    c.fillStyle=model.color(d.pigment);c.beginPath();c.moveTo(x-w,sim.lineY(x-w));c.bezierCurveTo(x-w*.5,y,x+w*.5,y,x+w,sim.lineY(x+w));
    if(p<.18){c.bezierCurveTo(x+w,y+h*.55,x+w*.55,y+h,x,y+h);c.bezierCurveTo(x-w*.55,y+h,x-w,y+h*.55,x-w,sim.lineY(x-w));}
    else{
      const neck=w*Math.max(.025,1-Math.pow(p,1.5)),shoulder=y+h*.23,belly=y+h*.72;
      c.bezierCurveTo(x+w*.8,y+h*.06,x+neck,y+h*.12,x+neck,shoulder);
      c.bezierCurveTo(x+neck,y+h*.43,x+w*1.10,y+h*.48,x+w*.78,belly);
      c.bezierCurveTo(x+w*.66,y+h*.94,x+w*.37,y+h,x,y+h);
      c.bezierCurveTo(x-w*.37,y+h,x-w*.66,y+h*.94,x-w*.78,belly);
      c.bezierCurveTo(x-w*1.10,y+h*.48,x-neck,y+h*.43,x-neck,shoulder);
      c.bezierCurveTo(x-neck,y+h*.12,x-w*.8,y+h*.06,x-w,sim.lineY(x-w));
    }c.closePath();c.fill();
    if(d.parts.length>1){c.save();c.clip();fillParts(c,d.parts,x-w*1.15,y-40,w*2.3,h+80,model);c.restore();}
  }
  function obstacle(c,b,ghost,alpha){
    c.save();c.globalAlpha=alpha==null?1:alpha;
    if(b.amplitude){line(c,b.baseX-b.amplitude,b.y,b.baseX+b.amplitude,b.y,'#d6dfdb',2);}
    if(ghost){
      c.setLineDash([4,5]);c.strokeStyle='#8fa29b';c.lineWidth=1.5;c.strokeRect(b.x-b.w/2,b.y-b.h/2,b.w,b.h);
    }else{
      box(c,b.x-b.w/2,b.y-b.h/2,b.w,b.h,b.flash?'#9aafa6':'#c9d5d0',3);
      line(c,b.x-b.w/2+4,b.y-b.h/2+3,b.x+b.w/2-4,b.y-b.h/2+3,'#eef4f0',1);
      if(b.amplitude){text(c,'↔',b.x,b.y+4,11,'#6c8579','center');}
    }
    c.restore();
  }
  function render(c,sim,ui,specs,session,model){
    c.fillStyle='#f7faf9';c.fillRect(0,0,390,844);
    text(c,'Y E D I',28,53,13);text(c,ui.muted?'静音':'音量',275,53,12,INK,'center');text(c,'暂停',340,53,12,INK,'center');circle(c,253,48,2.5,ui.muted?'#b4c0c4':BLUE);
    text(c,session.mode==='practice'?'自由练习':'此刻的积累',28,87,11,MUTED);
    const score=String(session.score);text(c,score,27,136,score.length>9?32:43);
    text(c,'个人最高',362,100,10,MUTED,'right');text(c,session.mode==='classic'?ui.best:'—',362,128,19,INK,'right');
    box(c,28,155,112,28,'#e9f2f4',8);text(c,'连击 '+session.combo+'   ×'+session.multiplier,84,174,11,INK,'center');
    text(c,session.mode==='practice'?'自由调参 · 不计纪录':'异色往下挂，同色找角度',362,174,10,MUTED,'right');
    const pressure=Math.min(1,sim.pressure),warning=pressure>.78,goal=session.goal();
    line(c,28,195,362,195,'#e6edeb',3);line(c,28,195,28+334*pressure,195,warning?'#c78274':'#9bb9b8',3);
    text(c,'挑战 · '+goal.label+' '+session.goalProgress+'/'+goal.target,28,213,10,MUTED);
    text(c,session.mode==='practice'?'承重 '+Math.round(pressure*100)+'% · 不惩罚':sim.pressure>=1?'超载 · 再射 '+(3-sim.overloadStrikes)+' 滴将崩落':'承重 '+Math.round(pressure*100)+'%',362,213,10,warning?'#b16c60':MUTED,'right');
    sim.obstacles.retired.forEach(b=>obstacle(c,b,false,b.fade/.45*.45));
    sim.obstacles.active.forEach(b=>obstacle(c,b,false));
    if(sim.obstacles.pending)sim.obstacles.pending.boards.forEach(b=>obstacle(c,b,true,.65+.25*Math.sin(sim.t*5)));
    sim.drops.forEach(d=>drop(c,sim,d,model));
    if(sim.pressure>.68){c.save();c.setLineDash([3,8]);line(c,28,520,362,520,'#d3b6ae');c.restore();text(c,'拥挤线',362,513,9,'#b89b94','right');}
    c.strokeStyle='#436779';c.lineWidth=1.7;c.lineJoin='round';c.beginPath();
    for(let i=0;i<65;i++){const x=28+334*i/64,y=229+sim.nodes[i];if(!i)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();circle(c,28,229,3,'#436779');circle(c,362,229,3,'#436779');
    for(const s of sim.shots){c.save();c.translate(s.x,s.y);c.scale(.9*(1-(s.squash||0)*.23),1.12*(1+(s.squash||0)*.23));circle(c,0,0,s.r,model.color(s.pigment));c.restore();}
    for(const effect of sim.wallEffects){c.save();c.globalAlpha=(1-effect.age/.35)*.5;line(c,effect.x,effect.y-7-effect.age*20,effect.x,effect.y+7+effect.age*20,'#829fae',3);c.restore();}
    for(const f of sim.falling){const stretch=1+.28*Math.exp(-f.age*3)*Math.cos(f.age*13);c.save();c.translate(f.x,f.y);c.scale(1/stretch,stretch);circle(c,0,0,f.r,model.color(f.pigment));if(f.parts.length>1){c.clip();fillParts(c,f.parts,-f.r,-f.r,2*f.r,2*f.r,model);}c.restore();}
    line(c,54,591,336,591,'#e6eeec');
    for(const r of sim.ripples){c.save();c.globalAlpha=(1-r.age/1.2)*.36;c.strokeStyle=r.color;c.lineWidth=1.3;c.beginPath();c.ellipse(r.x,591,9+r.age*46,2+r.age*7,0,0,Math.PI*2);c.stroke();c.restore();}
    for(const e of ui.effects){c.save();c.globalAlpha=Math.max(0,1-e.age/1.05);text(c,e.text,e.x,e.y-e.age*34,13,INK,'center');c.restore();}
    text(c,'已落下 '+session.drops+' 滴',28,548,11,MUTED);
    text(c,Math.floor(session.elapsed/60)+' 分 '+Math.floor(session.elapsed%60)+' 秒',362,548,11,MUTED,'right');
    const field=sim.obstacles,band=field.pending?field.pending.band:field.band,start=300+(band-1)*500;
    text(c,band?(field.pending?'即将换场 · ':start+'–'+(start+499)+' · ')+(field.pending?field.pending.name:field.name):'300 分起 · 随机障碍',195,575,10,MUTED,'center');
    if(ui.aiming){const points=sim.trajectory(ui.launchX,ui.targetX);c.save();c.setLineDash([3,7]);c.strokeStyle='#a9cde9';c.lineWidth=1;c.beginPath();points.forEach((p,i)=>{if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);});c.stroke();c.restore();const end=points[points.length-1];circle(c,end.x,end.y,3,'#a9cde9');}
    c.strokeStyle='#d2e4ef';c.lineWidth=1;c.beginPath();c.arc(ui.launchX,640,24,0,Math.PI*2);c.stroke();
    circle(c,ui.launchX,640,sim.params.shotRadius,'rgb('+model.PALETTE[ui.color].join(',')+')');
    text(c,'随机出滴',195,684,11,MUTED,'center');
    text(c,'接下来',170,713,10,MUTED,'right');
    ui.queue.slice(1).forEach((index,i)=>circle(c,195+i*29,709,8,'rgb('+model.PALETTE[index].join(',')+')'));
    box(c,283,685,79,35,ui.mixArmed?'#dcece5':'#eaf0ed',10);text(c,(ui.mixArmed?'已准备 ':'调色 ')+session.charges,322,707,11,session.charges?INK:MUTED,'center');
    text(c,ui.toastTime>0?ui.toast:'线下调位置 · 线上瞄准，松手发射',195,738,11,MUTED,'center');
    line(c,28,753,362,753,'#e1e9e7');
    text(c,'玩法',65,784,12);text(c,'设置',195,784,12);text(c,'重新开始',326,784,12,INK,'center');
    text(c,'慢慢来。每一滴，都有回响。',195,824,10,MUTED,'center');
    if(ui.audioError&&!ui.muted)text(c,'声音暂不可用',362,811,9,MUTED,'right');
    if(ui.storageError)text(c,'浏览器未允许保存纪录',28,811,9,MUTED);
    if(ui.debug)text(c,ui.fps+' FPS',362,208,10,MUTED,'right');
    if(ui.overlay){
      c.fillStyle='rgba(238,244,241,0.82)';c.fillRect(0,196,390,648);
      if(ui.overlay==='volume'){
        box(c,24,360,342,258,'#fff',20);text(c,'音效音量',40,400,21);text(c,'关闭',330,399,12,INK,'center');
        text(c,'音量',40,438,12,MUTED);text(c,Math.round(ui.volume*100)+'%'+(ui.muted?' · 静音':''),347,438,13,INK,'right');
        line(c,62,480,328,480,'#e1e9e7',5);line(c,62,480,62+266*ui.volume,480,BLUE,5);circle(c,62+266*ui.volume,480,10,BLUE);
        text(c,'0',62,508,10,MUTED,'center');text(c,'100',328,508,10,MUTED,'center');
        button(c,ui.muted?'恢复声音':'静音',40,525,146,false);button(c,'完成',204,525,146,true);
        text(c,'拖动滑块，松手试听 · 自动保存',195,599,11,MUTED,'center');
      }else if(ui.overlay==='settings'){
        box(c,20,292,350,450,'#fff',20);text(c,'设置',40,332,20);text(c,'完成',330,330,12,INK,'center');
        button(c,session.mode==='classic'?'进入练习 · 重新开始':'回到计分 · 重新开始',38,364,314,false);
        text(c,session.mode==='classic'?'计分使用标准物理，练习可自由调节':'练习分数不写入个人最高',40,437,11,MUTED);
        specs.forEach((s,i)=>{const y=459+i*48,v=sim.params[s.key],enabled=session.mode==='practice';
          text(c,s.name,40,y+4,11,enabled?INK:MUTED);line(c,142,y,325,y,'#dfe8e6',3);
          line(c,142,y,142+(v-s.min)/(s.max-s.min)*183,y,enabled?BLUE:'#b7c7c9',3);circle(c,142+(v-s.min)/(s.max-s.min)*183,y,6,enabled?BLUE:'#b7c7c9');
          text(c,(s.key==='threshold'||s.key==='damping'?v.toFixed(2):Math.round(v))+s.unit,325,y+21,10,MUTED,'right');
        });
        line(c,40,644,350,644,'#edf2f0');text(c,'最近记录',40,670,11,MUTED);
        const records=ui.records.slice(0,3);text(c,records.length?records.map(r=>r.score+' 分').join('   /   '):'下一次重新开始时留下记录',40,696,12,INK);
        text(c,'右上角音量可调节，M 快捷静音',40,724,10,MUTED);
      }else if(ui.overlay==='restart'){
        box(c,24,319,342,284,'#fff',20);text(c,'重新开始这一场？',195,371,22,INK,'center');
        text(c,'当前 '+session.score+' 分',195,419,18,INK,'center');text(c,'最高分会保留，本场计分存入最近记录。',195,454,11,MUTED,'center');
        button(c,'继续玩',40,524,146,false);button(c,'重新开始',204,524,146,true);
      }else{
        box(c,24,294,342,420,'#fff',20);
        if(ui.overlay==='help'){
          text(c,'让每一滴，慢慢汇合',40,336,21);
          const lines=['线下调位置不发射；线上瞄准松手发射。','同色融合，异色下挂；切断带落整支。','调色 / C：下一发可混合两种三原色。','落下每 3 滴或完成挑战可补充调色。','300 分起，每增 500 分随机换障碍。','虚线是预告，实心挡板可以借力反弹。','借板命中 +15，连续借板再加 +10。','超载再射 3 滴将崩落扣分，仍可继续。'];
          lines.forEach((s,i)=>text(c,s,40,379+i*28,12,i===7?INK:MUTED));
        }else{
          text(c,'停一下，也很好',40,340,24);text(c,session.score,40,412,43);text(c,'分',142,410,13,MUTED);
          text(c,'落下 '+session.drops+' 滴 · 最高连击 '+session.maxCombo,40,458,13,MUTED);
          text(c,'这一场可以一直继续。',40,509,12,MUTED);text(c,'空格继续 · M 静音 · H 查看玩法',40,548,11,MUTED);
        }
        button(c,'继续滴落',40,632,310,true);
      }
    }
  }
  return {render};
});
