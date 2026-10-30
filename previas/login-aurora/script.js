/* ==========================================================================
   LOGIN AURORA — script.js
   JavaScript puro, sem dependências. Funciona abrindo o index.html direto.

   Sumário
   1. Integração (troque pelas chamadas reais da sua API)
   2. Utilitários
   3. Aurora boreal (canvas 2D) + estrelas
   4. Troca de painéis (abas, recuperar, sucesso) com altura animada
   5. Validação em tempo real e no envio
   6. Mostrar/ocultar senha e medidor de força
   7. Envio com botão que se transforma
   8. Estados de validação: aprovado, erro e bloqueado
   9. Login social (demonstração)
   10. Inicialização
   ========================================================================== */

(() => {
  'use strict';

  /* 1. INTEGRAÇÃO ---------------------------------------------------------
     Segurança do login: quantos erros seguidos travam o formulário e por
     quanto tempo. (A trava de verdade precisa existir também no servidor;
     esta é a resposta visual a ela.) */
  const SEGURANCA = {
    tentativas: 3,          // erros seguidos até travar
    bloqueioSegundos: 30,   // duração da trava, em segundos
  };

  /* Conta de demonstração (aparece na dica do painel). Remova ao publicar. */
  const DEMO = { email: 'demo@polar.app', senha: 'aurora' };

  /**
   * autenticar(dados) → Promise com UM dos três estados:
   *   { estado: 'aprovado', nome }                 credenciais certas
   *   { estado: 'erro', restantes? }               senha errada (restantes é opcional)
   *   { estado: 'bloqueado', segundos }            conta travada por um tempo
   * Lançar um Error mostra a mensagem como falha genérica (rede caiu etc.).
   *
   * Para ligar ao seu backend, troque o corpo por algo assim:
   *
   *   const r = await fetch('/api/login', {
   *     method: 'POST',
   *     headers: { 'Content-Type': 'application/json' },
   *     body: JSON.stringify(dados),               // { email, senha, lembrar }
   *   });
   *   if (r.status === 200) {                      // 200 → aprovado
   *     const usuario = await r.json();
   *     return { estado: 'aprovado', nome: usuario.nome };
   *   }
   *   if (r.status === 401) {                      // 401 → erro (senha errada)
   *     const corpo = await r.json().catch(() => ({}));
   *     return { estado: 'erro', restantes: corpo.tentativasRestantes };
   *   }
   *   if (r.status === 423 || r.status === 429) {  // 423/429 → bloqueado
   *     return { estado: 'bloqueado', segundos: lerRetryAfter(r.headers.get('Retry-After')) };
   *   }
   *   throw new Error('Não foi possível entrar agora. Tente de novo.');
   */
  async function autenticar(dados) {
    await esperar(1300);
    const certo = dados.email.toLowerCase() === DEMO.email && dados.senha === DEMO.senha;
    return certo ? { estado: 'aprovado', nome: nomeDoEmail(dados.email) } : { estado: 'erro' };
  }

  /* Converte o cabeçalho Retry-After (segundos ou data HTTP) em segundos */
  function lerRetryAfter(valor) {
    const n = Number(valor);
    if (Number.isFinite(n) && n > 0) return Math.ceil(n);
    const data = Date.parse(valor);
    if (!Number.isNaN(data)) return Math.max(1, Math.ceil((data - Date.now()) / 1000));
    return SEGURANCA.bloqueioSegundos;
  }

  /* Demais chamadas: resolva para sucesso; rejeite com Error('mensagem') para
     mostrar o erro. Na demonstração, "erro@exemplo.com" simula e-mail em uso. */
  const API = {
    entrar: autenticar,
    cadastro: async (dados) => {
      await esperar(1500);
      if (dados.email === 'erro@exemplo.com') throw new Error('Este e-mail já está em uso.');
      return { nome: dados.nome.trim().split(/\s+/)[0] };
    },
    recuperar: async () => {
      await esperar(1200);
    },
    social: (provedor) => {
      // Redirecione para o seu fluxo OAuth aqui, ex.: location.href = '/auth/' + provedor.toLowerCase();
      avisar(`Demonstração: conecte o login com ${provedor} em API.social (script.js).`);
    },
  };

  /* Título e subtítulo do topo do painel em cada modo */
  const TOPOS = {
    entrar: ['Que bom ver você', 'Entre para continuar de onde parou.'],
    cadastro: ['Crie sua conta', 'Grátis por 14 dias. Sem cartão de crédito.'],
    recuperar: ['Esqueceu a senha?', 'Acontece com todo mundo. Vamos resolver.'],
    enviado: ['Link a caminho', 'Confira sua caixa de entrada.'],
    sucesso: ['Tudo certo por aqui', 'Sua sessão está pronta.'],
  };

  /* 2. UTILITÁRIOS -------------------------------------------------------- */
  const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
  const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];
  const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduzido = () => movimentoReduzido.matches;

  function nomeDoEmail(email) {
    const parte = String(email).split('@')[0].split(/[._-]/)[0] || 'você';
    return parte.charAt(0).toUpperCase() + parte.slice(1);
  }

  /* Reinicia uma animação CSS de classe (ex.: tremer, piscar) */
  function repetirClasse(el, classe) {
    el.classList.remove(classe);
    void el.offsetWidth; // força reflow para a animação recomeçar
    el.classList.add(classe);
    el.addEventListener('animationend', () => el.classList.remove(classe), { once: true });
  }

  /* 3. AURORA BOREAL ------------------------------------------------------
     Cada faixa é uma "cortina": centenas de raios verticais finos, com a base
     brilhante e o topo esmaecido, cuja base ondula lentamente. O canvas é
     desenhado em baixa resolução e desfocado via CSS (barato e sedoso). */
  const Aurora = (() => {
    const canvas = $('.la-ceu__aurora');
    const ctxA = canvas.getContext('2d');
    const estrelas = $('.la-ceu__estrelas');
    const ctxE = estrelas.getContext('2d');
    const ESCALA = 0.5;  // resolução do canvas da aurora em relação à tela
    const PASSO = 2;     // largura de cada raio (px do canvas)
    let largura = 0;
    let altura = 0;
    let sprites = [];       // cores normais (verde, turquesa, rosa)
    let spritesErro = [];   // vermelho e magenta (senha errada)
    let spritesGelo = [];   // azul frio (bloqueio)
    let quadro = 0;
    let rodando = false;
    let relogio = 0;        // tempo da aurora (ms); anda mais rápido ou quase para conforme o humor
    let ultimo = 0;

    /* HUMOR da aurora: cada valor desliza suavemente até o alvo.
       ganho = intensidade · subida = desloca as faixas (negativo sobe)
       agito = turbulência · erro/gelo = mistura de cor · tempo = velocidade */
    const NORMAL = { ganho: 1, subida: 0, agito: 0, erro: 0, gelo: 0, tempo: 1 };
    const humor = { ...NORMAL };
    let alvo = { ...NORMAL };
    let inercia = 0.25;     // segundos para chegar ~63% do caminho até o alvo
    let idHumor = 0;

    /* Faixas: y = altura da base (0–1), amp = ondulação, alt = altura dos raios,
       incl = inclinação, de/ate = trecho horizontal ocupado, cor = 1|2|3 (tokens CSS) */
    const FAIXAS = [
      { cor: 1, y: 0.42, amp: 0.085, alt: 0.42, incl: -0.18, de: -0.10, ate: 0.92, vel: 1.0, fase: 0.0, alfa: 1.0 },
      { cor: 2, y: 0.52, amp: 0.070, alt: 0.30, incl: -0.10, de: 0.10, ate: 1.10, vel: 0.8, fase: 2.1, alfa: 0.80 },
      { cor: 3, y: 0.27, amp: 0.060, alt: 0.22, incl: -0.14, de: 0.18, ate: 0.85, vel: 0.6, fase: 4.2, alfa: 0.50 },
      { cor: 1, y: 0.62, amp: 0.050, alt: 0.20, incl: 0.06, de: -0.05, ate: 0.50, vel: 1.25, fase: 1.3, alfa: 0.55 },
      { cor: 2, y: 0.30, amp: 0.045, alt: 0.20, incl: -0.22, de: 0.55, ate: 1.10, vel: 0.9, fase: 3.4, alfa: 0.55 },
    ];

    /* Lê uma cor hex do :root (#rrggbb ou #rgb) e devolve [r, g, b] */
    function lerCor(nomeVar, padrao) {
      let hex = getComputedStyle(document.documentElement).getPropertyValue(nomeVar).trim() || padrao;
      hex = hex.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      const n = parseInt(hex, 16);
      return Number.isNaN(n) ? lerCor('', padrao) : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    /* Sprite de 1 px de largura com o degradê vertical de um raio */
    function criarSprite([r, g, b]) {
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 256;
      const x = c.getContext('2d');
      const grad = x.createLinearGradient(0, 0, 0, 256);
      const claro = (v) => Math.round(v + (255 - v) * 0.45);
      grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grad.addColorStop(0.45, `rgba(${r},${g},${b},0.16)`);
      grad.addColorStop(0.8, `rgba(${r},${g},${b},0.62)`);
      grad.addColorStop(0.93, `rgba(${claro(r)},${claro(g)},${claro(b)},1)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      x.fillStyle = grad;
      x.fillRect(0, 0, 1, 256);
      return c;
    }

    /* Gerador pseudoaleatório com semente (estrelas sempre no mesmo lugar) */
    function aleatorio(semente) {
      return () => {
        semente = (semente * 16807) % 2147483647;
        return (semente - 1) / 2147483646;
      };
    }

    function desenharEstrelas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      estrelas.width = Math.round(w * dpr);
      estrelas.height = Math.round(h * dpr);
      ctxE.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxE.clearRect(0, 0, w, h);
      const rnd = aleatorio(7);
      const total = Math.round((w * h) / 2600);
      for (let i = 0; i < total; i++) {
        const x = rnd() * w;
        const y = Math.pow(rnd(), 1.6) * h * 0.85; // mais estrelas no alto
        const r = rnd() < 0.92 ? 0.35 + rnd() * 0.6 : 1 + rnd() * 0.7;
        ctxE.globalAlpha = 0.25 + rnd() * 0.7 * (1 - y / h);
        ctxE.fillStyle = rnd() < 0.15 ? '#bff7ff' : '#ffffff';
        ctxE.beginPath();
        ctxE.arc(x, y, r, 0, Math.PI * 2);
        ctxE.fill();
      }
      ctxE.globalAlpha = 1;
    }

    function redimensionar() {
      largura = Math.max(1, Math.round(window.innerWidth * ESCALA));
      altura = Math.max(1, Math.round(window.innerHeight * ESCALA));
      canvas.width = largura;
      canvas.height = altura;
      desenharEstrelas();
      if (!rodando) desenhar(TEMPO_ESTATICO);
    }

    const suave = (a, b, v) => {
      const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };

    /* Desenha um quadro no tempo t (ms) */
    function desenhar(t) {
      ctxA.globalCompositeOperation = 'source-over';
      ctxA.clearRect(0, 0, largura, altura);
      ctxA.globalCompositeOperation = 'lighter';
      // Em telas em pé (celular) a aurora sobe e fica mais alta, para aparecer pelo vidro
      const retrato = altura > largura;
      const ajusteY = (retrato ? -0.12 : (window.innerWidth < 900 ? -0.06 : 0)) + humor.subida;
      const escalaAlt = (retrato ? 1.35 : 1) * (1 + Math.max(0, humor.ganho - 1) * 0.35);
      // Pesos de cor: normal → erro (magenta) ou gelo (azul frio)
      const pErro = Math.min(1, humor.erro);
      const pGelo = Math.min(1 - pErro, humor.gelo);
      const pBase = Math.max(0, 1 - pErro - pGelo);
      const agito = humor.agito;

      for (const f of FAIXAS) {
        const camadas = [[sprites[f.cor - 1], pBase], [spritesErro[f.cor - 1], pErro], [spritesGelo[f.cor - 1], pGelo]]
          .filter(([sp, p]) => sp && p > 0.01);
        const s = t * 0.001 * f.vel;
        for (let x = 0; x <= largura; x += PASSO) {
          const u = x / largura;
          const env = suave(f.de, f.de + 0.25, u) * (1 - suave(f.ate - 0.25, f.ate, u));
          if (env <= 0.01) continue;
          const base = altura * (
            f.y + ajusteY + f.incl * (u - 0.5) +
            f.amp * (1 + agito * 0.6) * Math.sin(u * 3.4 + s * 0.22 + f.fase) +
            f.amp * 0.45 * Math.sin(u * 8.3 - s * 0.35 + f.fase * 1.7) +
            // Turbulência (senha errada): ondas curtas e rápidas que agitam as faixas
            agito * 0.035 * Math.sin(u * 19 + s * 4.2 + f.fase * 2.3)
          );
          // Altura dos raios: ondulação larga + pontas finas e irregulares
          const h = altura * f.alt * escalaAlt *
            (0.6 + 0.4 * Math.sin(u * 5.1 + s * 0.3 + f.fase)) *
            (0.86 + 0.14 * Math.sin(u * 260 + s * 0.9 + f.fase));
          // Dobras da cortina: variação de brilho em várias escalas (larga → fina)
          let a = 0.55 +
            0.22 * Math.sin(u * 23 + s * 0.7 + f.fase) +
            0.14 * Math.sin(u * 170 + s * 1.3) +
            0.09 * Math.sin(u * 410 - s * 2.1 + f.fase);
          a = Math.max(0, Math.min(1, a * humor.ganho)) * f.alfa * env;
          for (const [sp, p] of camadas) {
            ctxA.globalAlpha = a * p;
            ctxA.drawImage(sp, x, base - h, PASSO + 0.6, h * 1.1);
          }
        }
      }
      ctxA.globalAlpha = 1;
    }

    const TEMPO_ESTATICO = 41000; // instante usado no modo estático (movimento reduzido)

    function laco(agora) {
      const dt = Math.min(0.05, ultimo ? (agora - ultimo) / 1000 : 0.016);
      ultimo = agora;
      // Aproxima cada valor do humor do seu alvo (suavização exponencial)
      const k = 1 - Math.exp(-dt / inercia);
      for (const chave in humor) humor[chave] += (alvo[chave] - humor[chave]) * k;
      relogio += dt * 1000 * humor.tempo;
      desenhar(TEMPO_ESTATICO + relogio);
      quadro = requestAnimationFrame(laco);
    }

    function definirHumor(valores, segundos = 0.25) {
      alvo = { ...NORMAL, ...valores };
      inercia = segundos;
      if (!rodando) {
        // Movimento reduzido (ou aba oculta): aplica direto, sem transição
        Object.assign(humor, alvo);
        desenhar(TEMPO_ESTATICO);
      }
    }

    /**
     * Reação da aurora a cada estado de validação.
     * aprovado: pulsa, sobe e fica mais intensa · erro: vira magenta e se agita
     * bloqueado: esfria para azul e quase congela · liberado: volta aquecendo.
     */
    function reagir(tipo) {
      clearTimeout(idHumor);
      const reduzidoAgora = reduzido();
      if (tipo === 'aprovado') {
        if (reduzidoAgora) return definirHumor(NORMAL);
        definirHumor({ ganho: 2.1, subida: -0.08, agito: 0.25, tempo: 2.6 }, 0.22);
        idHumor = setTimeout(() => definirHumor({ ganho: 1.25, subida: -0.03, tempo: 1.2 }, 0.9), 700);
      } else if (tipo === 'erro') {
        if (reduzidoAgora) return definirHumor(NORMAL);
        definirHumor({ erro: 1, agito: 1, ganho: 1.3, tempo: 3.4 }, 0.12);
        idHumor = setTimeout(() => definirHumor(NORMAL, 0.6), 850);
      } else if (tipo === 'bloqueado') {
        definirHumor({ gelo: 1, ganho: 0.78, subida: 0.035, tempo: 0.05 }, 0.55);
      } else if (tipo === 'liberado') {
        if (reduzidoAgora) return definirHumor(NORMAL);
        definirHumor({ ganho: 1.6, subida: -0.04, tempo: 1.8 }, 0.35);
        idHumor = setTimeout(() => definirHumor(NORMAL, 0.8), 650);
      } else {
        definirHumor(NORMAL);
      }
    }

    function iniciar() {
      const cores = [lerCor('--la-aurora-1', '#3ef2a5'), lerCor('--la-aurora-2', '#2fd8e4'), lerCor('--la-aurora-3', '#ff6fae')];
      sprites = cores.map(criarSprite);
      spritesErro = [lerCor('--la-aurora-erro-1', '#ff3d6e'), lerCor('--la-aurora-erro-2', '#ff3fd4'), lerCor('--la-aurora-erro-3', '#ff7a45')].map(criarSprite);
      spritesGelo = [lerCor('--la-aurora-gelo-1', '#8fcaff'), lerCor('--la-aurora-gelo-2', '#5f8dff'), lerCor('--la-aurora-gelo-3', '#d8efff')].map(criarSprite);
      redimensionar();
      atualizarMovimento();

      let espera;
      window.addEventListener('resize', () => {
        clearTimeout(espera);
        espera = setTimeout(redimensionar, 120);
      });
      // Pausa quando a aba não está visível (economia de bateria)
      document.addEventListener('visibilitychange', atualizarMovimento);
      movimentoReduzido.addEventListener?.('change', atualizarMovimento);
    }

    function atualizarMovimento() {
      const deveRodar = !reduzido() && !document.hidden;
      if (deveRodar && !rodando) {
        rodando = true;
        ultimo = 0;
        quadro = requestAnimationFrame(laco);
      } else if (!deveRodar && rodando) {
        rodando = false;
        cancelAnimationFrame(quadro);
        if (reduzido()) desenhar(TEMPO_ESTATICO);
      }
    }

    return { iniciar, reagir };
  })();

  /* 4. TROCA DE PAINÉIS --------------------------------------------------- */
  const painel = $('.la-painel');
  const palco = $('.la-palco');
  const abas = $('.la-abas');
  const abaEntrar = $('#la-aba-entrar');
  const abaCadastro = $('#la-aba-cadastro');
  const topoTitulo = $('#la-painel-titulo');
  const topoSub = $('#la-painel-sub');
  const ORDEM = ['recuperar', 'entrar', 'cadastro', 'sucesso'];
  let atual = $('[data-painel="entrar"]', palco);
  let fimTroca = null;

  /* Executa "mudanca" e anima a altura do palco da altura antiga para a nova */
  function animarAltura(mudanca, aoTerminar) {
    if (fimTroca) fimTroca();
    if (reduzido()) {
      mudanca();
      aoTerminar?.();
      return;
    }
    const hInicial = palco.offsetHeight;
    mudanca();
    palco.style.height = '';
    const hFinal = palco.offsetHeight;
    palco.style.height = hInicial + 'px';
    palco.classList.add('la-animando');
    void palco.offsetHeight;
    palco.style.height = hFinal + 'px';

    let id;
    fimTroca = () => {
      clearTimeout(id);
      fimTroca = null;
      palco.style.height = '';
      palco.classList.remove('la-animando');
      aoTerminar?.();
    };
    id = setTimeout(fimTroca, 460);
  }

  function atualizarTopo(nome) {
    const [titulo, sub] = TOPOS[nome];
    if (topoTitulo.textContent === titulo) return;
    const topo = topoTitulo.parentElement;
    if (reduzido()) {
      topoTitulo.textContent = titulo;
      topoSub.textContent = sub;
      return;
    }
    topo.classList.add('la-trocando');
    setTimeout(() => {
      topoTitulo.textContent = titulo;
      topoSub.textContent = sub;
      topo.classList.remove('la-trocando');
    }, 160);
  }

  function marcarAba(nome) {
    const indice = nome === 'cadastro' ? 1 : 0;
    abas.dataset.ativa = String(indice);
    [abaEntrar, abaCadastro].forEach((aba, i) => {
      aba.setAttribute('aria-selected', String(i === indice));
      aba.tabIndex = i === indice ? 0 : -1;
    });
    // Durante o sucesso as abas ficam inativas
    painel.dataset.modo = nome;
    abas.inert = nome === 'sucesso';
  }

  /**
   * Mostra o painel "nome" (entrar | cadastro | recuperar | sucesso).
   * opcoes.foco: elemento (ou seletor) que recebe o foco ao terminar.
   */
  function trocarPainel(nome, opcoes = {}) {
    const novo = $(`[data-painel="${nome}"]`, palco);
    if (!novo || novo === atual) return;
    const anterior = atual;
    const direcao = ORDEM.indexOf(nome) > ORDEM.indexOf(anterior.dataset.painel) ? 1 : -1;
    palco.style.setProperty('--la-dir', direcao);
    atual = novo;

    marcarAba(nome);
    atualizarTopo(nome);

    animarAltura(
      () => {
        if (reduzido()) {
          anterior.hidden = true;
          novo.hidden = false;
          return;
        }
        anterior.classList.add('la-saindo');
        novo.hidden = false;
        novo.classList.add('la-entrando');
        void novo.offsetWidth;
        requestAnimationFrame(() => novo.classList.remove('la-entrando'));
      },
      () => {
        anterior.classList.remove('la-saindo');
        if (anterior !== atual) anterior.hidden = true;
        // Botões voltam ao estado normal quando o painel sai de cena
        $$('.la-botao[data-estado]', anterior).forEach(limparBotao);
        const foco = typeof opcoes.foco === 'string' ? $(opcoes.foco) : opcoes.foco;
        foco?.focus({ preventScroll: true });
      }
    );
  }

  // Cliques e teclado nas abas (setas, Home, End)
  abaEntrar.addEventListener('click', () => trocarPainel('entrar'));
  abaCadastro.addEventListener('click', () => trocarPainel('cadastro'));
  abas.addEventListener('keydown', (ev) => {
    const mapa = { ArrowLeft: 'entrar', ArrowRight: 'cadastro', Home: 'entrar', End: 'cadastro' };
    const destino = mapa[ev.key];
    if (!destino) return;
    ev.preventDefault();
    trocarPainel(destino);
    (destino === 'entrar' ? abaEntrar : abaCadastro).focus();
  });

  // Botões e links com data-ir="entrar|cadastro|recuperar"
  document.addEventListener('click', (ev) => {
    const alvo = ev.target.closest('[data-ir]');
    if (!alvo) return;
    const destino = alvo.dataset.ir;
    if (destino === 'recuperar') {
      // Leva o e-mail já digitado para o fluxo de recuperação
      const email = $('#la-entrar-email').value;
      const campo = $('#la-rec-email');
      if (email && !campo.value) campo.value = email;
      $('[data-etapa="pedir"]').hidden = false;
      $('[data-etapa="enviado"]').hidden = true;
      trocarPainel('recuperar', { foco: '#la-rec-titulo' });
    } else if (destino === 'entrar' && atual.dataset.painel === 'sucesso') {
      reiniciarDemo();
    } else {
      trocarPainel(destino, { foco: destino === 'cadastro' ? '#la-cad-nome' : '#la-entrar-email' });
    }
  });

  /* 5. VALIDAÇÃO ---------------------------------------------------------
     Cada input tem data-validar="<regra>". A regra devolve a mensagem de erro
     ou nada (válido). Adicione regras novas aqui. */
  const REGRAS = {
    email(valor) {
      if (!valor) return 'Informe seu e-mail.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor)) return 'Digite um e-mail válido, como nome@empresa.com.';
    },
    senha(valor) {
      if (!valor) return 'Informe sua senha.';
      if (valor.length < 6) return 'A senha tem pelo menos 6 caracteres.';
    },
    nome(valor) {
      if (!valor) return 'Como podemos chamar você?';
      if (valor.length < 3) return 'Digite seu nome completo.';
    },
    'senha-nova'(valor) {
      if (!valor) return 'Crie uma senha.';
      if (valor.length < 8) return 'Use pelo menos 8 caracteres.';
      if (forcaSenha(valor) < 2) return 'Senha fraca: misture maiúsculas, números ou símbolos.';
    },
    confirmar(valor, input) {
      const original = document.getElementById(input.dataset.igual).value;
      if (!valor) return 'Repita a senha para confirmar.';
      if (valor !== original) return 'As senhas não coincidem.';
    },
    termos(_valor, input) {
      if (!input.checked) return 'Aceite os termos para continuar.';
    },
  };

  function caixaDo(input) {
    return input.closest('.la-campo, .la-check');
  }

  function mostrarErro(input, mensagem, tremer = false) {
    const caixa = caixaDo(input);
    const erro = document.getElementById(input.id + '-erro');
    caixa.classList.add('la-invalido');
    caixa.classList.remove('la-valido');
    input.setAttribute('aria-invalid', 'true');
    if (erro) {
      erro.replaceChildren();
      const icone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icone.setAttribute('aria-hidden', 'true');
      icone.innerHTML = '<use href="#la-i-alerta"/>';
      const texto = document.createElement('span');
      texto.textContent = mensagem;
      erro.append(icone, texto);
      erro.classList.add('la-visivel');
    }
    if (tremer && !reduzido()) repetirClasse(caixa, 'la-tremer');
  }

  function limparErro(input) {
    const caixa = caixaDo(input);
    const erro = document.getElementById(input.id + '-erro');
    caixa.classList.remove('la-invalido');
    input.removeAttribute('aria-invalid');
    if (erro && erro.classList.contains('la-visivel')) {
      erro.classList.remove('la-visivel');
      setTimeout(() => { if (!erro.classList.contains('la-visivel')) erro.replaceChildren(); }, 320);
    }
  }

  /* Valida um campo; devolve true se estiver ok */
  function validarCampo(input, tremer = false) {
    const regra = REGRAS[input.dataset.validar];
    if (!regra) return true;
    const valor = input.type === 'checkbox' ? '' : input.value.trim();
    const mensagem = regra(valor, input);
    if (mensagem) {
      mostrarErro(input, mensagem, tremer);
      return false;
    }
    limparErro(input);
    caixaDo(input).classList.toggle('la-valido', input.type !== 'checkbox' && valor !== '');
    return true;
  }

  // Tempo real: depois do primeiro blur (ou de uma tentativa de envio), valida a cada tecla
  $$('[data-validar]').forEach((input) => {
    const evento = input.type === 'checkbox' ? 'change' : 'input';
    input.addEventListener(evento, () => {
      if (input.type === 'checkbox') input.dataset.tocado = '1';
      if (input.dataset.tocado) validarCampo(input);
      else if (caixaDo(input).classList.contains('la-valido')) caixaDo(input).classList.remove('la-valido');
      // Se a senha mudar, revalida a confirmação
      const dependente = $(`[data-igual="${input.id}"]`);
      if (dependente?.dataset.tocado) validarCampo(dependente);
    });
    input.addEventListener('blur', () => {
      if (input.type === 'checkbox') return;
      if (input.value.trim() !== '') input.dataset.tocado = '1';
      if (input.dataset.tocado) validarCampo(input);
    });
  });

  /* 6. SENHA: OLHO E FORÇA ------------------------------------------------ */
  $$('.la-olho').forEach((botao) => {
    botao.addEventListener('click', () => {
      const input = document.getElementById(botao.getAttribute('aria-controls'));
      const mostrar = input.type === 'password';
      const { selectionStart: ini, selectionEnd: fim } = input;
      input.type = mostrar ? 'text' : 'password';
      botao.setAttribute('aria-pressed', String(mostrar));
      botao.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
      if (!reduzido()) repetirClasse(botao, 'la-piscar');
      // Mantém o cursor onde estava, caso o foco volte ao campo
      try { input.setSelectionRange(ini, fim); } catch (_) { /* alguns tipos não suportam */ }
    });
  });

  /* Força da senha de 0 (vazia) a 4 (forte) */
  function forcaSenha(senha) {
    if (!senha) return 0;
    let pontos = 0;
    if (senha.length >= 8) pontos++;
    if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++;
    if (/\d/.test(senha)) pontos++;
    if (/[^A-Za-z0-9]/.test(senha)) pontos++;
    if (senha.length >= 14 && pontos >= 3) pontos = 4;
    if (senha.length < 8) pontos = Math.min(pontos, 1);
    return Math.max(1, pontos);
  }

  const TEXTOS_FORCA = [
    'Use 8+ caracteres com letras, números e símbolos.',
    'Fraca: aumente o tamanho e misture caracteres.',
    'Razoável: adicione números ou símbolos.',
    'Boa: falta pouco para ficar forte.',
    'Forte: excelente escolha!',
  ];

  const senhaNova = $('#la-cad-senha');
  const medidor = $('.la-forca');
  const textoForca = $('.la-forca__texto');
  senhaNova.addEventListener('input', () => {
    const nivel = forcaSenha(senhaNova.value);
    if (medidor.dataset.nivel === String(nivel)) return;
    medidor.dataset.nivel = String(nivel);
    textoForca.textContent = nivel === 1 && senhaNova.value.length < 8
      ? 'Fraca: use pelo menos 8 caracteres.'
      : TEXTOS_FORCA[nivel];
  });

  /* 7. ENVIO -------------------------------------------------------------- */
  function limparBotao(botao) {
    delete botao.dataset.estado;
    botao.removeAttribute('aria-busy');
    botao.removeAttribute('aria-label');
  }

  function camposVisiveis(form) {
    return $$('[data-validar]', form).filter((input) => !input.closest('[hidden]'));
  }

  async function aoEnviar(ev) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const tipo = form.dataset.painel;
    const botao = $$('.la-botao[type="submit"]', form).find((b) => !b.closest('[hidden]'));
    if (botao.dataset.estado || botao.disabled) return; // já enviando ou travado

    // Valida tudo e foca o primeiro campo com erro
    let primeiroInvalido = null;
    for (const input of camposVisiveis(form)) {
      input.dataset.tocado = '1';
      if (!validarCampo(input, true) && !primeiroInvalido) primeiroInvalido = input;
    }
    if (primeiroInvalido) {
      primeiroInvalido.focus();
      return;
    }

    const dados = Object.fromEntries(new FormData(form));
    dados.email = (dados.email || '').trim();

    // texto → spinner
    botao.dataset.estado = 'carregando';
    botao.setAttribute('aria-busy', 'true');
    botao.setAttribute('aria-label', 'Enviando…');

    let resposta;
    try {
      resposta = await API[tipo](dados);
    } catch (erro) {
      limparBotao(botao);
      const campo = $('input[type="email"]', form);
      mostrarErro(campo, erro.message || 'Algo deu errado. Tente de novo.', true);
      campo.focus();
      return;
    }

    // Login: erro e bloqueio têm reações próprias (seção 8)
    if (tipo === 'entrar' && resposta?.estado === 'erro') {
      limparBotao(botao);
      Guarda.erro(resposta.restantes);
      return;
    }
    if (tipo === 'entrar' && resposta?.estado === 'bloqueado') {
      limparBotao(botao);
      Guarda.bloquear(resposta.segundos);
      return;
    }

    // spinner → ✓ (no login, a aurora comemora junto)
    botao.dataset.estado = 'sucesso';
    botao.setAttribute('aria-label', 'Pronto');
    if (tipo === 'entrar') Guarda.aprovado();
    await esperar(reduzido() ? 300 : 900);

    if (tipo === 'recuperar') {
      $('.la-rec__destino').textContent = dados.email;
      animarAltura(() => {
        $('[data-etapa="pedir"]', form).hidden = true;
        $('[data-etapa="enviado"]', form).hidden = false;
      }, () => {
        limparBotao(botao);
        $('#la-rec-enviado-titulo').focus({ preventScroll: true });
      });
      atualizarTopo('enviado');
      return;
    }

    $('.la-sucesso__quem').textContent = resposta?.nome || 'você';
    trocarPainel('sucesso', { foco: '#la-sucesso-titulo' });
  }

  $$('form.la-form').forEach((form) => form.addEventListener('submit', aoEnviar));

  /* Volta tudo ao estado inicial (botão da tela de sucesso) */
  function reiniciarDemo() {
    $$('form.la-form').forEach((form) => {
      form.reset();
      $$('[data-validar]', form).forEach((input) => {
        delete input.dataset.tocado;
        limparErro(input);
        caixaDo(input).classList.remove('la-valido');
      });
      $$('.la-botao[data-estado]', form).forEach(limparBotao);
    });
    $$('.la-olho[aria-pressed="true"]').forEach((b) => b.click());
    medidor.dataset.nivel = '0';
    textoForca.textContent = TEXTOS_FORCA[0];
    trocarPainel('entrar', { foco: '#la-entrar-email' });
  }

  /* 8. ESTADOS DE VALIDAÇÃO ----------------------------------------------
     aprovado  → a aurora pulsa e sobe, um raio de luz atravessa o vidro
     erro      → a aurora fica magenta e se agita; mostra as tentativas restantes
     bloqueado → um escudo de luz congela a cena e a aurora esfria para azul;
                 o formulário trava com contagem regressiva e depois "derrete" */
  const Guarda = (() => {
    const formEntrar = $('#la-form-entrar');
    const email = $('#la-entrar-email');
    const senha = $('#la-entrar-senha');
    const bloco = $('#la-bloqueio');
    const tempo = $('#la-bloqueio-tempo');
    const titulo = $('#la-bloqueio-titulo');
    const anuncio = $('#la-anuncio');
    let falhas = 0;
    let fim = 0;
    let total = 0;
    let idContagem = 0;
    let idEfeito = 0;

    /* Marca o painel com o estado atual (o CSS anima a partir dele) */
    function efeito(nome, ms) {
      clearTimeout(idEfeito);
      painel.dataset.validacao = '';
      void painel.offsetWidth; // reinicia a animação se repetir o mesmo estado
      painel.dataset.validacao = nome;
      if (ms) idEfeito = setTimeout(() => { if (painel.dataset.validacao === nome) painel.dataset.validacao = ''; }, ms);
    }

    function anunciar(texto) {
      anuncio.textContent = '';
      setTimeout(() => { anuncio.textContent = texto; }, 60);
    }

    const plural = (n) => `${n} ${n === 1 ? 'tentativa' : 'tentativas'}`;
    const relogio = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    function aprovado() {
      falhas = 0; // acertar a senha zera o contador
      Aurora.reagir('aprovado');
      if (!reduzido()) efeito('aprovado', 1500);
    }

    function erro(restantesDoServidor) {
      falhas++;
      const restantes = Number.isFinite(restantesDoServidor) ? restantesDoServidor : SEGURANCA.tentativas - falhas;
      if (restantes <= 0) return bloquear(SEGURANCA.bloqueioSegundos);
      Aurora.reagir('erro');
      efeito('erro', reduzido() ? 0 : 1200);
      senha.dataset.tocado = '1';
      mostrarErro(senha, `E-mail ou senha incorretos. Você tem ${plural(restantes)}.`, true);
      senha.focus();
      senha.select(); // a senha fica selecionada: é só digitar de novo
    }

    /* Liga/desliga todos os controles do formulário de login */
    function travar(sim) {
      $$('input, button', formEntrar).forEach((el) => {
        if (el.closest('.la-bloqueio') || el.matches('[data-ir]')) return; // recuperar senha e cadastro seguem livres
        el.disabled = sim;
      });
      formEntrar.toggleAttribute('aria-disabled', sim);
    }

    function bloquear(segundos) {
      total = Math.max(1, Math.round(segundos || SEGURANCA.bloqueioSegundos));
      fim = Date.now() + total * 1000;
      falhas = 0;
      [email, senha].forEach(limparErro);
      travar(true);
      Aurora.reagir('bloqueado');
      efeito('bloqueado');
      bloco.style.setProperty('--la-resta', '1');
      tempo.textContent = relogio(total);
      animarAltura(() => {
        bloco.hidden = false;
        formEntrar.classList.add('la-travado');
      });
      bloco.scrollIntoView({ block: 'nearest', behavior: reduzido() ? 'auto' : 'smooth' });
      titulo.focus({ preventScroll: true });
      anunciar(`Muitas tentativas sem sucesso. Por segurança, o acesso foi pausado. Tente de novo em ${total} segundos.`);
      clearInterval(idContagem);
      idContagem = setInterval(contar, 250);
      requestAnimationFrame(contar);
    }

    function contar() {
      const resta = Math.max(0, Math.ceil((fim - Date.now()) / 1000));
      const texto = relogio(resta);
      if (tempo.textContent !== texto) tempo.textContent = texto;
      bloco.style.setProperty('--la-resta', String(resta / total));
      if (resta <= 0) liberar();
    }

    function liberar() {
      clearInterval(idContagem);
      efeito('liberando');
      Aurora.reagir('liberado');
      setTimeout(() => {
        animarAltura(() => {
          bloco.hidden = true;
          formEntrar.classList.remove('la-travado');
        });
        travar(false);
        painel.dataset.validacao = '';
        senha.value = '';
        delete senha.dataset.tocado;
        [email, senha].forEach(limparErro);
        (email.value ? senha : email).focus({ preventScroll: true });
        anunciar('Pronto, você já pode tentar de novo.');
      }, reduzido() ? 0 : 900);
    }

    const bloqueado = () => painel.dataset.validacao === 'bloqueado';

    // Link de suporte: só visual na demonstração
    $('.la-bloqueio__suporte').addEventListener('click', (ev) => {
      ev.preventDefault();
      avisar('Demonstração: ligue este link ao seu canal de suporte.');
    });

    return { aprovado, erro, bloquear, bloqueado };
  })();

  // Dica da conta demo: preenche os campos de login
  $('#la-preencher').addEventListener('click', () => {
    const email = $('#la-entrar-email');
    const senha = $('#la-entrar-senha');
    email.value = DEMO.email;
    senha.value = DEMO.senha;
    [email, senha].forEach((input) => { input.dataset.tocado = '1'; validarCampo(input); });
    $('#la-form-entrar .la-botao').focus();
  });

  /* 9. LOGIN SOCIAL ------------------------------------------------------- */
  const aviso = $('.la-aviso');
  let idAviso;
  function avisar(texto) {
    aviso.textContent = texto;
    aviso.classList.add('la-visivel');
    clearTimeout(idAviso);
    idAviso = setTimeout(() => aviso.classList.remove('la-visivel'), 3600);
  }

  $$('.la-social').forEach((botao) => {
    botao.addEventListener('click', () => {
      if (!reduzido()) repetirClasse(botao, 'la-pulsando');
      API.social(botao.dataset.social);
    });
  });

  /* 10. INICIALIZAÇÃO ----------------------------------------------------- */
  Aurora.iniciar();
  marcarAba('entrar');
})();
