/* ==========================================================================
   BOTÕES MAGNÉTICOS — script.js
   --------------------------------------------------------------------------
   Sem dependências. Cada efeito é uma função independente (iniciarXxx):
   copie só a função que precisa + a chamada correspondente em "Inicialização".

   Índice:
   0. Utilitários (movimento reduzido)
   1. Magnético        → iniciarMagnetico(botao)
   2. Ripple           → iniciarRipple(botao)
   5. Líquido          → iniciarLiquido(botao)
   6. Pressão 3D       → iniciarPressao(botao)   (só ajuda o Enter)
   8. Confete          → iniciarConfete(botao)
   9. Segure           → iniciarSegure(botao)
   Interface da galeria: clipboard, toast e "Copiar HTML"
   (Os efeitos 3, 4 e 7 são CSS puro — não precisam de JS.)
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     0. UTILITÁRIOS
     ------------------------------------------------------------------------ */
  var consultaReduz = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  /** true quando a pessoa pediu menos movimento no sistema */
  function reduzMovimento() { return consultaReduz.matches; }

  /** Limita um número entre mínimo e máximo */
  function limitar(n, min, max) { return Math.min(max, Math.max(min, n)); }


  /* ------------------------------------------------------------------------
     1. MAGNÉTICO
     Mola simples: a cada quadro a posição acelera em direção ao alvo (RIGIDEZ)
     e perde energia (ATRITO). Quando o cursor sai do raio, o alvo volta a 0
     e a mola faz o botão voltar com um pequeno "balanço".
     HTML: <button class="bm-magnetico"><span class="bm-magnetico__texto">…</span></button>
     ------------------------------------------------------------------------ */
  function iniciarMagnetico(botao) {
    var texto = botao.querySelector('.bm-magnetico__texto');
    var RAIO = 110;       // distância (px) da borda do botão em que a atração começa
    var FORCA = 0.32;     // quanto do deslocamento do cursor o botão copia
    var LIMITE_X = 30;    // deslocamento máximo (px)
    var LIMITE_Y = 18;
    var RIGIDEZ = 0.16;   // maior = mola mais firme
    var ATRITO = 0.76;    // menor = para mais rápido

    var pos = { x: 0, y: 0 };
    var vel = { x: 0, y: 0 };
    var alvo = { x: 0, y: 0 };
    var quadro = 0;

    function aplicar() {
      botao.style.transform = 'translate3d(' + pos.x.toFixed(2) + 'px,' + pos.y.toFixed(2) + 'px,0)';
      // o texto anda um pouco além do botão: dá sensação de profundidade
      if (texto) texto.style.transform = 'translate3d(' + (pos.x * 0.45).toFixed(2) + 'px,' + (pos.y * 0.45).toFixed(2) + 'px,0)';
    }

    function passo() {
      vel.x = (vel.x + (alvo.x - pos.x) * RIGIDEZ) * ATRITO;
      vel.y = (vel.y + (alvo.y - pos.y) * RIGIDEZ) * ATRITO;
      pos.x += vel.x;
      pos.y += vel.y;
      aplicar();

      var parado = Math.abs(vel.x) < 0.01 && Math.abs(vel.y) < 0.01 &&
                   Math.abs(alvo.x - pos.x) < 0.05 && Math.abs(alvo.y - pos.y) < 0.05;
      if (parado) {
        pos.x = alvo.x; pos.y = alvo.y;
        aplicar();
        quadro = 0;
        return;
      }
      quadro = requestAnimationFrame(passo);
    }

    function acordar() { if (!quadro) quadro = requestAnimationFrame(passo); }

    function aoMover(e) {
      if (reduzMovimento()) return;
      if (e.pointerType === 'touch') return;     // toque não tem "aproximar"
      var r = botao.getBoundingClientRect();
      // centro "de repouso" (descontando o deslocamento atual)
      var cx = r.left + r.width / 2 - pos.x;
      var cy = r.top + r.height / 2 - pos.y;
      var dx = e.clientX - cx;
      var dy = e.clientY - cy;
      // distância do cursor até a borda do botão
      var dist = Math.hypot(Math.max(Math.abs(dx) - r.width / 2, 0), Math.max(Math.abs(dy) - r.height / 2, 0));

      if (dist < RAIO) {
        alvo.x = limitar(dx * FORCA, -LIMITE_X, LIMITE_X);
        alvo.y = limitar(dy * FORCA, -LIMITE_Y, LIMITE_Y);
      } else {
        alvo.x = 0; alvo.y = 0;
      }
      acordar();
    }

    function soltar() { alvo.x = 0; alvo.y = 0; acordar(); }

    window.addEventListener('pointermove', aoMover, { passive: true });
    document.documentElement.addEventListener('mouseleave', soltar);
    window.addEventListener('blur', soltar);
  }


  /* ------------------------------------------------------------------------
     2. RIPPLE
     Cria uma onda no ponto do clique. Com teclado (Enter/Espaço) o clique
     chega sem coordenadas, então a onda nasce no centro.
     HTML: <button class="bm-ripple"><span class="bm-ripple__texto">…</span></button>
     ------------------------------------------------------------------------ */
  function iniciarRipple(botao) {
    botao.addEventListener('click', function (e) {
      if (reduzMovimento()) return;
      var r = botao.getBoundingClientRect();
      var porTeclado = e.detail === 0 || (e.clientX === 0 && e.clientY === 0);
      var x = porTeclado ? r.width / 2 : e.clientX - r.left;
      var y = porTeclado ? r.height / 2 : e.clientY - r.top;
      // diâmetro que cobre o botão inteiro a partir do ponto do clique
      var d = Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y)) * 2;

      var onda = document.createElement('span');
      onda.className = 'bm-ripple__onda';
      onda.style.width = onda.style.height = d + 'px';
      onda.style.left = (x - d / 2) + 'px';
      onda.style.top = (y - d / 2) + 'px';
      onda.addEventListener('animationend', function () { onda.remove(); });
      botao.appendChild(onda);
    });
  }


  /* ------------------------------------------------------------------------
     5. PREENCHIMENTO LÍQUIDO
     Grava em --x / --y o ponto onde o mouse entrou (ou saiu) para o CSS
     fazer o líquido crescer (ou recuar) a partir dali.
     HTML: <button class="bm-liquido"><span class="bm-liquido__onda"></span><span class="bm-liquido__texto">…</span></button>
     ------------------------------------------------------------------------ */
  function iniciarLiquido(botao) {
    function marcar(e) {
      var r = botao.getBoundingClientRect();
      botao.style.setProperty('--x', (e.clientX - r.left).toFixed(1) + 'px');
      botao.style.setProperty('--y', (e.clientY - r.top).toFixed(1) + 'px');
    }
    botao.addEventListener('pointerenter', marcar);
    botao.addEventListener('pointerleave', marcar);
    // Teclado: sobe pela base do botão
    botao.addEventListener('focus', function () {
      if (!botao.matches(':hover')) {
        botao.style.setProperty('--x', '50%');
        botao.style.setProperty('--y', '115%');
      }
    });
  }


  /* ------------------------------------------------------------------------
     6. PRESSÃO 3D
     O CSS já afunda com :active (mouse, toque e Espaço). O Enter não ativa
     :active nos navegadores, então espelhamos com a classe .is-pressionado.
     ------------------------------------------------------------------------ */
  function iniciarPressao(botao) {
    botao.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') botao.classList.add('is-pressionado');
    });
    function soltar() { botao.classList.remove('is-pressionado'); }
    botao.addEventListener('keyup', soltar);
    botao.addEventListener('blur', soltar);
  }


  /* ------------------------------------------------------------------------
     8. CONFETE
     Partículas simples (retângulos girando) desenhadas num <canvas> pequeno
     que fica por cima do botão. O laço de animação para sozinho quando
     todas as partículas somem.
     HTML: <button class="bm-confete"><span class="bm-confete__texto">…</span><canvas class="bm-confete__tela"></canvas></button>
     ------------------------------------------------------------------------ */
  function iniciarConfete(botao) {
    var tela = botao.querySelector('.bm-confete__tela');
    var texto = botao.querySelector('.bm-confete__texto');
    if (!tela || !tela.getContext) return;
    var ctx = tela.getContext('2d');
    var cores = ['#ff6a2b', '#b9d84e', '#f4ead8', '#ff9566', '#6b8620'];
    var particulas = [];
    var quadro = 0;
    var ultimo = 0;
    var largura = 0, altura = 0;
    var rotuloOriginal = texto ? texto.textContent : '';
    var temporizador = 0;

    // Ajusta a resolução do canvas à tela (nítido em telas retina)
    function medir() {
      var dpr = window.devicePixelRatio || 1;
      var r = tela.getBoundingClientRect();
      largura = r.width; altura = r.height;
      tela.width = Math.round(largura * dpr);
      tela.height = Math.round(altura * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function explodir(x, y) {
      for (var i = 0; i < 42; i++) {
        var angulo = Math.random() * Math.PI * 2;
        var forca = 3 + Math.random() * 6.5;
        particulas.push({
          x: x, y: y,
          vx: Math.cos(angulo) * forca,
          vy: Math.sin(angulo) * forca - 2.2,         // leve empurrão para cima
          giro: Math.random() * Math.PI,
          vgiro: (Math.random() - 0.5) * 0.4,
          w: 5 + Math.random() * 5,
          h: 3 + Math.random() * 4,
          cor: cores[(Math.random() * cores.length) | 0],
          vida: 1,
          decai: 0.011 + Math.random() * 0.012
        });
      }
    }

    function desenhar(t) {
      var dt = limitar((t - ultimo) / 16.67, 0.2, 2.5);   // 1 = quadro a 60 fps
      ultimo = t;
      ctx.clearRect(0, 0, largura, altura);

      for (var i = particulas.length - 1; i >= 0; i--) {
        var p = particulas[i];
        p.vy += 0.26 * dt;                       // gravidade
        p.vx *= Math.pow(0.985, dt);             // resistência do ar
        p.vy *= Math.pow(0.985, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.giro += p.vgiro * dt;
        p.vida -= p.decai * dt;
        if (p.vida <= 0) { particulas.splice(i, 1); continue; }

        ctx.save();
        ctx.globalAlpha = Math.min(1, p.vida * 1.6);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.giro);
        ctx.fillStyle = p.cor;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      quadro = particulas.length ? requestAnimationFrame(desenhar) : 0;
      if (!particulas.length) ctx.clearRect(0, 0, largura, altura);
    }

    botao.addEventListener('click', function (e) {
      // pequeno feedback textual (também vale para quem reduz movimento)
      if (texto) {
        texto.textContent = 'Valeu! 🎉';
        clearTimeout(temporizador);
        temporizador = setTimeout(function () { texto.textContent = rotuloOriginal; }, 1300);
      }
      if (reduzMovimento()) return;

      medir();
      var rt = tela.getBoundingClientRect();
      var rb = botao.getBoundingClientRect();
      var porTeclado = e.detail === 0 || (e.clientX === 0 && e.clientY === 0);
      var x = porTeclado ? rb.left + rb.width / 2 - rt.left : e.clientX - rt.left;
      var y = porTeclado ? rb.top + rb.height / 2 - rt.top : e.clientY - rt.top;
      explodir(x, y);
      if (!quadro) { ultimo = performance.now(); quadro = requestAnimationFrame(desenhar); }
    });
  }


  /* ------------------------------------------------------------------------
     9. SEGURE PARA CONFIRMAR
     --p vai de 0 a 1 enquanto o botão é segurado (mouse, toque ou Enter/Espaço).
     Soltar antes do fim faz o progresso recuar. Ao completar, dispara o evento
     "bm:confirmado" — escute-o para executar sua ação:
        botao.addEventListener('bm:confirmado', () => { … });
     ------------------------------------------------------------------------ */
  function iniciarSegure(botao) {
    var texto = botao.querySelector('.bm-segure__texto');
    var DURACAO = 1500;        // ms para completar
    var VOLTA = 2.6;           // velocidade de retorno (x mais rápido que o avanço)
    var rotuloPadrao = texto ? texto.textContent : '';

    var p = 0;
    var segurando = false;
    var concluido = false;
    var quadro = 0;
    var ultimo = 0;

    function desenhar() { botao.style.setProperty('--p', p.toFixed(4)); }

    function passo(t) {
      var dt = t - ultimo;
      ultimo = t;
      p += (segurando ? 1 : -VOLTA) * dt / DURACAO;

      if (p >= 1) { p = 1; desenhar(); quadro = 0; concluir(); return; }
      if (p <= 0) { p = 0; desenhar(); quadro = 0; return; }
      desenhar();
      quadro = requestAnimationFrame(passo);
    }

    function acordar() {
      if (quadro) return;
      ultimo = performance.now();
      quadro = requestAnimationFrame(passo);
    }

    function comecar() {
      if (concluido || segurando) return;
      segurando = true;
      botao.classList.add('is-segurando');
      if (texto) texto.textContent = 'Segurando…';
      acordar();
    }

    function soltar() {
      if (!segurando) return;
      segurando = false;
      botao.classList.remove('is-segurando');
      if (texto && !concluido) texto.textContent = rotuloPadrao;
      acordar();
    }

    function concluir() {
      concluido = true;
      segurando = false;
      botao.classList.remove('is-segurando');
      botao.classList.add('is-ok');
      if (texto) texto.textContent = 'Enviado!';
      botao.dispatchEvent(new CustomEvent('bm:confirmado', { bubbles: true }));

      // volta ao estado inicial depois de um instante
      setTimeout(function () {
        concluido = false;
        botao.classList.remove('is-ok');
        if (texto) texto.textContent = rotuloPadrao;
        acordar();             // p = 1 → drena de volta a 0
      }, 2000);
    }

    // Mouse e toque (pointer events unificam os dois)
    botao.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      try { botao.setPointerCapture(e.pointerId); } catch (_) { /* navegador antigo */ }
      comecar();
    });
    botao.addEventListener('pointerup', soltar);
    botao.addEventListener('pointercancel', soltar);
    botao.addEventListener('lostpointercapture', soltar);

    // Teclado: Enter e Espaço (ignora a repetição automática de tecla)
    botao.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!e.repeat) comecar();
      }
    });
    botao.addEventListener('keyup', function (e) {
      if (e.key === 'Enter' || e.key === ' ') soltar();
    });
    botao.addEventListener('blur', soltar);

    // Evita o menu de contexto do toque longo no celular
    botao.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }


  /* ==========================================================================
     INTERFACE DA GALERIA (não faz parte dos efeitos)
     Copiar HTML + toast. Os trechos são capturados ANTES de os efeitos
     inicializarem, para o HTML copiado sair limpo (sem estilos inline).
     ========================================================================== */

  /** Copia texto. Usa a API moderna e cai para textarea + execCommand. Nunca lança erro. */
  function copiarTexto(texto) {
    function plano() {
      try {
        var campo = document.createElement('textarea');
        campo.value = texto;
        campo.setAttribute('readonly', '');
        campo.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
        document.body.appendChild(campo);
        campo.select();
        campo.setSelectionRange(0, texto.length);
        var ok = document.execCommand('copy');
        document.body.removeChild(campo);
        return Promise.resolve(!!ok);
      } catch (_) {
        return Promise.resolve(false);
      }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(texto).then(function () { return true; }, plano);
      }
    } catch (_) { /* cai para o plano B */ }
    return plano();
  }

  var toast = document.querySelector('.toast');
  var toastTexto = toast ? toast.querySelector('.toast__texto') : null;
  var toastTempo = 0;

  function mostrarToast(mensagem) {
    if (!toast || !toastTexto) return;
    toastTexto.textContent = mensagem;
    toast.classList.add('is-visivel');
    clearTimeout(toastTempo);
    toastTempo = setTimeout(function () { toast.classList.remove('is-visivel'); }, 2400);
  }

  /** Remove a indentação da página para o trecho copiado ficar alinhado à esquerda */
  function alinharSnippet(html) {
    var linhas = html.split('\n');
    if (linhas.length < 2) return html;
    var base = linhas[linhas.length - 1].match(/^\s*/)[0];
    return linhas.map(function (linha, i) {
      if (i === 0) return linha;
      return linha.indexOf(base) === 0 ? linha.slice(base.length) : linha.replace(/^\s+/, '');
    }).join('\n');
  }

  function iniciarCopiar() {
    var celulas = document.querySelectorAll('.celula');
    celulas.forEach(function (celula) {
      var botaoDemo = celula.querySelector('.celula__palco > *');
      var botaoCopiar = celula.querySelector('[data-copiar]');
      if (!botaoDemo || !botaoCopiar) return;

      var classe = (botaoDemo.className.match(/bm-[\w-]+/) || ['bm-botao'])[0];
      var nome = (celula.querySelector('h2') || {}).textContent || classe;
      // Efeitos que são CSS puro não precisam do script.js
      var soCss = ['bm-brilho', 'bm-borda-viva', 'bm-seta'].indexOf(classe) !== -1;
      var snippet = '<!-- ' + nome + ' · requer o bloco .' + classe + ' do estilo.css' +
                    (soCss ? ' (CSS puro, sem JS)' : ' e a função correspondente do script.js') + ' -->\n' +
                    alinharSnippet(botaoDemo.outerHTML);
      var rotulo = botaoCopiar.querySelector('.copiar__rotulo');
      var temporizador = 0;

      botaoCopiar.addEventListener('click', function () {
        copiarTexto(snippet).then(function (ok) {
          if (ok) {
            mostrarToast('HTML do botão “' + nome + '” copiado');
            botaoCopiar.classList.add('is-copiado');
            if (rotulo) rotulo.textContent = 'Copiado!';
            clearTimeout(temporizador);
            temporizador = setTimeout(function () {
              botaoCopiar.classList.remove('is-copiado');
              if (rotulo) rotulo.textContent = 'Copiar HTML';
            }, 1600);
          } else {
            mostrarToast('Não foi possível copiar automaticamente');
          }
        });
      });
    });
  }


  /* ==========================================================================
     INICIALIZAÇÃO
     Cada linha liga um efeito a todos os botões da classe correspondente.
     ========================================================================== */
  function iniciar() {
    iniciarCopiar();   // primeiro: captura o HTML ainda limpo

    document.querySelectorAll('.bm-magnetico').forEach(iniciarMagnetico);
    document.querySelectorAll('.bm-ripple').forEach(iniciarRipple);
    document.querySelectorAll('.bm-liquido').forEach(iniciarLiquido);
    document.querySelectorAll('.bm-pressao').forEach(iniciarPressao);
    document.querySelectorAll('.bm-confete').forEach(iniciarConfete);
    document.querySelectorAll('.bm-segure').forEach(function (botao) {
      iniciarSegure(botao);
      // Na demo, mostramos um aviso quando a confirmação acontece
      botao.addEventListener('bm:confirmado', function () { mostrarToast('Ação confirmada ✔'); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
