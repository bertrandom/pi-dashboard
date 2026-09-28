// ===== Patternflow pattern =====
// Title:    Moonwell
// Author:   @engmung
// Date:     2026-09-13
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Moonlight=0..1, Water=0..4, Aperture=0..1, Awakening=0..1
// @matrix 64x128
// Pattern: Moonwell — a blade waiting beneath the earth.
// SPDX-License-Identifier: MIT


// K1: ice / violet / lava / gold / toxic green. K2: mirror / storm water.
// K3: darkness / cavern-filling light. K4: 30px levitation and a large spell ring.
// Tap K1: next light; K2: raindrop; K3: breathing light; K4: awakening burst.
const W=64,H=128;
const rockColors=[[2,5,9],[5,11,18],[11,23,34],[21,38,51],[33,55,70],[48,77,90],[72,111,121],[119,164,161]];
const lights=[[55,225,255],[197,65,255],[255,59,24],[255,205,58],[77,255,117],[55,225,255]];
const pedestal=[
'............77777..............',
'..........776566777.............',
'.........76554555667............',
'.......776545334555667..........',
'......76554322334456667.........',
'....776544332223344455667.......',
'...76543211332233444555667......',
'..7654321112332233445554467.....',
'.654321111122332233444433467....',
'65432111111122332233443333467...',
'543211122111122332223332223456..',
'4321123442111122332222332223456.',
'3211235543211112233222233222345.',
'211234443221111122333223322234..',
'.1234433221111112223333222233...',
'..22332211111111122223332222....'];
const gemColors=[[0,0,0],[5,12,19],[13,28,37],[25,47,58],[42,70,80],[67,107,115],[104,146,140],[170,197,139]];
let stone,frame,radial,wx,wy,ring;
function hash(n){n=Math.imul(n^0x9e3779b9,0x85ebca6b);n^=n>>>13;return(n>>>0)/4294967296;}
function put(x,y,r,g,b){x=Math.floor(x);y=Math.floor(y);if(x<0||x>=W||y<0||y>=H)return;const i=(y*W+x)*3;frame[i]=r;frame[i+1]=g;frame[i+2]=b;}
function rect(x,y,w,h,r,g,b){for(let yy=Math.max(0,Math.floor(y));yy<Math.min(H,Math.floor(y+h));yy++)for(let xx=Math.max(0,Math.floor(x));xx<Math.min(W,Math.floor(x+w));xx++)put(xx,yy,r,g,b);}
function polygon(points,c){
  let lo=H,hi=0;for(let i=0;i<points.length;i++){lo=Math.min(lo,points[i][1]);hi=Math.max(hi,points[i][1]);}
  for(let y=Math.max(0,lo);y<Math.min(H,hi);y++){
    const xs=[];
    for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
    xs.sort((a,b)=>a-b);
    for(let i=0;i+1<xs.length;i+=2)for(let x=Math.max(0,Math.ceil(xs[i]));x<Math.min(W,Math.ceil(xs[i+1]));x++)stone[y*W+x]=c;
  }
}
function seam(points,c){for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],n=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));for(let s=0;s<=n;s++){const x=Math.round(a[0]+(b[0]-a[0])*s/n),y=Math.round(a[1]+(b[1]-a[1])*s/n);if(x>=0&&x<W&&y>=0&&y<H)stone[y*W+x]=c;}}}
function crag(cx,cy,w,h,flip){
  const shear=hash(Math.round(cx*7+cy*13))*.8-.4;
  const P=(x,y)=>[Math.round(cx+(x+y*shear)*w*flip),Math.round(cy+y*h)];
  polygon([P(-.5,-.35),P(-.18,-.55),P(.35,-.43),P(.51,.03),P(.19,.5),P(-.34,.42)],2);
  polygon([P(-.5,-.35),P(-.18,-.55),P(.13,-.20),P(-.16,.12),P(-.34,.42)],5);
  polygon([P(-.18,-.55),P(.35,-.43),P(.13,-.20)],7);
  polygon([P(.13,-.20),P(.35,-.43),P(.51,.03),P(.19,.5),P(-.16,.12)],3);
  polygon([P(.13,-.20),P(.37,.03),P(.19,.5),P(-.03,.21)],4);
  seam([P(-.48,-.32),P(-.18,-.49),P(.12,-.23)],6);
  seam([P(-.28,.41),P(-.08,.18),P(.11,.16),P(.22,.01)],1);
}
export function setup(p){
  stone=new Uint8Array(W*H);frame=new Uint8ClampedArray(W*H*3);
  p.t=0;p.water=0;p.k=[0,2,0,0.06];p.shift=0;p.drop=0;p.burst=0;p.breathe=false;
  // Static jagged strata are cached once; no noise or polygons in the frame loop.
  polygon([[0,0],[29,0],[21,14],[20,26],[17,34],[19,43],[17,62],[21,73],[23,87],[0,99]],3);
  polygon([[64,0],[39,0],[43,12],[44,25],[48,35],[46,46],[48,61],[45,74],[44,91],[64,101]],3);
  polygon([[0,0],[23,0],[18,15],[19,23],[13,35],[15,47],[12,58],[17,70],[15,89],[0,102]],2);
  polygon([[64,0],[44,0],[49,18],[48,29],[53,41],[49,52],[53,64],[50,83],[64,101]],2);
  polygon([[0,0],[17,0],[12,13],[13,23],[8,32],[10,44],[6,55],[11,69],[8,80],[11,94],[0,110]],1);
  polygon([[64,0],[51,0],[52,11],[57,23],[55,35],[60,46],[55,61],[57,76],[54,90],[64,107]],1);
  polygon([[0,0],[11,0],[7,15],[8,27],[3,38],[5,49],[0,59]],0);
  polygon([[64,0],[59,0],[58,17],[63,30],[60,44],[64,56]],0);
  seam([[23,0],[18,15],[19,23],[13,35],[15,47]],4);
  seam([[8,45],[6,55],[11,69],[8,80],[11,94]],4);
  seam([[13,57],[17,70],[15,82]],5);
  seam([[43,12],[44,25],[48,35],[46,46]],4);
  seam([[53,52],[50,59],[53,64],[50,83],[54,91]],5);
  seam([[5,5],[3,18],[5,22]],2);seam([[56,6],[58,16],[56,22]],3);
  seam([[15,3],[12,13],[13,19]],3);seam([[61,37],[59,45],[61,50]],3);
  seam([[2,72],[7,73],[9,83]],5);seam([[61,76],[57,77],[53,88]],6);
  seam([[18,66],[20,73],[22,82]],4);
  polygon([[16,32],[19,25],[18,41],[16,47],[16,39]],3);
  polygon([[12,51],[14,47],[16,60],[15,67],[14,57]],3);
  polygon([[8,17],[10,9],[9,29],[7,34]],2);
  polygon([[46,39],[49,32],[48,47],[45,57]],4);
  polygon([[54,64],[56,57],[55,76],[51,87],[52,77]],3);
  polygon([[11,76],[14,79],[18,91],[15,90]],4);
  // Widely spaced horizontal fractures keep large rock faces from looking flat.
  for(let y=11;y<83;y+=7)for(let x=4;x<60;x++){
    const s=stone[y*W+x];
    if(s>=2&&s<=4&&hash(Math.floor(x/3)*91+y*3)>0.77)stone[y*W+x]=s-1;
  }
  // Foreground shores: remain almost black so the reflected blade reads.
  polygon([[0,94],[7,99],[9,105],[14,105],[19,116],[22,128],[0,128]],1);
  polygon([[64,96],[57,99],[54,111],[47,117],[45,128],[64,128]],1);
  seam([[0,95],[7,99],[9,105],[14,105],[19,116],[22,128]],4);
  seam([[64,97],[57,100],[54,111],[47,117],[45,128]],3);
  const silhouette=new Uint8Array(stone);
  // Overlapping asymmetric slabs: broad illuminated faces, deep cracks, chipped bevels.
  for(let side=0;side<2;side++){
    for(let row=0;row<7;row++){
      const yy=3+row*14+hash(row*51+side*87)*9,inner=side?49:15,outer=side?59:5,flip=side?-1:1;
      crag(inner+(hash(row*7+side)*6-3),yy,7+hash(row*37+side)*9,15+hash(row*53+side)*18,flip);
      crag(outer,yy+7,8+hash(row*13+side)*7,17+hash(row*9+side)*12,flip);
    }
    crag(side?56:8,106,17,22,side?-1:1);
    crag(side?58:9,126,24,27,side?-1:1);
  }
  for(let i=0;i<stone.length;i++)if(!silhouette[i])stone[i]=0;
  radial=new Uint8Array(W*H);wx=new Float32Array(W);wy=new Float32Array(H);ring=new Float32Array(180);
  for(let y=86;y<H;y++)for(let x=0;x<W;x++)radial[y*W+x]=Math.min(179,Math.round(Math.sqrt((x-32)*(x-32)*0.7+(y-87)*(y-87)*4)));
}
export function update(dt,input,p){
  dt=Math.max(0,Math.min(0.05,dt));
  if(input.knobValues)for(let i=0;i<4;i++)p.k[i]=input.knobValues[i];
  p.t+=dt;p.water+=dt*p.k[1];p.drop=Math.max(0,p.drop-dt*0.55);p.burst=Math.max(0,p.burst-dt*0.45);
  if(input.btnPressed[0])p.shift=(p.shift+1/5)%1;
  if(input.btnPressed[1])p.drop=1;
  if(input.btnPressed[2])p.breathe=!p.breathe;
  if(input.btnPressed[3])p.burst=1;
}
export function draw(display,p){
  const k=p.k,t=p.t,flow=p.water,awake=Math.min(1,k[3]+p.burst);
  const hue=((k[0]+p.shift)%1)*5,si=Math.floor(hue),a=lights[si],b=lights[si+1],mix=hue-si;
  const lr=a[0]+(b[0]-a[0])*mix,lg=a[1]+(b[1]-a[1])*mix,lb=a[2]+(b[2]-a[2])*mix;
  const opening=k[2]*k[2];
  const breath=p.breathe?0.80+Math.sin(t*0.85)*0.20:1;
  const sway=Math.sin(t*0.23)*0.7;
  // Row-level trigonometry, simple arithmetic per pixel. 8192 output pixels.
  for(let y=0;y<88;y++){
    const center=32+sway*(y/88)+Math.sin(t*0.55)*opening*7*(y/88),half=1.5+opening*13+y*(0.018+opening*0.29);
    const vertical=Math.max(0.20,1-y*0.0068)*breath;
    const streakA=29+Math.sin(t*0.37+y*0.035)*2,streakB=35+Math.sin(t*0.29+y*0.025);
    for(let x=0;x<W;x++){
      const st=stone[y*W+x],c=rockColors[st];
      const d=Math.abs(x-center),cone=Math.max(0,1-d/half);
      const ripple=(Math.abs(x-streakA)<1.5?0.09:0)+(Math.abs(x-streakB)<1?0.06:0);
      let v=(cone*cone*(0.30+opening)+cone*0.12+ripple*cone)*vertical;
      if(st>0)v*=0.22+opening*0.8;
      // Sharp, irregular skylight cap instead of a blurred white triangle.
      if(y<16&&d<(y<5?y*0.9:7-(y-5)*0.43)&&st===0){put(x,y,192+lr*0.23,192+lg*0.23,192+lb*0.23);continue;}
      const rim=st>=4?0.05*vertical:0;
      const tint=0.18+opening*0.8+awake*0.25;
      const shade=st?(0.3+Math.max(0,1-Math.abs(x-32)/32)*0.7):1;
      put(x,y,c[0]*shade*(0.3+lr/190*(1+tint))+lr*(v+rim),c[1]*shade*(0.3+lg/230*(1+tint))+lg*(v+rim),c[2]*shade*(0.3+lb/255*(1+tint))+lb*(v+rim));
    }
  }
  // Dust lit only inside the shaft. Deterministic positions with slow drift.
  const count=10+Math.floor(awake*45);
  for(let i=0;i<count;i++){
    const y=17+((hash(i*19+3)*67-t*(0.55+hash(i)*1.1))%67+67)%67;
    const x=23+hash(i*71)*19+Math.sin(t*0.4+i)*1.1;
    const v=i%5===0?0.85:0.35;
    put(x,y,lr*v,lg*v,lb*v);
    if(i%8===0&&awake>0.6){put(x-1,y,lr*0.3,lg*0.3,lb*0.3);put(x,y-1,150,225,239);}
  }
  // Blade: gold furniture, dark grip, three clean pixels of luminous steel.
  const lift=Math.round(awake*30+Math.sin(t*2)*awake*3),sy=80-lift;
  rect(30,sy-10,5,12,lr*0.2,lg*0.2,lb*0.2);
  rect(31,sy-10,3,12,lr*0.64,lg*0.84,lb*0.84);
  rect(31,sy-10,1,12,210,255,255);rect(32,sy-10,1,12,241,255,243);
  put(32,sy+2,195,250,255);
  rect(27,sy-12,11,1,255,227,137);rect(28,sy-11,9,1,133,99,45);
  put(27,sy-11,241,229,166);put(37,sy-11,241,229,166);
  rect(31,sy-17,3,5,13,24,30);rect(32,sy-17,1,5,154,154,109);
  put(32,sy-16,28,37,36);put(32,sy-14,28,37,36);put(31,sy-15,99,154,158);put(31,sy-13,99,154,158);
  rect(31,sy-19,3,2,255,230,147);put(32,sy-19,248,255,228);
  put(32,sy-12,23,107,165);put(32,sy-11,173,241,255);
  if(awake>0.15){
    for(let i=0;i<32;i++){
      const angle=t*(0.5+awake*2)+i*Math.PI/16;
      const xx=32+Math.cos(angle)*(6+awake*15),yy=sy-5+Math.sin(angle)*(3+awake*13);
      if(i/32>awake)continue;
      put(xx,yy,lr,lg,lb);
      if(i%4===0){put(xx+1,yy,200,250,255);put(xx,yy+1,lr*.6,lg*.6,lb*.6);}
    }
    if(awake>.4){
      for(let y=sy+3;y<82;y++){
        const x=32+Math.round(Math.sin(y*.63-t*6)*awake*4);
        put(x,y,lr*.6,lg*.6,lb*.6);if(y%3===0)put(x+1,y,190,250,255);
      }
    }
  }
  for(let x=0;x<W;x++)wx[x]=Math.sin(x*.33+flow*.7)+Math.sin(x*.71-flow*.9)*.45;
  for(let y=86;y<H;y++)wy[y]=Math.sin(y*.64-flow*2)+Math.sin(y*.27+flow*1.6)*.6;
  for(let i=0;i<180;i++)ring[i]=Math.sin(i*.56-flow*2.7);
  // Water reflects the scene above it, with row-based displacement and broken highlights.
  for(let y=88;y<H;y++){
    const depth=(y-88)/40;
    const amplitude=k[1]*k[1]*.55;
    for(let x=0;x<W;x++){
      const st=stone[y*W+x];
      if(st){const c=rockColors[st];put(x,y,c[0]*(.25+lr/900),c[1]*(.25+lg/900),c[2]*(.25+lb/900));continue;}
      const wave=wy[y]+wx[x]*.6+ring[radial[y*W+x]]*.6;
      const shift=Math.round(wave*(.1+amplitude*(.5+depth)));
      const srcY=Math.max(0,Math.min(87,Math.round(85-(y-88)*.7+wx[x]*amplitude*.3)));
      const glint=wave>.65&&wave<1.17;
      const sx=Math.max(0,Math.min(W-1,x+shift)),si=(srcY*W+sx)*3;
      const rr=frame[si],gg=frame[si+1],bb=frame[si+2];
      const center=Math.max(0,1-Math.abs(x-32-shift)/(10+depth*7));
      const mod=glint?0.88:0.30;
      const ribbon=Math.max(0,1-Math.abs(x-32-shift)/(1.6+depth*2.7));
      const sheen=(glint?0.17:0.03)*center+ribbon*(glint?0.60:0.07);
      const foam=wave>.87&&wave<1.08?Math.max(0,k[1]-1.5)*center*.20:0;
      const body=.014+.012*wx[x]*wy[y];
      put(x,y,4+rr*mod+lr*(sheen+body)+foam*160,13+gg*mod+lg*(sheen+body)+foam*210,20+bb*mod+lb*(sheen+body)+foam*220);
    }
  }
  // Discrete water ripples stretch horizontally, no full-screen blur.
  for(let i=0;i<23;i++){
    const y=86+Math.floor(hash(i*31+8)*41),x=9+Math.floor(hash(i*59+7)*46);
    const len=2+Math.floor(hash(i*11)*7),v=0.07+0.1*(0.5+0.5*Math.sin(flow*1.1+i*2));
    for(let q=0;q<len;q++)if(x+q<W&&!stone[y*W+x+q])put(x+q,y,lr*v,lg*v,lb*v);
  }
  // Hand-composed facets: chipped crown, offset ridge, a deep diagonal crack.
  for(let row=0;row<pedestal.length;row++){
    for(let x=0;x<pedestal[row].length;x++){
      const s=pedestal[row].charCodeAt(x)-48;if(s<1||s>7)continue;
      const c=gemColors[s===7&&row>3?(row%3===0?6:5):s],v=awake*.18+opening*.14;
      put(x+17,80+row,c[0]+lr*v,c[1]+lg*v,c[2]+lb*v);
    }
  }
  // A few satellite stones and the waterline anchor the pedestal.
  rect(17,89,5,3,5,13,21);rect(18,88,3,1,86,139,145);put(20,89,137,189,184);
  rect(43,89,5,3,6,17,26);rect(44,88,2,1,76,125,135);
  for(let x=18;x<48;x++)if(x<24||x>40||x%4===0)put(x,92,lr*0.45,lg*0.6,lb*0.6);
  // One expanding elliptical ripple per tap; the blade is never flashed out.
  if(p.drop>0||p.burst>0){
    const life=Math.max(p.drop,p.burst),radius=(1-life)*25+3;
    for(let i=0;i<48;i++){const angle=i*Math.PI/24;put(32+Math.cos(angle)*radius,94+Math.sin(angle)*radius*0.24,lr*life,lg*life,lb*life);}
  }
  for(let y=0;y<display.height;y++)for(let x=0;x<display.width;x++){
    const i=(Math.floor(y*H/display.height)*W+Math.floor(x*W/display.width))*3;
    display.setPixel(x,y,frame[i],frame[i+1],frame[i+2]);
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
