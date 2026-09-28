// ===== Patternflow pattern =====
// Title:    Midnight Clocktower
// Author:   @engmung
// Date:     2026-09-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Zoom=1..3.5, ClockSpeed=-3..5, Wind=-10..10, Light=0..1
// @matrix 64x128
// Pattern: Midnight Clocktower



const TAU = Math.PI * 2;
const INK = [0,0,0], STONE = [9,9,9], SHADE = [23,23,23];
const EDGE = [83,83,83], SILVER = [173,173,173], WHITE = [229,229,222];
const GOLD = [242,146,29], WARM = [255,204,76];
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const mix = (a,b,t) => a+(b-a)*t;
const fract = x => x-Math.floor(x);
function hash(n) { return fract(Math.sin(n*127.1+311.7)*43758.5453); }
function grey(n) { return [n,n,n]; }

export function setup(p) {
  p.t=0; p.zoom=1; p.hours=10+1/6; p.clockSpeed=1; p.wind=.18; p.light=.32;
  p.auto=true; p.zoomHome=false; p.gust=0; p.beacon=0; p.drift=0; p.flow=.18;
  p.last=null;

  p.birds = [
    { x: -10, y: 25, baseSpeed: 7, waveFreq: 1.2, waveAmp: 2.0, flapSpeed: 8.5 },
    { x: 15,  y: 42, baseSpeed: 9, waveFreq: 0.9, waveAmp: 1.5, flapSpeed: 9.2 },
    { x: 45,  y: 58, baseSpeed: 6, waveFreq: 1.5, waveAmp: 2.8, flapSpeed: 7.8 },
    { x: 70,  y: 73, baseSpeed: 8, waveFreq: 1.1, waveAmp: 1.8, flapSpeed: 8.8 }
  ];
}

export function update(dt,input,p) {
  dt=clamp(Number.isFinite(dt)?dt:0,0,.05);
  const v=input&&input.knobValues, pressed=input&&input.btnPressed;
  if(v) {
    p.last=v.slice(0,4);
    const ease=1-Math.exp(-dt*5);
    p.zoom=mix(p.zoom,p.zoomHome?1:clamp(v[0],1,3.5),ease);
    p.clockSpeed=mix(p.clockSpeed,v[1],ease);
    p.wind=mix(p.wind,v[2],ease);
    p.light=mix(p.light,clamp(v[3],0,1),ease);
  }
  if(pressed) {
    if(pressed[0]) p.zoomHome=true;
    if(pressed[1]) p.auto=!p.auto;
    if(pressed[2]) p.gust=3.8;
    if(pressed[3]) p.beacon=4;
  }
  p.t+=dt;
  
  if(p.auto) {
    p.hours = (p.hours + (dt / 120) * p.clockSpeed) % 24;
    if(p.hours < 0) p.hours += 24;
  }

  p.gust=Math.max(0,p.gust-dt);
  p.beacon=Math.max(0,p.beacon-dt);
  p.flow=p.wind+(p.wind<0?-1:1)*Math.sin(p.gust/3.8*Math.PI)*.9;
  p.drift+=dt*p.flow;

  if (p.birds) {
    for (let i = 0; i < p.birds.length; i++) {
      const b = p.birds[i];
      const currentSpeed = b.baseSpeed + p.flow * 10;
      b.x += currentSpeed * dt;

      if (currentSpeed >= 0 && b.x > 84) {
        b.x = -20;
      } else if (currentSpeed < 0 && b.x < -20) {
        b.x = 84;
      }
    }
  }
}

function projection(p,x,y,depth) {
  const z=1+(p.zoom-1)*depth;
  const cy=64+(p.cameraY-64)*depth;
  return [(32+(x-32)*z)*p.sx,(64+(y-cy)*z)*p.sy];
}

function pixel(p,x,y,c) {
  x=Math.floor(x);y=Math.floor(y);
  if(x<0||y<0||x>=p.w||y>=p.h)return;
  const i=(y*p.w+x)*3;
  p.rgb[i]=c[0];p.rgb[i+1]=c[1];p.rgb[i+2]=c[2];
}

function rect(p,x,y,w,h,c,depth=1) {
  const a=projection(p,x,y,depth),b=projection(p,x+w,y+h,depth);
  const x0=Math.max(0,Math.round(a[0])),x1=Math.min(p.w,Math.round(b[0]));
  const y0=Math.max(0,Math.round(a[1])),y1=Math.min(p.h,Math.round(b[1]));
  for(let yy=y0;yy<y1;yy++)for(let xx=x0;xx<x1;xx++)pixel(p,xx,yy,c);
}

function poly(p,points,c,depth=1) {
  const pts=points.map(a=>projection(p,a[0],a[1],depth));
  const ymin=Math.max(0,Math.floor(Math.min(...pts.map(a=>a[1]))));
  const ymax=Math.min(p.h,Math.ceil(Math.max(...pts.map(a=>a[1]))));
  for(let y=ymin;y<ymax;y++) {
    const hits=[],cy=y+.5;
    for(let i=0,j=pts.length-1;i<pts.length;j=i++) {
      const a=pts[i],b=pts[j];
      if((a[1]>cy)!==(b[1]>cy))hits.push(a[0]+(cy-a[1])*(b[0]-a[0])/(b[1]-a[1]));
    }
    hits.sort((a,b)=>a-b);
    for(let i=0;i+1<hits.length;i+=2)for(let x=Math.max(0,Math.ceil(hits[i]-.5));x<Math.min(p.w,hits[i+1]-.5);x++)pixel(p,x,y,c);
  }
}

function stroke(p,x1,y1,x2,y2,c,width=.55,depth=1) {
  const a=projection(p,x1,y1,depth),b=projection(p,x2,y2,depth);
  const size=Math.max(1,Math.round(width*(1+(p.zoom-1)*depth)*Math.min(p.sx,p.sy)));
  const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));
  for(let i=0;i<=n;i++) {
    const x=Math.round(mix(a[0],b[0],i/n)),y=Math.round(mix(a[1],b[1],i/n));
    for(let dy=0;dy<size;dy++)for(let dx=0;dx<size;dx++)pixel(p,x+dx-(size>>1),y+dy-(size>>1),c);
  }
}

function ellipse(p,x,y,rx,ry,c,depth=1) {
  const a=projection(p,x,y,depth),z=1+(p.zoom-1)*depth;
  rx*=z*p.sx;ry*=z*p.sy;
  for(let yy=Math.max(0,Math.ceil(a[1]-ry));yy<=Math.min(p.h-1,Math.floor(a[1]+ry));yy++) {
    const v=(yy-a[1])/ry;if(Math.abs(v)>1)continue;
    const span=rx*Math.sqrt(1-v*v);
    for(let xx=Math.max(0,Math.ceil(a[0]-span));xx<=Math.min(p.w-1,Math.floor(a[0]+span));xx++)pixel(p,xx,yy,c);
  }
}

function arch(p,x,y,w,h,c,depth=1) {
  poly(p,[[x,y+h],[x,y+w*.45],[x+w*.23,y+w*.14],[x+w*.5,y],[x+w*.77,y+w*.14],[x+w,y+w*.45],[x+w,y+h]],c,depth);
}

function lit(p,id) {
  const threshold=[1,3,4].includes(id) ? .12+id*.025 : hash(id+41)*.88+.04;
  return p.light>threshold || p.beacon>1;
}

function window(p,x,y,w,h,id,depth=1) {
  arch(p,x-.45,y-.6,w+.9,h+.9,EDGE,depth);
  arch(p,x,y,w,h,INK,depth);
  if(lit(p,id)) {
    arch(p,x+.5,y+.65,w-1,h-1,GOLD,depth);
    rect(p,x+w*.52,y+1.3,w*.19,h-1.8,WARM,depth);
  } else if(p.zoom>1.5) {
    stroke(p,x+.5,y+1.2,x+.5,y+h-1,SHADE,.3,depth);
  }
  stroke(p,x+w*.5,y+.5,x+w*.5,y+h,INK,.42,depth);
  stroke(p,x+.2,y+h*.58,x+w-.2,y+h*.58,INK,.45,depth);
  rect(p,x-.6,y+h,w+1.2,.55,SILVER,depth);
}

function cloud(p,x,y,size,light,depth=.28) {
  const outline=[[-17,2],[-13,1],[-11,-1],[-8,0],[-7,-3],[-4,-2],[-3,-5],[0,-4],[2,-1],[5,-2],[7,0],[10,0],[12,2],[18,3],[11,4],[7,5],[1,4],[-3,6],[-8,5],[-12,3]];
  const pts=outline.map(([xx,yy])=>[x+xx*size,y+yy*size]);
  poly(p,pts,grey(light),depth);
  const ridge=[[-15,2],[-10,1],[-8,-1],[-6,0],[-3,-3],[0,-2],[2,0],[6,0],[9,2]];
  for(let i=1;i<ridge.length;i++)stroke(p,x+ridge[i-1][0]*size,y+ridge[i-1][1]*size,x+ridge[i][0]*size,y+ridge[i][1]*size,grey(light+19),.45,depth);
}

function sky(p) {
  const starDriftX = (p.drift * 0.15) % 64;
  const starDriftY = Math.sin(p.t * 0.1) * 0.8;
  for(let i=0;i<33;i++) {
    let x = (2 + hash(i*7)*60 + starDriftX) % 64;
    if(x < 0) x += 64;
    const y = 2 + hash(i*7+1)*94 + starDriftY;
    if(Math.abs(x-32)<10 && y>22) continue;
    const b = i%8===0 ? 172 : 48;
    rect(p,x,y,.65,.65,grey(Math.round(b*(.8+.2*Math.sin(p.t*.35+i)))),.16);
  }

  const moonX = 12;
  const moonY = 18;
  ellipse(p,moonX,moonY,6.8,6.8,WHITE,.18);

  const rotAngle = p.t * 0.12; 
  const cosA = Math.cos(rotAngle);
  const sinA = Math.sin(rotAngle);
  const craters = [[-3,-3,2],[-1,0,1.6],[2,-4,1.5],[3,2,2.1],[-2,4,1.4]];

  for(const [mx,my,r] of craters) {
    const rx = mx * cosA - my * sinA;
    const ry = mx * sinA + my * cosA;
    ellipse(p,moonX+rx,moonY+ry,r,r*.8,grey(48),.18);
  }

  const shadowX = -3 * cosA;
  const shadowY = -3 * sinA;
  ellipse(p,moonX+shadowX,moonY+shadowY,.9,1.4,INK,.18);

  const clouds=[[1,16,.9,24],[59,12,.85,21],[-5,28,1.1,18],[66,35,1.25,22],[8,42,1.25,19],[52,48,1.4,25]];
  clouds.forEach((c,i)=>{
    const drift=(((p.drift * 3.0)*(.48+i*.05)+i*3+90)%180+180)%180-90-i*3;
    cloud(p,c[0]+drift,c[1]+Math.sin(p.t*.08+i)*.6,c[2],c[3],.28);
  });

  if (p.birds) {
    for (let i = 0; i < p.birds.length; i++) {
      const b = p.birds[i];
      const renderY = b.y + Math.sin(p.t * b.waveFreq + i) * b.waveAmp;
      const flap = Math.sin(p.t * b.flapSpeed + i) * 0.8;
      
      stroke(p, b.x - 1.5, renderY - 0.3 - flap, b.x, renderY + 0.5, SILVER, 0.35, 0.45);
      stroke(p, b.x, renderY + 0.5, b.x + 1.6, renderY - 0.5 - flap, SILVER, 0.35, 0.45);
    }
  }

  for(let i=0;i<15;i++) {
    const x=i*4.8-2,h=7+hash(i+19)*12,y=111-h;
    rect(p,x,y,3.8,h,grey(i%3===0?26:14),.42);
    poly(p,[[x-.3,y],[x+1.9,y-3-hash(i)*4],[x+4.1,y]],grey(35),.42);
    if(i%3===0)stroke(p,x+1.9,y-4,x+1.9,y-7,EDGE,.35,.42);
    if(lit(p,i+70))rect(p,x+1.2,y+3,.7,1.3,GOLD,.42);
  }
  for(let i=0;i<27;i++) {
    const y=110+i*.48;
    const shift=Math.sin(y*1.8+p.drift*.8)*(.7+Math.abs(p.flow));
    const c=i%4===0?EDGE:SHADE;
    stroke(p,45+hash(i)*4+shift,y,49+hash(i+1)*11+shift,y,c,.3,.5);
    if(i%3===0&&p.light>.2)stroke(p,54+shift,y,55.2+shift+hash(i)*1.4,y,GOLD,.3,.5);
  }
}

function turret(p,x,y,base) {
  rect(p,x-1,y,2,base-y,STONE);
  stroke(p,x-1,y,x-1,base,SILVER,.5);
  stroke(p,x+1,y,x+1,base,EDGE,.4);
  poly(p,[[x-2,y],[x,y-7],[x+2,y]],INK);
  stroke(p,x-2,y,x,y-7,SILVER,.5);
  stroke(p,x,y-7,x+2,y,EDGE,.4);
  stroke(p,x,y-7,x,y-9,EDGE,.35);
  rect(p,x-2.3,y,4.6,.65,SILVER);
  if(lit(p,Math.floor(x)))rect(p,x-.4,y+1.5,.8,3.3,GOLD);
  rect(p,x-2,base,4,.7,EDGE);
}

function tower(p) {
  rect(p,24,39,16,74,STONE);
  rect(p,23,65,2,47,SHADE);
  rect(p,39,65,1.7,47,SHADE);
  rect(p,25.5,67,13,43,INK);
  const beacon=Math.sin(p.beacon/4*Math.PI);
  const edgeLight=p.beacon>0?grey(173+beacon*69):SILVER;
  stroke(p,23.5,44,23.5,113,edgeLight,.75);
  stroke(p,40.5,43,40.5,112,EDGE,.55);
  stroke(p,25.2,67,25.2,111,EDGE,.5);
  stroke(p,38.5,67,38.5,111,SHADE,.55);
  poly(p,[[22.8,69],[24.5,69],[24,104],[22.8,114],[21.6,115]],grey(35));
  stroke(p,22.8,69,21.6,115,edgeLight,.65);
  poly(p,[[40,69],[41.2,69],[42.1,113],[40.5,112]],grey(18));
  stroke(p,41.2,69,42.1,113,EDGE,.45);
  for(const y of [67,88,103]) {
    rect(p,22.1,y,4,.7,edgeLight);
    rect(p,38.2,y,3.7,.6,EDGE);
  }
  window(p,27,66.8,2.3,6.2,2);
  window(p,30.8,66.8,2.3,6.2,5);
  window(p,34.6,66.8,2.3,6.2,8);
  window(p,29,77,6,10.3,1);
  window(p,29.7,93,4.6,9,4);
  window(p,29.8,106,4.4,7.5,0);
  arch(p,28.2,75.1,7.6,13.3,EDGE);
  arch(p,28.8,75.8,6.4,11.7,INK);
  window(p,29.8,77.4,4.4,9.8,1);

  // 시계탑 정면 진추(Pendulum) 절반 축소 적용
  if(p.zoom>1.3) {
    for(let i=0;i<23;i++) {
      const y=65+i*2.1;
      stroke(p,23.2,y,24.6,y,grey(i%3===0?106:45),.22);
      stroke(p,39.4,y+.7,40.9,y+.7,SHADE,.25);
    }
    for(const y of [75.3,91.4,104.7]) {
      poly(p,[[32,y-1.6],[33,y],[32,y+1.6],[31,y]],EDGE);
      poly(p,[[32,y-1],[32.6,y],[32,y+1],[31.4,y]],INK);
    }
    const swing=Math.sin(p.t*2.3)*1.3; // 절반으로 줄인 진폭
    stroke(p,32,68.0,32+swing,73.0,SILVER,.3);
    ellipse(p,32+swing,73.0,0.85,1.05,WARM); // 적절하게 절반 크기로 조정된 진추
    ellipse(p,32+swing,73.0,0.6,0.8,GOLD);
  }

  rect(p,23,44,18,19,STONE);
  rect(p,24.5,45.4,15,16.8,INK);
  rect(p,23,44,18,1,EDGE);
  rect(p,22.5,63,19,1,SILVER);
  rect(p,24,64.5,16,.6,EDGE);
  for(const x of [22.5,40.8]) {
    stroke(p,x,45,x,62,SILVER,.55);
    rect(p,x-.65,45,1.8,1.3,EDGE);
    rect(p,x-.8,61.5,2.1,1.2,SILVER);
  }
  rect(p,26,32,12,11,STONE);
  poly(p,[[25,32],[32,13],[39,32]],INK);
  poly(p,[[25,32],[32,13],[29.8,30]],grey(35));
  stroke(p,25,32,32,13,SILVER,.7);
  stroke(p,32,13,39,32,EDGE,.4);
  stroke(p,27.5,31,32,15,EDGE,.45);
  if(p.zoom>1.4)for(let i=0;i<10;i++){
    const y=18+i*1.3,x=32-(y-13)*.37;
    stroke(p,x,y,x+.9,y,SHADE,.3);
  }
  turret(p,25,32,41);
  turret(p,39,32,41);
  turret(p,22,41,46);
  turret(p,42,41,46);
  poly(p,[[28,39],[28,32],[32,27.5],[36,32],[36,39]],INK);
  stroke(p,28,32,32,27.5,SILVER,.6);
  stroke(p,32,27.5,36,32,EDGE,.5);
  window(p,30,30.3,4,8.5,3);
  rect(p,25,40,14,.8,SILVER);
  rect(p,26,42,12,.65,EDGE);
  for(let x=27;x<=36;x+=2.7)rect(p,x,40.9,1,1,INK);
  stroke(p,32,13,32,8.4,SILVER,.45);
  stroke(p,30.9,10.2,33.1,10.2,p.light>.15?GOLD:SILVER,.5);
  if(p.light>.15)rect(p,31.8,8.3,.5,1.7,WARM);
}

function roman(p,text,x,y,h,c) {
  const glyphs={I:['1','1','1','1','1'],V:['101','101','101','101','010'],X:['101','101','010','101','101']};
  const unit=Math.max(1,Math.round(h*p.zoom*Math.min(p.sx,p.sy)/5));
  const total=text.split('').reduce((sum,ch)=>sum+glyphs[ch][0].length+1,-1)*unit;
  const at=projection(p,x,y+h*.5,1);
  let left=Math.round(at[0]-total/2);
  const top=Math.round(at[1]-2.5*unit);
  for(const ch of text) {
    const glyph=glyphs[ch];
    for(let row=0;row<5;row++)for(let col=0;col<glyph[row].length;col++)if(glyph[row][col]==='1') {
      for(let yy=0;yy<unit;yy++)for(let xx=0;xx<unit;xx++)pixel(p,left+col*unit+xx,top+row*unit+yy,c);
    }
    left+=(glyph[0].length+1)*unit;
  }
}

function hand(p,a,length,width,c) {
  const dx=Math.cos(a),dy=Math.sin(a),nx=-dy*width,ny=dx*width;
  poly(p,[[32-dx*.8+nx,53-dy*.8+ny],[32+dx*length,53+dy*length],[32-dx*.8-nx,53-dy*.8-ny]],c);
  stroke(p,32,53,32+dx*length,53+dy*length,c,.4);
}

function clockFace(p) {
  ellipse(p,32,53,8.7,8.7,EDGE);
  ellipse(p,32,53,8.1,8.1,INK);
  ellipse(p,32,53,7.55,7.55,WHITE);
  const fine=p.zoom>=1.7;
  if(fine)for(let i=0;i<60;i++) {
    const a=i*TAU/60-Math.PI/2,r=i%5===0?6.65:7.0;
    stroke(p,32+Math.cos(a)*r,53+Math.sin(a)*r,32+Math.cos(a)*7.2,53+Math.sin(a)*7.2,INK,.22);
  }
  for(let i=0;i<12;i++) {
    const a=i*TAU/12-Math.PI/2;
    if(!fine) {
      const pos=projection(p,32+Math.cos(a)*6.6,53+Math.sin(a)*6.6,1);
      pixel(p,Math.round(pos[0]),Math.round(pos[1]),INK);
    }
  }
  if(fine) {
    roman(p,'XII',32,46.9,1.4,INK);
    roman(p,'III',37.2,52.3,1.4,INK);
    roman(p,'VI',32,57.6,1.4,INK);
    roman(p,'IX',26.8,52.3,1.4,INK);
    if(p.zoom>2.7) {
      for(const [n,str] of [[1,'I'],[2,'II'],[4,'IV'],[5,'V'],[7,'VII'],[8,'VIII'],[10,'X'],[11,'XI']]) {
        const a=n*TAU/12-Math.PI/2;
        roman(p,str,32+Math.cos(a)*5.45,53+Math.sin(a)*5.45-.6,1.15,INK);
      }
    }
  }
  const hourA=(p.hours%12)/12*TAU-Math.PI/2;
  const minA=fract(p.hours)*TAU-Math.PI/2;
  hand(p,hourA,4.2,.7,INK);
  hand(p,minA,6.1,.42,INK);
  ellipse(p,32,53,.85,.85,INK);
  ellipse(p,32,53,.3,.3,p.light>.1?GOLD:WHITE);
  if(p.zoom>2) {
    const secA=fract(p.hours*60)*TAU-Math.PI/2;
    stroke(p,32,53,32+Math.cos(secA)*6,53+Math.sin(secA)*6,GOLD,.17);
    ellipse(p,32,53,.33,.33,INK);
  }
}

function roof(p,x,y,w,h,depth,id) {
  rect(p,x,y,w,128-y,STONE,depth);
  poly(p,[[x-2,y],[x+w*.5,y-h],[x+w+2,y]],INK,depth);
  stroke(p,x-2,y,x+w*.5,y-h,EDGE,.65,depth);
  stroke(p,x+w*.5,y-h,x+w+2,y,SHADE,.4,depth);
  stroke(p,x-1,y,x+w+1,y,EDGE,.55,depth);
  if(w>15) {
    for(let i=1;i<5;i++)stroke(p,x+w*.5-i*1.4,y-h+i*1.6,x+w*.5+i*1.8,y-h+i*1.6,grey(25),.3,depth);
  }
  const wy=y+3;
  if(w>8)window(p,x+w*.5-1.6,wy,3.2,5,id,depth);
  rect(p,x+w*.24,y-h*.75-3,1.7,5,INK,depth);
  rect(p,x+w*.24-.6,y-h*.75-3,2.9,.65,EDGE,depth);
}

function foreground(p) {
  for(let i=0;i<10;i++) {
    const phase=(p.t*.22+i*.16)%1.6;
    const x=7+phase*p.flow*3+Math.sin(phase*5+p.t*.15)*.8,y=105-phase*12;
    ellipse(p,x,y,.5+phase*.6,.9,grey(Math.round(28*(1-phase/1.6))),.9);
  }
  roof(p,-3,113,16,7,1.12,20);
  roof(p,9,122,14,8,1.16,21);
  roof(p,19,116,22,8,1.13,22);
  roof(p,37,126,14,9,1.2,23);
  roof(p,55,120,14,8,1.15,24);
  rect(p,4,105,4,10,INK,1.1);
  rect(p,3.3,104.5,5.4,1,EDGE,1.1);
  rect(p,4,101,1.2,4,INK,1.1);
  rect(p,6.4,101,1.2,4,INK,1.1);
}

export function draw(display,p) {
  if(p.w!==display.width||p.h!==display.height) {
    p.w=display.width;p.h=display.height;p.sx=p.w/64;p.sy=p.h/128;
    p.rgb=new Uint8Array(p.w*p.h*3);
  }
  p.rgb.fill(0);
  const approach=clamp((p.zoom-1)/1.8,0,1);
  p.cameraY=mix(64,53,approach*approach*(3-2*approach));
  sky(p);
  tower(p);
  clockFace(p);
  foreground(p);
  for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++) {
    const i=(y*p.w+x)*3;
    display.setPixel(x,y,p.rgb[i],p.rgb[i+1],p.rgb[i+2]);
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
