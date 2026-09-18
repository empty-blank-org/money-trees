// The encoding key ("How to read"), built once and mounted on every page that
// draws rings, so the Forest and the Tree page can never drift apart.
// Mount point: <details class="read-key" data-reading-key></details>
(function () {
  const ITEMS = [
    ['width-mark', '<i></i><i></i>', 'Ring width', 'Wider means stronger annual growth.'],
    ['color-mark', '', 'Color', 'Down year → flat → up year.'],
    ['vol-mark', '', 'Darkness + grain', 'More means higher volatility.'],
    ['scar-mark', '', 'Scar', 'Major drawdown; reaching bark means unrecovered.'],
    ['year-mark', '1Y', 'One band', 'One calendar year.']
  ];
  const html = () => `<summary>How to read</summary><div class="reading-grid">${ITEMS.map(([cls, inner, name, text]) =>
    `<div class="reading-item"><span class="key-mark ${cls}">${inner}</span><span><b>${name}</b> ${text}</span></div>`).join('')}</div>`;

  function mount() {
    document.querySelectorAll('details[data-reading-key]').forEach(el => {
      el.innerHTML = html();
      // A popover should get out of the way: close on outside click and on Escape.
      document.addEventListener('click', e => { if (el.open && !el.contains(e.target)) el.open = false; });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.open) el.open = false; });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.ReadingKey = { html, mount };
})();
