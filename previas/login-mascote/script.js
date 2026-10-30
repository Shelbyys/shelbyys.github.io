/* =========================================================================
   Login Mascote — comportamento
   -------------------------------------------------------------------------
   • A coruja “Oli” (SVG) segue o cursor com os olhos; com o e-mail focado,
     segue o caractere que está sendo digitado (medido com canvas).
   • Senha focada → tampa os olhos com as asas. Senha visível → espia.
   • Erro → balança a cabeça, fica triste e o campo treme.
   • Sucesso → pula, fecha os olhos sorrindo, solta confetes e o cartão
     “respira” fundo de alívio.
   • 3 erros seguidos → a Oli segura um cadeado fofo, as asas cobrem o
     formulário e uma contagem regressiva destrava tudo no fim.
   • Pisca sozinha de tempos em tempos.
   Sem dependências. Troque autenticar() pela chamada ao seu backend.
   ========================================================================= */
(() => {
  'use strict';

  /* ---------- Configuração (documentada no LEIAME.md) ---------- */
  const CONFIG = {
    emailDemo: 'demo@exemplo.com',
    senhaDemo: '123456',
    atrasoDemoMs: 1100,        // “tempo de rede” simulado na demo
    alcancePupila: 9,          // px (unidades do SVG) que a pupila pode andar
    suavidadeOlhar: 0.18,      // 0–1: quanto o olhar se aproxima do alvo por quadro
    inclinacaoMax: 7,          // graus de inclinação da cabeça seguindo o olhar
    piscarMin: 2200,           // ms entre piscadas (mínimo)
    piscarMax: 5600,           // ms entre piscadas (máximo)
    duracaoTriste: 2200,       // ms que a coruja fica triste após um erro
    duracaoFesta: 2600,        // ms de comemoração
    confetes: 34,
    coresConfete: ['#ff6f59', '#1f7a8c', '#ffb648', '#36c2a8', '#ff9fb0'],
    chaveLembrar: 'lm2-email-lembrado',  // chave do localStorage do “Lembrar de mim”
    tentativas: 3,             // erros seguidos até travar o formulário
    bloqueioSegundos: 30,      // duração da trava, em segundos
  };

  /**
   * autenticar(email, senha) → Promise com UM dos três estados:
   *   { estado: 'aprovado', mensagem }             credenciais certas
   *   { estado: 'erro', restantes? }               senha errada (restantes é opcional)
   *   { estado: 'bloqueado', segundos }            conta travada por um tempo
   * ---------------------------------------------------------------------
   * Na demo, só aceita CONFIG.emailDemo / CONFIG.senhaDemo e conta os erros
   * aqui no navegador. Para usar com um backend real, troque o corpo por:
   *
   *   const r = await fetch('/api/login', {
   *     method: 'POST',
   *     headers: { 'Content-Type': 'application/json' },
   *     body: JSON.stringify({ email, senha }),
   *   });
   *   if (r.status === 200) return { estado: 'aprovado', mensagem: 'Bem-vindo(a) de volta!' };   // 200
   *   if (r.status === 401) {                                                                    // 401
   *     const corpo = await r.json().catch(() => ({}));
   *     return { estado: 'erro', restantes: corpo.tentativasRestantes };
   *   }
   *   if (r.status === 423 || r.status === 429) {                                                // 423/429
   *     return { estado: 'bloqueado', segundos: lerRetryAfter(r.headers.get('Retry-After')) };
   *   }
   *   throw new Error('Resposta inesperada do servidor');
   *
   * O resto da tela (mascote, botão, mensagens, trava) já reage ao retorno.
   * O formato antigo { ok: true/false } continua aceito.
   */
  async function autenticar(email, senha) {
    await new Promise((r) => setTimeout(r, CONFIG.atrasoDemoMs));
    const ok = email.trim().toLowerCase() === CONFIG.emailDemo && senha === CONFIG.senhaDemo;
    return ok
      ? { estado: 'aprovado', mensagem: 'Tudo certo! Bem-vindo(a) de volta ao Ninho.' }
      : { estado: 'erro' };
  }

  /** Converte o cabeçalho Retry-After (segundos ou data HTTP) em segundos. */
  function lerRetryAfter(valor) {
    const n = Number(valor);
    if (Number.isFinite(n) && n > 0) return Math.ceil(n);
    const data = Date.parse(valor);
    if (!Number.isNaN(data)) return Math.max(1, Math.ceil((data - Date.now()) / 1000));
    return CONFIG.bloqueioSegundos;
  }

  /* ---------- Elementos ---------- */
  const $ = (s) => document.querySelector(s);
  const coruja = $('#lm2-coruja');
  const cabeca = $('#lm2-cabeca');
  const pupilas = [
    { el: $('#lm2-pupila-e'), cx: 88, cy: 100, x: 0, y: 0 },
    { el: $('#lm2-pupila-d'), cx: 152, cy: 100, x: 0, y: 0 },
  ];
  const form = $('#lm2-form');
  const email = $('#lm2-email');
  const senha = $('#lm2-senha');
  const btnMostrar = $('#lm2-mostrar');
  const btnEntrar = $('#lm2-entrar');
  const lembrar = $('#lm2-lembrar');
  const msg = $('#lm2-msg');
  const campoEmail = $('#lm2-campo-email');
  const campoSenha = $('#lm2-campo-senha');
  const confetes = $('#lm2-confetes');
  const cartao = $('.lm2-cartao');
  const titulo = $('#lm2-titulo');
  const subtitulo = $('.lm2-sub');
  const bloqueio = $('#lm2-bloqueio');
  const bloqueioTempo = $('#lm2-bloqueio-tempo');
  const bloqueioTitulo = $('#lm2-bloqueio-titulo');
  const btnPreencher = $('#lm2-preencher');
  const textosOriginais = { titulo: titulo.textContent, sub: subtitulo.textContent };
  cartao.addEventListener('animationend', (e) => { if (e.animationName === 'lm2-respira') cartao.classList.remove('lm2-respira'); });

  const movReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* =====================================================================
     OLHAR: cursor, caractere digitado ou alvo fixo
     ===================================================================== */
  let alvo = null;           // {x,y} em px da janela; null = olhar para frente
  let inclinacao = 0;
  let ultimoPonteiro = null;

  document.addEventListener('pointermove', (e) => {
    ultimoPonteiro = { x: e.clientX, y: e.clientY };
    if (document.activeElement !== email) alvo = ultimoPonteiro;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (document.activeElement !== email) alvo = null; });

  // Canvas só para medir texto (nunca é desenhado na tela)
  const medidor = document.createElement('canvas').getContext('2d');

  /** Posição (px da janela) do cursor de texto dentro de um input. */
  function posicaoDoCursor(input) {
    const cs = getComputedStyle(input);
    medidor.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const fim = input.selectionEnd ?? input.value.length;
    let texto = input.value.slice(0, fim);
    if (input.type === 'password') texto = '•'.repeat(texto.length);
    const largura = medidor.measureText(texto).width;
    const r = input.getBoundingClientRect();
    const esq = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
    const dir = parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth);
    const x = Math.min(r.left + esq + largura - input.scrollLeft, r.right - dir);
    return { x, y: r.top + r.height / 2 };
  }

  function seguirDigitacao() {
    if (document.activeElement === email) alvo = posicaoDoCursor(email);
  }
  ['input', 'keyup', 'click', 'select', 'focus'].forEach((ev) => email.addEventListener(ev, () => requestAnimationFrame(seguirDigitacao)));
  email.addEventListener('blur', () => { alvo = ultimoPonteiro; });

  /** Converte um ponto da janela para as coordenadas do SVG. */
  function paraSVG(px, py) {
    const m = coruja.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(px, py).matrixTransform(m.inverse());
    return p;
  }

  function quadro() {
    // Alvo do olhar conforme o estado
    let destino = alvo;
    const quieta = estado === 'triste' || estado === 'guardando';
    if (quieta) destino = null;                             // olha para baixo (abaixo)
    if (estado === 'espiando') destino = posicaoDoCursor(senha);

    let mediaDx = 0;
    for (const p of pupilas) {
      let tx = 0, ty = 0;
      if (estado === 'triste') { tx = 0; ty = CONFIG.alcancePupila * 0.8; }
      else if (estado === 'guardando') { tx = 0; ty = CONFIG.alcancePupila * 0.55; }  // de olho no cadeado
      else if (!destino) { tx = 0; ty = CONFIG.alcancePupila * 0.4; }   // sem cursor: olha para o formulário
      else {
        const s = paraSVG(destino.x, destino.y);
        if (s) {
          const dx = s.x - p.cx, dy = s.y - p.cy;
          const d = Math.hypot(dx, dy) || 1;
          const alcance = Math.min(CONFIG.alcancePupila, d / 14);
          tx = dx / d * alcance; ty = dy / d * alcance;
          mediaDx += dx / pupilas.length;
        }
      }
      const k = movReduzido.matches ? 1 : CONFIG.suavidadeOlhar;
      p.x += (tx - p.x) * k;
      p.y += (ty - p.y) * k;
      p.el.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
    }

    // Cabeça inclina levemente para o lado do olhar
    const alvoInc = (destino && !quieta && !movReduzido.matches)
      ? Math.max(-CONFIG.inclinacaoMax, Math.min(CONFIG.inclinacaoMax, mediaDx / 30)) : 0;
    inclinacao += (alvoInc - inclinacao) * 0.12;
    cabeca.style.transform = `rotate(${inclinacao.toFixed(2)}deg)`;

    requestAnimationFrame(quadro);
  }

  /* =====================================================================
     ESTADOS DO MASCOTE
     normal · cobrindo · espiando · triste · feliz · guardando · destravando
     ===================================================================== */
  let estado = 'normal';
  let timerEstado = 0;

  function definirEstado(novo) {
    estado = novo;
    coruja.classList.toggle('lm2-cobrindo', novo === 'cobrindo');
    coruja.classList.toggle('lm2-espiando', novo === 'espiando');
    coruja.classList.toggle('lm2-triste', novo === 'triste');
    coruja.classList.toggle('lm2-feliz-modo', novo === 'feliz');
    coruja.classList.toggle('lm2-guardando', novo === 'guardando');
    coruja.classList.toggle('lm2-destravando', novo === 'destravando');
  }

  /** Decide o estado “de repouso” a partir do foco e da visibilidade da senha. */
  function estadoPeloFoco() {
    if (['triste', 'feliz', 'guardando', 'destravando'].includes(estado)) return;
    const naSenha = campoSenha.contains(document.activeElement);
    if (!naSenha) return definirEstado('normal');
    definirEstado(senha.type === 'text' ? 'espiando' : 'cobrindo');
  }
  // focusin/focusout no campo inteiro: o botão “mostrar” conta como parte da senha
  document.addEventListener('focusin', estadoPeloFoco);
  document.addEventListener('focusout', () => setTimeout(estadoPeloFoco, 0));

  function estadoTemporario(nome, ms) {
    clearTimeout(timerEstado);
    definirEstado(nome);
    timerEstado = setTimeout(() => { definirEstado('normal'); estadoPeloFoco(); }, ms);
  }

  /* ---------- Piscar sozinha ---------- */
  function agendarPiscada() {
    const espera = CONFIG.piscarMin + Math.random() * (CONFIG.piscarMax - CONFIG.piscarMin);
    setTimeout(() => {
      if (!movReduzido.matches && !document.hidden && (estado === 'normal' || estado === 'espiando')) {
        coruja.classList.add('lm2-piscando');
        setTimeout(() => coruja.classList.remove('lm2-piscando'), 150);
        // às vezes, piscada dupla
        if (Math.random() < 0.25) {
          setTimeout(() => coruja.classList.add('lm2-piscando'), 320);
          setTimeout(() => coruja.classList.remove('lm2-piscando'), 470);
        }
      }
      agendarPiscada();
    }, espera);
  }

  /* ---------- Reações ---------- */
  function reagirErro(campos) {
    estadoTemporario('triste', CONFIG.duracaoTriste);
    coruja.classList.remove('lm2-erro');
    void coruja.getBoundingClientRect();   // reinicia a animação
    coruja.classList.add('lm2-erro');
    setTimeout(() => coruja.classList.remove('lm2-erro'), 800);
    for (const c of campos) {
      c.classList.add('lm2-campo--erro');
      c.classList.remove('lm2-tremer');
      void c.offsetWidth;
      c.classList.add('lm2-tremer');
      c.querySelector('input').setAttribute('aria-invalid', 'true');
    }
  }

  function reagirSucesso() {
    estadoTemporario('feliz', CONFIG.duracaoFesta);
    if (movReduzido.matches) return;
    soltarConfetes();
    // O cartão “respira” fundo de alívio junto com o pulo da Oli
    cartao.classList.remove('lm2-respira');
    void cartao.offsetWidth;
    cartao.classList.add('lm2-respira');
  }

  function soltarConfetes() {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < CONFIG.confetes; i++) {
      const c = document.createElement('span');
      c.className = 'lm2-confete' + (i % 3 === 0 ? ' lm2-confete--bola' : '');
      const ang = (-160 + Math.random() * 140) * Math.PI / 180;   // leque para cima
      const forca = 70 + Math.random() * 110;
      c.style.setProperty('--x', `${(Math.cos(ang) * forca * 1.2).toFixed(0)}px`);
      c.style.setProperty('--y', `${(Math.sin(ang) * forca).toFixed(0)}px`);
      c.style.setProperty('--r', `${(Math.random() * 540 - 270).toFixed(0)}deg`);
      c.style.setProperty('--d', `${(1.1 + Math.random() * 0.6).toFixed(2)}s`);
      c.style.setProperty('--c', CONFIG.coresConfete[i % CONFIG.coresConfete.length]);
      c.style.animationDelay = `${(Math.random() * 0.12).toFixed(2)}s`;
      frag.appendChild(c);
    }
    confetes.appendChild(frag);
    setTimeout(() => { confetes.textContent = ''; }, 2000);
  }

  /* =====================================================================
     FORMULÁRIO
     ===================================================================== */
  function mensagem(texto, tipo) {
    msg.textContent = texto;
    msg.dataset.tipo = tipo || '';
  }

  function limparErro(campo) {
    campo.classList.remove('lm2-campo--erro');
    campo.querySelector('input').removeAttribute('aria-invalid');
  }
  email.addEventListener('input', () => limparErro(campoEmail));
  senha.addEventListener('input', () => limparErro(campoSenha));
  [campoEmail, campoSenha].forEach((c) => c.addEventListener('animationend', () => c.classList.remove('lm2-tremer')));

  // Mostrar / ocultar senha
  btnMostrar.addEventListener('click', () => {
    const mostrar = senha.type === 'password';
    senha.type = mostrar ? 'text' : 'password';
    btnMostrar.setAttribute('aria-pressed', String(mostrar));
    btnMostrar.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
    estadoPeloFoco();
  });

  // Preencher com as credenciais da demo
  $('#lm2-preencher').addEventListener('click', () => {
    email.value = CONFIG.emailDemo;
    senha.value = CONFIG.senhaDemo;
    limparErro(campoEmail); limparErro(campoSenha);
    mensagem('Credenciais da demo preenchidas. É só entrar!', 'info');
    btnEntrar.focus();
  });

  $('#lm2-esqueci').addEventListener('click', () => {
    const e = email.value.trim();
    mensagem(e && validoEmail(e)
      ? `Se ${e} tiver conta, enviaremos um link de recuperação.`
      : 'Digite seu e-mail acima para receber o link de recuperação.', 'info');
    if (!e) email.focus();
  });
  ['#lm2-criar', '#lm2-ajuda'].forEach((s) => $(s).addEventListener('click', (ev) => {
    ev.preventDefault();
    mensagem('Na demo, use as credenciais da dica para entrar.', 'info');
  }));

  const validoEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  let enviando = false;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (enviando || !bloqueio.hidden) return; // já enviando ou travado

    // Validação local antes de chamar o servidor
    const e = email.value.trim(), s = senha.value;
    const errados = [];
    if (!e || !validoEmail(e)) errados.push(campoEmail);
    if (!s) errados.push(campoSenha);
    if (errados.length) {
      mensagem(!e ? 'Informe seu e-mail para entrar.' : !validoEmail(e) ? 'Esse e-mail parece incompleto.' : 'Digite sua senha.', 'erro');
      reagirErro(errados);
      errados[0].querySelector('input').focus();
      return;
    }

    enviando = true;
    btnEntrar.dataset.estado = 'carregando';
    btnEntrar.setAttribute('aria-disabled', 'true');
    form.setAttribute('aria-busy', 'true');
    mensagem('Verificando…', 'info');

    let r;
    try { r = await autenticar(e, s); }
    catch { r = { estado: 'falha', mensagem: 'Não foi possível conectar. Tente de novo.' }; }
    // Aceita também o formato antigo { ok: true/false }
    const estadoResposta = r.estado || (r.ok ? 'aprovado' : 'erro');

    form.removeAttribute('aria-busy');
    if (estadoResposta === 'aprovado') {
      falhas = 0; // acertar a senha zera o contador
      btnEntrar.dataset.estado = 'sucesso';
      mensagem(r.mensagem || 'Tudo certo! Bem-vindo(a) de volta.', 'ok');
      try {
        if (lembrar.checked) localStorage.setItem(CONFIG.chaveLembrar, e);
        else localStorage.removeItem(CONFIG.chaveLembrar);
      } catch { /* armazenamento indisponível: ignora */ }
      senha.blur(); email.blur();
      // Boas-vindas no topo do cartão (voltam ao normal quando alguém digita de novo)
      titulo.textContent = 'Bem-vindo(a) de volta!';
      subtitulo.textContent = `Você entrou como ${e}.`;
      reagirSucesso();
      // Aqui você redirecionaria: location.href = '/painel';
      setTimeout(() => {
        btnEntrar.dataset.estado = '';
        btnEntrar.removeAttribute('aria-disabled');
        enviando = false;
      }, CONFIG.duracaoFesta + 400);
      return;
    }

    btnEntrar.dataset.estado = '';
    btnEntrar.removeAttribute('aria-disabled');
    enviando = false;
    if (estadoResposta === 'bloqueado') return bloquear(r.segundos);
    if (estadoResposta === 'erro') return errou(r.restantes);
    mensagem(r.mensagem, 'erro');
    reagirErro([campoEmail, campoSenha]);
  });

  /* =====================================================================
     ESTADOS DE VALIDAÇÃO: erro com tentativas restantes e bloqueio
     ===================================================================== */
  let falhas = 0;
  let fimBloqueio = 0, totalBloqueio = 0, idContagem = 0;

  function errou(restantesDoServidor) {
    falhas++;
    const restantes = Number.isFinite(restantesDoServidor) ? restantesDoServidor : CONFIG.tentativas - falhas;
    if (restantes <= 0) return bloquear(CONFIG.bloqueioSegundos);
    mensagem(`E-mail ou senha incorretos. Você tem ${restantes} ${restantes === 1 ? 'tentativa' : 'tentativas'}.`, 'erro');
    reagirErro([campoSenha]);
    campoEmail.classList.add('lm2-campo--erro');
    senha.focus();
    senha.select(); // senha selecionada: é só digitar de novo
  }

  const relogio = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  /** Liga/desliga todos os controles do formulário (e o “Preencher” da dica). */
  function travar(sim) {
    form.querySelectorAll('input, button').forEach((el) => { el.disabled = sim; });
    btnPreencher.disabled = sim;
    form.classList.toggle('lm2-travado', sim);
  }

  /** 3 erros seguidos: a Oli segura um cadeado e as asas cobrem o formulário. */
  function bloquear(segundos) {
    totalBloqueio = Math.max(1, Math.round(segundos || CONFIG.bloqueioSegundos));
    fimBloqueio = Date.now() + totalBloqueio * 1000;
    falhas = 0;
    clearTimeout(timerEstado);
    limparErro(campoEmail); limparErro(campoSenha);
    travar(true);
    definirEstado('guardando');
    bloqueioTempo.textContent = relogio(totalBloqueio);
    bloqueio.style.setProperty('--lm2-resta', '1');
    bloqueio.hidden = false;
    bloqueio.classList.remove('lm2-bloqueio--abrindo');
    // No celular o formulário pode estar abaixo da dobra: traz as asas para a tela
    bloqueio.scrollIntoView({ block: 'nearest', behavior: movReduzido.matches ? 'auto' : 'smooth' });
    bloqueioTitulo.focus({ preventScroll: true });
    mensagem(`Muitas tentativas sem sucesso. Por segurança, o acesso foi pausado. Tente de novo em ${totalBloqueio} segundos.`, 'info');
    clearInterval(idContagem);
    idContagem = setInterval(contar, 250);
  }

  function contar() {
    const resta = Math.max(0, Math.ceil((fimBloqueio - Date.now()) / 1000));
    const texto = relogio(resta);
    if (bloqueioTempo.textContent !== texto) bloqueioTempo.textContent = texto;
    bloqueio.style.setProperty('--lm2-resta', String(resta / totalBloqueio));
    if (resta <= 0) liberar();
  }

  /** Fim da contagem: o cadeado abre, as asas voltam e o formulário destrava. */
  function liberar() {
    clearInterval(idContagem);
    definirEstado('destravando');
    bloqueio.classList.add('lm2-bloqueio--abrindo');
    setTimeout(() => {
      bloqueio.hidden = true;
      bloqueio.classList.remove('lm2-bloqueio--abrindo');
      travar(false);
      senha.value = '';
      limparErro(campoEmail); limparErro(campoSenha);
      definirEstado('normal');
      (email.value ? senha : email).focus();
      estadoPeloFoco();
      mensagem('Prontinho, destravado! Pode tentar de novo.', 'ok');
    }, movReduzido.matches ? 0 : 1000);
  }

  // Link de suporte: só visual na demonstração
  $('#lm2-suporte').addEventListener('click', (ev) => {
    ev.preventDefault();
    mensagem('Demonstração: ligue este link ao seu canal de suporte.', 'info');
  });

  // Ao digitar de novo depois do sucesso, o topo volta ao convite original
  [email, senha].forEach((c) => c.addEventListener('input', () => {
    if (titulo.textContent !== textosOriginais.titulo) {
      titulo.textContent = textosOriginais.titulo;
      subtitulo.textContent = textosOriginais.sub;
    }
  }));

  /* ---------- Início ---------- */
  try {
    const salvo = localStorage.getItem(CONFIG.chaveLembrar);
    if (salvo) { email.value = salvo; lembrar.checked = true; }
  } catch { /* sem localStorage (modo privado): segue normal */ }

  agendarPiscada();
  requestAnimationFrame(quadro);
})();
