// Scar-study renderer — frozen copy of the production ring core, comparing the
// current seam against TAPERED-SEAM variants: same radial-seam character, but the
// width tapers to a point at BOTH ends when the drawdown recovered (a closed lens),
// and tapers only at the trough end while staying open to the bark when it hasn't.
// Self-contained per the lab convention; production never imports this.
//   opts.scar = { mode:'seam' } | { mode:'taper', shape:'lens'|'teardrop' }
(function () {
  const CLASS_COLORS = { crypto:"#E69F00", equity:"#56B4E9", bonds:"#009E73", commodities:"#D55E00", fx:"#CC79A7", portfolio:"#F0E442" };
  const CLASS_NAMES = { crypto:"Crypto", equity:"Equity", bonds:"Bonds", commodities:"Commodities", fx:"FX", portfolio:"Portfolio" };
  const PALETTES = { wood:{neg:[83,55,38],mid:[162,119,72],pos:[225,184,111]}, market:{neg:[202,92,102],mid:[173,158,124],pos:[88,169,145]} };
  let NORM = null;
  const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x)), mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t)), rgba=(c,a=1)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;
  function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function rand(seed){let x=seed||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;};}

  function metrics(tree,year=9999){
    const rings=tree.rings.filter(r=>r.year<=year);if(!rings.length)return null;
    const scars=(tree.scars||[]).filter(s=>s.year<=year);
    return {rings,years:rings.length,scars};
  }
  function ringThickness(lg){const lo0=NORM?.lg_p5??-.45,hi0=NORM?.lg_p95??.55,t=Math.sign(lg)*Math.log1p(Math.abs(lg)*3.2),lo=Math.sign(lo0)*Math.log1p(Math.abs(lo0)*3.2),hi=Math.sign(hi0)*Math.log1p(Math.abs(hi0)*3.2);return .28+1.72*clamp((t-lo)/(hi-lo),0,1);}
  function ringFill(cls,ring,palette="wood"){
    const p=PALETTES[palette]||PALETTES.wood,la=(NORM?.lg_cls&&NORM.lg_cls[cls])||[NORM?.lg_p5||-.45,NORM?.lg_p95||.55];
    let col;if(ring.log_growth>=0)col=mix(p.mid,p.pos,Math.sqrt(clamp(ring.log_growth/la[1],0,1)));else col=mix(p.mid,p.neg,Math.sqrt(clamp(ring.log_growth/la[0],0,1)));
    const va=(NORM?.vol_cls&&NORM.vol_cls[cls])||[NORM?.vol_p10||.1,NORM?.vol_p90||.7],v=clamp((ring.vol-va[0])/(va[1]-va[0]),0,1);
    return mix(mix(col,[216,220,224],.24*(1-v)),[12,17,15],.42*v);
  }
  function boundaryPoints(cx,cy,r,R,vol01,thickness,seed){
    const rng=rand(hash(seed)),steps=Math.max(96,Math.round(R*1.15)),amp=Math.min(thickness*.18,R*(.001+.005*vol01));
    const k1=3+Math.floor(rng()*3),k2=7+Math.floor(rng()*5),p1=rng()*Math.PI*2,p2=rng()*Math.PI*2,pts=[];
    for(let i=0;i<=steps;i++){const a=-Math.PI/2+i/steps*Math.PI*2,j=amp*(.72*Math.sin(k1*a+p1)+.28*Math.sin(k2*a+p2)),rr=r+j;pts.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]);}
    return pts;
  }
  function tracePoints(g,pts,reverse=false){const first=reverse?pts.length-1:0,last=reverse?0:pts.length-1,step=reverse?-1:1;g.moveTo(...pts[first]);for(let i=first+step;reverse?i>=last:i<=last;i+=step)g.lineTo(...pts[i]);}
  function ringPath(g,outer,inner){g.beginPath();tracePoints(g,outer);tracePoints(g,inner,true);g.closePath();}

  // Shared seam geometry: builds the two organic edges + fills. `widthAt(t)` maps
  // position-along-span (0=trough/inner … 1=recovery-or-bark/outer) to a 0..1 width.
  // `halfScale` thins the whole wound (real cracks/scars are hairline-fine).
  function paintSeam(g,cx,cy,R,rStart,span,depth,baseAngle,seed,widthAt,halfScale=1){
    const half=Math.min(R*(.008+.017*depth),Math.max(1.6,rStart*.26))*halfScale,n=Math.round(clamp(span/3.5,10,32)),rng=rand(hash(seed)),p1=rng()*Math.PI*2,p2=rng()*Math.PI*2,left=[],right=[],center=[];
    for(let i=0;i<=n;i++){
      const t=i/n,r=rStart+span*t,w=clamp(widthAt(t),0,1);
      const wander=R*(.004+.010*depth)*w*(.72*Math.sin(p1+t*Math.PI*2.1)+.28*Math.sin(p2+t*Math.PI*5.3));
      const a=baseAngle+wander/Math.max(r,8),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
      const rough=(rng()-.5)*.30,wl=half*w*(1+rough),wr=half*w*(1-rough*.7+(rng()-.5)*.15),px=-Math.sin(a),py=Math.cos(a);
      left.push([x+px*wl,y+py*wl]);right.push([x-px*wr,y-py*wr]);center.push([x,y]);
    }
    g.beginPath();g.moveTo(...left[0]);for(let i=1;i<left.length;i++)g.lineTo(...left[i]);for(let i=right.length-1;i>=0;i--)g.lineTo(...right[i]);g.closePath();g.fillStyle='rgba(5,7,6,.88)';g.fill();
    const edge=pts=>{g.beginPath();g.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)g.lineTo(...pts[i]);g.strokeStyle='rgba(213,193,151,.24)';g.lineWidth=Math.max(.55,R*.0022);g.stroke();};edge(left);edge(right);
    g.beginPath();g.moveTo(...center[0]);for(let i=1;i<center.length;i++)g.lineTo(...center[i]);g.strokeStyle='rgba(0,0,0,.44)';g.lineWidth=Math.max(.45,R*.0015);g.stroke();
  }

  function seamGeom(bands,sc,year){
    const k0=bands.findIndex(b=>b.year>=sc.year);if(k0<0)return null;
    const recovered=sc.r_year!=null&&sc.r_year<=year;let k1=bands.length-1;if(recovered){k1=k0;while(k1+1<bands.length&&bands[k1+1].year<=sc.r_year)k1++;}
    const rStart=bands[k0].r0,rEnd=bands[k1].r1;
    return {recovered,rStart,span:Math.max(1,rEnd-rStart),depth:clamp(Math.abs(sc.depth||0),0,1),baseAngle:-Math.PI/2+(sc.angle||0)*Math.PI*2};
  }

  // (1) CURRENT: wide at the trough, tapers only toward recovery; open scars stay ~full.
  function drawSeam(g,cx,cy,R,bands,sc,year){
    const G=seamGeom(bands,sc,year);if(!G)return;
    const widthAt=G.recovered?(t=>.10+.90*Math.pow(1-t,.72)):(t=>.82+.12*Math.sin(Math.PI*t));
    paintSeam(g,cx,cy,R,G.rStart,G.span,G.depth,G.baseAngle,`seam|${sc.date||sc.year}|${sc.depth}`,widthAt);
  }

  // (2) TAPERED: taper to a point at BOTH ends when recovered (a closed lens); taper
  // only the trough end and stay open to the bark when unrecovered. `w` thins it
  // toward a real hairline crack.
  function drawTaperedSeam(g,cx,cy,R,bands,sc,year,shape,w){
    const G=seamGeom(bands,sc,year);if(!G)return;
    let widthAt;
    if(G.recovered){
      widthAt = shape==='teardrop'
        ? (t=>Math.pow(Math.sin(Math.PI*t),.60)*(1-.34*t))   // widest ~a third in, points at both ends
        : (t=>Math.pow(Math.sin(Math.PI*t),.90));            // symmetric lens
    } else {
      widthAt = (t=>Math.pow(clamp(t/.34,0,1),.8));           // point at trough, open to the bark
    }
    paintSeam(g,cx,cy,R,G.rStart,G.span,G.depth,G.baseAngle,`tap|${sc.date||sc.year}|${sc.depth}`,widthAt,w||.4);
  }

  function drawScar(g,cx,cy,R,bands,sc,year,style){
    if(style.mode==='taper')drawTaperedSeam(g,cx,cy,R,bands,sc,year,style.shape||'lens',style.w);
    else drawSeam(g,cx,cy,R,bands,sc,year);
  }

  function drawDetailedRings(g,tree,cx,cy,R,year=9999,opts={}){
    const m=metrics(tree,year);if(!m)return null;
    const style=opts.scar||{mode:'seam'};
    const total=m.rings.reduce((s,r)=>s+ringThickness(r.log_growth),0),core=R*.055,usable=R-core,bands=[];
    let r0=core,innerPts=boundaryPoints(cx,cy,core,R,0,0,'core');g.save();
    m.rings.forEach(ring=>{
      const r1=r0+usable*ringThickness(ring.log_growth)/total,fill=ringFill(tree.cls,ring,opts.palette),va=(NORM?.vol_cls&&NORM.vol_cls[tree.cls])||[NORM?.vol_p10||.1,NORM?.vol_p90||.7],vol01=clamp((ring.vol-va[0])/(va[1]-va[0]),0,1);
      const outerPts=boundaryPoints(cx,cy,r1,R,vol01,r1-r0,tree.id+'|'+ring.year);
      ringPath(g,outerPts,innerPts);g.fillStyle=rgba(fill);g.fill();
      g.beginPath();tracePoints(g,outerPts);g.strokeStyle='rgba(8,11,10,.68)';g.lineWidth=Math.max(.7,R*.00135);g.stroke();
      bands.push({year:ring.year,r0,r1});r0=r1;innerPts=outerPts;
    });
    g.beginPath();tracePoints(g,innerPts);g.strokeStyle=CLASS_COLORS[tree.cls]||'#aaa';g.lineWidth=Math.max(1.5,R*.004);g.stroke();
    for(const sc of m.scars)drawScar(g,cx,cy,R,bands,sc,year,style);
    if(opts.years&&R>=90){g.strokeStyle='rgba(235,228,211,.23)';g.fillStyle='rgba(235,228,211,.6)';g.font=`${Math.max(8,Math.round(R*.05))}px ui-monospace,Menlo,monospace`;g.textAlign='right';bands.forEach((b,i)=>{if(bands.length>15&&i%2&&i!==bands.length-1)return;const y=cy-(b.r0+b.r1)/2;g.beginPath();g.moveTo(cx-4,y);g.lineTo(cx+4,y);g.stroke();g.fillText(String(b.year),cx-9,y+3);});}
    g.restore();return {core,bands};
  }

  async function load(url="data/rings.json"){const res=await fetch(url);if(!res.ok)throw new Error(`rings.json: ${res.status}`);const data=await res.json();NORM=data.norm;return data;}
  window.ScarLab={CLASS_COLORS,CLASS_NAMES,clamp,metrics,drawDetailedRings,load};
})();
