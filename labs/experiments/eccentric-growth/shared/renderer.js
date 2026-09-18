(function () {
  const CLASS_COLORS = {
    crypto: "#E69F00", equity: "#56B4E9", bonds: "#009E73",
    commodities: "#D55E00", fx: "#CC79A7", portfolio: "#F0E442"
  };
  const CLASS_NAMES = {crypto:"Crypto", equity:"Equity", bonds:"Bonds", commodities:"Commodities", fx:"FX", portfolio:"Portfolio"};
  const PALETTES = {
    wood: {neg:[69,45,30], negNear:[132,92,54], mid:[157,116,71], posNear:[184,142,85], pos:[235,198,128]},
    market: {neg:[190,57,73], negNear:[204,121,119], mid:[173,158,124], posNear:[113,172,145], pos:[43,143,111]}
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

  // Ring width curve. `w` is an optional override:
  // {squash, floor, max, lo, hi}. The shipped curve is log1p squash 3.2 between the
  // forest's p5/p95 growth anchors, floor .15, max 2.0. The low floor is what lets a
  // century tree breathe: 100 rings in one radius means the weakest years have to
  // collapse to a hairline or the strong years have no room left to read as strong.
  function ringThickness(lg, w) {
    const squash=w&&w.squash!=null?w.squash:3.2;
    const floor=w&&w.floor!=null?w.floor:.15, max=w&&w.max!=null?w.max:2.0;
    const lo0=(w&&w.lo!=null)?w.lo:(NORM?.lg_p5 ?? -.45), hi0=(w&&w.hi!=null)?w.hi:(NORM?.lg_p95 ?? .55);
    const sq=v=>Math.sign(v)*Math.log1p(Math.abs(v)*squash);
    const t=sq(lg),lo=sq(lo0),hi=sq(hi0);
    return floor+(max-floor)*clamp((t-lo)/(hi-lo),0,1);
  }

  function ringFill(cls, ring, palette="wood") {
    const p=PALETTES[palette]||PALETTES.wood;
    const la=(NORM?.lg_cls&&NORM.lg_cls[cls])||[NORM?.lg_p5||-.45,NORM?.lg_p95||.55];
    let col;
    if(p.negNear&&p.posNear){
      // Both palettes use separated ramps: every down year starts on the loss
      // side and every up year starts on the gain side. Magnitude varies within
      // each side, so near-zero years can no longer blur the sign boundary.
      const strength=Math.pow(clamp(ring.log_growth/(ring.log_growth>0?la[1]:la[0]),0,1),1.15);
      if(ring.log_growth>0)col=mix(p.posNear,p.pos,strength);
      else if(ring.log_growth<0)col=mix(p.negNear,p.neg,strength);
      else col=p.mid;
    }else if(ring.log_growth>=0)col=mix(p.mid,p.pos,Math.sqrt(clamp(ring.log_growth/la[1],0,1)));
    else col=mix(p.mid,p.neg,Math.sqrt(clamp(ring.log_growth/la[0],0,1)));
    const va=(NORM?.vol_cls&&NORM.vol_cls[cls])||[NORM?.vol_p10||.1,NORM?.vol_p90||.7];
    const v=clamp((ring.vol-va[0])/(va[1]-va[0]),0,1);
    if(palette==='wood')return mix(mix(col,[220,207,179],.08*(1-v)),[18,14,10],.12*v);
    return mix(mix(col,[216,220,224],.08*(1-v)),[12,17,15],.20*v);
  }

  function drawRings(g, tree, cx, cy, R, year=9999, alpha=1, palette="wood") {
    const m=metrics(tree,year); if (!m) return;
    const total=m.rings.reduce((s,r)=>s+ringThickness(r.log_growth),0);
    let r0=R*.07; const usable=R-r0, bands=[];
    g.save(); g.globalAlpha=alpha;
    for (const ring of m.rings) {
      const r1=r0+usable*ringThickness(ring.log_growth)/total;
      g.beginPath(); g.arc(cx,cy,r1,0,Math.PI*2); g.arc(cx,cy,r0,Math.PI*2,0,true); g.closePath();
      g.fillStyle=rgba(ringFill(tree.cls,ring,palette)); g.fill();
      g.beginPath(); g.arc(cx,cy,r1,0,Math.PI*2); g.strokeStyle="rgba(5,9,8,.55)"; g.lineWidth=.7; g.stroke();
      bands.push({year:ring.year,r0,r1}); r0=r1;
    }
    g.beginPath(); g.arc(cx,cy,R,0,Math.PI*2); g.strokeStyle=CLASS_COLORS[tree.cls]||"#aaa"; g.lineWidth=1.5; g.stroke();
    for (const sc of m.scars) drawOrganicScar(g,cx,cy,R,bands,sc,year);
    g.restore();
  }

  function boundaryPoints(cx,cy,r,R,vol01,thickness,seed,ecc) {
    const rng=rand(hash(seed)),steps=Math.max(96,Math.round(R*1.15));
    const amp=Math.min(thickness*.18,R*(.001+.005*vol01));
    const k1=3+Math.floor(rng()*3),k2=7+Math.floor(rng()*5),p1=rng()*Math.PI*2,p2=rng()*Math.PI*2,pts=[];
    // Persistent lean: a slow-drifting (angle, magnitude), carried across years
    // (see buildEccentricity), biases the boundary toward one compass direction
    // instead of every year's wobble being independently re-randomized. Capped
    // against this ring's own radius and its own thickness so a thin ring can
    // never fold through its own inner boundary.
    const eccAmp=ecc?Math.min(r*.45,thickness*1.1,R*ecc.mag*(ecc.scale??.05)):0, eccAngle=ecc?ecc.angle:0;
    for(let i=0;i<=steps;i++){
      const a=-Math.PI/2+i/steps*Math.PI*2;
      let j=amp*(.72*Math.sin(k1*a+p1)+.28*Math.sin(k2*a+p2));
      if(eccAmp)j+=eccAmp*Math.cos(a-eccAngle);
      const rr=r+j;
      pts.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]);
    }
    return pts;
  }

  // One (angle, magnitude) pair per ring, carried forward year to year: angle
  // drifts a little each year (a slow random walk, so the lean's compass
  // direction wanders instead of re-rolling from scratch), magnitude is a
  // leaky integrator of that year's realized volatility — a rough year pushes
  // the tree further off-round than it already was, calm years let it relax
  // back toward (not snap to) round. Deterministic per tree.
  function buildEccentricity(tree, rings, o={}) {
    const driftStep=o.driftStep??.55, decay=o.decay??.82, kick=o.kick??.85;
    const magMin=o.magMin??.10, magMax=o.magMax??1, scale=o.scale??.05;
    const va=(NORM?.vol_cls&&NORM.vol_cls[tree.cls])||[NORM?.vol_p10||.1,NORM?.vol_p90||.7];
    const rng=rand(hash(tree.id+"|eccentricity"));
    let angle=rng()*Math.PI*2, mag=magMin;
    const out=[];
    for(const ring of rings){
      angle+=(rng()-.5)*driftStep;
      const vol01=clamp((ring.vol-va[0])/(va[1]-va[0]),0,1);
      mag=clamp(mag*decay+(1-decay)*kick*vol01,magMin,magMax);
      out.push({year:ring.year,angle,mag,scale});
    }
    return out;
  }

  function tracePoints(g,pts,reverse=false) {
    const first=reverse?pts.length-1:0,last=reverse?0:pts.length-1,step=reverse?-1:1;
    g.moveTo(...pts[first]);for(let i=first+step;reverse?i>=last:i<=last;i+=step)g.lineTo(...pts[i]);
  }

  function ringPath(g,outer,inner) {g.beginPath();tracePoints(g,outer);tracePoints(g,inner,true);g.closePath();}

  // `hair` (<1 under magnification) keeps fibers screen-thin and, because the
  // random walk is seeded, adds grain rather than reshuffling it as you zoom in.
  function drawRadialFibers(g,cx,cy,r0,r1,vol01,seed,hair=1) {
    if(r1-r0<5)return;const rng=rand(hash(seed)),count=Math.round((2+Math.floor(vol01*5))*clamp(1/hair,1,9));
    for(let i=0;i<count;i++){
      const a=rng()*Math.PI*2,pad=(r1-r0)*(.18+.14*rng()),start=r0+pad,end=r1-pad*(.7+.15*rng());
      g.beginPath();g.moveTo(cx+Math.cos(a)*start,cy+Math.sin(a)*start);g.lineTo(cx+Math.cos(a)*end,cy+Math.sin(a)*end);
      g.strokeStyle=i%2?'rgba(245,238,218,.08)':'rgba(3,5,4,.16)';g.lineWidth=Math.max(.55,(r1-r0)*.025*hair);g.stroke();
    }
  }

  // A drawdown scar is a thin, hairline-fine crack in the wood — calibrated against
  // real fire-scarred cross-sections (see labs/scar-study). It follows a deterministic,
  // gently wandering path and tapers to a point at BOTH ends when the drawdown recovered
  // (a closed teardrop, widest ~a third out where the damage is deepest); when it hasn't
  // recovered it tapers at the trough and stays open to the bark. Thinness is size-aware:
  // hairline on a large specimen, a touch heavier on small cards so it stays legible.
  // `sr` is the reference radius for hairline strokes: it equals R for a plain
  // render, but the immersive viewer holds it near the fit-to-screen radius so
  // edge lines stay hairlines instead of fattening with magnification.
  function drawOrganicScar(g,cx,cy,R,bands,sc,year,sr) {
    if(sr==null)sr=R;
    const k0=bands.findIndex(b=>b.year>=sc.year);if(k0<0)return;
    const recovered=sc.r_year!=null&&sc.r_year<=year;
    let k1=bands.length-1;
    if(recovered){k1=k0;while(k1+1<bands.length&&bands[k1+1].year<=sc.r_year)k1++;}
    const rStart=bands[k0].r0,rEnd=bands[k1].r1,span=Math.max(1,rEnd-rStart);
    const depth=clamp(Math.abs(sc.depth||0),0,1),baseAngle=-Math.PI/2+(sc.angle||0)*Math.PI*2;
    const wScale=clamp(.42-(R-120)*.16/170,.26,.44);
    const half=Math.min(R*(.008+.017*depth),Math.max(1.6,rStart*.26))*wScale;
    const widthAt=recovered
      ? (t=>Math.pow(Math.sin(Math.PI*t),.60)*(1-.34*t))   // closed teardrop, points both ends
      : (t=>Math.pow(clamp(t/.34,0,1),.8));                // point at trough, open to the bark
    const n=Math.round(clamp(span/3.5,8,30)),rng=rand(hash(`scar|${sc.date||sc.year}|${sc.depth}`));
    const p1=rng()*Math.PI*2,p2=rng()*Math.PI*2,left=[],right=[],center=[];
    for(let i=0;i<=n;i++){
      const t=i/n,r=rStart+span*t,w=clamp(widthAt(t),0,1);
      const wander=R*(.004+.010*depth)*w*(.72*Math.sin(p1+t*Math.PI*2.1)+.28*Math.sin(p2+t*Math.PI*5.3));
      const a=baseAngle+wander/Math.max(r,8),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
      const rough=(rng()-.5)*.30,wl=half*w*(1+rough),wr=half*w*(1-rough*.7+(rng()-.5)*.15);
      const px=-Math.sin(a),py=Math.cos(a);
      left.push([x+px*wl,y+py*wl]);right.push([x-px*wr,y-py*wr]);center.push([x,y]);
    }
    g.beginPath();g.moveTo(...left[0]);for(let i=1;i<left.length;i++)g.lineTo(...left[i]);for(let i=right.length-1;i>=0;i--)g.lineTo(...right[i]);g.closePath();
    g.fillStyle='rgba(5,7,6,.88)';g.fill();
    const edge=pts=>{g.beginPath();g.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)g.lineTo(...pts[i]);g.strokeStyle='rgba(213,193,151,.22)';g.lineWidth=Math.max(.5,sr*.0018);g.stroke();};
    edge(left);edge(right);
    g.beginPath();g.moveTo(...center[0]);for(let i=1;i<center.length;i++)g.lineTo(...center[i]);g.strokeStyle='rgba(0,0,0,.44)';g.lineWidth=Math.max(.4,sr*.0013);g.stroke();
  }

  // Detailed renderer: one visible boundary per calendar year. Volatility
  // changes the irregularity of that real boundary rather than adding false
  // concentric contours inside the annual band.
  function drawDetailedRings(g,tree,cx,cy,R,year=9999,opts={}) {
    const m=metrics(tree,year);if(!m)return null;
    const wc=opts.width;   // opt-in ring-width curve override; undefined = shipped curve
    const total=m.rings.reduce((s,r)=>s+ringThickness(r.log_growth,wc),0),core=R*.055,usable=R-core;
    const baseAlpha=opts.alpha==null?1:opts.alpha;
    // Hairline reference radius: a magnified render (immersive zoom) passes the
    // fit-to-screen radius so boundary lines stay hairlines instead of fattening.
    const sr=opts.strokeR||R,hair=sr/R;
    // Optional screen-rect clip: with a deeply zoomed tree most annuli fall
    // entirely outside the viewport, and generating their (very fine) boundary
    // polylines is the whole cost of a frame. Skip those; keep their geometry
    // in `bands` so hit-testing and the scar/label passes stay complete. (Only
    // the shipped path honors this; the eccentric path always computes every
    // band since it needs the full cumulative profile regardless of viewport.)
    const clip=opts.clip;let rNear=0,rFar=Infinity;
    if(clip){
      const dx=[clip.x0-cx,clip.x1-cx],dy=[clip.y0-cy,clip.y1-cy];
      rFar=Math.max(...dx.map(a=>Math.max(...dy.map(b=>Math.hypot(a,b)))))+2;
      rNear=Math.hypot(Math.max(clip.x0-cx,0,cx-clip.x1),Math.max(clip.y0-cy,0,cy-clip.y1))-2;
    }
    const onScreen=(a,b)=>!clip||(b>=rNear&&a<=rFar);
    const va=(NORM?.vol_cls&&NORM.vol_cls[tree.cls])||[NORM?.vol_p10||.1,NORM?.vol_p90||.7];
    // opts.eccentric turns on the persistent-lean boundary (see buildEccentricity);
    // omitted/false renders the shipped independent-per-year wobble unchanged.
    const eccArr=opts.eccentric?buildEccentricity(tree,m.rings,typeof opts.eccentric==='object'?opts.eccentric:{}):null;
    const bands=(()=>{
      const out=[];let r0=core,innerPts=null,prev={r:core,vol:0,th:0,seed:'core',ecc:null};
      m.rings.forEach((ring,i)=>{
        const r1=r0+usable*ringThickness(ring.log_growth,wc)/total,a0=-Math.PI/2,a1=a0+Math.PI*2;
        const vol01=clamp((ring.vol-va[0])/(va[1]-va[0]),0,1),ecc=eccArr?eccArr[i]:null;
        const self={r:r1,vol:vol01,th:r1-r0,seed:tree.id+'|'+ring.year,ecc};
        if(onScreen(r0,r1)){
          if(!innerPts)innerPts=boundaryPoints(cx,cy,prev.r,R,prev.vol,prev.th,prev.seed,prev.ecc);
          const outerPts=boundaryPoints(cx,cy,r1,R,vol01,r1-r0,self.seed,ecc);
          out.push({year:ring.year,r0,r1,a0,a1,partial:!!ring.partial,innerPts,outerPts,fill:ringFill(tree.cls,ring,opts.palette),vol01});
          innerPts=outerPts;
        }else{
          out.push({year:ring.year,r0,r1,a0,a1,partial:!!ring.partial,innerPts:null,outerPts:null,vol01});innerPts=null;
        }
        prev=self;r0=r1;
      });
      return out;
    })();
    g.save();g.globalAlpha=baseAlpha;
    bands.forEach(b=>{
      if(!b.outerPts)return;
      g.globalAlpha=baseAlpha*((opts.focusYear&&b.year!==opts.focusYear) ? 0.20 : 1);
      ringPath(g,b.outerPts,b.innerPts);g.fillStyle=rgba(b.fill);g.fill();
      if(opts.fibers)drawRadialFibers(g,cx,cy,b.r0,b.r1,b.vol01,tree.id+'|fiber|'+b.year,hair);
      // Decade reference lines. Dendrochronologists mark every tenth ring so the
      // eye can count a long series without losing its place; the outer edge of a
      // year ending in 0 gets a slightly heavier, slightly darker boundary. It has
      // to whisper — texture at card scale, gentle latitude lines at specimen scale —
      // so this is a small step up from the annual hairline, not a rule.
      const decade=opts.decades!==false&&b.year%10===0;
      g.beginPath();tracePoints(g,b.outerPts);
      g.strokeStyle=decade?'rgba(5,8,7,.9)':'rgba(8,11,10,.68)';
      g.lineWidth=decade?Math.max(1.5,sr*.0032):Math.max(.7,sr*.00135);
      g.stroke();
    });
    g.globalAlpha=baseAlpha;
    const outer=bands[bands.length-1];if(outer&&outer.outerPts){g.beginPath();tracePoints(g,outer.outerPts);g.strokeStyle=CLASS_COLORS[tree.cls]||'#aaa';g.lineWidth=Math.max(1.5,sr*.004);g.stroke();}
    for(const sc of m.scars){g.globalAlpha=baseAlpha*((opts.focusYear&&sc.year!==opts.focusYear) ? 0.22 : 1);drawOrganicScar(g,cx,cy,R,bands,sc,year,sr);}
    g.globalAlpha=baseAlpha;
    if(opts.highlightYear){const b=bands.find(x=>x.year===opts.highlightYear);if(b&&b.outerPts){ringPath(g,b.outerPts,b.innerPts);g.fillStyle='rgba(245,215,142,.16)';g.fill();g.strokeStyle='rgba(255,232,170,.9)';g.lineWidth=Math.max(1.2,sr*.004);g.stroke();}}
    // Year labels: thin them by the SPACE each label needs, not by a fixed
    // every-other-ring stride. A century-long tree packs 100 bands into the same
    // radius, so a fixed stride piles 50 labels into an unreadable smear; gating
    // on the type's own line height keeps them legible at any ring count.
    // opts.labelPx pins the type to a screen size (immersive zoom), which is what
    // lets a magnified century tree reveal more of its years rather than fewer.
    // opts.labelAngle swings the label rail off 12 o'clock, so a zoomed-and-panned
    // view can still carry years even when the pith is off screen.
    if(opts.years&&(opts.labelPx||R>=90)){
      const fs=opts.labelPx||Math.max(8,Math.round(R*.055)),ang=opts.labelAngle==null?-Math.PI/2:opts.labelAngle;
      const ux=Math.cos(ang),uy=Math.sin(ang),qx=-uy,qy=ux;   // q: across the rail
      // Space needed between labels is the label box measured along the rail.
      const minGap=Math.abs(ux)*fs*3.0+Math.abs(uy)*fs*1.15,ox=-qx*9,oy=-qy*9;
      g.strokeStyle='rgba(235,228,211,.23)';g.fillStyle='rgba(240,233,216,.78)';g.font=`${fs}px ui-monospace,Menlo,monospace`;
      g.textAlign=ox<-1?'right':ox>1?'left':'center';g.textBaseline='middle';
      let last=-Infinity;   // walk bark -> pith; the key grows as radius shrinks
      for(let i=bands.length-1;i>=0;i--){const b=bands[i],rm=(b.r0+b.r1)/2,px=cx+ux*rm,py=cy+uy*rm;
        if(-rm-last<minGap)continue;
        last=-rm;if(clip&&(px<clip.x0-60||px>clip.x1+60||py<clip.y0-2*fs||py>clip.y1+2*fs))continue;
        g.lineWidth=1;g.strokeStyle='rgba(235,228,211,.23)';g.beginPath();g.moveTo(px-qx*4,py-qy*4);g.lineTo(px+qx*4,py+qy*4);g.stroke();
        // Magnified views sit on pale latewood, so give the type a dark halo.
        if(opts.labelPx){g.lineWidth=3;g.strokeStyle='rgba(4,8,6,.5)';g.strokeText(String(b.year),px+ox,py+oy);}
        g.fillText(String(b.year),px+ox,py+oy);}
      g.textBaseline='alphabetic';}
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

  async function load(url="../data/rings.json") {
    const res=await fetch(url); if(!res.ok) throw new Error(`rings.json: ${res.status}`);
    const data=await res.json(); NORM=data.norm; return data;
  }

  window.EccentricLab={CLASS_COLORS,CLASS_NAMES,PALETTES,clamp,metrics,ringThickness,ringFill,drawRings,drawDetailedRings,detailedRingAt,drawStandingTree,buildEccentricity,fitCanvas,label,load};
})();
