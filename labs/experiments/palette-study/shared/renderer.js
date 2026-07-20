(function () {
  const CLASS_COLORS = {
    crypto: "#E69F00", equity: "#56B4E9", bonds: "#009E73",
    commodities: "#D55E00", fx: "#CC79A7", portfolio: "#F0E442"
  };
  const CLASS_NAMES = {crypto:"Crypto", equity:"Equity", bonds:"Bonds", commodities:"Commodities", fx:"FX", portfolio:"Portfolio"};
  const PALETTES = {
    market: {neg:[202,92,102], mid:[173,158,124], pos:[88,169,145]},
    natural: {neg:[83,55,38], mid:[162,119,72], pos:[225,184,111]},
    botanical: {neg:[106,65,47], mid:[158,128,79], pos:[126,145,76]},
    wood: {neg:[76,57,43], mid:[151,113,72], pos:[224,190,133]},
    overlay: {neg:[92,70,52], mid:[153,118,79], pos:[211,177,123]}
  };
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

  function ringFill(cls, ring, palette="market") {
    const p=PALETTES[palette]||PALETTES.market;
    const la=(NORM?.lg_cls&&NORM.lg_cls[cls])||[NORM?.lg_p5||-.45,NORM?.lg_p95||.55];
    let col;
    if (ring.log_growth>=0) col=mix(p.mid,p.pos,Math.sqrt(clamp(ring.log_growth/la[1],0,1)));
    else col=mix(p.mid,p.neg,Math.sqrt(clamp(ring.log_growth/la[0],0,1)));
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
    for (const sc of m.scars) drawOrganicScar(g,cx,cy,R,bands,sc,year);
    g.restore();
  }

  function boundaryPoints(cx,cy,r,R,vol01,thickness,seed) {
    const rng=rand(hash(seed)),steps=Math.max(96,Math.round(R*1.15));
    const amp=Math.min(thickness*.18,R*(.001+.005*vol01));
    const k1=3+Math.floor(rng()*3),k2=7+Math.floor(rng()*5),p1=rng()*Math.PI*2,p2=rng()*Math.PI*2,pts=[];
    for(let i=0;i<=steps;i++){
      const a=-Math.PI/2+i/steps*Math.PI*2,j=amp*(.72*Math.sin(k1*a+p1)+.28*Math.sin(k2*a+p2)),rr=r+j;
      pts.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]);
    }
    return pts;
  }

  function tracePoints(g,pts,reverse=false) {
    const first=reverse?pts.length-1:0,last=reverse?0:pts.length-1,step=reverse?-1:1;
    g.moveTo(...pts[first]);for(let i=first+step;reverse?i>=last:i<=last;i+=step)g.lineTo(...pts[i]);
  }

  function ringPath(g,outer,inner) {g.beginPath();tracePoints(g,outer);tracePoints(g,inner,true);g.closePath();}

  function drawRadialFibers(g,cx,cy,r0,r1,vol01,seed) {
    if(r1-r0<5)return;const rng=rand(hash(seed)),count=2+Math.floor(vol01*5);
    for(let i=0;i<count;i++){
      const a=rng()*Math.PI*2,pad=(r1-r0)*(.18+.14*rng()),start=r0+pad,end=r1-pad*(.7+.15*rng());
      g.beginPath();g.moveTo(cx+Math.cos(a)*start,cy+Math.sin(a)*start);g.lineTo(cx+Math.cos(a)*end,cy+Math.sin(a)*end);
      g.strokeStyle=i%2?'rgba(245,238,218,.08)':'rgba(3,5,4,.16)';g.lineWidth=Math.max(.55,(r1-r0)*.025);g.stroke();
    }
  }

  // A drawdown scar behaves like damaged wood being grown around, not a
  // ruler-straight radial mark. The wound follows a deterministic, gently
  // wandering path with asymmetric edges. Recovered scars taper shut at the
  // recovery ring; open scars stay wide enough to visibly interrupt the bark.
  function drawOrganicScar(g,cx,cy,R,bands,sc,year) {
    const k0=bands.findIndex(b=>b.year>=sc.year);if(k0<0)return;
    const recovered=sc.r_year!=null&&sc.r_year<=year;
    let k1=bands.length-1;
    if(recovered){k1=k0;while(k1+1<bands.length&&bands[k1+1].year<=sc.r_year)k1++;}
    const rStart=bands[k0].r0,rEnd=bands[k1].r1,span=Math.max(1,rEnd-rStart);
    const depth=clamp(Math.abs(sc.depth||0),0,1),baseAngle=-Math.PI/2+(sc.angle||0)*Math.PI*2;
    const half=Math.min(R*(.007+.016*depth),Math.max(1.4,rStart*.24));
    const n=Math.round(clamp(span/3.5,8,28)),rng=rand(hash(`scar|${sc.date||sc.year}|${sc.depth}`));
    const p1=rng()*Math.PI*2,p2=rng()*Math.PI*2,left=[],right=[],center=[];
    for(let i=0;i<=n;i++){
      const t=i/n,r=rStart+span*t,envelope=Math.sin(Math.PI*t);
      const wander=R*(.004+.010*depth)*envelope*(.72*Math.sin(p1+t*Math.PI*2.1)+.28*Math.sin(p2+t*Math.PI*5.3));
      const a=baseAngle+wander/Math.max(r,8),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
      const profile=recovered?(.10+.90*Math.pow(1-t,.72)):(.82+.12*Math.sin(Math.PI*t));
      const rough=(rng()-.5)*.34,wl=half*profile*(1+rough),wr=half*profile*(1-rough*.7+(rng()-.5)*.15);
      const px=-Math.sin(a),py=Math.cos(a);
      left.push([x+px*wl,y+py*wl]);right.push([x-px*wr,y-py*wr]);center.push([x,y]);
    }
    g.beginPath();g.moveTo(...left[0]);for(let i=1;i<left.length;i++)g.lineTo(...left[i]);for(let i=right.length-1;i>=0;i--)g.lineTo(...right[i]);g.closePath();
    g.fillStyle='rgba(5,7,6,.88)';g.fill();
    const edge=pts=>{g.beginPath();g.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)g.lineTo(...pts[i]);g.strokeStyle='rgba(213,193,151,.24)';g.lineWidth=Math.max(.55,R*.0022);g.stroke();};
    edge(left);edge(right);
    g.beginPath();g.moveTo(...center[0]);for(let i=1;i<center.length;i++)g.lineTo(...center[i]);g.strokeStyle='rgba(0,0,0,.46)';g.lineWidth=Math.max(.45,R*.0015);g.stroke();
  }

  // Detailed renderer: one visible boundary per calendar year. Volatility
  // changes the irregularity of that real boundary rather than adding false
  // concentric contours inside the annual band.
  function drawDetailedRings(g,tree,cx,cy,R,year=9999,opts={}) {
    const m=metrics(tree,year);if(!m)return null;
    const total=m.rings.reduce((s,r)=>s+ringThickness(r.log_growth),0),core=R*.055,usable=R-core,bands=[];
    const baseAlpha=opts.alpha==null?1:opts.alpha;
    let r0=core,innerPts=boundaryPoints(cx,cy,core,R,0,0,'core');g.save();g.globalAlpha=baseAlpha;
    m.rings.forEach((ring,k)=>{
      const r1=r0+usable*ringThickness(ring.log_growth)/total,a0=-Math.PI/2,a1=a0+Math.PI*2;
      const fill=ringFill(tree.cls,ring,opts.palette),va=(NORM?.vol_cls&&NORM.vol_cls[tree.cls])||[NORM?.vol_p10||.1,NORM?.vol_p90||.7],vol01=clamp((ring.vol-va[0])/(va[1]-va[0]),0,1);
      g.globalAlpha=baseAlpha*((opts.focusYear&&ring.year!==opts.focusYear) ? 0.20 : 1);
      const outerPts=boundaryPoints(cx,cy,r1,R,vol01,r1-r0,tree.id+'|'+ring.year);
      ringPath(g,outerPts,innerPts);g.fillStyle=rgba(fill);g.fill();
      if(opts.fibers)drawRadialFibers(g,cx,cy,r0,r1,vol01,tree.id+'|fiber|'+ring.year);
      g.beginPath();tracePoints(g,outerPts);g.strokeStyle='rgba(8,11,10,.68)';g.lineWidth=Math.max(.7,R*.00135);g.stroke();
      bands.push({year:ring.year,r0,r1,a0,a1,partial:!!ring.partial,innerPts,outerPts});r0=r1;innerPts=outerPts;
    });
    g.globalAlpha=baseAlpha;
    const outer=bands[bands.length-1];if(outer){g.beginPath();tracePoints(g,outer.outerPts);g.strokeStyle=CLASS_COLORS[tree.cls]||'#aaa';g.lineWidth=Math.max(1.5,R*.004);g.stroke();}
    for(const sc of m.scars){g.globalAlpha=baseAlpha*((opts.focusYear&&sc.year!==opts.focusYear) ? 0.22 : 1);drawOrganicScar(g,cx,cy,R,bands,sc,year);}
    g.globalAlpha=baseAlpha;
    if(opts.highlightYear){const b=bands.find(x=>x.year===opts.highlightYear);if(b){ringPath(g,b.outerPts,b.innerPts);if(opts.palette==='overlay'){const ring=m.rings.find(r=>r.year===b.year);g.fillStyle=rgba(ringFill(tree.cls,ring,'market'),.72);}else g.fillStyle='rgba(245,215,142,.16)';g.fill();g.strokeStyle='rgba(255,232,170,.9)';g.lineWidth=Math.max(1.2,R*.004);g.stroke();}}
    if(opts.years&&R>=90){g.strokeStyle='rgba(235,228,211,.23)';g.fillStyle='rgba(235,228,211,.62)';g.font=`${Math.max(8,Math.round(R*.055))}px ui-monospace,Menlo,monospace`;g.textAlign='right';bands.forEach((b,i)=>{if(bands.length>15&&i%2&&i!==bands.length-1)return;const y=cy-(b.r0+b.r1)/2;g.beginPath();g.moveTo(cx-4,y);g.lineTo(cx+4,y);g.stroke();g.fillText(String(b.year),cx-9,y+3);});}
    g.restore();return {core,bands,barkR:outer?.r1||0};
  }

  function detailedRingAt(geo,cx,cy,x,y){
    if(!geo)return null;const dist=Math.hypot(x-cx,y-cy),b=geo.bands.find(v=>dist>=v.r0&&dist<=v.r1);if(!b)return null;
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

  async function load(url="data/rings.json") {
    const res=await fetch(url); if(!res.ok) throw new Error(`rings.json: ${res.status}`);
    const data=await res.json(); NORM=data.norm; return data;
  }

  window.LivingTrees={CLASS_COLORS,CLASS_NAMES,PALETTES,clamp,metrics,ringThickness,ringFill,drawRings,drawDetailedRings,detailedRingAt,drawStandingTree,fitCanvas,label,load};
})();
