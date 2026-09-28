// ===== Patternflow pattern =====
// Title:    The Rose and Her Little Planet
// Author:   @mondkim
// Based on: "Midnight Clocktower" by @engmung — https://patternflow.work/community/p/9b007348542a4c0f
// Date:     2026-09-17
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0:#d6d3cc 0.751:#1f303d 0.931:#040201 0.552:#0f170d 1:#193732 1:#411917
// @knobs Bloom=0..1, Starspeed=0..12, Starlight=0..1, Zoom=0.4..1.95
// @matrix 64x128
// The Rose and Her Little Planet

// Bloom: bud -> full rose (0.6) -> wilt. Push Bloom for automatic life cycle.
// Starspeed: nonlinear speed and 2-6 meteors, in two sizes.
// Starlight: strong exposure response. Zoom: 0.4 wide -> 1.95 close.
// Scalar artwork retains the selected external color ramp.
function sat(v) { return Math.max(0, Math.min(1, v)); }
function fract(v) { return v - Math.floor(v); }
function smooth(a,b,v) { var q=sat((v-a)/(b-a)); return q*q*(3-2*q); }
function lineDist(x,y,ax,ay,bx,by) {
  var dx=bx-ax,dy=by-ay,q=sat(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy));
  return Math.sqrt((x-ax-q*dx)*(x-ax-q*dx)+(y-ay-q*dy)*(y-ay-q*dy));
}
export function setup(p) {
  p.t=0; p.sky=0; p.orbit=0; p.auto=false; p.life=0; p.previousBloom=-1;
  p.stars=[]; p.petals=[]; p.meteors=[];
  for(var m=0;m<6;m++) p.meteors.push({x:0,y:0,c:0,s:0,len:0,width:0});
  for(var i=0;i<30;i++) p.stars.push({x:fract(i*0.618034+0.12),y:fract(i*0.414214+0.07)*1.92,phase:i*2.399,light:0});
  for(var j=0;j<23;j++) p.petals.push({x:0,y:0,rx:0,ry:0,c:1,s:0});
}
export function update(dt,input,p) {
  dt=Math.max(0,dt||0); var k=input.knobValues||[0.62,4,0.8,1];
  if(input.btnPressed && input.btnPressed[0]) { p.auto=!p.auto; p.life=Math.acos(1-2*sat(k[0]))/0.17; }
  if(p.previousBloom>=0 && Math.abs(k[0]-p.previousBloom)>0.002) p.auto=false;
  p.previousBloom=k[0]; p.t+=dt; var speed=Math.max(0,k[1]);
  p.sky+=dt*(0.03*speed+0.17*speed*speed); p.orbit+=dt*0.32;
  p.meteorCount=Math.min(6,2+Math.floor(speed/3));
  p.zoom=Math.max(0.15,Math.min(1.95,k[3]));
  p.cameraY=1.25-0.41*smooth(0.4,1.95,p.zoom);
  for(var m=0;m<6;m++) {
    var mt=p.meteors[m], large=m%2===0, a=0.30+(m%3)*0.085;
    var progress=fract(p.sky*(0.073+m*0.003)+m*0.173);
    mt.x=-1.15+progress*3.3; mt.y=0.2+m*0.24+(mt.x-0.5)*Math.tan(a);
    mt.c=Math.cos(a); mt.s=Math.sin(a);
    mt.len=large?0.29:0.14; mt.width=large?0.016:0.008;
  }
  p.life+=p.auto?dt:0; p.bloom=p.auto?0.5-0.5*Math.cos(p.life*0.17):sat(k[0]);
  p.open=smooth(0,0.62,p.bloom); p.wilt=smooth(0.7,1,p.bloom); p.light=2.4*Math.pow(sat(k[2]),3);
  p.px=0.5+Math.sin(p.orbit*0.35)*0.008;
  p.py=1.56+Math.sin(p.orbit*0.48)*0.008;
  p.fx=p.px+0.012*Math.sin(p.t*0.55)+0.045*p.wilt;
  p.fy=0.78+0.055*p.wilt+(p.py-1.56);
  for(var i=0;i<p.stars.length;i++) {
    var a=p.stars[i]; a.light=p.light*(0.24+0.64*Math.pow(0.5+0.5*Math.sin(p.t*(0.65+(i%4)*0.13)+a.phase),3));
  }
  // Three overlapping whorls: 9 outer, 8 middle, 6 inner petals.
  for(var j=0;j<23;j++) {
    var z=p.petals[j], ringId=j<9?0:(j<17?1:2);
    var n=ringId===0?j:(ringId===1?j-9:j-17), count=ringId===0?9:(ringId===1?8:6);
    var angle=n*6.283185/count+ringId*0.65-1.5;
    var ring=(ringId===0?0.112:(ringId===1?0.065:0.026))*p.open;
    z.x=p.fx+Math.cos(angle)*ring;
    z.y=p.fy+Math.sin(angle)*ring*0.78+(ringId===2?-0.014:0.007)+p.wilt*(ringId===0?0.035:0);
    z.rx=(ringId===0?0.108:(ringId===1?0.078:0.044))*(0.42+0.58*p.open)*(1-0.18*p.wilt);
    z.ry=(ringId===0?0.084:(ringId===1?0.060:0.039))*(0.70+0.30*p.open);
    z.c=Math.cos(angle+0.65); z.s=Math.sin(angle+0.65);
  }
}
export function draw(display,p,time) {
  var w=display.width,h=display.height,aspect=h/w,aa=0.85/w;
  // Coordinates preserve a complete portrait composition at other resolutions.
  var unit=Math.min(w,h/2), ox=(w-unit)/2, oy=(h-unit*2)/2;
  aa=0.65/(unit*p.zoom);
  var glow=0.5+0.5*Math.sin(p.t*0.85);
  for(var y=0;y<h;y++) for(var x=0;x<w;x++) {
    var u=0.5+((x+0.5-ox)/unit-0.5)/p.zoom;
    var v=p.cameraY+((y+0.5-oy)/unit-1)/p.zoom,val=0;
    var skyU=fract(u), skyV=fract(v/2)*2;
    for(var i=0;i<p.stars.length;i++) {
      var st=p.stars[i],sx=Math.abs(skyU-st.x),sy=Math.abs(skyV-st.y);
      if(sx<0.033 && sy<0.033) {
        var dot=sat(1-Math.sqrt(sx*sx+sy*sy)/(0.015+(i%3)*0.003));
        var cross=(i%5===0)?Math.max(sat(1-sx/0.007)*sat(1-sy/0.034),sat(1-sy/0.007)*sat(1-sx/0.028))*0.55:0;
        val=Math.max(val,Math.min(0.98,st.light*Math.max(dot,cross)));
      }
    }
    var dx,dy,along,across;
    for(var m=0;m<p.meteorCount;m++) {
      var mt=p.meteors[m]; dx=u-mt.x;dy=v-mt.y;
      along=dx*mt.c+dy*mt.s; across=Math.abs(-dx*mt.s+dy*mt.c);
      var width=Math.max(mt.width,0.45/(unit*p.zoom));
      if(along<=0 && along>-mt.len) {
        var tail=sat(1-across/width)*Math.pow(1+along/mt.len,1.35);
        val=Math.max(val,Math.min(0.98,p.light*tail));
      }
      var head=sat(1-Math.sqrt(dx*dx+dy*dy)/(width*1.25));
      val=Math.max(val,Math.min(0.98,p.light*head));
    }
    // Thin clouds behind the planet and flower.
    var cloudx=fract(u*0.68-p.t*0.012), cy=1.27+0.04*Math.sin(u*9+p.t*0.08);
    var cloud=Math.exp(-Math.pow((v-cy)/0.038,2))*Math.pow(sat(Math.sin(cloudx*6.283)),6)*0.085;
    val=Math.max(val,cloud);
    // A dim spherical world with luminous atmosphere and slowly turning terrain.
    dx=u-p.px;dy=v-p.py;var r=Math.sqrt(dx*dx+dy*dy),pr=0.325;
    if(r<pr+0.055) {
      val=Math.max(val,(0.045+0.035*glow)*Math.exp(-Math.abs(r-pr)*65));
      if(r<pr) {
        var normal=Math.sqrt(Math.max(0,1-r*r/(pr*pr)));
        var lit=sat((-dx*0.48-dy*0.68)/pr+normal*0.57);
        var terrain=0.5+0.5*Math.sin(dx*33+p.orbit*0.55+Math.sin(dy*24)*1.5);
        val=0.045+lit*0.34+terrain*0.044*normal;
        val+=Math.exp(-(pr-r)*160)*(0.23+0.18*glow)*sat(0.45-dy/pr);
      }
    }
    // Stem is anchored to the planet; the flower is always in front of the sky.
    var rootY=p.py-pr+0.022, stemTop=p.fy+0.067;
    if(v>stemTop && v<rootY) {
      var f=sat((v-stemTop)/(rootY-stemTop));
      var stemX=p.fx*(1-f)+p.px*f-0.025*Math.sin(f*3.14159);
      var stem=sat((0.012-Math.abs(u-stemX))/aa);
      val=val*(1-stem)+(0.48+0.2*(1-f))*stem;
    }
    // Two pointed leaves, each with a central vein.
    for(var leaf=0;leaf<2;leaf++) {
      var sign=leaf===0?-1:1, ax=p.px-0.008, ay=1.12+leaf*0.06+(p.py-1.56);
      var lx=(u-ax)*sign, ly=v-ay+lx*0.55;
      if(lx>0 && lx<0.143) {
        var half=0.034*Math.sin(lx/0.143*3.14159), mask=sat((half-Math.abs(ly))/aa);
        var shade=0.3+0.24*sat(1-Math.abs(ly)/(half+0.001));
        if(Math.abs(ly)<0.006) shade=0.73;
        val=val*(1-mask)+shade*mask;
      }
    }
    // Overlapping sculpted petals: dark seams preserve the rose at LED resolution.
    if(Math.abs(u-p.fx)<0.26 && Math.abs(v-p.fy)<0.26) {
      for(var j=0;j<23;j++) {
        var pet=p.petals[j], qx=u-pet.x,qy=v-pet.y;
        var a=(qx*pet.c+qy*pet.s)/pet.rx,b=(-qx*pet.s+qy*pet.c)/pet.ry;
        var d=Math.sqrt(a*a+b*b),mask=sat((1-d)*Math.min(pet.rx,pet.ry)/aa);
        if(mask>0) {
          // A pale engraved outline separates each dark petal in the current ramp.
          // The same value contrast becomes dark seams with a standard B/W ramp.
          var edge=(1-d)*Math.min(pet.rx,pet.ry);
          var seam=1-smooth(0.003,0.003+Math.max(0.006,0.62/(unit*p.zoom)),edge);
          var fold=0.5+0.5*Math.sin(a*3.8+b*1.4+j*0.6);
          var body=0.48+0.22*sat(0.6-b*0.4)+0.07*fold;
          body*=1-0.15*p.wilt;
          var shade=body*(1-seam)+0.035*seam;
          val=val*(1-mask)+shade*mask;
        }
      }
      var cx=(u-p.fx)/0.038,cy2=(v-p.fy+0.014)/0.034,rr=Math.sqrt(cx*cx+cy2*cy2);
      if(rr<1) {
        var spiral=0.5+0.5*Math.cos(Math.atan2(cy2,cx)+rr*10);
        val=0.045+0.68*smooth(0.28,0.65,spiral);
      }
    }
    // One falling petal during the late life stage, never obscuring the rose.
    if(p.wilt>0.15) {
      var fall=fract(p.t*0.12),fx=p.fx+0.17+0.035*Math.sin(fall*7),fy=p.fy+0.15+fall*0.42;
      var fd=Math.pow((u-fx)/0.024,2)+Math.pow((v-fy)/0.039,2);
      if(fd<1) val=Math.max(val,(0.45+0.24*(1-fd))*p.wilt*(1-fall));
    }
    display.setValue(x,y,sat(val));
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
