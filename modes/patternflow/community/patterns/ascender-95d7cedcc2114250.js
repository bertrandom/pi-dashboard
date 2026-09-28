// ===== Patternflow pattern =====
// Title:    Ascender
// Author:   @engmung
// Date:     2026-09-12
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Lantern=0..1, Ascent=-12..20, Tower=0..2, Magic=0..1
// @matrix 128x128
// Pattern: Ascender




const W = 64, H = 128;
const stone=[
  [0,0,0],
  [5,10,18],
  [10,18,30],
  [18,32,50],
  [38,64,88],
  [80,120,140],
  [135,178,188],
  [215,242,246],
  [0,0,0],
  [18,32,50],
  [38,64,88],
  [80,120,140]
];

const baseHues=[[255,110,10],[20,225,255],[240,45,255],[255,110,10]];
let pixels;
let palette;

function box(x,y,w,h,c) {
  const x0=Math.max(0,Math.floor(x)), x1=Math.min(W,Math.floor(x+w));
  const y0=Math.max(0,Math.floor(y)), y1=Math.min(H,Math.floor(y+h));
  if(x0>=x1 || y0>=y1) return;
  for(let row=y0;row<y1;row++) pixels.fill(c,row*W+x0,row*W+x1);
}

function dot(x,y,c) { 
  x=Math.round(x); y=Math.round(y);
  if(x>=0 && x<W && y>=0 && y<H) pixels[y*W+x]=c; 
}

function line(x0,y0,x1,y1,c) {
  x0=Math.round(x0); y0=Math.round(y0); x1=Math.round(x1); y1=Math.round(y1);
  const dx=Math.abs(x1-x0), sx=x0<x1?1:-1, dy=-Math.abs(y1-y0), sy=y0<y1?1:-1;
  let err=dx+dy;
  for(let i=0;i<300;i++){
    dot(x0,y0,c);
    if(x0===x1 && y0===y1) break;
    const e=2*err;
    if(e>=dy){ err+=dy; x0+=sx; }
    if(e<=dx){ err+=dx; y0+=sy; }
  }
}

function circle(cx, cy, r, c) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  let x = 0, y = r;
  let d = 3 - 2 * r;
  while(x <= y) {
    dot(cx + x, cy + y, c);
    dot(cx - x, cy + y, c);
    dot(cx + x, cy - y, c);
    dot(cx - x, cy - y, c);
    dot(cx + y, cy + x, c);
    dot(cx - y, cy + x, c);
    dot(cx + y, cy - x, c);
    dot(cx - y, cy - x, c);
    if (d < 0) {
      d = d + 4 * x + 6;
    } else {
      d = d + 4 * (x - y) + 10;
      y--;
    }
    x++;
  }
}

function arch(cx,y,half,h,c) {
  box(cx-half,y+half,half*2+1,h-half,c);
  for(let row=0;row<half;row++) {
    const span=Math.floor(row*0.72+half*0.28);
    box(cx-span,y+row,span*2+1,1,c);
  }
}

function hash(n) {n=(n^0x45d9f3b)*1597334677;n^=n>>>16;return (n>>>0)/4294967296;}

function lamp(x,y,t,id,type) {
  if(type===0) {
    dot(x, y+2, 3);
    dot(x, y+1, 4);
    const flick = Math.sin(t*12 + id*7) > 0 ? 1 : 0;
    const sway  = Math.cos(t*15 + id*3) > 0.2 ? 1 : 0;
    box(x-1, y-1-flick, 3, 2+flick, 14);
    dot(x, y-2-flick, 14);
    dot(x, y-flick, 15);
    if(sway) dot(x+1, y-2-flick, 14);
  } else if(type===1) {
    box(x-2, y+2, 5, 2, 4);
    box(x-1, y+4, 3, 2, 3);
    dot(x, y+6, 3);

    const flick = Math.sin(t*11 + id*7) > 0 ? 1 : 0;
    const sway  = Math.sin(t*15 + id*3) > 0.2 ? 1 : -1;
    const hSpike = Math.cos(t*13 + id*5) > 0.3 ? 1 : 0;

    box(x-2, y-2-flick, 5, 4+flick, 14);
    box(x-1, y-4-flick-hSpike, 3, 3, 14);
    dot(x+sway, y-5-flick-hSpike, 14);

    box(x-1, y-1-flick, 3, 3+flick, 15);
    box(x, y-3-flick, 1, 3, 15);
    dot(x, y-4-flick, 15);

    if(flick && hSpike) {
      dot(x-2, y-3, 14);
      dot(x+2, y-4, 15);
    }
  } else {
    box(x-2, y+2, 5, 2, 4);
    box(x-1, y+4, 3, 2, 3);
    dot(x, y+6, 3);

    const flick = Math.sin(t*13 + id*9) > 0 ? 1 : 0;
    const sway  = Math.cos(t*16 + id*4) > 0.1 ? 1 : -1;
    const blast = Math.sin(t*10 + id*3) > 0.2 ? 1 : 0;

    box(x-2, y-3-flick, 5, 5+flick, 14);
    box(x-1, y-5-flick-blast, 3, 3+blast, 14);
    dot(x+sway, y-6-flick-blast, 14);

    box(x-1, y-2-flick, 3, 3+flick, 15);
    box(x, y-4-flick, 1, 3, 15);
    dot(x, y-5-flick, 15);

    if(flick) {
      dot(x-3, y-2-blast, 14);
      dot(x+3, y-4-flick, 15);
    }
  }
}

export function setup(p) {
  pixels=new Uint8Array(W*H);palette=new Uint8Array(32*3);
  p.scroll=0;p.t=0;p.reverse=1;p.seed=7;p.pulse=0;p.invert=0;
  p.k=[0,2,0,0.06];
}

export function update(dt,input,p) {
  dt=Math.min(0.05,Math.max(0,dt));
  const v=input.knobValues;
  if(v)for(let i=0;i<4;i++)p.k[i]=v[i];
  p.t+=dt;p.scroll+=dt*p.k[1]*6*p.reverse;p.pulse=Math.max(0,p.pulse-dt*0.7);
  if(input.btnPressed[0])p.invert=1-p.invert;
  if(input.btnPressed[1])p.reverse*=-1;
  if(input.btnPressed[2])p.seed+=13;
  if(input.btnPressed[3])p.pulse=1.0;
}

export function draw(display,p,time) {
  const t=p.t,travel=p.scroll,k=p.k;
  const magic=Math.min(1,k[3]+p.pulse*0.7);
  const widen=k[2]*5;
  const left=Math.round(13-widen),right=63-left;

  for(let i=0;i<12;i++)for(let c=0;c<3;c++)palette[i*3+c]=stone[i][c];

  const hue=(k[0]+p.invert*0.5)%1;
  const seg=Math.floor(hue*3);
  const a=baseHues[seg], b=baseHues[seg+1];
  const m=hue*3-seg;
  const r=a[0]+(b[0]-a[0])*m;
  const g=a[1]+(b[1]-a[1])*m;
  const bl=a[2]+(b[2]-a[2])*m;

  for(let c=0;c<3;c++){
    const v=c===0?r:c===1?g:bl;
    palette[12*3+c]=Math.round(v*0.75);
    palette[13*3+c]=Math.round(v*0.4 + 255*0.6);
    palette[14*3+c]=Math.round(v);
    palette[15*3+c]=255;
  }

  palette.set([
    255,18,45,
    255,80,95,
    0,0,0,
    190,245,255,
    255,190,30,
    255,255,185
  ],48);

  pixels.fill(0);

  box(left+3,0,right-left-6,H,1);
  box(24,0,16,H,2);
  box(26,0,12,H,3);
  const backOffset=((travel*0.38)%40+40)%40;
  for(let y=backOffset-40;y<H;y+=40){
    arch(32,y+5,5,22,4);
    arch(32,y+6,4,20,1);
    arch(32,y+8,2,15,6);
    arch(32,y+9,1,13,19);

    box(31,y+9,1,14,3);
    box(33,y+9,1,14,3);
    box(30,y+17,5,1,3);

    box(24,y+29,16,2,4);
    box(23,y+31,18,1,2);
    for(let x=25;x<41;x+=3)box(x,y+26,1,3,5);
    box(23,y+25,18,1,6);

    for(let by=0;by<40;by+=8){
      line(left+4, y+by, 23, y+by, 2);
      line(41, y+by, right-4, y+by, 2);
    }
  }

  const middle=((travel*0.64)%54+54)%54;
  const leftCol=left+5;
  const rightCol=right-5;
  const spanW=rightCol-leftCol;

  box(leftCol-1,0,3,H,0);box(leftCol-1,0,1,H,5);
  box(rightCol-1,0,3,H,0);box(rightCol-1,0,1,H,5);

  for(let y=middle-54;y<H;y+=54){
    const bY = y + 22;

    box(leftCol, bY, spanW, 2, 4);
    box(leftCol, bY, spanW, 1, 7);

    line(leftCol, bY-3, rightCol, bY-3, 6);
    for(let x = leftCol + 2; x < rightCol; x += 3){
      box(x, bY-3, 1, 3, 5);
    }

    for(let x = leftCol; x <= rightCol; x++){
      const norm = ((x - leftCol) / spanW) * 2 - 1;
      const archDrop = Math.round((1 - norm * norm) * 4);
      dot(x, bY + 2 + archDrop, 0);
    }

    for(let side=0;side<2;side++){
      const cx = side ? rightCol : leftCol;
      box(cx-2, y+34, 5, 11, 16);
      box(cx-2, y+34, 1, 10, 17);
      dot(cx, y+45, 0);
      line(cx, y+36, cx, y+42, 0);
      line(cx-1, y+38, cx+1, y+38, 0);
      lamp(cx, y+12, t, side + Math.floor((y-middle)/54), 0);
    }
  }

  const floor=48;
  const offset=((travel)%floor+floor)%floor;
  for(let side=0;side<2;side++){
    const edge=side?right:left;
    const x0=side?right+3:0;
    const bw=left-2;

    box(x0, 0, bw, H, 3);

    for(let y=offset-floor*2;y<H;y+=floor){
      const id=Math.round((y-travel)/floor)+p.seed+side*31;
      const center=side?right+7:left-7;

      arch(center, y+6, 6, 24, 5);
      arch(center, y+8, 4, 21, 0);

      dot(center, y+5, 7);
      dot(center-1, y+6, 6);
      dot(center+1, y+6, 6);

      for(let q=0;q<3;q++){
        dot(center-5, y+13+q*4, 6);
        dot(center+5, y+13+q*4, 4);
        box(center-4, y+14+q*4, 1, 1, 4);
        box(center+4, y+15+q*4, 1, 1, 4);
      }
      box(center-5, y+28, 11, 1, 5);

      for(let by=0;by<floor;by+=5){
        box(edge-1, y+by, 4, 4, 4);
        box(edge-1, y+by, 1, 4, 7);
        if((by/5)%2===0) box(edge+1, y+by+1, 1, 3, 3);
        if(hash(id*19+by)>0.5) dot(edge, y+by+2, 7);
      }

      const shelf=y+34;
      box(x0, shelf, side?W-x0:left+2, 3, 4);
      box(x0, shelf, side?W-x0:left+2, 1, 7);
      for(let x=x0+1; x<x0+bw; x+=3){
        box(x, shelf-4, 1, 4, 5);
        dot(x, shelf-4, 7);
      }
      box(x0, shelf-5, bw, 1, 6);
      line(edge, shelf+3, side?W-1:0, shelf+9, 4);

      lamp(center, y+29, t, id, 1);

      if(hash(id)>0.32){
        const fy = y + floor - 4;
        box(center-2, fy, 5, 11, 16);
        box(center-2, fy, 1, 10, 17);
        dot(center, fy+10, 0);
        dot(center-1, fy+10, 16);
        dot(center+1, fy+10, 16);
        line(center, fy+2, center, fy+7, 0);
        line(center-2, fy+3, center+2, fy+3, 0);
      }
    }
  }

  const chainY=((travel*1.2)%4+4)%4;
  for(const x of [22,42]){
    box(x,0,2,H,0);
    for(let y=chainY-4;y<H;y+=4){box(x,y,1,2,6);dot(x,y,7);dot(x+1,y+2,0);}
  }

  const py=90+Math.round(Math.sin(t*1.7)*0.8);

  box(20,py+4,25,3,0);
  box(21,py+6,23,2,3);
  box(23,py+8,19,2,3);
  box(25,py+10,15,2,4);
  box(19,py,27,4,4);
  box(19,py,1,4,7);
  box(20,py+3,25,1,3);
  for(const x of [20,44]){box(x,py+1,2,2,0);dot(x,py+1,14);}

  if(magic > 0.1){
    const hx = 32;
    const hy = py - 44;
    const r = Math.round(7 + magic * 6);
    const rot = t * 0.45;

    circle(hx, hy, r, 20);

    if(magic > 0.35){
      const starR = r - 1;
      const vx = new Int32Array(6);
      const vy = new Int32Array(6);
      for(let i=0; i<6; i++){
        const a = rot + i * (Math.PI / 3);
        vx[i] = Math.round(hx + Math.cos(a) * starR);
        vy[i] = Math.round(hy + Math.sin(a) * starR);
      }

      line(vx[0], vy[0], vx[2], vy[2], 20);
      line(vx[2], vy[2], vx[4], vy[4], 20);
      line(vx[4], vy[4], vx[0], vy[0], 20);

      line(vx[1], vy[1], vx[3], vy[3], 20);
      line(vx[3], vy[3], vx[5], vy[5], 20);
      line(vx[5], vy[5], vx[1], vy[1], 20);

      for(let i=0; i<6; i++){
        dot(vx[i], vy[i], 21);
      }

      dot(hx, hy, 21);
      dot(hx-1, hy, 20);
      dot(hx+1, hy, 20);
      dot(hx, hy-1, 20);
      dot(hx, hy+1, 20);
    }

    const dropCount = 3 + Math.floor(magic * 6);
    const dropLifeDist = 26;

    for(let i=0; i<dropCount; i++){
      const startAngle = (Math.PI * 0.5) + (Math.sin(i * 1.9 + p.seed) * 0.7);
      const originX = hx + Math.cos(startAngle) * r;
      const originY = hy + Math.sin(startAngle) * r;

      const dropSpeed = 6.0 + (i % 3) * 2.0;
      const progress = ((t * dropSpeed + i * 5.7) % dropLifeDist);

      const driftX = Math.sin(progress * 0.35 + i * 1.4) * 1.2;
      const currentX = originX + driftX;
      const currentY = originY + progress;

      const emberCol = (progress < 6) ? 21 : 20;
      dot(currentX, currentY, emberCol);

      if(progress > 2 && progress < dropLifeDist - 3){
        dot(currentX, currentY - 1, 20);
      }
    }

    if(p.pulse > 0){
      const pr = r + (1.0 - p.pulse) * 22;
      circle(hx, hy, pr, 21);
    }
  }

  if(magic > 0.08){
    const radius = 11 + magic * 5;
    for(let i=0; i<16; i++){
      const a = t * (0.6 + magic * 0.4) + i * Math.PI / 8;
      const x = 32 + Math.cos(a) * radius;
      const y = py - 9 + Math.sin(a) * (radius * 0.38);
      if(i / 16 > magic) continue;
      line(x-1, y, x+1, y, 14);
      dot(x, y-1, 19);
      if(magic > 0.5) dot(x, y+1, 15);
    }
  }

  box(30,py-4,2,4,0);box(33,py-4,2,4,0);
  for(let row=0;row<9;row++){
    const sway=Math.round(Math.sin(t*3+row*0.2)*(row/8));
    box(31-Math.floor(row*0.25)+sway,py-12+row,4+Math.floor(row*0.3),1,16);
    dot(30-Math.floor(row*0.25)+sway,py-12+row,17);
  }

  box(31,py-15,3,2,0);
  box(30,py-13,5,3,0);
  box(32,py-12,2,1,13);
  dot(33,py-12,15);

  line(37,py-13,36,py-1,6);
  dot(37,py-13,19);

  for(let x=23;x<=41;x+=5)box(x,py-4,1,4,6);
  box(22,py-4,21,1,7);

  lamp(20,py-5,t,21,2);
  lamp(44,py-5,t,29,2);

  const n=8+Math.floor(magic*16);
  for(let i=0;i<n;i++){
    const x=4+hash(i*73+p.seed)*56;
    const y=((hash(i*127)*H+travel*(0.3+hash(i)*0.7)-t*3)%H+H)%H;
    dot(x,y,i%4===0?19:6);
    if(magic>0.35&&i%3===0)dot(x,y+1,14);
  }

  if(display.width===W&&display.height===H){
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=pixels[y*W+x]*3;display.setPixel(x,y,palette[c],palette[c+1],palette[c+2]);}
  }else{
    for(let y=0;y<display.height;y++)for(let x=0;x<display.width;x++){const c=pixels[Math.floor(y*H/display.height)*W+Math.floor(x*W/display.width)]*3;display.setPixel(x,y,palette[c],palette[c+1],palette[c+2]);}
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
