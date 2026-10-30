/* Loja — comportamento do site. Configuração em window.LOJA (assets/config.js, gerado pelo build). */
(() => {
  const L = window.LOJA || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CHAVE_COMPRAS = 'loja-compras-demo';

  /* ---------------- Toast ---------------- */
  let toastT;
  function toast(msg) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
    t.textContent = msg;
    t.classList.add('ver');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('ver'), 2600);
  }

  /* ---------------- Telas escaladas (iframe de 1440px reduzido ao container) ---------------- */
  function ajustarTela(tela) {
    const iframe = $('iframe', tela);
    if (!iframe) return;
    const lw = Number(tela.dataset.largura) || 1440;
    const lh = Number(tela.dataset.altura) || 900;
    const disponivel = tela.parentElement.clientWidth - (parseFloat(getComputedStyle(tela.parentElement).paddingLeft) * 2 || 0);
    const escala = Math.min(1, disponivel / lw);
    iframe.style.width = lw + 'px';
    iframe.style.height = lh + 'px';
    iframe.style.transform = `scale(${escala})`;
    tela.style.width = lw * escala + 'px';
    tela.style.height = lh * escala + 'px';
  }
  const ro = new ResizeObserver((ents) => ents.forEach((e) => $$('.tela', e.target).forEach(ajustarTela)));
  function registrarTelas(raiz = document) {
    $$('.tela', raiz).filter((t) => !t.closest('.visor')).forEach((t) => {
      ajustarTela(t);
      ro.observe(t.parentElement);
      const f = $('iframe', t);
      if (f && !f.dataset.ok) {
        t.classList.add('tela-carregando');
        f.addEventListener('load', () => { t.classList.remove('tela-carregando'); f.dataset.ok = 1; }, { once: true });
      }
    });
  }

  /* ---------------- Visor em tela cheia: um modelo por vez, com setas ---------------- */
  const visor = $('#visor');
  if (visor) {
    const telaV = $('.tela', visor);
    const iframeV = $('iframe', telaV);
    const palco = $('.visor-palco', visor);
    const setas = $$('[data-visor-ant], [data-visor-prox]', visor);
    let lista = [];      // slugs navegáveis (os cards visíveis da grade de onde se abriu)
    let idx = 0;
    let hashAntes = '';  // o endereço ganha #ver=<slug> enquanto o visor está aberto (link compartilhável)
    let dispositivo = { largura: 1440, altura: 0 }; // altura 0 = a do próprio modelo

    function ajustarVisor() {
      const lw = Number(telaV.dataset.largura) || 1440;
      const lh = Number(telaV.dataset.altura) || 900;
      const cs = getComputedStyle(palco);
      const dw = palco.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const dh = palco.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const escala = Math.max(0.05, Math.min(1, dw / lw, dh / lh));
      iframeV.style.width = lw + 'px';
      iframeV.style.height = lh + 'px';
      iframeV.style.transform = `scale(${escala})`;
      telaV.style.width = lw * escala + 'px';
      telaV.style.height = lh * escala + 'px';
    }
    new ResizeObserver(() => { if (visor.open) ajustarVisor(); }).observe(palco);

    function mostrarItem() {
      const slug = lista[idx];
      const p = L.produtos[slug];
      if (!p) return;
      $('#visor-nome').textContent = p.nome;
      $('#visor-meta').textContent = `${p.categoria} · v${p.versao}`;
      $('#visor-contador').textContent = lista.length > 1 ? `${idx + 1} / ${lista.length}` : '';
      $('#visor-resumo').textContent = p.resumo || '';
      $('#visor-preco').textContent = p.gratuito ? 'Grátis' : p.precoTexto;
      $('#visor-detalhes').href = p.url;
      $('#visor-externo').href = `/previas/${slug}/`;
      const baixar = $('#visor-baixar');
      const comprar = $('#visor-comprar');
      baixar.hidden = !p.gratuito;
      comprar.hidden = !!p.gratuito;
      if (p.gratuito) baixar.href = p.download;
      else comprar.dataset.comprar = slug;
      setas.forEach((b) => { b.disabled = lista.length < 2; });
      telaV.style.setProperty('--fundo', p.fundo || '#141412');
      telaV.dataset.largura = dispositivo.largura;
      telaV.dataset.altura = dispositivo.altura || p.altura || 900;
      telaV.classList.add('tela-carregando');
      iframeV.src = `/previas/${slug}/`;
      ajustarVisor();
      history.replaceState(null, '', `#ver=${slug}`);
    }
    iframeV.addEventListener('load', () => telaV.classList.remove('tela-carregando'));

    function abrirVisor(slug, origem) {
      const grade = origem?.closest('.grade') || $('#grade');
      lista = grade ? $$('.card[data-slug]:not([hidden])', grade).map((c) => c.dataset.slug) : [];
      if (!lista.includes(slug)) lista = [slug, ...lista.filter((s) => s !== slug)];
      idx = lista.indexOf(slug);
      // Em telas pequenas começa no tamanho celular (o desktop reduzido ficaria ilegível).
      const inicial = innerWidth < 760 ? '390' : '1440';
      $$('.seg button[data-largura]', visor).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.largura === inicial)));
      const bi = $(`.seg button[data-largura="${inicial}"]`, visor);
      dispositivo = { largura: Number(bi.dataset.largura), altura: Number(bi.dataset.altura) || 0 };
      if (!visor.open) hashAntes = location.hash.startsWith('#ver=') ? '' : location.hash;
      mostrarItem();
      if (!visor.open) visor.showModal();
    }
    const passo = (d) => { if (lista.length < 2) return; idx = (idx + d + lista.length) % lista.length; mostrarItem(); };

    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ver]');
      if (b) { e.preventDefault(); abrirVisor(b.dataset.ver, b); }
    });
    $$('[data-visor-ant]', visor).forEach((b) => b.addEventListener('click', () => passo(-1)));
    $$('[data-visor-prox]', visor).forEach((b) => b.addEventListener('click', () => passo(1)));
    $$('.seg button[data-largura]', visor).forEach((b) => b.addEventListener('click', () => {
      $$('.seg button', visor).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      dispositivo = { largura: Number(b.dataset.largura), altura: Number(b.dataset.altura) || 0 };
      const p = L.produtos[lista[idx]];
      telaV.dataset.largura = dispositivo.largura;
      telaV.dataset.altura = dispositivo.altura || p?.altura || 900;
      ajustarVisor();
    }));
    visor.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); passo(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); passo(1); }
    });
    visor.addEventListener('click', (e) => { if (e.target === visor) visor.close(); });
    visor.addEventListener('close', () => {
      iframeV.src = 'about:blank';
      history.replaceState(null, '', hashAntes || location.pathname + location.search);
    });
    // Link direto: /#ver=login-mascote abre o visor já naquele modelo.
    const direto = /^#ver=([\w-]+)$/.exec(location.hash);
    if (direto && L.produtos[direto[1]]) abrirVisor(direto[1], null);
  }

  /* ---------------- Filtros e busca do catálogo ---------------- */
  const grade = $('#grade');
  if (grade) {
    const cards = $$('.card', grade);
    const chips = $$('.chip[data-filtro]');
    const busca = $('#busca');
    const contador = $('#contador');
    const vazio = $('#vazio');
    const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    let filtro = (location.hash.slice(1) || 'todos');
    if (!chips.some((c) => c.dataset.filtro === filtro)) filtro = 'todos';
    function aplicar() {
      const q = norm(busca?.value || '');
      let n = 0;
      for (const c of cards) {
        const okF = filtro === 'todos' || (filtro === 'gratis' ? c.dataset.gratis === '1' : c.dataset.cat === filtro);
        const okB = !q || norm(c.dataset.busca).includes(q);
        c.hidden = !(okF && okB);
        if (!c.hidden) n++;
      }
      chips.forEach((ch) => ch.setAttribute('aria-pressed', String(ch.dataset.filtro === filtro)));
      if (contador) contador.textContent = n === 1 ? '1 modelo' : `${n} modelos`;
      if (vazio) vazio.hidden = n > 0;
    }
    chips.forEach((ch) => ch.addEventListener('click', () => {
      filtro = ch.dataset.filtro;
      history.replaceState(null, '', filtro === 'todos' ? location.pathname : '#' + filtro);
      aplicar();
    }));
    busca?.addEventListener('input', aplicar);
    const rolarAoCatalogo = () => { if (filtro !== 'todos') $('#catalogo')?.scrollIntoView({ behavior: reduzido ? 'auto' : 'smooth' }); };
    addEventListener('hashchange', () => {
      const h = location.hash.slice(1);
      if (h === 'catalogo' || !h) filtro = 'todos';
      else if (chips.some((c) => c.dataset.filtro === h)) filtro = h;
      else return;
      aplicar();
      rolarAoCatalogo();
    });
    aplicar();
    rolarAoCatalogo();
  }

  /* ---------------- Página de produto: tamanhos da prévia ---------------- */
  const corpo = $('.previa-corpo');
  if (corpo) {
    const tela = $('.tela', corpo);
    const janela = corpo.parentElement;
    $$('.seg button[data-largura]', janela).forEach((b) => b.addEventListener('click', () => {
      $$('.seg button', janela).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      tela.dataset.largura = b.dataset.largura;
      tela.dataset.altura = b.dataset.altura;
      corpo.dataset.dispositivo = b.dataset.largura;
      ajustarTela(tela);
    }));
    $('#recarregar')?.addEventListener('click', () => { const f = $('iframe', tela); f.src = f.src; });
    // Em telas pequenas a prévia já abre no tamanho celular (o desktop reduzido ficaria ilegível).
    if (innerWidth < 760) $('.seg button[data-largura="390"]', janela)?.click();
  }

  /* ---------------- Compra ---------------- */
  const dlg = $('#dlg-compra');
  const form = $('#form-compra');
  let slugCompra = null;
  $$('[data-comprar]').forEach((b) => b.addEventListener('click', () => {
    slugCompra = b.dataset.comprar;
    const p = L.produtos[slugCompra];
    $('#dlg-nome').textContent = p.nome;
    $('#dlg-preco').textContent = p.precoTexto;
    $('#dlg-capa').src = p.capa;
    $('#dlg-msg').hidden = true;
    const salvo = localStorage.getItem('loja-email');
    if (salvo && !form.email.value) form.email.value = salvo;
    dlg.showModal();
    form.email.focus();
  }));
  $$('[data-fechar]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  dlg?.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim().toLowerCase();
    const msg = $('#dlg-msg');
    const botao = $('button[type="submit"]', form);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return mostrar(msg, 'Digite um e-mail válido. É nele que você recebe o acesso.', true);
    if (!form.aceite.checked) return mostrar(msg, 'Confirme que leu a licença de uso.', true);
    localStorage.setItem('loja-email', email);
    botao.disabled = true;
    const original = botao.innerHTML;
    botao.textContent = 'Abrindo pagamento…';
    try {
      if (L.modo !== 'producao') {
        // Modo local (npm run dev): o servidor atende /__api/checkout — simulado ou Asaas Sandbox,
        // conforme a chave salva em /admin/.
        const r = await fetch('/__api/checkout', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: slugCompra, email }),
        }).catch(() => null);
        if (r && r.status !== 404) {
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j.url) throw new Error(j.erro || 'Não foi possível iniciar o pagamento.');
          location.href = j.url;
          return;
        }
        // Site estático de demonstração (sem servidor): simula no próprio navegador.
        await new Promise((r) => setTimeout(r, 700));
        const compras = JSON.parse(localStorage.getItem(CHAVE_COMPRAS) || '[]');
        if (!compras.some((c) => c.slug === slugCompra)) compras.push({ slug: slugCompra, email, data: new Date().toISOString() });
        localStorage.setItem(CHAVE_COMPRAS, JSON.stringify(compras));
        location.href = `/obrigado/?slug=${encodeURIComponent(slugCompra)}&demo=1`;
        return;
      }
      const r = await fetch(`${L.supabaseUrl}/functions/v1/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: L.supabaseAnonKey, Authorization: `Bearer ${L.supabaseAnonKey}` },
        body: JSON.stringify({ slug: slugCompra, email }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw new Error(j.erro || 'Não foi possível iniciar o pagamento.');
      location.href = j.url;
    } catch (err) {
      mostrar(msg, err.message, true);
      botao.disabled = false;
      botao.innerHTML = original;
    }
  });

  function mostrar(el, texto, erro) {
    el.hidden = false;
    el.className = 'msg ' + (erro ? 'msg-erro' : 'msg-ok');
    el.textContent = texto;
  }

  /* ---------------- Supabase (só em produção) ---------------- */
  let sbPromessa;
  function supabase() {
    sbPromessa ||= import('https://esm.sh/@supabase/supabase-js@2.45.4').then(({ createClient }) =>
      createClient(L.supabaseUrl, L.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true } }));
    return sbPromessa;
  }

  async function baixar(slug, botao) {
    const p = L.produtos[slug];
    if (!p) return;
    if (p.gratuito) { location.href = p.download; return; }
    if (L.modo !== 'producao') {
      // Modo local (npm run dev): o servidor entrega o zip pago. No site estático de
      // demonstração não existe /__privado/: avisa em vez de cair numa página 404.
      const url = `/__privado/${p.arquivo}`;
      const r = await fetch(url, { method: 'HEAD' }).catch(() => null);
      if (r && r.ok) location.href = url;
      else toast('Site em demonstração: o arquivo é entregue quando os pagamentos estiverem ativos.');
      return;
    }
    botao && (botao.disabled = true);
    try {
      const sb = await supabase();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { location.href = '/conta/'; return; }
      const r = await fetch(`${L.supabaseUrl}/functions/v1/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: L.supabaseAnonKey, Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ slug }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw new Error(j.erro || 'Download indisponível.');
      location.href = j.url;
    } catch (err) {
      toast(err.message);
    } finally {
      botao && (botao.disabled = false);
    }
  }

  function itemCompra(slug, extra = '') {
    const p = L.produtos[slug];
    if (!p) return '';
    return `<div class="compra-item">
      <img src="${p.capa}" alt="" loading="lazy">
      <div><b>${p.nome}</b><small>v${p.versao}${extra}</small></div>
      <button class="btn btn-sinal" data-baixar="${slug}" type="button">${ICONE_DOWNLOAD}Baixar .zip</button>
    </div>`;
  }
  const ICONE_DOWNLOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg>';
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-baixar]');
    if (b) baixar(b.dataset.baixar, b);
  });

  /* ---------------- Página: Minha conta ---------------- */
  const conta = $('#conta');
  if (conta) iniciarConta();
  async function iniciarConta() {
    const lista = $('#conta-lista');
    const login = $('#conta-login');
    const sessao = $('#conta-sessao');
    if (L.modo !== 'producao') {
      // Compras do servidor local (npm run dev) + as simuladas no navegador (site estático de demonstração).
      const locais = JSON.parse(localStorage.getItem(CHAVE_COMPRAS) || '[]');
      const r = await fetch('/__api/compras').catch(() => null);
      const doServidor = r?.ok ? (await r.json()).compras : [];
      const compras = [
        ...doServidor.map((c) => ({ slug: c.produto_slug, email: c.email, data: c.pago_em || c.criado_em })),
        ...locais,
      ].filter((c, i, todos) => todos.findIndex((x) => x.slug === c.slug) === i);
      login.hidden = true;
      sessao.hidden = false;
      $('#conta-email').textContent = compras[0]?.email || 'modo demonstração';
      lista.innerHTML = compras.length
        ? compras.map((c) => itemCompra(c.slug, ' · ' + new Date(c.data).toLocaleDateString('pt-BR'))).join('')
        : '<p class="vazio">Nenhuma compra ainda. No modo local, sem chave do Asaas, qualquer compra é aprovada na hora.</p>';
      $('#conta-sair').onclick = async () => {
        localStorage.removeItem(CHAVE_COMPRAS);
        await fetch('/__api/limpar', { method: 'POST' }).catch(() => {});
        location.reload();
      };
      return;
    }
    const sb = await supabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      login.hidden = false;
      const f = $('#form-login');
      const msg = $('#login-msg');
      f.email.value = localStorage.getItem('loja-email') || '';
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = f.email.value.trim().toLowerCase();
        const b = $('button', f);
        b.disabled = true;
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + '/conta/' } });
        b.disabled = false;
        if (error) mostrar(msg, 'Não deu para enviar o link: ' + error.message, true);
        else mostrar(msg, `Enviamos um link de acesso para ${email}. Abra o e-mail neste aparelho.`, false);
      });
      return;
    }
    sessao.hidden = false;
    $('#conta-email').textContent = session.user.email;
    $('#conta-sair').onclick = async () => { await sb.auth.signOut(); location.reload(); };
    const { data, error } = await sb.from('compras').select('produto_slug, criado_em').eq('status', 'pago').order('criado_em', { ascending: false });
    if (error) { lista.innerHTML = `<p class="msg msg-erro">${error.message}</p>`; return; }
    const vistos = new Set();
    const itens = (data || []).filter((c) => !vistos.has(c.produto_slug) && vistos.add(c.produto_slug));
    lista.innerHTML = itens.length
      ? itens.map((c) => itemCompra(c.produto_slug, ' · ' + new Date(c.criado_em).toLocaleDateString('pt-BR'))).join('')
      : '<p class="vazio">Nenhuma compra encontrada para este e-mail. Se pagou com Pix agora há pouco, aguarde 1 minuto e recarregue.</p>';
  }

  /* ---------------- Página: Obrigado ---------------- */
  const obrigado = $('#obrigado');
  if (obrigado) {
    const q = new URLSearchParams(location.search);
    const slug = q.get('slug');
    const p = L.produtos[slug];
    if (p) {
      $('#obrigado-nome').textContent = p.nome;
      $('#obrigado-capa').src = p.capa;
      $('#obrigado-capa').hidden = false;
      const liberar = () => {
        $('#obrigado-acao').innerHTML = `<button class="btn btn-sinal btn-largo" data-baixar="${slug}" type="button">${ICONE_DOWNLOAD}Baixar ${p.nome}</button>`;
      };
      if (L.modo !== 'producao') {
        const compra = q.get('compra');
        if (!compra) liberar();
        else {
          // Voltou do Asaas (ou do pagamento simulado) no modo local: o servidor confirma a compra.
          fetch('/__api/retorno', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ compra }) })
            .then((r) => r.json()).then((j) => { if (j.status === 'pago') liberar(); else toast('Pagamento ainda não confirmado.'); })
            .catch(() => liberar());
        }
      }
    }
  }

  /* ---------------- Voltou do checkout sem pagar ---------------- */
  const retornoPagamento = new URLSearchParams(location.search).get('pagamento');
  if (retornoPagamento === 'cancelado') setTimeout(() => toast('Pagamento cancelado. Nada foi cobrado.'), 400);
  if (retornoPagamento === 'expirado') setTimeout(() => toast('O link de pagamento expirou. É só tentar de novo.'), 400);

  /* ---------------- Copiar (prompts, URLs) ---------------- */
  async function copiarTexto(texto) {
    try { await navigator.clipboard.writeText(texto); return true; } catch { /* usa o plano B */ }
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copiar]');
    if (!b) return;
    const alvo = document.getElementById(b.dataset.copiar);
    if (!alvo) return;
    const ok = await copiarTexto(alvo.textContent.trim());
    toast(ok ? (b.closest('.prompt') ? 'Prompt copiado — cole no Axyoma' : 'Copiado') : 'Não deu para copiar. Selecione o texto e use Ctrl+C.');
    const rotulo = $('span', b);
    if (ok && rotulo) { const antes = rotulo.textContent; rotulo.textContent = 'Copiado!'; setTimeout(() => { rotulo.textContent = antes; }, 1600); }
  });

  /* ---------------- Fotos de contexto ---------------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-foto]');
    if (!b) return;
    const dlgFoto = document.createElement('dialog');
    dlgFoto.className = 'dlg dlg-foto';
    dlgFoto.innerHTML = `<button class="icone-btn dlg-fechar" type="button" aria-label="Fechar foto">×</button><img src="${b.dataset.foto}" alt="Foto ampliada do modelo">`;
    document.body.append(dlgFoto);
    dlgFoto.querySelector('button').onclick = () => dlgFoto.close();
    dlgFoto.addEventListener('click', (ev) => { if (ev.target === dlgFoto) dlgFoto.close(); });
    dlgFoto.addEventListener('close', () => dlgFoto.remove());
    dlgFoto.showModal();
  });

  registrarTelas();
  window.Loja = { toast, ajustarTela, supabase, mostrar, copiarTexto };
})();
