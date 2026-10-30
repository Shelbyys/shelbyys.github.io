/* Selo de prévia, injetado só nas demos de produtos pagos publicadas no site. */
(() => {
  const dentroDaLoja = window.top !== window.self;
  const el = document.createElement('a');
  el.href = dentroDaLoja ? '#' : location.pathname.replace(/^\/previas\//, '/p/');
  el.target = dentroDaLoja ? '' : '_top';
  el.textContent = dentroDaLoja ? 'Prévia' : 'Prévia · comprar o código';
  el.setAttribute('aria-label', 'Prévia do modelo — o código completo vem no download');
  el.style.cssText = [
    'position:fixed', 'right:14px', 'bottom:14px', 'z-index:2147483647',
    'font:600 11px/1 ui-monospace,Menlo,monospace', 'letter-spacing:.06em', 'text-transform:uppercase',
    'padding:7px 10px', 'border-radius:99px', 'background:rgba(13,13,12,.78)', 'color:#f2efe8',
    'backdrop-filter:blur(6px)', 'text-decoration:none', dentroDaLoja ? 'pointer-events:none' : '',
  ].join(';');
  const pronto = () => document.body.append(el);
  document.body ? pronto() : addEventListener('DOMContentLoaded', pronto);
})();
