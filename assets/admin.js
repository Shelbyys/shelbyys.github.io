/* Painel /admin/ — configura o Asaas, acompanha vendas, pausa produtos, prompts e administradores.
   Modo local (npm run dev): fala com /__api/admin, sem login (só no seu computador).
   Produção: fala com a Edge Function "admin", com login por link mágico (só e-mails da tabela admins). */
(() => {
  const L = window.LOJA || {};
  const Loja = window.Loja;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const local = L.modo !== 'producao';
  const BRL = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STATUS = { pago: 'Pago', pendente: 'Pendente', reembolsado: 'Reembolsado', cancelado: 'Cancelado', expirado: 'Expirado', falhou: 'Falhou' };
  let token = null;
  let estado = null;

  async function api(acao, dados = {}) {
    const url = local ? '/__api/admin' : `${L.supabaseUrl}/functions/v1/admin`;
    const headers = { 'Content-Type': 'application/json' };
    if (!local) { headers.apikey = L.supabaseAnonKey; headers.Authorization = `Bearer ${token}`; }
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ acao, ...dados }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(r.status === 404 && local ? 'Servidor local não encontrado. Abra a loja com npm run dev.' : (j.erro || `Erro ${r.status}`));
      e.status = r.status;
      throw e;
    }
    return j;
  }

  function aviso(el, texto, tipo = 'ok') {
    el.hidden = false;
    el.className = 'msg ' + (tipo === 'erro' ? 'msg-erro' : 'msg-ok');
    el.textContent = texto;
  }

  /* ---------------- Entrada ---------------- */
  async function iniciar() {
    if (local) return abrirApp();
    const sb = await Loja.supabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      $('#adm-quem').textContent = 'Entre com um e-mail de administrador.';
      $('#adm-login').hidden = false;
      const f = $('#adm-form-login');
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = f.email.value.trim().toLowerCase();
        const b = $('button', f);
        b.disabled = true;
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + '/admin/' } });
        b.disabled = false;
        aviso($('#adm-login-msg'), error ? 'Não deu para enviar: ' + error.message : `Se ${email} for administrador, o link de acesso chega em instantes.`, error ? 'erro' : 'ok');
      });
      return;
    }
    token = session.access_token;
    sb.auth.onAuthStateChange((_, s) => { token = s?.access_token || token; });
    try {
      await abrirApp();
    } catch (err) {
      $('#adm-quem').innerHTML = `${esc(err.message)} <button class="btn" type="button" id="adm-sair">Sair</button>`;
      $('#adm-sair').onclick = async () => { await sb.auth.signOut(); location.reload(); };
    }
  }

  async function abrirApp() {
    estado = await api('estado');
    $('#adm-app').hidden = false;
    $('#adm-quem').textContent = local
      ? 'Modo local: as configurações ficam em loja/.local/ no seu computador.'
      : `Conectado como ${estado.eu}`;
    const modo = $('#adm-modo');
    modo.hidden = false;
    modo.textContent = local ? 'Local' : 'Produção';
    modo.dataset.tipo = local ? 'local' : 'producao';
    pintarEstado();
    ligarAbas();
    ligarPagamentos();
    ligarVendas();
    ligarAdmins();
  }

  function pintarEstado() {
    const c = estado.config;
    const r = estado.resumo;
    $('#kpi-vendas').textContent = r.vendas;
    $('#kpi-receita').textContent = BRL(r.receitaCentavos);
    $('#kpi-pendentes').textContent = r.pendentes;
    $('#kpi-reembolsos').textContent = r.reembolsos;

    const f = $('#adm-form-asaas');
    f.querySelector(`input[name="ambiente"][value="${c.ambiente}"]`).checked = true;
    $$('input[name="metodos"]', f).forEach((i) => { i.checked = c.metodos.includes(i.value); });
    f.minutosExpirar.value = c.minutosExpirar;
    f.siteUrl.value = c.siteUrl || '';
    f.emailAvisos.value = c.emailAvisos || '';
    f.chave.value = '';
    f.chave.placeholder = c.temChave ? `${c.chaveMascarada} (salva — deixe vazio para manter)` : '$aact_...';

    $('#adm-webhook-url').textContent = estado.webhookUrl || (local ? 'Em produção: https://SEU-PROJETO.supabase.co/functions/v1/asaas-webhook' : '—');
    marcarPasso('chave', c.temChave ? 'ok' : 'pendente', c.temChave ? `Salva · ${c.ambiente === 'producao' ? 'Produção' : 'Sandbox'}` : 'Salve a chave do Asaas');
    if (!sessionStorage.getItem('adm-conexao-ok')) marcarPasso('conexao', c.temChave ? 'pendente' : 'bloqueado', 'Teste a chave');
    else marcarPasso('conexao', 'ok', sessionStorage.getItem('adm-conexao-ok'));
    marcarPasso('webhook', c.webhookConfigurado ? 'ok' : (local ? 'info' : 'pendente'),
      c.webhookConfigurado ? 'Configurado' : (local ? 'Em produção (ou com túnel)' : 'Configure para liberar os downloads'));
  }

  function marcarPasso(id, tipo, texto) {
    const li = $(`#adm-passos [data-passo="${id}"]`);
    li.dataset.estado = tipo;
    $('span', li).textContent = texto;
  }

  /* ---------------- Abas ---------------- */
  const carregadas = new Set();
  function ligarAbas() {
    const abas = $$('.adm-abas [role="tab"]');
    const ir = (aba, foco = false) => {
      abas.forEach((a) => {
        const sel = a === aba;
        a.setAttribute('aria-selected', String(sel));
        a.tabIndex = sel ? 0 : -1;
        $('#' + a.getAttribute('aria-controls')).hidden = !sel;
      });
      if (foco) aba.focus();
      const id = aba.id.replace('aba-', '');
      history.replaceState(null, '', '#' + id);
      if (!carregadas.has(id)) { carregadas.add(id); ({ vendas: carregarVendas, produtos: carregarProdutos, admins: carregarAdmins })[id]?.(); }
    };
    abas.forEach((a, i) => {
      a.addEventListener('click', () => ir(a));
      a.addEventListener('keydown', (e) => {
        const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (d) { e.preventDefault(); ir(abas[(i + d + abas.length) % abas.length], true); }
        if (e.key === 'Home') { e.preventDefault(); ir(abas[0], true); }
        if (e.key === 'End') { e.preventDefault(); ir(abas.at(-1), true); }
      });
    });
    const inicial = abas.find((a) => a.id === 'aba-' + location.hash.slice(1));
    if (inicial) ir(inicial);
  }

  /* ---------------- Pagamentos (Asaas) ---------------- */
  function ligarPagamentos() {
    const f = $('#adm-form-asaas');
    const msg = $('#adm-msg-asaas');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = $('button[type="submit"]', f);
      b.disabled = true;
      try {
        const dados = {
          ambiente: f.querySelector('input[name="ambiente"]:checked').value,
          chave: f.chave.value.trim(),
          metodos: $$('input[name="metodos"]:checked', f).map((i) => i.value),
          minutosExpirar: Number(f.minutosExpirar.value),
          siteUrl: f.siteUrl.value.trim(),
          emailAvisos: f.emailAvisos.value.trim(),
        };
        const ambienteMudou = dados.ambiente !== estado.config.ambiente;
        const r = await api('salvar', dados);
        estado.config = r.config;
        if (dados.chave || ambienteMudou) sessionStorage.removeItem('adm-conexao-ok');
        pintarEstado();
        aviso(msg, dados.chave ? 'Configurações e chave salvas. Agora teste a conexão.' : 'Configurações salvas.');
      } catch (err) {
        aviso(msg, err.message, 'erro');
      } finally {
        b.disabled = false;
      }
    });

    $('#adm-testar').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      const res = $('#adm-res-teste');
      b.disabled = true;
      res.hidden = false;
      res.className = 'adm-resultado';
      res.textContent = 'Conectando ao Asaas…';
      try {
        const { conta } = await api('testar');
        res.classList.add('ok');
        res.innerHTML = `<b>Conectado${conta.nome ? ': ' + esc(conta.nome) : ''}</b>
          <dl>${conta.email ? `<div><dt>E-mail</dt><dd>${esc(conta.email)}</dd></div>` : ''}
          ${conta.documento ? `<div><dt>CPF/CNPJ</dt><dd>${esc(conta.documento)}</dd></div>` : ''}
          ${conta.saldo !== null ? `<div><dt>Saldo</dt><dd>${BRL(Math.round(conta.saldo * 100))}</dd></div>` : ''}
          <div><dt>Ambiente</dt><dd>${estado.config.ambiente === 'producao' ? 'Produção' : 'Sandbox'}</dd></div></dl>`;
        sessionStorage.setItem('adm-conexao-ok', conta.nome ? `OK · ${conta.nome}` : 'OK');
        pintarEstado();
      } catch (err) {
        res.classList.add('erro');
        res.textContent = err.message;
        marcarPasso('conexao', 'erro', 'Falhou — confira a chave e o ambiente');
      } finally {
        b.disabled = false;
      }
    });

    $('#adm-webhook').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      const res = $('#adm-res-webhook');
      b.disabled = true;
      res.hidden = false;
      res.className = 'adm-resultado';
      res.textContent = 'Configurando no Asaas…';
      try {
        const r = await api('webhook');
        res.classList.add('ok');
        res.innerHTML = `<b>Webhook ativo.</b> O Asaas vai avisar <code>${esc(r.url)}</code> a cada pagamento, com token secreto.`;
        estado = await api('estado');
        pintarEstado();
      } catch (err) {
        res.classList.add(local ? 'info' : 'erro');
        res.textContent = err.message;
      } finally {
        b.disabled = false;
      }
    });
  }

  /* ---------------- Vendas ---------------- */
  function ligarVendas() {
    $('#adm-filtro-status').addEventListener('change', carregarVendas);
    $('#adm-atualizar-vendas').addEventListener('click', carregarVendas);
    $('#adm-vendas').addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-acao]');
      if (!b) return;
      const { acao, id, status } = b.dataset;
      if (acao === 'marcar') {
        const frase = status === 'pago' ? 'Marcar esta compra como PAGA e liberar o download?' : `Marcar esta compra como ${STATUS[status].toUpperCase()}? O download fica bloqueado.`;
        if (!confirm(frase)) return;
      }
      b.disabled = true;
      try {
        const r = await api(acao, { id, status });
        Loja.toast(r.aviso || (acao === 'reenviar' ? 'Link de acesso reenviado.' : 'Compra atualizada.'));
        if (acao === 'marcar') carregarVendas();
      } catch (err) {
        Loja.toast(err.message);
        b.disabled = false;
      }
    });
  }

  async function carregarVendas() {
    const corpo = $('#adm-vendas');
    corpo.innerHTML = '<tr><td colspan="6" class="vazio">Carregando…</td></tr>';
    try {
      const { compras, resumo } = await api('vendas', { status: $('#adm-filtro-status').value });
      estado.resumo = resumo;
      pintarEstado();
      corpo.innerHTML = compras.length ? compras.map((c) => {
        const nome = L.produtos[c.produto_slug]?.nome || c.produto_slug;
        const acoes = [
          c.status !== 'pago' && c.status !== 'reembolsado' ? `<button class="btn btn-mini" data-acao="marcar" data-status="pago" data-id="${c.id}">Marcar pago</button>` : '',
          c.status === 'pago' ? `<button class="btn btn-mini" data-acao="reenviar" data-id="${c.id}">Reenviar acesso</button>` : '',
          c.status === 'pago' ? `<button class="btn btn-mini" data-acao="marcar" data-status="reembolsado" data-id="${c.id}">Reembolsado</button>` : '',
        ].join('');
        return `<tr>
          <td class="mono">${new Date(c.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
          <td>${esc(c.email)}</td>
          <td>${esc(nome)}${c.simulado ? ' <small class="adm-sim">simulado</small>' : ''}</td>
          <td class="mono">${BRL(c.valor_centavos)}</td>
          <td><span class="adm-status" data-status="${c.status}">${STATUS[c.status] || c.status}</span></td>
          <td class="adm-acoes">${acoes}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="6" class="vazio">Nenhuma venda por aqui ainda.</td></tr>';
    } catch (err) {
      corpo.innerHTML = `<tr><td colspan="6" class="vazio">${esc(err.message)}</td></tr>`;
    }
  }

  /* ---------------- Produtos ---------------- */
  async function carregarProdutos() {
    const corpo = $('#adm-produtos');
    try {
      const { produtos } = await api('produtos');
      corpo.innerHTML = produtos.length ? produtos.map((p) => `<tr>
        <td><b>${esc(p.nome)}</b><br><small class="mono">${esc(p.slug)}</small></td>
        <td class="mono">${BRL(p.preco_centavos)}</td>
        <td class="mono">${esc(p.versao)}</td>
        <td><label class="adm-chave-liga"><input type="checkbox" data-slug="${esc(p.slug)}" ${p.ativo ? 'checked' : ''}><span aria-hidden="true"></span><b class="sr">À venda: ${esc(p.nome)}</b></label></td>
      </tr>`).join('') : `<tr><td colspan="4" class="vazio">${local ? 'Nenhum produto pago.' : 'Nenhum produto publicado. Rode npm run publicar.'}</td></tr>`;
      corpo.onchange = async (e) => {
        const i = e.target.closest('input[data-slug]');
        if (!i) return;
        try {
          await api('produto', { slug: i.dataset.slug, ativo: i.checked });
          Loja.toast(i.checked ? 'Venda retomada.' : 'Venda pausada.');
        } catch (err) {
          i.checked = !i.checked;
          Loja.toast(err.message);
        }
      };
    } catch (err) {
      corpo.innerHTML = `<tr><td colspan="4" class="vazio">${esc(err.message)}</td></tr>`;
    }
  }

  /* ---------------- Administradores ---------------- */
  function ligarAdmins() {
    const f = $('#adm-form-admin');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('admin_add', { email: f.email.value.trim() });
        f.reset();
        carregarAdmins();
      } catch (err) {
        aviso($('#adm-msg-admins'), err.message, 'erro');
      }
    });
    $('#adm-admins').addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-email]');
      if (!b || !confirm(`Remover ${b.dataset.email} dos administradores?`)) return;
      try { await api('admin_del', { email: b.dataset.email }); carregarAdmins(); } catch (err) { aviso($('#adm-msg-admins'), err.message, 'erro'); }
    });
  }

  async function carregarAdmins() {
    const ul = $('#adm-admins');
    try {
      const r = await api('admins');
      if (r.local) {
        ul.innerHTML = '<li class="adm-txt">No modo local não há login. Em produção, o primeiro administrador é cadastrado por SQL (veja COMO-USAR.md) e os demais aqui.</li>';
        $('#adm-form-admin').hidden = true;
        return;
      }
      ul.innerHTML = r.admins.map((e) => `<li><span>${esc(e)}</span>${e === estado.eu ? '<small>você</small>' : `<button class="btn btn-mini" type="button" data-email="${esc(e)}">Remover</button>`}</li>`).join('');
    } catch (err) {
      ul.innerHTML = `<li>${esc(err.message)}</li>`;
    }
  }

  iniciar().catch((err) => { $('#adm-quem').textContent = err.message; });
})();
