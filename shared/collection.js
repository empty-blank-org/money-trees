// Shared collection ordering — the SINGLE source of "what order are the trees in".
// Used by the forest grid AND the tree prev/next, so stepping through
// trees matches the collection you came from. Family membership (the archetype
// taxonomy) lives in TreeInsights; this module only SORTS + applies the class/
// family/search filters. Sorts are pure orderings by metric — no archetype names,
// so they never collide with the family control.
(function () {
  const metric = t => LivingTrees.metrics(t, 9999);

  const SORTS = {
    curated:     { label: 'Curated',              headline: 'in curated order',                compare: (a, b) => a._i - b._i,                                 value: () => '' },
    growth:      { label: 'Highest growth',       headline: 'by annualized growth, highest first',     compare: (a, b) => b.cagr - a.cagr,                             value: t => `${(t.cagr * 100).toFixed(1)}% CAGR` },
    vol:         { label: 'Calmest',              headline: 'by mean volatility, calmest first',   compare: (a, b) => a.mean_vol - b.mean_vol,                     value: t => `${(t.mean_vol * 100).toFixed(1)}% mean vol` },
    age:         { label: 'Oldest',               headline: 'by length of record, oldest first',      compare: (a, b) => b.age_years - a.age_years,                   value: t => `${t.age_years.toFixed(1)} years · ${t.n_rings} rings` },
    drawdown:    { label: 'Deepest drawdown',     headline: 'by worst drawdown, deepest first',       compare: (a, b) => a.worst_dd - b.worst_dd,                     value: t => `${(t.worst_dd * 100).toFixed(1)}% worst DD` },
    consistency: { label: 'Most positive years',  headline: 'by share of positive years, highest first',   compare: (a, b) => metric(b).positive - metric(a).positive,     value: t => `${Math.round(metric(t).positive * 100)}% positive years` },
    scars:       { label: 'Most scars',           headline: 'by number of major scars, most first',   compare: (a, b) => b.scars.length - a.scars.length,             value: t => `${t.scars.length} scar${t.scars.length === 1 ? '' : 's'}` },
  };
  const SORT_ORDER = ['curated', 'growth', 'vol', 'age', 'drawdown', 'consistency', 'scars'];

  // Filter (class + family + search) then sort. Returns a new array; never mutates.
  function order(trees, insights, { sort = 'curated', cls = 'all', family = 'all', q = '' } = {}) {
    const cfg = SORTS[sort] || SORTS.curated;
    const query = (q || '').trim().toLowerCase();
    return trees.filter(t =>
      (cls === 'all' || t.cls === cls) &&
      (family === 'all' || TreeInsights.familyOf(insights, t) === family) &&
      (!query || t.id.includes(query) || (t.name || '').toLowerCase().includes(query))
    ).slice().sort(cfg.compare);
  }

  window.Collection = { SORTS, SORT_ORDER, order };
})();
