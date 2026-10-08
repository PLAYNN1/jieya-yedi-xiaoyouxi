(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.YediObstacles=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Curated open layouts, then mirrored and varied. No layout seals the field.
  const layouts=[
    ['短横板',[[130,408,112,15]]],['方块',[[195,408,54,54]]],
    ['竖挡板',[[147,405,16,100]]],['高低横板',[[106,376,112,15],[284,465,100,15]]],
    ['双方块',[[112,396,48,48],[277,453,48,48]]],
    ['窄门',[[87,421,100,16],[303,421,100,16]]],
    ['转角',[[132,388,104,15],[177,428,15,65]]],
    ['错位竖板',[[119,383,16,81],[270,460,16,74]]],
    ['横板与方块',[[115,385,120,15],[279,461,51,51]]],
    ['阶梯',[[97,366,92,14],[195,422,82,14],[297,478,82,14]]],
    ['三点绕射',[[91,393,43,43],[292,393,43,43],[195,483,80,14]]],
    ['回折通道',[[115,365,125,14],[275,425,110,14],[130,486,100,14]]]
  ];
  function overlap(b,areas,pad){return areas.some(a=>a.x+a.w/2+pad>b.x-b.w/2&&a.x-a.w/2-pad<b.x+b.w/2&&a.y+a.h/2+pad>b.y-b.h/2&&a.y-a.h/2-pad<b.y+b.h/2);}
  class Director{
    constructor(random){this.random=random||Math.random;this.reset();}
    reset(){this.band=0;this.peak=0;this.active=[];this.pending=null;this.retired=[];this.name='自由滴落';this.lastLayout=-1;this.activeLayout=-1;this.time=0;}
    plan(band,areas){
      const limit=band===1?1:band<5?2:3;
      let choices=layouts.map((l,i)=>i).filter(i=>layouts[i][1].length<=limit&&(limit===1||layouts[i][1].length>=2)&&i!==this.lastLayout&&i!==this.activeLayout);
      // Pick a new arrangement with room for the existing suspension tree.
      for(let attempt=0;attempt<36;attempt++){
        const index=choices[Math.floor(this.random()*choices.length)],layout=layouts[index],mirror=this.random()<.5?-1:1;
        const dx=(this.random()-.5)*16,dy=(this.random()-.5)*20;
        const moving=band>=3&&this.random()<.65;
        const boards=layout[1].map((r,i)=>({x:195+(r[0]-195)*mirror+dx,y:r[1]+dy,w:r[2],h:r[3],baseX:195+(r[0]-195)*mirror+dx,amplitude:moving&&i===0?18:0,phase:this.random()*Math.PI*2,vx:0,flash:0}));
        if(!boards.some(b=>overlap(b,areas,10))){this.lastLayout=index;return {band,index,name:(moving?'游动 · ':'')+layout[0],boards,age:0};}
      }
      return null; // Wait for a clear space rather than creating a board inside a drop.
    }
    update(dt,score,areas,particles){
      this.time+=dt;this.peak=Math.max(this.peak,score||0);
      const desired=this.peak<300?0:1+Math.floor((this.peak-300)/500);
      this.retired.forEach(b=>b.fade-=dt);this.retired=this.retired.filter(b=>b.fade>0);
      let notice=null;
      if(desired>this.band&&(!this.pending||this.pending.band!==desired)){
        const plan=this.plan(desired,areas);
        if(plan){this.pending=plan;notice={name:plan.name,band:desired};}
      }
      if(this.pending){
        this.pending.age+=dt;
        const occupied=areas.concat(particles.map(s=>({x:s.x,y:s.y,w:2*s.r,h:2*s.r})));
        if(this.pending.age>=1.8&&!this.pending.boards.some(b=>overlap(b,occupied,8))){
          this.retired=this.active.map(b=>Object.assign({},b,{fade:.45}));this.active=this.pending.boards;this.band=this.pending.band;this.activeLayout=this.pending.index;this.name=this.pending.name;this.pending=null;
        }else if(this.pending.age>5&&this.pending.boards.some(b=>overlap(b,areas,8))){this.pending=null;}
      }
      for(const b of this.active){
        b.flash=Math.max(0,b.flash-dt*4);const previous=b.x;
        const target=b.baseX+b.amplitude*Math.sin(this.time*.9+b.phase),speed=b.amplitude*.9*dt;
        const next=b.x+Math.max(-speed,Math.min(speed,target-b.x));
        // Stop a moving board before it reaches an attached branch.
        if(!overlap(Object.assign({},b,{x:next}),areas,8))b.x=next;
        b.vx=(b.x-previous)/Math.max(dt,1e-6);
      }
      return notice;
    }
  }
  // Swept circle against faces and rounded corners; fast shots cannot tunnel.
  function sweep(s,dx,dy,b){
    const l=b.x-b.w/2,r=b.x+b.w/2,t=b.y-b.h/2,bottom=b.y+b.h/2;
    const qx=Math.max(l,Math.min(r,s.x)),qy=Math.max(t,Math.min(bottom,s.y));
    let nx=s.x-qx,ny=s.y-qy,d=Math.hypot(nx,ny),best=null;
    if(d<s.r-1e-5){
      if(d>1e-6)return {t:0,nx:nx/d,ny:ny/d,push:s.r-d};
      const faces=[[s.x-l,-1,0],[r-s.x,1,0],[s.y-t,0,-1],[bottom-s.y,0,1]].sort((a,b)=>a[0]-b[0]);
      return {t:0,nx:faces[0][1],ny:faces[0][2],push:s.r+faces[0][0]};
    }
    function offer(time,x,y){if(time>=-1e-8&&time<=1&&dx*x+dy*y<-1e-8&&(!best||time<best.t))best={t:Math.max(0,time),nx:x,ny:y,push:0};}
    if(dx>0){const time=(l-s.r-s.x)/dx,y=s.y+dy*time;if(y>=t&&y<=bottom)offer(time,-1,0);}
    if(dx<0){const time=(r+s.r-s.x)/dx,y=s.y+dy*time;if(y>=t&&y<=bottom)offer(time,1,0);}
    if(dy>0){const time=(t-s.r-s.y)/dy,x=s.x+dx*time;if(x>=l&&x<=r)offer(time,0,-1);}
    if(dy<0){const time=(bottom+s.r-s.y)/dy,x=s.x+dx*time;if(x>=l&&x<=r)offer(time,0,1);}
    const a=dx*dx+dy*dy;
    if(a>1e-10)for(const corner of [[l,t,-1,-1],[r,t,1,-1],[l,bottom,-1,1],[r,bottom,1,1]]){
      const px=s.x-corner[0],py=s.y-corner[1],bb=2*(px*dx+py*dy),cc=px*px+py*py-s.r*s.r,disc=bb*bb-4*a*cc;
      if(disc<0)continue;const time=(-bb-Math.sqrt(disc))/(2*a),x=px+dx*time,y=py+dy*time;
      if(x*corner[2]>=-1e-6&&y*corner[3]>=-1e-6)offer(time,x/s.r,y/s.r);
    }
    return best;
  }
  return {Director,sweep,layouts};
});
