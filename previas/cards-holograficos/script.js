/* ==========================================================================
   CARDS HOLOGRÁFICOS — script.js
   JavaScript puro, sem dependências. Funciona abrindo o index.html direto.

   O que este arquivo faz:
   1. Configuração (intensidades e velocidades)
   2. Lê cada carta (.ch-slot) e prepara o estado
   3. Ponteiro (mouse e toque): calcula o alvo de inclinação e brilho
   4. Virar a carta (clique, Enter, Espaço)
   5. Laço de animação: suaviza (lerp) e escreve as variáveis CSS
   6. Movimento reduzido: pose estática
   ========================================================================== */

(() => {
  'use strict';

  /* 1. CONFIGURAÇÃO ------------------------------------------------------- */
  const raiz = getComputedStyle(document.documentElement);
  const CONFIG = {
    inclinacaoMax: parseFloat(raiz.getPropertyValue('--ch-inclinacao-max')) || 16, // graus
    suavidadeAtivo: 0.16,   // 0–1: quanto maior, mais rápido segue o ponteiro
    suavidadeRepouso: 0.05, // retorno ao repouso / flutuação
    flutuacaoPx: 7,         // amplitude da flutuação "idle"
    brilhoRepouso: 0.5,     // intensidade do foil quando ninguém interage
  };

  const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

  /* 2. CARTAS ------------------------------------------------------------- */
  const cartas = [...document.querySelectorAll('.ch-slot')].map((slot, i) => {
    const el = slot.querySelector('.ch-carta');
    // data-pose="rx,ry": inclinação de repouso (dá vida à capa, mesmo parada)
    const [poseX, poseY] = (slot.dataset.pose || '5,-8').split(',').map(Number);
    const pose = { rx: poseX, ry: poseY, px: 50 + poseY * 2.2, py: 50 - poseX * 3, ativo: CONFIG.brilhoRepouso };
    return {
      i,
      slot,
      el,
      botao: el.querySelector('.ch-carta__virar'),
      frente: el.querySelector('.ch-face--frente'),
      verso: el.querySelector('.ch-face--verso'),
      pose,
      atual: { ...pose, flut: 0, repouso: 1 },
      alvo: { ...pose },
      sobre: false,
    };
  });

  /* Escreve o estado como variáveis CSS (o CSS faz todo o desenho) */
  function aplicar(c) {
    const s = c.el.style;
    const a = c.atual;
    s.setProperty('--rx', a.rx.toFixed(2));
    s.setProperty('--ry', a.ry.toFixed(2));
    s.setProperty('--px', a.px.toFixed(2));
    s.setProperty('--py', a.py.toFixed(2));
    s.setProperty('--ativo', a.ativo.toFixed(3));
    s.setProperty('--flut', a.flut.toFixed(2));
    // A sombra acompanha a inclinação e a altura
    c.slot.style.setProperty('--sx', (-a.ry * 1.2).toFixed(2));
    c.slot.style.setProperty('--sf', (-a.flut).toFixed(2));
  }

  /* 3. PONTEIRO ----------------------------------------------------------- */
  function seguirPonteiro(c, ev) {
    const r = c.el.getBoundingClientRect();
    const x = limitar((ev.clientX - r.left) / r.width, 0, 1);
    const y = limitar((ev.clientY - r.top) / r.height, 0, 1);
    const max = CONFIG.inclinacaoMax;
    c.alvo.ry = (x - 0.5) * 2 * max;    // ponteiro à direita → gira em Y
    c.alvo.rx = -(y - 0.5) * 2 * max;   // ponteiro embaixo → gira em X
    c.alvo.px = x * 100;
    c.alvo.py = y * 100;
    c.alvo.ativo = 1;
  }

  function entrar(c) {
    c.sobre = true;
    c.slot.classList.add('ch-ativo');
  }

  function sair(c) {
    c.sobre = false;
    c.slot.classList.remove('ch-ativo');
  }

  cartas.forEach((c) => {
    c.el.addEventListener('pointerenter', (ev) => { entrar(c); seguirPonteiro(c, ev); });
    c.el.addEventListener('pointermove', (ev) => { if (!c.sobre) entrar(c); seguirPonteiro(c, ev); });
    c.el.addEventListener('pointerleave', () => sair(c));
    c.el.addEventListener('pointercancel', () => sair(c)); // toque virou rolagem
    // No toque, solta o brilho um instante depois de levantar o dedo
    c.el.addEventListener('pointerup', (ev) => {
      if (ev.pointerType !== 'mouse') setTimeout(() => sair(c), 700);
    });

    // Foco por teclado também "acende" a carta
    c.botao.addEventListener('focus', () => {
      if (!c.botao.matches(':focus-visible')) return;
      c.foco = true;
    });
    c.botao.addEventListener('blur', () => { c.foco = false; });
  });

  /* 4. VIRAR -------------------------------------------------------------- */
  function virar(c) {
    const virada = c.el.classList.toggle('ch-virada');
    c.botao.setAttribute('aria-pressed', String(virada));
    // Só a face visível fica exposta a leitores de tela
    c.frente.setAttribute('aria-hidden', String(virada));
    c.verso.setAttribute('aria-hidden', String(!virada));
  }

  // <button> já trata clique, Enter e Espaço
  cartas.forEach((c) => c.botao.addEventListener('click', () => virar(c)));

  /* 5. LAÇO DE ANIMAÇÃO --------------------------------------------------- */
  let anterior = performance.now();
  let quadro = 0;

  function passo(agora) {
    // Fator de suavização independente da taxa de quadros (60 Hz como referência)
    const dt = Math.min(0.05, (agora - anterior) / 1000);
    anterior = agora;
    const t = agora / 1000;

    for (const c of cartas) {
      const interagindo = c.sobre || c.foco;
      let alvo;

      if (c.sobre) {
        alvo = c.alvo;
      } else if (c.foco) {
        // Pose de destaque para quem navega pelo teclado
        alvo = { rx: 4 + Math.sin(t * 0.9) * 3, ry: Math.sin(t * 0.7) * 10, px: 50 + Math.sin(t * 0.7) * 22, py: 38, ativo: 0.85 };
      } else {
        // Repouso: pose inicial + oscilação lenta (o foil continua cintilando)
        const fase = c.i * 1.9;
        const rx = c.pose.rx + Math.sin(t * 0.55 + fase) * 2.5;
        const ry = c.pose.ry + Math.sin(t * 0.42 + fase) * 4;
        alvo = { rx, ry, px: 50 + ry * 2.2, py: 50 - rx * 3, ativo: CONFIG.brilhoRepouso };
      }

      const k = interagindo ? CONFIG.suavidadeAtivo : CONFIG.suavidadeRepouso;
      const f = 1 - Math.pow(1 - k, dt * 60);
      const a = c.atual;
      a.rx += (alvo.rx - a.rx) * f;
      a.ry += (alvo.ry - a.ry) * f;
      a.px += (alvo.px - a.px) * f;
      a.py += (alvo.py - a.py) * f;
      a.ativo += (alvo.ativo - a.ativo) * f;

      // Flutuação só no repouso (desliga suavemente ao interagir)
      a.repouso += ((interagindo ? 0 : 1) - a.repouso) * (1 - Math.pow(0.92, dt * 60));
      a.flut = Math.sin(t * 1.15 + c.i * 2.1) * CONFIG.flutuacaoPx * a.repouso;

      aplicar(c);
    }
    quadro = requestAnimationFrame(passo);
  }

  /* 6. MOVIMENTO REDUZIDO ------------------------------------------------- */
  function poseEstatica() {
    cartas.forEach((c) => {
      Object.assign(c.atual, c.pose, { flut: 0 });
      aplicar(c);
    });
  }

  function atualizarModo() {
    cancelAnimationFrame(quadro);
    if (movimentoReduzido.matches) {
      poseEstatica();
    } else {
      anterior = performance.now();
      quadro = requestAnimationFrame(passo);
    }
  }

  movimentoReduzido.addEventListener?.('change', atualizarModo);
  poseEstatica();
  atualizarModo();
})();
