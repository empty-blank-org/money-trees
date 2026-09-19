// Compare: two trees side by side. Same renderer and data contract as the tree page.
// The disc scale is the forest's age rule by default (a 17-year tree is visibly
// smaller than a century tree); "fit both" gives each tree its whole panel.
// Hovering a year on either tree highlights it on both; clicking selects it.
// The timeline draws every scar of both trees on one calendar axis.
const params=new URLSearchParams(location.search);
const $=id=>document.getElementById(id);
const pickA=$('pick-a'),pickB=$('pick-b'),tip=$('tip'),tl=$('timeline');
let trees=[],insights,side={a:null,b:null},palette=['wood','market'].includes(params.get('color'))?params.get('color'):'wood',scale=params.get('scale')==='fit'?'fit':'age';
let hoverYear=null,selectedYear=params.get('year')?+params.get('year'):null,geo={a:null,b:null},size={a:0,b:0},tlHits=[];
const AGE_REF_YEARS=100,AGE_EXP=.35;
const ageScale=t=>Math.min(1,Math.pow((t.n_rings||t.rings.length)/AGE_REF_YEARS,AGE_EXP));
const pct=x=>(x*100).toFixed(1)+'%',signed=x=>(x>=0?'+':'')+pct(x);
const treeHref=id=>window.PRETTY_ROUTES?`/tree/${id}/`:`../tree/?id=${id}`;

function setUrl(){const u=new URL(location.href);u.searchParams.set('a',side.a.id);u.searchParams.set('b',side.b.id);u.searchParams.set('color',palette);u.searchParams.set('scale',scale);if(selectedYear)u.searchParams.set('year',selectedYear);else u.searchParams.delete('year');history.replaceState(null,'',u)}

function paintSide(k){const t=side[k],cv=$('cv-'+k),art=cv.parentElement,s=Math.max(200,Math.floor(art.clientWidth)),dpr=Math.min(devicePixelRatio||1,2);
  size[k]=s;cv.width=Math.round(s*dpr);cv.height=Math.round(s*dpr);const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,s,s);
  const R=s*.445*(scale==='age'?ageScale(t):1);
  geo[k]=LivingTrees.drawDetailedRings(g,t,s/2,s/2,R,9999,{palette,years:false,fibers:true,highlightYear:hoverYear||selectedYear})}
function paint(){paintSide('a');paintSide('b');paintTimeline()}

function readout(k,year){const t=side[k],el=$('ro-'+k);if(!year){el.innerHTML='<span class="dim">hover a ring on either tree</span>';return}
  const r=t.rings.find(x=>x.year===year);
  el.innerHTML=r?`<b>${year}${r.partial?' partial':''}</b> · return ${signed(r.ret)} · vol ${pct(r.vol)} · max dd ${pct(r.max_dd)}`:`<b>${year}</b> · <span class="dim">no ring — record ${year<t.first_year?'begins '+t.first_year:'ends '+t.last_year}</span>`}
function showYear(year){hoverYear=year;readout('a',year||selectedYear);readout('b',year||selectedYear);paint()}
function selectYear(year){selectedYear=year;hoverYear=null;readout('a',year);readout('b',year);paint();setUrl()}

// ---- timeline: every drawdown episode of both trees on one calendar axis ----
const frac=d=>{const [y,m,dd]=d.split('-').map(Number);return y+(m-1)/12+(dd-1)/365};
function paintTimeline(){const wrap=tl.parentElement,W=Math.max(300,Math.floor(wrap.clientWidth-20)),H=150,dpr=Math.min(devicePixelRatio||1,2);
  tl.width=Math.round(W*dpr);tl.height=Math.round(H*dpr);tl.style.height=H+'px';const g=tl.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
  const y0=Math.min(side.a.first_year,side.b.first_year),y1=Math.max(side.a.last_year,side.b.last_year)+1,padL=54,padR=14,x=v=>padL+(v-y0)/(y1-y0)*(W-padL-padR);
  g.font='10px ui-monospace,Menlo,monospace';g.textAlign='center';g.textBaseline='top';
  const step=(y1-y0)>60?10:(y1-y0)>25?5:1;
  for(let y=Math.ceil(y0/step)*step;y<y1;y+=step){g.strokeStyle='rgba(228,218,190,.10)';g.beginPath();g.moveTo(x(y),8);g.lineTo(x(y),H-18);g.stroke();g.fillStyle='#8f897d';g.fillText(String(y),x(y),H-14)}
  if(selectedYear||hoverYear){const y=hoverYear||selectedYear;g.fillStyle='rgba(245,215,142,.10)';g.fillRect(x(y),8,x(y+1)-x(y),H-26);g.strokeStyle='rgba(255,232,170,.8)';g.beginPath();g.moveTo(x(y),8);g.lineTo(x(y),H-18);g.stroke()}
  tlHits=[];
  [['a',38],['b',86]].forEach(([k,rowY])=>{const t=side[k];
    g.fillStyle=LivingTrees.CLASS_COLORS[t.cls];g.textAlign='left';g.font='600 10px ui-monospace,Menlo,monospace';g.fillText(t.id.toUpperCase(),6,rowY-5);
    // the record's span, faint
    g.fillStyle='rgba(228,218,190,.08)';g.fillRect(x(t.first_year),rowY-10,x(t.last_year+1)-x(t.first_year),20);
    for(const sc of t.scars){const xs=x(frac(sc.peak_date||sc.date)),xt=x(frac(sc.date)),xe=sc.r_date?x(frac(sc.r_date)):x(t.last_year+1),depth=Math.min(1,Math.abs(sc.depth)),h=6+14*depth;
      const active=(hoverYear||selectedYear)===sc.year;
      g.fillStyle=active?'rgba(245,215,142,.55)':(sc.nested?'rgba(150,110,70,.55)':'rgba(120,80,45,.75)');g.fillRect(xs,rowY-h/2,Math.max(2,xe-xs),h);
      if(!sc.r_date){g.strokeStyle='rgba(228,218,190,.5)';g.setLineDash([2,2]);g.beginPath();g.moveTo(xe-1,rowY-h/2);g.lineTo(xe-1,rowY+h/2);g.stroke();g.setLineDash([])}
      g.fillStyle=active?'#ffe8aa':'#0b0806';g.beginPath();g.arc(xt,rowY,3,0,Math.PI*2);g.fill();
      tlHits.push({x0:Math.min(xs,xt-4),x1:Math.max(xe,xt+4),y0:rowY-12,y1:rowY+12,sc,k})}});
}
function tlHit(e){const r=tl.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;let best=null;for(const h of tlHits)if(px>=h.x0&&px<=h.x1&&py>=h.y0&&py<=h.y1&&(!best||(h.x1-h.x0)<(best.x1-best.x0)))best=h;return best}
tl.onmousemove=e=>{const h=tlHit(e);tl.style.cursor=h?'pointer':'default';if(!h){tip.style.opacity=0;if(hoverYear){showYear(null)}return}
  const s=h.sc,t=side[h.k];tip.innerHTML=`<b>${t.id.toUpperCase()} · ${s.date}</b><br>${pct(s.depth)} drawdown from the ${s.peak_date} ${s.nested?'interim high':'peak'}<br>${s.r_date?`recovered ${s.r_date}`:'not yet recovered'}`;tip.style.left=Math.min(innerWidth-280,e.clientX+14)+'px';tip.style.top=Math.max(8,e.clientY+14)+'px';tip.style.opacity=1;if(hoverYear!==s.year)showYear(s.year)};
tl.onmouseleave=()=>{tip.style.opacity=0;if(hoverYear)showYear(null)};
tl.onclick=e=>{const h=tlHit(e);if(h)selectYear(h.sc.year)};

// ---- facts ----
function facts(){const A=side.a,B=side.b,ma=LivingTrees.metrics(A),mb=LivingTrees.metrics(B);
  const rows=[
    ['family',TreeInsights.FAMILY_LABELS[TreeInsights.familyOf(insights,A)],TreeInsights.FAMILY_LABELS[TreeInsights.familyOf(insights,B)],null],
    ['record',`${A.first_year}–${A.last_year} · ${ma.years} rings`,`${B.first_year}–${B.last_year} · ${mb.years} rings`,null],
    ['annualized growth',signed(ma.cagr),signed(mb.cagr),ma.cagr>mb.cagr?'a':'b'],
    ['accumulated growth',mult(ma),mult(mb),ma.cagr>mb.cagr?'a':'b'],
    ['mean volatility',pct(ma.meanVol),pct(mb.meanVol),ma.meanVol<mb.meanVol?'a':'b'],
    ['worst drawdown',pct(ma.worst),pct(mb.worst),ma.worst>mb.worst?'a':'b'],
    ['positive years',Math.round(ma.positive*100)+'%',Math.round(mb.positive*100)+'%',ma.positive>mb.positive?'a':'b'],
    ['major scars',String(ma.scars.length),String(mb.scars.length),ma.scars.length<mb.scars.length?'a':ma.scars.length>mb.scars.length?'b':null],
  ];
  $('facts').innerHTML=`<thead><tr><th></th><th>${A.name}</th><th>${B.name}</th></tr></thead><tbody>${rows.map(([l,a,b,w])=>`<tr><td>${l}</td><td class="${w==='a'?'better':''}">${a}</td><td class="${w==='b'?'better':''}">${b}</td></tr>`).join('')}</tbody>`}
function mult(m){const x=Math.pow(1+m.cagr,m.ageYears);if(x<10)return signed(x-1);const p=Math.pow(10,Math.floor(Math.log10(x))-1),r=Math.round(x/p)*p;return `~${r>=1000?Math.round(r).toLocaleString():r.toFixed(r<100?1:0)}×`}

// ---- wiring ----
function update(){for(const k of ['a','b']){const t=side[k];$('name-'+k).innerHTML=`<a href="${treeHref(t.id)}">${t.name}</a>`;const c=$('cls-'+k);c.textContent=`${t.id.toUpperCase()} · ${LivingTrees.CLASS_NAMES[t.cls]} · ${TreeInsights.FAMILY_LABELS[TreeInsights.familyOf(insights,t)]}`;c.style.color=LivingTrees.CLASS_COLORS[t.cls];$('cv-'+k).setAttribute('aria-label',`${t.name}, annual rings`)}
  pickA.value=side.a.id;pickB.value=side.b.id;document.title=`${side.a.name} vs ${side.b.name} — Money Tree Forest`;$('title').textContent=`${side.a.name} vs ${side.b.name}`;
  if(selectedYear&&!side.a.rings.some(r=>r.year===selectedYear)&&!side.b.rings.some(r=>r.year===selectedYear))selectedYear=null;
  readout('a',selectedYear);readout('b',selectedYear);facts();paint();setUrl()}
function syncToggles(){document.querySelectorAll('#palette [data-palette]').forEach(b=>{const on=b.dataset.palette===palette;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});$('legend').dataset.palette=palette;
  document.querySelectorAll('#scale [data-scale]').forEach(b=>{const on=b.dataset.scale===scale;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))})}
$('palette').onclick=e=>{const b=e.target.closest('[data-palette]');if(!b)return;palette=b.dataset.palette;syncToggles();paint();setUrl()};
$('scale').onclick=e=>{const b=e.target.closest('[data-scale]');if(!b)return;scale=b.dataset.scale;syncToggles();paint();setUrl()};
$('swap').onclick=()=>{[side.a,side.b]=[side.b,side.a];update()};
pickA.onchange=()=>{side.a=trees.find(t=>t.id===pickA.value);update()};pickB.onchange=()=>{side.b=trees.find(t=>t.id===pickB.value);update()};
for(const k of ['a','b']){const cv=$('cv-'+k);
  cv.onmousemove=e=>{const r=cv.getBoundingClientRect(),s=size[k],b=LivingTrees.detailedRingAt(geo[k],s/2,s/2,(e.clientX-r.left)*s/r.width,(e.clientY-r.top)*s/r.height);if(!b){tip.style.opacity=0;if(hoverYear)showYear(null);return}if(hoverYear!==b.year)showYear(b.year);tip.style.opacity=0};
  cv.onmouseleave=()=>{if(hoverYear)showYear(null)};
  cv.onclick=e=>{const r=cv.getBoundingClientRect(),s=size[k],b=LivingTrees.detailedRingAt(geo[k],s/2,s/2,(e.clientX-r.left)*s/r.width,(e.clientY-r.top)*s/r.height);if(b)selectYear(b.year)};
  cv.onkeydown=e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();const years=[...new Set([...side.a.rings,...side.b.rings].map(r=>r.year))].sort((a,b)=>a-b),cur=selectedYear||years[years.length-1],i=Math.max(0,years.indexOf(cur));selectYear(years[Math.max(0,Math.min(years.length-1,i+(e.key==='ArrowLeft'?-1:1)))])}}
window.addEventListener('resize',paint);

LivingTrees.load('../data/rings.json').then(d=>{trees=d.trees.filter(t=>t.featured);insights=TreeInsights.create(trees);
  const opts=trees.slice().sort((x,y)=>x.name.localeCompare(y.name)).map(t=>`<option value="${t.id}">${t.name} · ${t.id.toUpperCase()}</option>`).join('');pickA.innerHTML=opts;pickB.innerHTML=opts;
  const byId=id=>trees.find(t=>t.id===(id||'').toLowerCase());
  side.a=byId(params.get('a'))||byId('spy');side.b=byId(params.get('b'))||byId('btc');if(side.a===side.b)side.b=trees.find(t=>t!==side.a);
  syncToggles();$('freshness').textContent=`Prices through ${new Date(`${d.data_through}T12:00:00Z`).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'})}`;update()}).catch(err=>{console.error(err);$('title').textContent='The comparison could not load.'});
