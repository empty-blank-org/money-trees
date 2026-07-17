(function () {
  const CLASS_COLORS = {
    crypto: "#E69F00", equity: "#56B4E9", bonds: "#009E73",
    commodities: "#D55E00", fx: "#CC79A7", portfolio: "#F0E442"
  };
  const CLASS_NAMES = {crypto:"Crypto", equity:"Equity", bonds:"Bonds", commodities:"Commodities", fx:"FX", portfolio:"Portfolio"};
  const RET_NEG = [202, 92, 102], RET_MID = [173, 158, 124], RET_POS = [88, 169, 145];
  let NORM = null;

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgba = (c, a=1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  function hash(s) { let h=2166136261; for (let i=0;i<s.length;i++) { h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
  function rand(seed) { let x=seed||1; return () => { x^=x<<13; x^=x>>>17; x^=x<<5; return (x>>>0)/4294967296; }; }
  function hexToRgb(h) { const n=parseInt(h.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }

  function metrics(tree, year=9999) {
    const rings = tree.rings.filter(r => r.year <= year);
    if (!rings.length) return null;
    const sumLg = rings.reduce((s,r)=>s+r.log_growth,0);
    const cagr = Math.exp(sumLg/rings.length)-1;
    const meanVol = rings.reduce((s,r)=>s+r.vol,0)/rings.length;
    const positive = rings.filter(r=>r.ret>0).length/rings.length;
    const scars = (tree.scars||[]).filter(s=>s.year<=year);
    const worst = Math.min(...rings.map(r=>r.max_dd==null?0:r.max_dd));
    const thickness = rings.reduce((s,r)=>s+ringThickness(r.log_growth),0);
    return {rings, years:rings.length, sumLg, cagr, meanVol, positive, scars, worst, thickness};
  }

  function ringThickness(lg) {
    const lo0=NORM?.lg_p5 ?? -.45, hi0=NORM?.lg_p95 ?? .55;
    const t=Math.sign(lg)*Math.log1p(Math.abs(lg)*3.2);
    const lo=Math.sign(lo0)*Math.log1p(Math.abs(lo0)*3.2);
    const hi=Math.sign(hi0)*Math.log1p(Math.abs(hi0)*3.2);
    return .28+1.72*clamp((t-lo)/(hi-lo),0,1);
  }

  function ringFill(cls, ring) {
    const la=(NORM?.lg_cls&&NORM.lg_cls[cls])||[NORM?.lg_p5||-.45,NORM?.lg_p95||.55];
    let col;
    if (ring.log_growth>=0) col=mix(RET_MID,RET_POS,Math.sqrt(clamp(ring.log_growth/la[1],0,1)));
    else col=mix(RET_MID,RET_NEG,Math.sqrt(clamp(ring.log_growth/la[0],0,1)));
    const va=(NORM?.vol_cls&&NORM.vol_cls[cls])||[NORM?.vol_p10||.1,NORM?.vol_p90||.7];
    const v=clamp((ring.vol-va[0])/(va[1]-va[0]),0,1);
    return mix(mix(col,[216,220,224],.24*(1-v)),[12,17,15],.42*v);
  }

  function drawRings(g, tree, cx, cy, R, year=9999, alpha=1) {
    const m=metrics(tree,year); if (!m) return;
    const total=m.rings.reduce((s,r)=>s+ringThickness(r.log_growth),0);
    let r0=R*.07; const usable=R-r0, bands=[];
    g.save(); g.globalAlpha=alpha;
    for (const ring of m.rings) {
      const r1=r0+usable*ringThickness(ring.log_growth)/total;
      g.beginPath(); g.arc(cx,cy,r1,0,Math.PI*2); g.arc(cx,cy,r0,Math.PI*2,0,true); g.closePath();
      g.fillStyle=rgba(ringFill(tree.cls,ring)); g.fill();
      g.beginPath(); g.arc(cx,cy,r1,0,Math.PI*2); g.strokeStyle="rgba(5,9,8,.55)"; g.lineWidth=.7; g.stroke();
      bands.push({year:ring.year,r0,r1}); r0=r1;
    }
    g.beginPath(); g.arc(cx,cy,R,0,Math.PI*2); g.strokeStyle=CLASS_COLORS[tree.cls]||"#aaa"; g.lineWidth=1.5; g.stroke();
    for (const sc of m.scars) {
      const b=bands.find(x=>x.year>=sc.year); if (!b) continue;
      const a=-Math.PI/2+(sc.angle||0)*Math.PI*2, end=R*(sc.r_year&&sc.r_year<=year ? .88 : 1);
      g.beginPath(); g.moveTo(cx+Math.cos(a)*b.r0,cy+Math.sin(a)*b.r0); g.lineTo(cx+Math.cos(a)*end,cy+Math.sin(a)*end);
      g.strokeStyle="rgba(3,4,3,.92)"; g.lineWidth=1.5+3*clamp(Math.abs(sc.depth||0),0,1); g.stroke();
    }
    g.restore();
  }

  function monthCoverage(mr) {
    if (!mr) return null;
    let first=-1,last=-1;
    for (let i=0;i<mr.length;i++) if (mr[i]!=null) { if(first<0)first=i; last=i; }
    if (first<0 || (first===0&&last===11)) return null;
    return {first,last};
  }

  function drawGrain(g,cx,cy,r0,r1,vol01,a0,a1,seed) {
    if (r1-r0<3.2) return;
    const rng=rand(hash(seed)), span=a1-a0, steps=Math.max(24,Math.round(span/(Math.PI*2)*220));
    const amp=(r1-r0)*(.025+.12*vol01);
    for(let i=0;i<4;i++) {
      const rr=r0+(r1-r0)*(i+1)/5, k1=3+Math.floor(rng()*6), k2=8+Math.floor(rng()*10), p1=rng()*Math.PI*2, p2=rng()*Math.PI*2;
      g.beginPath();
      for(let s=0;s<=steps;s++) {
        const a=a0+span*s/steps, j=amp*(Math.sin(k1*a+p1)*.68+Math.sin(k2*a+p2)*.32), rad=rr+j;
        const x=cx+Math.cos(a)*rad,y=cy+Math.sin(a)*rad; if(s===0)g.moveTo(x,y);else g.lineTo(x,y);
      }
      g.strokeStyle=i%2?'rgba(255,255,255,.075)':'rgba(0,0,0,.16)';g.lineWidth=Math.max(.7,(r1-r0)*.022);g.stroke();
    }
  }

  // Poster-detail renderer for larger multi-asset views. It preserves the same
  // one-ring-per-year contract; the extra lines are deterministic grain whose
  // amplitude is tied to that year's class-normalized realized volatility.
  function drawDetailedRings(g,tree,cx,cy,R,year=9999,opts={}) {
    const m=metrics(tree,year);if(!m)return null;
    const total=m.rings.reduce((s,r)=>s+ringThickness(r.log_growth),0),core=R*.055,usable=R-core,bands=[];
    const baseAlpha=opts.alpha==null?1:opts.alpha;
    let r0=core;g.save();g.globalAlpha=baseAlpha;
    m.rings.forEach((ring,k)=>{
      const r1=r0+usable*ringThickness(ring.log_growth)/total,isEdge=k===0||k===m.rings.length-1,cov=isEdge?monthCoverage(ring.mr):null;
      const a0=cov?-Math.PI/2+cov.first/12*Math.PI*2:-Math.PI/2,a1=cov?-Math.PI/2+(cov.last+1)/12*Math.PI*2:a0+Math.PI*2;
      const fill=ringFill(tree.cls,ring),va=(NORM?.vol_cls&&NORM.vol_cls[tree.cls])||[NORM?.vol_p10||.1,NORM?.vol_p90||.7],vol01=clamp((ring.vol-va[0])/(va[1]-va[0]),0,1);
      g.globalAlpha=baseAlpha*((opts.focusYear&&ring.year!==opts.focusYear) ? 0.20 : 1);
      g.beginPath();g.arc(cx,cy,r1,a0,a1);g.arc(cx,cy,r0,a1,a0,true);g.closePath();g.fillStyle=rgba(fill);g.fill();
      drawGrain(g,cx,cy,r0,r1,vol01,a0,a1,tree.id+'|'+ring.year);
      g.beginPath();g.arc(cx,cy,r1,a0,a1);g.strokeStyle='rgba(8,11,10,.62)';g.lineWidth=Math.max(.65,R*.0012);g.stroke();
      if(cov){g.beginPath();g.moveTo(cx+Math.cos(a0)*r0,cy+Math.sin(a0)*r0);g.lineTo(cx+Math.cos(a0)*r1,cy+Math.sin(a0)*r1);g.moveTo(cx+Math.cos(a1)*r0,cy+Math.sin(a1)*r0);g.lineTo(cx+Math.cos(a1)*r1,cy+Math.sin(a1)*r1);g.stroke();}
      bands.push({year:ring.year,r0,r1,a0,a1,partial:!!cov});r0=r1;
    });
    g.globalAlpha=baseAlpha;
    const outer=bands[bands.length-1];if(outer){g.beginPath();if(outer.partial){const prev=bands.length>1?bands[bands.length-2].r1:core;g.arc(cx,cy,outer.r1,outer.a0,outer.a1);g.arc(cx,cy,prev,outer.a1,outer.a0+Math.PI*2);}else g.arc(cx,cy,outer.r1,0,Math.PI*2);g.strokeStyle=CLASS_COLORS[tree.cls]||'#aaa';g.lineWidth=Math.max(1.5,R*.004);g.stroke();}
    for(const sc of m.scars){const b=bands.find(x=>x.year>=sc.year);if(!b)continue;g.globalAlpha=baseAlpha*((opts.focusYear&&sc.year!==opts.focusYear) ? 0.22 : 1);const a=-Math.PI/2+(sc.angle||0)*Math.PI*2,end=R*((sc.r_year&&sc.r_year<=year) ? 0.88 : 1),depth=clamp(Math.abs(sc.depth||0),0,1);g.beginPath();g.moveTo(cx+Math.cos(a)*b.r0,cy+Math.sin(a)*b.r0);g.lineTo(cx+Math.cos(a)*end,cy+Math.sin(a)*end);g.strokeStyle='rgba(3,4,3,.9)';g.lineWidth=Math.max(1.4,R*(.006+.012*depth));g.stroke();}
    g.globalAlpha=baseAlpha;
    if(opts.highlightYear){const b=bands.find(x=>x.year===opts.highlightYear);if(b){g.beginPath();g.arc(cx,cy,b.r1,b.a0,b.a1);g.arc(cx,cy,b.r0,b.a1,b.a0,true);g.closePath();g.fillStyle='rgba(245,215,142,.16)';g.fill();g.strokeStyle='rgba(255,232,170,.9)';g.lineWidth=Math.max(1.2,R*.004);g.stroke();}}
    if(opts.years&&R>=90){g.strokeStyle='rgba(235,228,211,.23)';g.fillStyle='rgba(235,228,211,.62)';g.font=`${Math.max(8,Math.round(R*.055))}px ui-monospace,Menlo,monospace`;g.textAlign='right';bands.forEach((b,i)=>{if(bands.length>15&&i%2&&i!==bands.length-1)return;const y=cy-(b.r0+b.r1)/2;g.beginPath();g.moveTo(cx-4,y);g.lineTo(cx+4,y);g.stroke();g.fillText(String(b.year),cx-9,y+3);});}
    g.restore();return {core,bands,barkR:outer?.r1||0};
  }

  function detailedRingAt(geo,cx,cy,x,y){
    if(!geo)return null;const dist=Math.hypot(x-cx,y-cy),b=geo.bands.find(v=>dist>=v.r0&&dist<=v.r1);if(!b)return null;
    if(b.partial){let a=Math.atan2(y-cy,x-cx);while(a<b.a0)a+=Math.PI*2;if(a>b.a1)return null;}
    return b;
  }

  function drawStandingTree(g, tree, x, ground, maxH, year=9999, opts={}) {
    const m=metrics(tree,year); if (!m) return null;
    const ageScale=clamp(m.years/17,.18,1);
    const H=maxH*(.20+.80*ageScale);
    const cagrN=clamp((m.cagr+.10)/.45,0,1);
    const volN=clamp(m.meanVol/.65,0,1);
    const density=clamp(.25+.75*m.positive,.25,1);
    const crownW=H*(.18+.20*cagrN);
    const trunkW=Math.max(4,H*(.014+.020*clamp(m.thickness/28,0,1)));
    const top=ground-H, rng=rand(hash(tree.id+"|standing"));
    const classRgb=hexToRgb(CLASS_COLORS[tree.cls]||"#a99d83");
    const scale=opts.scale||1;
    g.save(); g.translate(x,ground); g.scale(scale,scale); g.translate(-x,-ground);

    // Shadow gives weight without encoding another quantity.
    g.beginPath(); g.ellipse(x,ground+3,crownW*.48,4,0,0,Math.PI*2); g.fillStyle="rgba(0,0,0,.28)"; g.fill();

    // Branches: irregularity is proportional to realized volatility.
    const branchEnds=[];
    const branchCount=Math.max(3,Math.round(4+m.years*.48));
    g.lineCap="round";
    for (let i=0;i<branchCount;i++) {
      const p=.23+.64*(i/(Math.max(1,branchCount-1)));
      const by=ground-H*p;
      const side=i%2?1:-1;
      const jitter=(rng()-.5)*volN*.65;
      const len=crownW*(.34+.55*(1-p))*(.78+rng()*.35);
      const ex=x+side*len*(1+jitter), ey=by-H*(.05+.07*rng())*(1+.35*volN);
      g.beginPath(); g.moveTo(x+(rng()-.5)*trunkW*.35,by); g.quadraticCurveTo(x+side*len*.45,by-H*.02,ex,ey);
      g.strokeStyle="rgba(105,82,55,.92)"; g.lineWidth=Math.max(1,trunkW*(.34-.20*p)); g.stroke();
      branchEnds.push([ex,ey,p]);
    }

    // Tapered trunk: length is age, width is accumulated ring growth.
    g.beginPath();
    g.moveTo(x-trunkW*.62,ground); g.quadraticCurveTo(x-trunkW*.30,ground-H*.50,x-trunkW*.10,top);
    g.lineTo(x+trunkW*.10,top); g.quadraticCurveTo(x+trunkW*.32,ground-H*.48,x+trunkW*.62,ground); g.closePath();
    const bark=g.createLinearGradient(x-trunkW,0,x+trunkW,0); bark.addColorStop(0,"#493622"); bark.addColorStop(.5,"#92704a"); bark.addColorStop(1,"#3c2c1d");
    g.fillStyle=bark; g.fill(); g.strokeStyle=CLASS_COLORS[tree.cls]||"#aaa"; g.lineWidth=1.1; g.stroke();

    // Drawdown scars live at the height corresponding to their calendar year.
    for (const sc of m.scars) {
      const idx=m.rings.findIndex(r=>r.year>=sc.year); if (idx<0) continue;
      const sy=ground-H*(.10+.78*(idx/Math.max(1,m.rings.length-1)));
      const depth=clamp(Math.abs(sc.depth||0),0,1);
      g.beginPath(); g.moveTo(x-trunkW*.44,sy+2); g.lineTo(x+trunkW*.44,sy-3-depth*3);
      g.strokeStyle="rgba(24,13,8,.95)"; g.lineWidth=1+depth*3; g.stroke();
    }

    // Foliage count/density = share of positive years; spread = CAGR.
    const clusters=Math.round(5+14*density);
    const centers=[[x,top+H*.09,.15],...branchEnds];
    for (let i=0;i<clusters;i++) {
      const c=centers[i%centers.length], rr=crownW*(.11+.08*rng());
      const fx=c[0]+(rng()-.5)*crownW*.35, fy=c[1]+(rng()-.5)*H*.09;
      const light=.38+.34*rng();
      const leaf=mix([20,46,34],classRgb,.32+light*.32);
      g.beginPath(); g.arc(fx,fy,rr,0,Math.PI*2); g.fillStyle=rgba(leaf,.54+.30*density); g.fill();
    }
    g.restore();
    return {x, top:top-(scale-1)*H, ground, width:crownW*2*scale, metrics:m, height:H*scale};
  }

  function fitCanvas(canvas, draw) {
    let raf=0;
    function resize() {
      cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>{
        const r=canvas.parentElement.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
        canvas.width=Math.max(1,Math.round(r.width*dpr)); canvas.height=Math.max(1,Math.round(r.height*dpr));
        canvas.style.width=r.width+"px"; canvas.style.height=r.height+"px";
        const g=canvas.getContext("2d"); g.setTransform(dpr,0,0,dpr,0,0); draw(g,r.width,r.height);
      });
    }
    window.addEventListener("resize",resize); resize(); return resize;
  }

  function label(g,text,x,y,accent="#eee") {
    g.font="11px ui-monospace, Menlo, monospace"; g.textAlign="center";
    g.fillStyle="rgba(0,0,0,.68)"; g.fillText(text,x+1,y+1); g.fillStyle=accent; g.fillText(text,x,y);
  }

  async function load() {
    const res=await fetch("../data/rings.json"); if(!res.ok) throw new Error(`rings.json: ${res.status}`);
    const data=await res.json(); NORM=data.norm; return data;
  }

  window.LivingTrees={CLASS_COLORS,CLASS_NAMES,clamp,metrics,ringThickness,drawRings,drawDetailedRings,detailedRingAt,drawStandingTree,fitCanvas,label,load};
})();
