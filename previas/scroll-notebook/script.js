/* ==========================================================================
   Scroll Notebook — apresentação guiada pela rolagem (sem dependências)

   Como funciona
   1. A seção .sn-cena é alta (700vh) e o conteúdo .sn-fixo fica "grudado" (sticky).
   2. A cada quadro (requestAnimationFrame) medimos quanto da seção já foi rolado:
      progresso = 0 no topo da seção, 1 no fim.
   3. mapear(progresso) traduz esse número em um ESTADO (ângulos, aproximação,
      opacidades das telas e dos textos…). É aqui que você ajusta os tempos.
   4. aplicar(estado) converte o estado em transformações CSS, usando medidas que
      dependem do tamanho da janela (medir()).

   Com prefers-reduced-motion: reduce nada disso roda — o CSS mostra o notebook
   aberto e as 3 etapas empilhadas (cada uma com uma miniatura da tela).
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     TEMPOS — trechos do progresso (0 a 1) em que cada coisa acontece.
     Mude estes números para acelerar/atrasar partes da animação.
     ------------------------------------------------------------------------ */
  var TEMPOS = {
    titulo:    [0.00, 0.10],   // o título do lançamento sobe e some
    abrir:     [0.02, 0.27],   // a tampa abre e o notebook gira para frente
    aproximar: [0.08, 0.36],   // o notebook cresce até a tela ocupar a janela
    encaixar:  [0.40, 0.48],   // recua para o lado e abre espaço para os textos
    etapas:    [0.46, 0.64, 0.82, 1.00], // limites: etapa 1 | etapa 2 | etapa 3
    troca:     0.035           // duração da troca entre uma tela e outra
  };

  /* ------------------------------------------------------------------------
     Ângulos (graus). tampa: -90 = fechada, 0 = aberta e de frente.
     ------------------------------------------------------------------------ */
  var ANGULOS = {
    tampaInicial: -80,
    giroInicial: { x: -50, y: -20, z: 6 },   // fechado e inclinado na capa
    giroAberto:  { x: -12, y: 0, z: 0 }      // quando a tampa termina de abrir
  };

  /* ---------- utilitários de tempo e curva ---------- */
  function limitar(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function misturar(a, b, t) { return a + (b - a) * t; }
  /** 0 → 1 dentro do trecho [a, b] do progresso */
  function trecho(p, faixa) { return limitar((p - faixa[0]) / (faixa[1] - faixa[0]), 0, 1); }
  function suave(t) { return t * t * (3 - 2 * t); }                                   // ease-in-out leve
  function entraSai(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; } // ease-in-out cúbico
  function saida(t) { return 1 - Math.pow(1 - t, 3); }                                 // ease-out cúbico

  /**
   * mapear(progresso) → estado da cena.
   * @param {number} p  progresso da seção, de 0 (topo) a 1 (fim)
   * @returns {{
   *   tampa:number, giro:{x:number,y:number,z:number},
   *   aproximar:number, encaixar:number, luz:number, brilho:number,
   *   titulo:{opacidade:number, subida:number}, dica:number,
   *   telas:number[], passos:{opacidade:number, desloc:number, progresso:number}[],
   *   etapa:number
   * }}
   * Todos os valores são "normalizados" (0 a 1, ou graus). Quem converte em pixels
   * é aplicar(), porque os tamanhos dependem da janela.
   */
  function mapear(p) {
    var abrir = entraSai(trecho(p, TEMPOS.abrir));
    var aproximar = entraSai(trecho(p, TEMPOS.aproximar));
    var encaixar = entraSai(trecho(p, TEMPOS.encaixar));
    var tit = trecho(p, TEMPOS.titulo);
    var E = TEMPOS.etapas, meia = TEMPOS.troca / 2;

    // Cruzamento entre as telas do app (1 → 2 e 2 → 3)
    var t12 = suave(trecho(p, [E[1] - meia, E[1] + meia]));
    var t23 = suave(trecho(p, [E[2] - meia, E[2] + meia]));

    // Textos das etapas: entram no começo do trecho e saem no fim (o último fica)
    var passos = [0, 1, 2].map(function (k) {
      var q = (p - E[k]) / (E[k + 1] - E[k]);
      var ent = saida(limitar(q / 0.16, 0, 1));
      var sai = k < 2 ? entraSai(limitar((q - 0.84) / 0.16, 0, 1)) : 0;
      return { opacidade: ent * (1 - sai), desloc: (1 - ent) - sai, progresso: limitar(q, 0, 1) };
    });

    return {
      tampa: misturar(ANGULOS.tampaInicial, 0, abrir),
      giro: {
        x: misturar(misturar(ANGULOS.giroInicial.x, ANGULOS.giroAberto.x, abrir), 0, aproximar),
        y: misturar(ANGULOS.giroInicial.y, ANGULOS.giroAberto.y, abrir),
        z: misturar(ANGULOS.giroInicial.z, ANGULOS.giroAberto.z, abrir)
      },
      aproximar: aproximar,
      encaixar: encaixar,
      luz: limitar((abrir - 0.35) / 0.5, 0, 1),        // tela "liga" na segunda metade da abertura
      brilho: misturar(0.75, 0.08, abrir),              // luz da tela sobre o teclado
      titulo: { opacidade: 1 - saida(tit), subida: tit },
      dica: 1 - trecho(p, [0, 0.03]),
      telas: [1 - t12, t12 * (1 - t23), t23],
      passos: passos,
      etapa: p < E[0] ? -1 : p < E[1] ? 0 : p < E[2] ? 1 : 2
    };
  }

  /* ==========================================================================
     Elementos
     ========================================================================== */
  var doc = document.documentElement;
  var cena = document.querySelector('.sn-cena');
  if (!cena) return;
  var notebook = cena.querySelector('.sn-notebook');
  var tampa = cena.querySelector('.sn-tampa');
  var baseTopo = cena.querySelector('.sn-base-topo');
  var ui = cena.querySelector('.sn-ui');
  var luz = cena.querySelector('.sn-ui-luz');
  var telas = [].slice.call(cena.querySelectorAll('.sn-ui-tela'));
  var itensMenu = [].slice.call(cena.querySelectorAll('.sn-ui-item[data-tela]'));
  var intro = cena.querySelector('.sn-intro');
  var dica = cena.querySelector('.sn-dica');
  var passosEl = cena.querySelector('.sn-passos');
  var passos = [].slice.call(cena.querySelectorAll('.sn-passo'));
  var indicador = cena.querySelector('.sn-indicador');
  var itensIndicador = [].slice.call(cena.querySelectorAll('.sn-indicador-item'));
  var barra = document.querySelector('.sn-progresso-barra');

  var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
  var m = {};                  // medidas atuais
  var pAlvo = 0, pAtual = 0;   // progresso medido e progresso suavizado
  var raf = 0, ultimo = 0;
  var inicio = performance.now();
  var DURACAO_ENTRADA = 1000;  // ms da entrada do notebook na capa
  var primeiro = true;

  /* ==========================================================================
     medir() — tamanhos que dependem da janela
     ========================================================================== */
  function medir() {
    var vw = doc.clientWidth, vh = window.innerHeight;
    var prop = 1 / 0.64;                 // largura / altura da tampa
    var estreito = vw < 900;
    var L;

    if (reduzido.matches) {
      L = Math.min(vw * (estreito ? 0.9 : 0.72), 1000);
      definirTamanho(L);
      m = { vw: vw, vh: vh, L: L };
      return;
    }

    // Tamanho "nativo" da tampa = tamanho quando a tela ocupa a janela (escala 1).
    // Assim o conteúdo da tela fica nítido no momento de maior zoom.
    L = estreito ? Math.min(vw * 1.04, vh * 0.9 * prop) : Math.min(vw * 0.94, vh * 0.94 * prop);
    definirTamanho(L);

    var lInicial = estreito ? Math.min(vw * 0.74, 400) : Math.min(vw * 0.32, vh * 0.51);
    var lEncaixe, xEncaixe, yEncaixe, giroEncaixe, passosTopo = null;
    if (estreito) {
      // tela no alto e textos logo abaixo; o conjunto fica centrado na altura
      lEncaixe = vw * 0.9;
      var alturaTampa = lEncaixe * 0.64, alturaBase = lEncaixe * 0.14;
      var conjunto = alturaTampa + alturaBase + 28 + 210;
      var topo = Math.max(64, (vh - 84 - conjunto) / 2);
      xEncaixe = 0;
      yEncaixe = topo + alturaTampa / 2 - vh / 2;
      giroEncaixe = { x: -10, y: 0 };
      passosTopo = topo + alturaTampa + alturaBase + 28;
    } else {
      lEncaixe = Math.min(vw * 0.55, vh * 0.6 * prop);
      var margem = Math.min(72, Math.max(20, vw * 0.05));
      xEncaixe = vw / 2 - margem - lEncaixe / 2;           // encostado à direita
      yEncaixe = -vh * 0.05;                               // deixa espaço para o indicador
      giroEncaixe = { x: -4, y: -12 };                     // vira um pouco para os textos
    }

    m = {
      vw: vw, vh: vh, L: L, estreito: estreito,
      s0: lInicial / L,
      // a massa do notebook fechado fica "para a frente" da dobradiça: compensamos aqui
      x0: vw * (estreito ? 0.115 : 0.055),
      y0: vh * (estreito ? 0.072 : 0.0),
      sEncaixe: lEncaixe / L,
      xEncaixe: xEncaixe,
      yEncaixe: yEncaixe,
      giroEncaixe: giroEncaixe
    };
    // no celular os textos ficam logo abaixo do notebook encaixado
    passosEl.style.top = passosTopo != null ? passosTopo.toFixed(0) + 'px' : '';
  }

  function definirTamanho(L) {
    doc.style.setProperty('--sn-l', L.toFixed(1) + 'px');
    ui.style.setProperty('--e', (L * 0.956 / 1280).toFixed(4));
  }

  /* ==========================================================================
     aplicar(estado) — escreve o estado no DOM
     ========================================================================== */
  function aplicar(e, entrada) {
    // Escala e posição: inicial → imersiva (1) → encaixada ao lado
    var s = misturar(misturar(m.s0, 1, e.aproximar), m.sEncaixe, e.encaixar);
    var x = misturar(misturar(m.x0, 0, e.aproximar), m.xEncaixe, e.encaixar);
    var y = misturar(misturar(m.y0, 0, e.aproximar), m.yEncaixe, e.encaixar);
    var gx = e.giro.x + m.giroEncaixe.x * e.encaixar;
    var gy = e.giro.y + m.giroEncaixe.y * e.encaixar;

    // Entrada da capa: o notebook sobe um pouco e cresce até o lugar
    var ent = saida(entrada);
    y += (1 - ent) * m.vh * 0.08;
    s *= 0.94 + 0.06 * ent;

    notebook.style.transform =
      'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) ' +
      'rotateX(' + gx.toFixed(2) + 'deg) rotateY(' + gy.toFixed(2) + 'deg) rotateZ(' + e.giro.z.toFixed(2) + 'deg) ' +
      'scale3d(' + s.toFixed(4) + ',' + s.toFixed(4) + ',' + s.toFixed(4) + ')';
    tampa.style.transform = 'rotateX(' + e.tampa.toFixed(2) + 'deg)';
    baseTopo.style.setProperty('--sn-brilho', e.brilho.toFixed(3));
    luz.style.opacity = (1 - e.luz).toFixed(3);

    // Título da capa e dica de rolagem
    intro.style.opacity = e.titulo.opacidade.toFixed(3);
    intro.style.transform = 'translateY(' + (-e.titulo.subida * 70).toFixed(1) + 'px)';
    intro.style.visibility = e.titulo.opacidade < 0.02 ? 'hidden' : '';
    dica.style.opacity = e.dica.toFixed(3);

    // Telas do app
    var maior = 0;
    telas.forEach(function (t, k) {
      var op = e.telas[k];
      t.style.opacity = op.toFixed(3);
      t.style.transform = 'translateY(' + ((1 - op) * (k === 0 ? 0 : 18)).toFixed(1) + 'px)';
      if (op > 0.6 && e.luz > 0.6) t.classList.add('sn-ativa');
      else if (op < 0.02) t.classList.remove('sn-ativa');
      if (op > e.telas[maior]) maior = k;
    });
    itensMenu.forEach(function (it) { it.classList.toggle('sn-ativo', Number(it.dataset.tela) === maior); });

    // Textos laterais
    passos.forEach(function (el, k) {
      var ps = e.passos[k];
      el.style.opacity = ps.opacidade.toFixed(3);
      el.style.transform = 'translateY(' + (ps.desloc * 44).toFixed(1) + 'px)';
      el.style.visibility = ps.opacidade < 0.02 ? 'hidden' : 'visible';
    });

    // Indicador de etapas
    indicador.classList.toggle('sn-visivel', e.encaixar > 0.5);
    itensIndicador.forEach(function (it, k) {
      it.style.setProperty('--p', e.passos[k].progresso.toFixed(3));
      if (k === e.etapa) it.setAttribute('aria-current', 'step'); else it.removeAttribute('aria-current');
    });
  }

  /* ==========================================================================
     Laço de quadros
     ========================================================================== */
  function lerProgresso() {
    var total = cena.offsetHeight - window.innerHeight;
    var topo = cena.getBoundingClientRect().top;
    return total > 0 ? limitar(-topo / total, 0, 1) : 0;
  }

  function atualizarBarra() {
    var max = doc.scrollHeight - window.innerHeight;
    barra.style.transform = 'scaleX(' + (max > 0 ? limitar(window.scrollY / max, 0, 1) : 0).toFixed(4) + ')';
  }

  function agendar() {
    if (!raf) { ultimo = performance.now(); raf = requestAnimationFrame(quadro); }
  }

  function quadro(t) {
    raf = 0;
    atualizarBarra();
    if (reduzido.matches) return;

    var dt = Math.min(0.05, Math.max(0, (t - ultimo) / 1000));
    ultimo = t;
    pAlvo = lerProgresso();
    if (primeiro) { pAtual = pAlvo; primeiro = false; }
    // suaviza o progresso (a cena "acompanha" a rolagem com um leve atraso)
    pAtual += (pAlvo - pAtual) * (1 - Math.exp(-dt * 12));
    if (Math.abs(pAlvo - pAtual) < 0.0002) pAtual = pAlvo;

    var entrada = limitar((t - inicio) / DURACAO_ENTRADA, 0, 1);
    aplicar(mapear(pAtual), entrada);

    if (pAtual !== pAlvo || entrada < 1) agendar();
  }

  /* ==========================================================================
     Indicador de etapas e links "#sn-passo-N": rolam até a etapa
     ========================================================================== */
  function rolarParaEtapa(k) {
    var E = TEMPOS.etapas;
    var p = E[k] + (E[k + 1] - E[k]) * 0.4;           // um pouco depois do texto entrar
    var total = cena.offsetHeight - window.innerHeight;
    var topoCena = cena.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: topoCena + p * total, behavior: 'smooth' });
  }

  document.addEventListener('click', function (ev) {
    if (reduzido.matches) return;                    // no modo empilhado a âncora normal já funciona
    var link = ev.target.closest ? ev.target.closest('a[href^="#sn-passo-"]') : null;
    if (!link) return;
    var k = parseInt(link.getAttribute('href').replace('#sn-passo-', ''), 10) - 1;
    if (k >= 0 && k < 3) { ev.preventDefault(); rolarParaEtapa(k); }
  });

  /* ==========================================================================
     Modo reduzido: miniaturas das telas dentro de cada etapa
     ========================================================================== */
  var minis = [];
  var roMinis = 'ResizeObserver' in window ? new ResizeObserver(function (lista) {
    lista.forEach(function (r) {
      var u = r.target.querySelector('.sn-ui');
      if (u) u.style.setProperty('--e', (r.target.clientWidth / 1280).toFixed(4));
    });
  }) : null;

  function montarMinis() {
    if (minis.length) return;
    passos.forEach(function (passo, k) {
      var mini = document.createElement('div');
      mini.className = 'sn-mini';
      mini.dataset.tela = k;
      mini.setAttribute('aria-hidden', 'true');
      var copia = ui.cloneNode(true);
      copia.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });
      // o gradiente do gráfico usa id: aponta a cópia para o original (que continua na página)
      copia.querySelectorAll('.sn-ui-luz').forEach(function (n) { n.remove(); });
      copia.removeAttribute('style');
      copia.querySelectorAll('.sn-ui-tela').forEach(function (t, i) {
        t.removeAttribute('style');
        t.classList.toggle('sn-ativa', i === k);
      });
      copia.querySelectorAll('.sn-ui-item').forEach(function (it) {
        it.classList.toggle('sn-ativo', Number(it.dataset.tela) === k);
      });
      mini.appendChild(copia);
      passo.appendChild(mini);
      if (roMinis) roMinis.observe(mini); else copia.style.setProperty('--e', '0.4');
      minis.push(mini);
    });
  }
  // No modo empilhado, o indicador marca a etapa que está na tela
  var ioPassos = 'IntersectionObserver' in window ? new IntersectionObserver(function (lista) {
    lista.forEach(function (r) {
      if (!r.isIntersecting) return;
      var k = passos.indexOf(r.target);
      itensIndicador.forEach(function (it, i) {
        if (i === k) it.setAttribute('aria-current', 'step'); else it.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -45% 0px' }) : null;

  function desmontarMinis() {
    minis.forEach(function (mi) { if (roMinis) roMinis.unobserve(mi); mi.remove(); });
    minis = [];
  }

  /* ==========================================================================
     Início e mudanças de ambiente
     ========================================================================== */
  function limparEstilos() {
    [notebook, tampa, intro, dica, luz, passosEl].concat(passos, telas).forEach(function (el) { el.removeAttribute('style'); });
    indicador.classList.remove('sn-visivel');
    itensIndicador.forEach(function (it) { it.removeAttribute('aria-current'); it.style.removeProperty('--p'); });
  }

  function configurar() {
    medir();
    if (reduzido.matches) {
      limparEstilos();
      telas[0].classList.add('sn-ativa');
      montarMinis();
      if (ioPassos) passos.forEach(function (el) { ioPassos.observe(el); });
    } else {
      desmontarMinis();
      if (ioPassos) ioPassos.disconnect();
      primeiro = true;
    }
    agendar();
  }

  window.addEventListener('scroll', agendar, { passive: true });
  window.addEventListener('resize', function () { medir(); agendar(); });
  if (reduzido.addEventListener) reduzido.addEventListener('change', configurar);

  configurar();
})();
