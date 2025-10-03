(() => {
  const canvas = document.getElementById('nebulaCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let w = canvas.width = innerWidth, h = canvas.height = innerHeight;
  const particles = [];
  function rand(a,b){return Math.random()*(b-a)+a}
  for(let i=0;i<Math.round((w*h)/90000);i++) particles.push({x:rand(0,w),y:rand(0,h),r:rand(0.6,2.6),vx:rand(-0.15,0.15),vy:rand(-0.05,0.05),hue:rand(180,280),alpha:rand(0.06,0.22)});
  addEventListener('resize',()=>{w=canvas.width=innerWidth;h=canvas.height=innerHeight});
  function draw(){
    ctx.clearRect(0,0,w,h);
    const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'rgba(10,6,24,0.6)');g.addColorStop(1,'rgba(6,12,30,0.6)');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    for(const p of particles){
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<-50)p.x=w+50; if(p.x>w+50)p.x=-50;
      if(p.y<-50)p.y=h+50; if(p.y>h+50)p.y=-50;
      ctx.beginPath();
      const grd=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*12);
      grd.addColorStop(0,`hsla(${p.hue},80%,65%,${p.alpha})`);
      grd.addColorStop(0.4,`hsla(${p.hue},70%,45%,${p.alpha*0.8})`);
      grd.addColorStop(1,`hsla(${p.hue},70%,30%,0)`);
      ctx.fillStyle=grd; ctx.arc(p.x,p.y,p.r*12,0,Math.PI*2); ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
})();
