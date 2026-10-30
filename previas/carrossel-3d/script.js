/* ==========================================================================
   Carrossel 3D — biblioteca sem dependências (v1.0.0)

   USO
     const c = Carrossel.criar(elemento, {
       modo: 'cobertura' | 'anel' | 'pilha',  // padrão 'cobertura'
       autoplay: false | true | 4800,          // número = intervalo em ms
       intervalo: 4500,                        // usado quando autoplay = true
       inicio: 0,                              // índice inicial
       controles: true,                        // cria setas, bolinhas, contador e play/pausa
       reflexo: true,                          // (cobertura) reflexo no chão
       rigidez: null,                          // mola do encaixe (padrão por modo)
       inercia: null,                          // quanto o "arremesso" projeta (padrão por modo)
       aoMudar: (indice, instancia) => {}      // callback a cada troca
     });

     c.proximo()  c.anterior()  c.ir(3)  c.play()  c.pausar()  c.destruir()
     c.indice  c.total  c.modo

   Também por atributos HTML (sem escrever JS):
     <div class="c3" data-c3-modo="anel" data-c3-autoplay="5000"> … </div>
     Carrossel.iniciarTodos()  // inicia todos os [data-c3-modo] da página

   Evento: elemento.addEventListener('c3:mudou', (e) => e.detail.indice)
   ========================================================================== */
(function (global) {
  'use strict';

  var PADRAO = {
    modo: 'cobertura',
    autoplay: false,
    intervalo: 4500,
    inicio: 0,
    controles: true,
    reflexo: true,
    rigidez: null,
    inercia: null,
    aoMudar: null
  };

  var movimentoReduzido = global.matchMedia
    ? global.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  var ICONES = {
    anterior: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
    proximo: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>',
    pausar: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6v12M15 6v12"/></svg>',
    tocar: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path data-cheio d="M8 5.5v13l10.5-6.5z"/></svg>'
  };

  /* ---------- utilitários ---------- */
  function mod(n, m) { return ((n % m) + m) % m; }
  function limitar(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function misturar(a, b, t) { return a + (b - a) * t; }
  function doisDigitos(n) { return n < 10 ? '0' + n : String(n); }
  function arred(n) { return Math.round(n * 100) / 100; }

  /* Pequenas inclinações fixas para os cartões da pilha (parecem "jogados") */
  var GIROS_PILHA = [-3, 2.4, -1.6, 3.2, -2.4, 1.4, -0.8];

  /* ==========================================================================
     MODOS
     Cada modo define:
       passo(m)               → quantos px de arrasto equivalem a 1 slide
       deslocamento(i,pos,n)  → distância (em slides) do slide i até a posição atual
       pose(d, m, i)          → estilo do slide para essa distância
       arrastar / soltar      → como o gesto vira posição
     "m" são as medidas atuais: { largura, n, raio, sentido }
     ========================================================================== */
  var MODOS = {

    /* 1. COBERTURA: central em destaque, laterais inclinadas e menores */
    cobertura: {
      rigidez: 170, inercia: 0.18, alcance: 3,
      passo: function (m) { return m.largura * 0.62; },
      deslocamento: function (i, pos, n) { return mod(i - pos + n / 2, n) - n / 2; },
      pose: function (d, m) {
        var a = Math.abs(d), s = d < 0 ? -1 : 1;
        var a1 = Math.min(a, 1), resto = Math.max(0, a - 1);
        var x = s * (a1 * m.largura * 0.62 + resto * m.largura * 0.34);
        var z = -a1 * 230 - resto * 90;
        var ry = -s * a1 * 46;
        return {
          transform: 'translate3d(' + arred(x) + 'px,0,' + arred(z) + 'px) rotateY(' + arred(ry) + 'deg)',
          zIndex: 100 - Math.round(a * 10),
          opacidade: limitar(3.2 - a, 0, 1),
          escuro: a1 * 0.42 + resto * 0.14,
          texto: 1
        };
      }
    },

    /* 2. ANEL: cartões num cilindro que gira em torno do eixo Y */
    anel: {
      rigidez: 90, inercia: 0.42, alcance: 999,
      passo: function (m) { return m.largura * 0.85; },
      deslocamento: function (i, pos, n) { return mod(i - pos + n / 2, n) - n / 2; },
      pose: function (d, m) {
        var ang = d * (360 / m.n);
        var cos = Math.cos(ang * Math.PI / 180);
        return {
          transform: 'translateZ(' + arred(-m.raio) + 'px) rotateX(-9deg) rotateY(' + arred(ang) + 'deg) translateZ(' + arred(m.raio) + 'px)',
          zIndex: 100 + Math.round(cos * 100),
          opacidade: limitar(0.35 + (cos + 1) * 0.5, 0, 1),
          escuro: (1 - cos) * 0.4,
          texto: limitar(cos * 2.2 - 0.4, 0, 1)
        };
      }
    },

    /* 3. PILHA: baralho; o de cima sai girando e volta para o fundo */
    pilha: {
      rigidez: 150, inercia: 0, alcance: 1,
      passo: function (m) { return m.largura * 2.6; },
      // e ∈ (-1, n-1]: 0 = topo, valores negativos = cartão saindo para o fundo
      deslocamento: function (i, pos, n) { var e = mod(i - pos, n); return e > n - 1 ? e - n : e; },
      pose: function (e, m, i) {
        var fila = function (k) {
          var c = Math.min(k, 3);
          return {
            y: -c * m.largura * 0.07,
            s: 1 - c * 0.06,
            op: k <= 3 ? 1 : limitar(1 - (k - 3) * 1.4, 0, 1)
          };
        };
        var giroBase = GIROS_PILHA[i % GIROS_PILHA.length];
        var fundo = fila(m.n - 1);
        var x = 0, y, s, op, rz, z, escuro;
        if (e < 0) {
          // Saindo: vai para o lado (pico em k = 0,5) e volta por trás da pilha
          var k = -e, onda = Math.sin(Math.PI * k);
          x = onda * m.largura * 0.95 * m.sentido;
          y = misturar(0, fundo.y, k) - onda * m.largura * 0.04;
          s = misturar(1, fundo.s, k);
          op = k < 0.5 ? 1 : misturar(1, fundo.op, (k - 0.5) * 2);
          rz = onda * 16 * m.sentido + giroBase * k;
          z = k < 0.5 ? 60 : 0;
          escuro = k * 0.35;
        } else {
          var f = fila(e);
          y = f.y; s = f.s; op = f.op;
          rz = giroBase * Math.min(e, 1);
          z = 50 - Math.round(e * 5);
          escuro = Math.min(e, 3) * 0.14;
        }
        return {
          transform: 'translate3d(' + arred(x) + 'px,' + arred(y) + 'px,0) rotate(' + arred(rz) + 'deg) scale(' + arred(s * 1000) / 1000 + ')',
          zIndex: z,
          opacidade: op,
          escuro: escuro,
          texto: 1
        };
      }
    }
  };

  /* Comportamento de arrasto comum a cobertura e anel */
  function arrastarGirando(inst, dx) {
    inst.pos = inst.arrasto.pos0 - dx / inst.passoPx;
    inst.alvo = inst.pos;
  }
  function soltarGirando(inst, dx, v) {
    var vSlides = limitar(-v / inst.passoPx, -24, 24);
    var projecao = inst.pos + vSlides * inst.inercia;
    var alcance = inst.modoDef.alcance;
    inst.alvo = Math.round(limitar(projecao, inst.pos - alcance, inst.pos + alcance));
    inst.vel = vSlides;
  }
  MODOS.cobertura.arrastar = MODOS.anel.arrastar = arrastarGirando;
  MODOS.cobertura.soltar = MODOS.anel.soltar = soltarGirando;

  /* Pilha: qualquer lado descarta; o sentido do gesto define para onde ele voa */
  MODOS.pilha.arrastar = function (inst, dx) {
    if (dx !== 0) inst.sentido = dx > 0 ? 1 : -1;
    inst.pos = inst.arrasto.base + Math.abs(dx) / inst.passoPx;
    inst.alvo = inst.pos;
  };
  MODOS.pilha.soltar = function (inst, dx, v) {
    var base = inst.arrasto.base;
    var arremesso = Math.abs(v) > 450 && (v > 0) === (dx > 0);
    var avancou = inst.pos - base > 0.06 || arremesso;
    inst.alvo = avancou ? base + 1 : base;
    inst.vel = 0;
  };

  /* ==========================================================================
     INSTÂNCIA
     ========================================================================== */
  function Instancia(el, opcoes) {
    this.el = el;
    this.o = Object.assign({}, PADRAO, lerAtributos(el), opcoes || {});
    if (typeof this.o.autoplay === 'number') { this.o.intervalo = this.o.autoplay; this.o.autoplay = true; }

    this.modo = MODOS[this.o.modo] ? this.o.modo : 'cobertura';
    this.modoDef = MODOS[this.modo];
    this.rigidez = this.o.rigidez || this.modoDef.rigidez;
    this.inercia = this.o.inercia != null ? this.o.inercia : this.modoDef.inercia;

    this.palco = el.querySelector('.c3-palco');
    this.trilho = el.querySelector('.c3-trilho');
    if (!this.palco || !this.trilho) throw new Error('Carrossel: faltam .c3-palco e .c3-trilho dentro do elemento.');
    this.slides = Array.prototype.slice.call(this.trilho.children);
    this.total = this.slides.length;

    this.pos = this.alvo = mod(this.o.inicio | 0, this.total || 1);
    this.vel = 0;
    this.indice = -1;
    this.sentido = 1;
    this.raf = 0;
    this.pausas = {};           // motivos de pausa do autoplay: hover, foco, aba, fora, arrasto
    this.autoplayLigado = !!this.o.autoplay;
    this.rodando = false;
    this.timer = 0;
    this.ouvintes = [];

    this._quadro = this._quadro.bind(this);
    this._tique = this._tique.bind(this);

    this._montar();
    this._medir();
    this._desenhar();
    this._sincronizarAutoplay();
  }

  function lerAtributos(el) {
    var d = el.dataset, o = {};
    if (d.c3Modo) o.modo = d.c3Modo;
    if (d.c3Autoplay !== undefined) {
      var n = parseInt(d.c3Autoplay, 10);
      o.autoplay = d.c3Autoplay !== 'false';
      if (n > 0) o.intervalo = n;
    }
    if (d.c3Inicio) o.inicio = parseInt(d.c3Inicio, 10) || 0;
    if (d.c3Reflexo === 'false') o.reflexo = false;
    return o;
  }

  var P = Instancia.prototype;

  /* ---------- montagem: atributos ARIA, controles e ouvintes ---------- */
  P._montar = function () {
    var el = this.el, self = this;
    el.classList.add('c3', 'c3-modo-' + this.modo, 'c3-pronto');
    if (!el.hasAttribute('role')) el.setAttribute('role', 'region');
    if (!el.hasAttribute('aria-roledescription')) el.setAttribute('aria-roledescription', 'carrossel');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.style.setProperty('--c3-intervalo', this.o.intervalo + 'ms');
    this.trilho.setAttribute('aria-live', 'polite');

    this.slides.forEach(function (s, i) {
      s.classList.add('c3-slide');
      s.setAttribute('role', 'group');
      s.setAttribute('aria-roledescription', 'slide');
      var titulo = s.querySelector('h1,h2,h3,h4,[data-c3-titulo]');
      s.setAttribute('aria-label', (i + 1) + ' de ' + self.total + (titulo ? ': ' + titulo.textContent.trim() : ''));
      // Reflexo (cobertura): cópia espelhada do conteúdo, invisível para leitores de tela
      if (self.modo === 'cobertura' && self.o.reflexo && s.firstElementChild) {
        var copia = s.firstElementChild.cloneNode(true);
        copia.classList.add('c3-reflexo');
        copia.setAttribute('aria-hidden', 'true');
        copia.removeAttribute('id');
        copia.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });
        s.appendChild(copia);
      }
    });

    if (this.o.controles) this._criarControles();

    // Ponteiro (mouse, toque e caneta)
    this._ouvir(this.palco, 'pointerdown', this._aoPressionar.bind(this));
    this._ouvir(global, 'pointermove', this._aoMover.bind(this));
    this._ouvir(global, 'pointerup', this._aoSoltar.bind(this));
    this._ouvir(global, 'pointercancel', this._aoSoltar.bind(this));
    this._ouvir(this.palco, 'click', this._aoClicar.bind(this), true);
    this._ouvir(this.palco, 'dragstart', function (e) { e.preventDefault(); });

    // Teclado
    this._ouvir(el, 'keydown', this._aoTeclar.bind(this));

    // Pausas do autoplay
    this._ouvir(el, 'pointerenter', function (e) { if (e.pointerType === 'mouse') self._pausa('hover', true); });
    this._ouvir(el, 'pointerleave', function (e) { if (e.pointerType === 'mouse') self._pausa('hover', false); });
    this._ouvir(el, 'focusin', function (e) {
      var porTeclado = true;
      try { porTeclado = e.target.matches(':focus-visible'); } catch (err) { /* navegador antigo */ }
      if (porTeclado) self._pausa('foco', true);
    });
    this._ouvir(el, 'focusout', function (e) { if (!el.contains(e.relatedTarget)) self._pausa('foco', false); });
    this._ouvir(document, 'visibilitychange', function () { self._pausa('aba', document.hidden); });
    this._ouvirMidia(function () { self._sincronizarAutoplay(); self._agendar(); });

    if ('IntersectionObserver' in global) {
      this.io = new IntersectionObserver(function (entradas) {
        self._pausa('fora', !entradas[0].isIntersecting);
      }, { threshold: 0.25 });
      this.io.observe(el);
    }
    if ('ResizeObserver' in global) {
      this.ro = new ResizeObserver(function () { self._medir(); self._desenhar(); });
      this.ro.observe(this.palco);
    } else {
      this._ouvir(global, 'resize', function () { self._medir(); self._desenhar(); });
    }
  };

  P._ouvir = function (alvo, tipo, fn, captura) {
    alvo.addEventListener(tipo, fn, captura || false);
    this.ouvintes.push([alvo, tipo, fn, captura || false]);
  };
  P._ouvirMidia = function (fn) {
    if (movimentoReduzido.addEventListener) {
      movimentoReduzido.addEventListener('change', fn);
      this.ouvintes.push([movimentoReduzido, 'change', fn, false]);
    }
  };

  P._criarControles = function () {
    var self = this;
    var ctr = document.createElement('div');
    ctr.className = 'c3-controles';

    this.contador = document.createElement('span');
    this.contador.className = 'c3-contador';
    this.contador.setAttribute('aria-hidden', 'true');

    var ant = botao('c3-seta c3-seta--anterior', 'Slide anterior', ICONES.anterior);
    var prox = botao('c3-seta c3-seta--proximo', 'Próximo slide', ICONES.proximo);
    ant.addEventListener('click', function () { self.anterior(); });
    prox.addEventListener('click', function () { self.proximo(); });

    this.bolinhas = document.createElement('div');
    this.bolinhas.className = 'c3-bolinhas';
    this.listaBolinhas = this.slides.map(function (s, i) {
      var b = botao('c3-bolinha', 'Ir para o slide ' + (i + 1), '');
      b.addEventListener('click', function () { self.ir(i); });
      self.bolinhas.appendChild(b);
      return b;
    });

    ctr.appendChild(this.contador);
    ctr.appendChild(ant);
    ctr.appendChild(this.bolinhas);
    ctr.appendChild(prox);

    if (this.o.autoplay) {
      this.botaoPlay = botao('c3-play', '', '');
      this.botaoPlay.addEventListener('click', function () {
        if (self.autoplayLigado) self.pausar(); else self.play();
      });
      ctr.appendChild(this.botaoPlay);
      this._atualizarBotaoPlay();
    }

    this.el.appendChild(ctr);
    this.controles = ctr;

    function botao(classe, rotulo, html) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = classe;
      if (rotulo) b.setAttribute('aria-label', rotulo);
      b.innerHTML = html;
      return b;
    }
  };

  P._atualizarBotaoPlay = function () {
    if (!this.botaoPlay) return;
    var ligado = this.autoplayLigado;
    this.botaoPlay.innerHTML = ligado ? ICONES.pausar : ICONES.tocar;
    this.botaoPlay.setAttribute('aria-label', ligado ? 'Pausar rotação automática' : 'Iniciar rotação automática');
  };

  /* ---------- medidas ---------- */
  P._medir = function () {
    var largura = this.slides[0] ? this.slides[0].offsetWidth : 0;
    this.m = {
      largura: largura || 260,
      n: this.total,
      // raio do cilindro para os cartões não se sobreporem (folga de 9%)
      raio: (largura * 0.59) / Math.tan(Math.PI / Math.max(3, this.total)),
      sentido: this.sentido
    };
    this.passoPx = this.modoDef.passo(this.m);
  };

  /* ---------- desenho de um quadro ---------- */
  P._desenhar = function () {
    var m = this.m, def = this.modoDef, pos = this.pos, n = this.total;
    m.sentido = this.sentido;
    for (var i = 0; i < n; i++) {
      var s = this.slides[i];
      var p = def.pose(def.deslocamento(i, pos, n), m, i);
      s.style.transform = p.transform;
      s.style.zIndex = p.zIndex;
      s.style.opacity = arred(p.opacidade);
      s.style.visibility = p.opacidade <= 0.01 ? 'hidden' : '';
      s.style.setProperty('--c3-escuro', arred(p.escuro));
      s.style.setProperty('--c3-texto-op', arred(p.texto));
    }
    var novo = mod(Math.round(pos), n);
    if (novo !== this.indice) this._mudouIndice(novo);
  };

  P._mudouIndice = function (novo) {
    var anterior = this.indice;
    this.indice = novo;
    this.slides.forEach(function (s, i) {
      var ativo = i === novo;
      s.classList.toggle('c3-ativo', ativo);
      s.setAttribute('aria-hidden', ativo ? 'false' : 'true');
    });
    if (this.listaBolinhas) {
      this.listaBolinhas.forEach(function (b, i) {
        if (i === novo) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
    }
    if (this.contador) this.contador.innerHTML = '<b>' + doisDigitos(novo + 1) + '</b> / ' + doisDigitos(this.total);
    if (anterior !== -1) {
      this.el.dispatchEvent(new CustomEvent('c3:mudou', { detail: { indice: novo, total: this.total, instancia: this } }));
      if (typeof this.o.aoMudar === 'function') this.o.aoMudar(novo, this);
    }
  };

  /* ---------- animação: mola criticamente amortecida ---------- */
  P._agendar = function () {
    if (this.raf) return;
    this.ultimo = performance.now();
    this.raf = requestAnimationFrame(this._quadro);
  };

  P._quadro = function (t) {
    this.raf = 0;
    var dt = Math.min(0.064, Math.max(0, (t - this.ultimo) / 1000));
    this.ultimo = t;
    var arrastando = this.arrasto && this.arrasto.ativo;
    var parado = false;

    if (!arrastando) {
      if (movimentoReduzido.matches) {
        this.pos = this.alvo; this.vel = 0;
      } else {
        var k = this.rigidez, c = 2 * Math.sqrt(k);
        var passos = Math.max(1, Math.ceil(dt / 0.008)), h = dt / passos;
        for (var i = 0; i < passos; i++) {
          var acel = k * (this.alvo - this.pos) - c * this.vel;
          this.vel += acel * h;
          this.pos += this.vel * h;
        }
      }
      if (Math.abs(this.alvo - this.pos) < 0.0006 && Math.abs(this.vel) < 0.01) {
        this.pos = this.alvo; this.vel = 0; parado = true;
      }
    }

    this._desenhar();

    if (parado) {
      // mantém os números pequenos (o desenho é cíclico, nada muda na tela)
      var voltas = Math.floor(this.alvo / this.total) * this.total;
      this.pos -= voltas; this.alvo -= voltas;
    } else if (!arrastando) {
      this._agendar();
    }
  };

  /* ---------- navegação ---------- */
  P.ir = function (i) {
    if (!this.total) return this;
    var atual = Math.round(this.alvo);
    var delta = mod(i - atual, this.total);
    if (delta > this.total / 2) delta -= this.total;
    if (delta === 0) return this;
    if (this.modo === 'pilha') this.sentido = delta > 0 ? 1 : -1;
    this.alvo = atual + delta;
    this._agendar();
    this._rearmar();
    return this;
  };
  P.proximo = function () {
    this.sentido = 1;
    this.alvo = Math.round(this.alvo) + 1;
    this._agendar();
    this._rearmar();
    return this;
  };
  P.anterior = function () {
    this.sentido = -1;
    this.alvo = Math.round(this.alvo) - 1;
    this._agendar();
    this._rearmar();
    return this;
  };

  /* ---------- autoplay ---------- */
  P.play = function () { this.autoplayLigado = true; this._atualizarBotaoPlay(); this._sincronizarAutoplay(); return this; };
  P.pausar = function () { this.autoplayLigado = false; this._atualizarBotaoPlay(); this._sincronizarAutoplay(); return this; };

  P._pausa = function (motivo, ligado) {
    if (ligado) this.pausas[motivo] = true; else delete this.pausas[motivo];
    this._sincronizarAutoplay();
  };
  P._sincronizarAutoplay = function () {
    var rodar = this.autoplayLigado && !movimentoReduzido.matches && Object.keys(this.pausas).length === 0;
    if (rodar === this.rodando) return;
    this.rodando = rodar;
    clearTimeout(this.timer);
    this.el.classList.toggle('c3-rodando', rodar);
    // enquanto gira sozinho, não anunciamos cada troca (evita "falatório" no leitor de tela)
    this.trilho.setAttribute('aria-live', rodar ? 'off' : 'polite');
    if (rodar) this.timer = setTimeout(this._tique, this.o.intervalo);
  };
  P._rearmar = function () {
    if (!this.rodando) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(this._tique, this.o.intervalo);
    // reinicia a barra de tempo da bolinha ativa
    this.el.classList.remove('c3-rodando');
    void this.el.offsetWidth;
    this.el.classList.add('c3-rodando');
  };
  P._tique = function () { this.proximo(); };

  /* ---------- gestos ---------- */
  P._aoPressionar = function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.arrasto = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY,
      pos0: this.pos, base: Math.round(this.pos),
      ativo: false, amostras: [[e.timeStamp, e.clientX]]
    };
    this.arrastou = false;
  };

  P._aoMover = function (e) {
    var a = this.arrasto;
    if (!a || e.pointerId !== a.id) return;
    var dx = e.clientX - a.x0, dy = e.clientY - a.y0;
    if (!a.ativo) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) { this.arrasto = null; return; } // gesto vertical: é rolagem
      a.ativo = true;
      a.x0 = e.clientX; dx = 0;          // começa do ponto atual, sem "pulo"
      a.pos0 = this.pos; a.base = Math.round(this.pos);
      this.vel = 0;
      this.arrastou = true;
      try { this.palco.setPointerCapture(e.pointerId); } catch (err) { /* ponteiro já liberado */ }
      this.el.classList.add('c3-arrastando');
      this._pausa('arrasto', true);
    }
    a.amostras.push([e.timeStamp, e.clientX]);
    if (a.amostras.length > 8) a.amostras.shift();
    this.modoDef.arrastar(this, dx);
    this._agendar();
  };

  P._aoSoltar = function (e) {
    var a = this.arrasto;
    if (!a || e.pointerId !== a.id) return;
    if (!a.ativo) { this.arrasto = null; return; }
    var dx = e.clientX - a.x0;
    // velocidade (px/s) a partir das amostras dos últimos ~100 ms
    var ult = a.amostras[a.amostras.length - 1], pri = ult;
    for (var i = a.amostras.length - 1; i >= 0; i--) {
      if (ult[0] - a.amostras[i][0] > 100) break;
      pri = a.amostras[i];
    }
    var dtv = (ult[0] - pri[0]) / 1000;
    var v = dtv > 0.005 && e.type !== 'pointercancel' ? (ult[1] - pri[1]) / dtv : 0;
    this.modoDef.soltar(this, dx, v);    // soltar() ainda consulta base/pos0
    this.arrasto = null;
    this.el.classList.remove('c3-arrastando');
    this._pausa('arrasto', false);
    this._rearmar();
    this._agendar();
  };

  P._aoClicar = function (e) {
    if (this.arrastou) {               // foi um arrasto, não um clique
      e.preventDefault(); e.stopPropagation();
      this.arrastou = false;
      return;
    }
    var slide = e.target.closest ? e.target.closest('.c3-slide') : null;
    if (!slide) return;
    var i = this.slides.indexOf(slide);
    if (i < 0) return;
    if (i !== this.indice) { e.preventDefault(); this.ir(i); }
    else if (this.modo === 'pilha') this.proximo();   // tocar no topo da pilha passa o cartão
  };

  P._aoTeclar = function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var tecla = e.key;
    if (tecla === 'ArrowRight') this.proximo();
    else if (tecla === 'ArrowLeft') this.anterior();
    else if (tecla === 'Home') this.ir(0);
    else if (tecla === 'End') this.ir(this.total - 1);
    else return;
    e.preventDefault();
  };

  /* ---------- destruir: devolve o HTML ao estado original ---------- */
  P.destruir = function () {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    this.ouvintes.forEach(function (o) { o[0].removeEventListener(o[1], o[2], o[3]); });
    if (this.io) this.io.disconnect();
    if (this.ro) this.ro.disconnect();
    if (this.controles) this.controles.remove();
    this.slides.forEach(function (s) {
      s.querySelectorAll('.c3-reflexo').forEach(function (r) { r.remove(); });
      s.removeAttribute('style');
      s.removeAttribute('aria-hidden');
      s.classList.remove('c3-ativo');
    });
    this.el.classList.remove('c3-modo-' + this.modo, 'c3-pronto', 'c3-rodando', 'c3-arrastando');
    delete this.el.c3;
  };

  /* ==========================================================================
     API pública
     ========================================================================== */
  var Carrossel = {
    versao: '1.0.0',
    modos: MODOS,                 // dá para registrar um modo novo: Carrossel.modos.meu = { … }
    criar: function (el, opcoes) {
      if (typeof el === 'string') el = document.querySelector(el);
      if (!el) throw new Error('Carrossel.criar: elemento não encontrado.');
      if (el.c3) el.c3.destruir();
      el.c3 = new Instancia(el, opcoes);
      return el.c3;
    },
    iniciarTodos: function (raiz) {
      return Array.prototype.map.call((raiz || document).querySelectorAll('[data-c3-modo]'), function (el) {
        return el.c3 || Carrossel.criar(el);
      });
    }
  };

  global.Carrossel = Carrossel;
})(window);

/* ==========================================================================
   Demo: inicia os três carrosséis da página (todos configurados via data-*)
   ========================================================================== */
(function () {
  function iniciar() { Carrossel.iniciarTodos(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
