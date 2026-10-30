/* =====================================================================
   CONTATO ANIMADO — comportamento
   ---------------------------------------------------------------------
   1. Utilidades
   2. Status do atendimento (hora real, fuso de Brasília)
   3. Copiar canais + aviso
   4. FAQ em acordeão
   5. Formulário: campos, chips, slider, contador, validação
   6. enviarMensagem(dados)  ← TROQUE AQUI pelo seu backend
   7. Animação: dobrar em avião de papel, voar, voltar
   8. Envio e estado de sucesso
   HTML, CSS e JavaScript puros. Sem dependências.
   ===================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     1. UTILIDADES
     ------------------------------------------------------------------ */
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const movimentoReduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

  /** Roda uma animação Web Animations e devolve o objeto Animation. */
  function animar(el, quadros, opcoes) {
    return el.animate(quadros, Object.assign({ fill: 'forwards', easing: 'cubic-bezier(.22,.8,.24,1)' }, opcoes));
  }
  /** Espera um grupo de animações terminar (ignora cancelamentos). */
  const terminar = (lista) => Promise.all(lista.map((a) => a.finished.catch(() => null)));

  /** Moeda em pt-BR sem centavos: 15000 → "R$ 15.000". */
  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  /* ------------------------------------------------------------------
     2. STATUS DO ATENDIMENTO
     Horário por dia da semana (0 = domingo). null = fechado.
     ------------------------------------------------------------------ */
  const HORARIO = { 0: null, 1: [9, 18], 2: [9, 18], 3: [9, 18], 4: [9, 18], 5: [9, 18], 6: [9, 13] };
  const FUSO = 'America/Sao_Paulo';
  const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  /** Dia da semana e hora decimal no fuso do atendimento (independe do fuso do visitante). */
  function agoraNoFuso() {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: FUSO, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
    }).formatToParts(new Date());
    const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
    const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
    return { dia, hora: (Number(p.hour) % 24) + Number(p.minute) / 60 };
  }

  /** Texto da próxima abertura: "hoje às 9h", "amanhã às 9h", "segunda às 9h". */
  function proximaAbertura(dia, hora) {
    for (let d = 0; d < 8; d++) {
      const idx = (dia + d) % 7;
      const faixa = HORARIO[idx];
      if (!faixa) continue;
      if (d === 0 && hora >= faixa[0]) continue;
      const quando = d === 0 ? 'hoje' : d === 1 ? 'amanhã' : DIAS[idx];
      return `${quando} às ${faixa[0]}h`;
    }
    return 'em breve';
  }

  function atualizarStatus() {
    const status = $('#ct-status');
    const equipe = $('#ct-equipe-texto');
    const { dia, hora } = agoraNoFuso();
    const faixa = HORARIO[dia];
    const aberto = !!faixa && hora >= faixa[0] && hora < faixa[1];
    const estado = aberto ? 'aberto' : 'fechado';
    if (status.dataset.estado === estado && status.dataset.pronto) return;
    status.dataset.estado = estado;
    status.dataset.pronto = '1';
    $('.ct-status__texto', status).textContent = aberto ? `Online agora · até ${faixa[1]}h` : 'Fora do horário';
    equipe.textContent = aberto
      ? 'Ana, Caio e Bia respondem em até 15 min'
      : `Voltamos ${proximaAbertura(dia, hora)} — pode deixar sua mensagem`;
  }

  /* ------------------------------------------------------------------
     3. COPIAR CANAIS + AVISO (toast)
     ------------------------------------------------------------------ */
  const aviso = $('#ct-aviso');
  let avisoTimer;
  function avisar(texto) {
    aviso.textContent = texto;
    aviso.classList.add('is-visivel');
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => aviso.classList.remove('is-visivel'), 2200);
  }

  async function copiarTexto(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (e) {
      // Plano B para navegadores sem a Clipboard API
      const area = document.createElement('textarea');
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;opacity:0;left:0;top:0';
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      area.remove();
      return ok;
    }
  }

  $$('.ct-copiar').forEach((botao) => {
    botao.addEventListener('click', async () => {
      const ok = await copiarTexto(botao.dataset.copiar);
      const rotulo = botao.getAttribute('aria-label').replace(/^Copiar /, '');
      avisar(ok ? `${rotulo.charAt(0).toUpperCase() + rotulo.slice(1)} copiado!` : 'Não foi possível copiar');
      if (!ok) return;
      botao.classList.add('is-copiado');
      setTimeout(() => botao.classList.remove('is-copiado'), 1600);
    });
  });

  /* ------------------------------------------------------------------
     4. FAQ EM ACORDEÃO (um item aberto por vez)
     ------------------------------------------------------------------ */
  $$('.ct-faq__botao').forEach((botao) => {
    botao.addEventListener('click', () => {
      const abrir = botao.getAttribute('aria-expanded') !== 'true';
      $$('.ct-faq__botao').forEach((b) => {
        b.setAttribute('aria-expanded', 'false');
        b.closest('.ct-faq__item').classList.remove('is-aberto');
      });
      if (abrir) {
        botao.setAttribute('aria-expanded', 'true');
        botao.closest('.ct-faq__item').classList.add('is-aberto');
      }
    });
  });

  /* ------------------------------------------------------------------
     5. FORMULÁRIO
     ------------------------------------------------------------------ */
  const form = $('#ct-form');
  const campos = {
    nome: $('#ct-nome'),
    email: $('#ct-email'),
    mensagem: $('#ct-mensagem')
  };
  const faixa = $('#ct-orcamento');
  const faixaValor = $('#ct-orcamento-valor');
  const contadorN = $('#ct-contador-n');
  const contador = $('#ct-contador');
  const chips = $('.ct-chips');
  const LIMITE = Number(campos.mensagem.maxLength) || 600;
  const MINIMO_MENSAGEM = 20;

  /** Campos que a pessoa já "tocou": só eles exibem erro (sem gritar antes da hora). */
  const tocados = new Set();

  /** Regras de validação: devolvem '' quando está tudo certo ou a mensagem de erro. */
  const regras = {
    nome(v) {
      return v.trim().length < 2 ? 'Conte como podemos te chamar (pelo menos 2 letras).' : '';
    },
    email(v) {
      const t = v.trim();
      if (!t) return 'Informe um e-mail para receber a resposta.';
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) ? '' : 'Esse e-mail parece incompleto — confira o @ e o domínio.';
    },
    mensagem(v) {
      const n = v.trim().length;
      if (!n) return 'Escreva sua mensagem.';
      const faltam = MINIMO_MENSAGEM - n;
      return faltam > 0 ? `Só mais um pouquinho: falta${faltam > 1 ? 'm' : ''} ${faltam} caractere${faltam > 1 ? 's' : ''}.` : '';
    },
    assunto() {
      return form.elements.assunto.value ? '' : 'Escolha um assunto para direcionarmos sua mensagem.';
    }
  };

  /** Valida um campo, atualiza classes, aria-invalid e a mensagem. Retorna true se válido. */
  function validar(nome) {
    const erro = nome === 'assunto' ? regras.assunto() : regras[nome](campos[nome].value);
    const caixa = nome === 'assunto' ? chips : campos[nome].closest('.ct-campo');
    const saida = $('#ct-erro-' + nome);
    const mostrar = tocados.has(nome) && !!erro;
    const temValor = nome === 'assunto' ? !!form.elements.assunto.value : campos[nome].value.trim() !== '';
    caixa.classList.toggle('is-invalido', mostrar);
    caixa.classList.toggle('is-valido', !erro && temValor);
    if (nome === 'assunto') {
      $$('input[name="assunto"]', chips).forEach((r) => r.setAttribute('aria-invalid', String(mostrar)));
    } else {
      campos[nome].setAttribute('aria-invalid', String(mostrar));
    }
    if (saida.textContent !== (mostrar ? erro : '')) saida.textContent = mostrar ? erro : '';
    return !erro;
  }

  // Validação em tempo real
  Object.entries(campos).forEach(([nome, el]) => {
    el.addEventListener('input', () => validar(nome));
    el.addEventListener('blur', () => {
      if (el.value.trim()) tocados.add(nome);
      validar(nome);
    });
  });
  chips.addEventListener('change', () => { tocados.add('assunto'); validar('assunto'); });

  /** Slider: valor em R$ e preenchimento do trilho. */
  function atualizarFaixa() {
    const min = Number(faixa.min), max = Number(faixa.max), v = Number(faixa.value);
    faixa.style.setProperty('--pct', ((v - min) / (max - min)) * 100 + '%');
    const texto = moeda.format(v) + (v >= max ? ' ou mais' : '');
    faixaValor.textContent = texto;
    faixa.setAttribute('aria-valuetext', texto);
  }
  faixa.addEventListener('input', atualizarFaixa);

  /** Textarea que cresce + contador de caracteres. */
  function atualizarMensagem() {
    const area = campos.mensagem;
    area.style.height = 'auto';
    area.style.height = Math.min(area.scrollHeight + 2, 260) + 'px';
    const n = area.value.length;
    contadorN.textContent = n;
    contador.classList.toggle('is-perto', n >= LIMITE * 0.9 && n < LIMITE);
    contador.classList.toggle('is-limite', n >= LIMITE);
  }
  campos.mensagem.addEventListener('input', atualizarMensagem);

  /** Lê os dados do formulário num objeto simples. */
  function coletarDados() {
    return {
      nome: campos.nome.value.trim(),
      email: campos.email.value.trim(),
      assunto: form.elements.assunto.value,
      orcamento: Number(faixa.value),
      orcamentoTexto: faixaValor.textContent,
      mensagem: campos.mensagem.value.trim(),
      enviadoEm: new Date().toISOString()
    };
  }

  /** Volta o formulário ao estado inicial. */
  function limparFormulario() {
    form.reset();
    tocados.clear();
    ['nome', 'email', 'mensagem', 'assunto'].forEach(validar);
    atualizarFaixa();
    atualizarMensagem();
    $('#ct-alerta').hidden = true;
  }

  // DEMONSTRAÇÃO: preenche um exemplo para testar rapidinho. Remova no seu projeto.
  $('#ct-exemplo').addEventListener('click', () => {
    campos.nome.value = 'Marina Albuquerque';
    campos.email.value = 'marina@padariaflor.com.br';
    form.querySelector('input[name="assunto"][value="Novo projeto"]').checked = true;
    faixa.value = 18000;
    campos.mensagem.value = 'Oi! Vamos abrir a segunda unidade da padaria e queremos um site novo, com cardápio online e encomendas pelo WhatsApp. Dá para conversarmos esta semana?';
    ['nome', 'email', 'mensagem', 'assunto'].forEach((n) => { tocados.add(n); validar(n); });
    atualizarFaixa();
    atualizarMensagem();
    $('#ct-enviar').focus();
  });

  /* ------------------------------------------------------------------
     6. ENVIO — TROQUE ESTA FUNÇÃO PELO SEU BACKEND
     ------------------------------------------------------------------
     Recebe: { nome, email, assunto, orcamento, orcamentoTexto, mensagem, enviadoEm }
     Deve devolver uma Promise que:
       • resolve com { protocolo: 'texto' } quando deu certo;
       • rejeita com um Error (mensagem amigável) quando falhar.
     Enquanto a Promise não resolve, o botão mostra "enviando".

     Exemplo com Formspree:
       const r = await fetch('https://formspree.io/f/SEU_ID', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
         body: JSON.stringify(dados)
       });
       if (!r.ok) throw new Error('Não conseguimos enviar agora. Tente de novo.');
       return { protocolo: 'CT-' + Date.now().toString().slice(-5) };

     Veja no LEIAME.md os exemplos de API própria e Supabase.
     ------------------------------------------------------------------ */
  async function enviarMensagem(dados) {
    // Simulação: espera ~0,9 s como se fosse uma requisição de rede.
    await esperar(900);
    // Para testar o estado de erro, escreva "erro" no começo da mensagem.
    if (/^erro\b/i.test(dados.mensagem)) throw new Error('O servidor não respondeu. Sua mensagem não foi perdida — tente de novo.');
    return { protocolo: 'CT-' + String(Date.now()).slice(-5) };
  }

  /* ------------------------------------------------------------------
     7. ANIMAÇÃO: DOBRAR → AVIÃO → VOAR (e o caminho de volta)
     ------------------------------------------------------------------ */
  const palco = $('#ct-palco');
  const dobra = $('#ct-dobra');
  const folha = $('#ct-folha');
  const metadeDir = $('.ct-folha__dir', folha);
  const abaEsq = $('.ct-folha__aba--esq', folha);
  const abaDir = $('.ct-folha__aba--dir', folha);
  const baseDir = $('.ct-folha__dir .ct-folha__base', folha);
  const aviao = $('#ct-aviao');
  const voo = $('#ct-voo');
  const vooAviao = $('#ct-voo-aviao');
  const rastro = $('#ct-rastro-caminho');

  /** Etapas da dobra guardadas para tocar ao contrário na volta. */
  let etapas = [];
  const curva = 'cubic-bezier(.65,0,.3,1)';

  /** Se o centro do cartão estiver fora da tela (celular), rola até ele antes de dobrar. */
  async function garantirVisivel() {
    const r = palco.getBoundingClientRect();
    const centro = r.top + r.height / 2;
    const vh = window.innerHeight;
    if (centro > 90 && centro < vh - 90) return;
    window.scrollBy({ top: centro - vh / 2, behavior: movimentoReduzido() ? 'auto' : 'smooth' });
    await esperar(480);
  }

  /** Ponto e tangente de uma curva de Bézier cúbica. */
  function bezier(p, t) {
    const u = 1 - t;
    const x = u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x;
    const y = u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y;
    const dx = 3 * u * u * (p[1].x - p[0].x) + 6 * u * t * (p[2].x - p[1].x) + 3 * t * t * (p[3].x - p[2].x);
    const dy = 3 * u * u * (p[1].y - p[0].y) + 6 * u * t * (p[2].y - p[1].y) + 3 * t * t * (p[3].y - p[2].y);
    return { x, y, ang: Math.atan2(dy, dx) };
  }

  /** Voo do avião ao longo da curva, desenhando o rastro tracejado. */
  function voar(pontos, duracao, { escalaDe, escalaPara, facilitar }) {
    return new Promise((ok) => {
      const trilha = [];
      rastro.getAnimations().forEach((a) => a.cancel());
      rastro.style.opacity = '';
      let inicio = 0;
      function quadro(agora) {
        const t = Math.min(1, (agora - inicio) / duracao);
        const e = facilitar(t);
        const pt = bezier(pontos, e);
        const s = escalaDe + (escalaPara - escalaDe) * e;
        vooAviao.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px) rotate(${pt.ang.toFixed(3)}rad) scale(${s.toFixed(3)})`;
        // o rastro sai da cauda do avião
        const cauda = 44 * s;
        trilha.push(`${(pt.x - Math.cos(pt.ang) * cauda).toFixed(1)} ${(pt.y - Math.sin(pt.ang) * cauda).toFixed(1)}`);
        rastro.setAttribute('d', 'M' + trilha.join(' L'));
        if (t < 1) requestAnimationFrame(quadro);
        else ok();
      }
      // desenha o primeiro quadro antes de mostrar a camada (evita "piscar" no canto)
      inicio = performance.now();
      quadro(inicio);
      voo.classList.add('is-ativa');
    });
  }

  /** Apaga o rastro devagar. */
  function apagarRastro() {
    const a = rastro.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, fill: 'forwards', easing: 'ease-out' });
    a.finished.then(() => { rastro.setAttribute('d', ''); }).catch(() => null);
  }

  /** Centro de um elemento em coordenadas da janela. */
  function centroDe(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /** IDA: cartão → folha → dobras → avião → voa para fora. */
  async function dobrarEVoar() {
    if (movimentoReduzido()) {
      await terminar([animar(form, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 })]);
      form.style.visibility = 'hidden';
      return;
    }
    await garantirVisivel();
    etapas = [];
    const ret = form.getBoundingClientRect();
    const L = folha.offsetWidth;
    const A = folha.offsetHeight;
    const topo = Math.max(0, (ret.height - A) / 2);
    const lado = Math.max(0, (ret.width - L) / 2);

    // Etapa 1 — o conteúdo do cartão some e a sombra se recolhe
    const filhos = [...form.children];
    const e1 = filhos.map((f, i) => animar(f, [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateY(-8px) scale(.98)' }
    ], { duration: 260, delay: i * 18 }));
    e1.push(animar(form, [{ boxShadow: getComputedStyle(form).boxShadow }, { boxShadow: '0 0 0 rgba(0,0,0,0)' }], { duration: 300 }));
    etapas.push(e1);
    await terminar(e1);

    // Etapa 2 — o cartão encolhe (clip-path) até o tamanho de uma folha
    const e2 = [animar(form, [
      { clipPath: 'inset(0px 0px 0px 0px round 24px)', background: '#ffffff' },
      { clipPath: `inset(${topo}px ${lado}px ${topo}px ${lado}px round 6px)`, background: '#ffffff' }
    ], { duration: 520, easing: curva })];
    etapas.push(e2);
    await terminar(e2);

    // troca o cartão pela folha 3D (mesmo tamanho e posição)
    dobra.classList.add('is-ativa');
    folha.style.transformOrigin = '25% 50%';
    const troca = [
      animar(folha, [{ opacity: 0 }, { opacity: 1 }], { duration: 140 }),
      animar(form, [{ opacity: 1 }, { opacity: 0 }], { duration: 140 })
    ];
    etapas.push(troca);
    etapas.troca = troca;
    await terminar(troca);
    form.style.visibility = 'hidden';

    // Etapa 3 — as pontas de cima dobram até o vinco central
    const e3 = [
      animar(abaEsq, [
        { transform: 'translateZ(1px) rotate3d(-1, 1, 0, 0deg)', filter: 'brightness(1)' },
        { transform: 'translateZ(1px) rotate3d(-1, 1, 0, 90deg)', filter: 'brightness(.86)', offset: 0.5 },
        { transform: 'translateZ(1px) rotate3d(-1, 1, 0, 180deg)', filter: 'brightness(.97)' }
      ], { duration: 520, easing: curva }),
      animar(abaDir, [
        { transform: 'translateZ(1px) rotate3d(1, 1, 0, 0deg)', filter: 'brightness(1)' },
        { transform: 'translateZ(1px) rotate3d(1, 1, 0, -90deg)', filter: 'brightness(.86)', offset: 0.5 },
        { transform: 'translateZ(1px) rotate3d(1, 1, 0, -180deg)', filter: 'brightness(.97)' }
      ], { duration: 520, delay: 110, easing: curva })
    ];
    etapas.push(e3);
    await terminar(e3);

    // Etapa 4 — a folha dobra ao meio (metade direita por cima da esquerda)
    const e4 = [
      animar(metadeDir, [
        { transform: 'translateZ(0px) rotateY(0deg)' },
        { transform: 'translateZ(3px) rotateY(-180deg)' }
      ], { duration: 560, easing: curva }),
      animar(baseDir, [{ filter: 'brightness(1)' }, { filter: 'brightness(.8)', offset: .5 }, { filter: 'brightness(.95)' }], { duration: 560, easing: curva })
    ];
    etapas.push(e4);
    await terminar(e4);

    // Etapa 5 — gira para a direção do voo e vira o avião de SVG
    const e5 = [
      animar(folha, [
        { opacity: 1, transform: 'none' },
        { opacity: 1, transform: `translateX(${L / 4}px) rotate(70deg) scale(.62)`, offset: .62 },
        { opacity: 0, transform: `translateX(${L / 4}px) rotate(70deg) scale(.5)` }
      ], { duration: 520, easing: curva }),
      animar(aviao, [
        { opacity: 0, transform: 'rotate(-20deg) scale(.55)' },
        { opacity: 0, transform: 'rotate(-20deg) scale(.55)', offset: .5 },
        { opacity: 1, transform: 'rotate(-20deg) scale(1)' }
      ], { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)' })
    ];
    etapas.push(e5);
    await terminar(e5);
    await esperar(120);

    // Etapa 6 — voa: sobe pela direita e faz uma curva por cima da página
    const p0 = centroDe(aviao);
    const vw = window.innerWidth, vh = window.innerHeight;
    const d = Math.min(380, Math.max(140, vw * 0.25));
    const pontos = [
      p0,
      { x: p0.x + d, y: p0.y - d * 0.364 },
      { x: Math.min(vw - 30, p0.x + d * 0.75), y: -vh * 0.07 },
      { x: -170, y: vh * 0.08 }
    ];
    aviao.style.visibility = 'hidden';
    await voar(pontos, 1500, { escalaDe: 1, escalaPara: 0.6, facilitar: (t) => 0.45 * t + 0.55 * t * t });
    apagarRastro();
    voo.classList.remove('is-ativa');
  }

  /** VOLTA: o avião entra pela esquerda, pousa e desdobra no formulário. */
  async function voltarEDesdobrar() {
    if (movimentoReduzido() || !etapas.length) {
      form.style.visibility = '';
      etapas.flat().forEach((a) => a.cancel());
      etapas = [];
      await terminar([animar(form, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'none' })]);
      return;
    }
    await garantirVisivel();
    const alvo = centroDe(aviao);
    const vh = window.innerHeight;
    const pontos = [
      { x: -170, y: vh * 0.1 },
      { x: alvo.x * 0.5, y: vh * 0.04 },
      { x: alvo.x - 200, y: alvo.y + 73 },
      alvo
    ];
    await voar(pontos, 1300, { escalaDe: 0.6, escalaPara: 1, facilitar: (t) => 1 - Math.pow(1 - t, 3) });
    aviao.style.visibility = '';
    voo.classList.remove('is-ativa');
    apagarRastro();

    // desfaz as etapas na ordem inversa (o cartão segue transparente até a última)
    form.style.visibility = '';
    // Cada grupo terminado é cancelado: o elemento volta ao estado da etapa anterior.
    for (let i = etapas.length - 1; i >= 0; i--) {
      const grupo = etapas[i];
      grupo.forEach((a) => a.reverse());
      await terminar(grupo);
      grupo.forEach((a) => a.cancel());
      if (grupo === etapas.troca) dobra.classList.remove('is-ativa'); // a folha sai de cena
    }
    etapas = [];
    folha.style.transformOrigin = '';
    dobra.classList.remove('is-ativa');
  }

  /* ------------------------------------------------------------------
     8. ENVIO E ESTADO DE SUCESSO
     ------------------------------------------------------------------ */
  const botaoEnviar = $('#ct-enviar');
  const alerta = $('#ct-alerta');
  const sucesso = $('#ct-sucesso');
  let ocupado = false;

  /** Monta o resumo do que foi enviado (texto seguro, sem innerHTML). */
  function montarResumo(dados) {
    const dl = $('#ct-resumo');
    dl.textContent = '';
    const msg = dados.mensagem.length > 140 ? dados.mensagem.slice(0, 137).trimEnd() + '…' : dados.mensagem;
    [['Nome', dados.nome], ['E-mail', dados.email], ['Assunto', dados.assunto], ['Orçamento', dados.orcamentoTexto], ['Mensagem', msg]]
      .forEach(([rotulo, valor]) => {
        const linha = document.createElement('div');
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = rotulo;
        dd.textContent = valor;
        linha.append(dt, dd);
        dl.appendChild(linha);
      });
  }

  function mostrarSucesso(dados, resposta) {
    const primeiroNome = dados.nome.split(/\s+/)[0];
    $('#ct-sucesso-titulo').textContent = `Mensagem enviada, ${primeiroNome}!`;
    const aberto = $('#ct-status').dataset.estado === 'aberto';
    $('#ct-sucesso-texto').textContent = aberto
      ? `Já está com a nossa equipe. Você deve receber a resposta em ${dados.email} em até 15 minutos.`
      : `Já está com a nossa equipe. Respondemos em ${dados.email} assim que o atendimento abrir.`;
    $('#ct-protocolo').textContent = (resposta && resposta.protocolo) || '—';
    montarResumo(dados);
    sucesso.hidden = false;
    sucesso.classList.remove('is-saindo');
    sucesso.classList.add('is-entrando');
    $('#ct-sucesso-titulo').focus({ preventScroll: true });
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (ocupado) return;

    // Valida tudo e leva o foco ao primeiro problema
    ['nome', 'email', 'assunto', 'mensagem'].forEach((n) => tocados.add(n));
    const invalidos = ['nome', 'email', 'assunto', 'mensagem'].filter((n) => !validar(n));
    if (invalidos.length) {
      form.classList.remove('is-tremendo');
      void form.offsetWidth; // reinicia a animação
      form.classList.add('is-tremendo');
      const primeiro = invalidos[0] === 'assunto' ? form.querySelector('input[name="assunto"]') : campos[invalidos[0]];
      primeiro.focus();
      avisar(invalidos.length === 1 ? 'Confira o campo destacado.' : `Confira os ${invalidos.length} campos destacados.`);
      return;
    }

    // Honeypot preenchido = provável robô: finge que enviou e não faz nada
    if (form.elements.site.value) return;

    const dados = coletarDados();
    ocupado = true;
    alerta.hidden = true;
    botaoEnviar.classList.add('is-enviando');
    botaoEnviar.setAttribute('aria-busy', 'true');
    palco.setAttribute('aria-busy', 'true');
    try {
      const resposta = await enviarMensagem(dados);
      botaoEnviar.classList.remove('is-enviando');
      form.inert = true; // nada do cartão dobrado recebe foco
      await dobrarEVoar();
      mostrarSucesso(dados, resposta);
    } catch (erro) {
      alerta.textContent = (erro && erro.message) || 'Não foi possível enviar. Tente de novo.';
      alerta.hidden = false;
      botaoEnviar.classList.remove('is-enviando');
    } finally {
      botaoEnviar.removeAttribute('aria-busy');
      palco.removeAttribute('aria-busy');
      ocupado = false;
    }
  });

  $('#ct-outra').addEventListener('click', async () => {
    if (ocupado) return;
    ocupado = true;
    sucesso.classList.remove('is-entrando');
    sucesso.classList.add('is-saindo');
    await esperar(movimentoReduzido() ? 10 : 340);
    sucesso.hidden = true;
    sucesso.classList.remove('is-saindo');
    limparFormulario();
    await voltarEDesdobrar();
    form.style.visibility = '';
    form.inert = false;
    ocupado = false;
    campos.nome.focus({ preventScroll: true });
  });

  /* ------------------------------------------------------------------
     INÍCIO
     ------------------------------------------------------------------ */
  atualizarStatus();
  setInterval(atualizarStatus, 60 * 1000);
  atualizarFaixa();
  atualizarMensagem();
})();
