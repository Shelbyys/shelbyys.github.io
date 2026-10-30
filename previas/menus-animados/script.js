/* ==========================================================================
   MENUS ANIMADOS — script.js
   --------------------------------------------------------------------------
   Cada menu tem a sua função de início (iniciarHamburguer, iniciarHolofote…),
   encontrada pelo atributo data-ma do elemento raiz. Leve só a função do menu
   que usar (mais a utilidade "fechaFora", se ela for chamada).
   O fim do arquivo é só da galeria: botões "Copiar HTML" e o toast.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (sel, raiz) { return (raiz || document).querySelector(sel); };
  var $$ = function (sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); };
  var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Fecha quando se clica fora de "raiz" ou se aperta Esc. Devolve a função que cancela. */
  function fechaFora(raiz, fechar) {
    function clique(e) { if (!raiz.contains(e.target)) fechar(); }
    function tecla(e) { if (e.key === 'Escape') fechar(); }
    document.addEventListener('pointerdown', clique);
    document.addEventListener('keydown', tecla);
    return function () {
      document.removeEventListener('pointerdown', clique);
      document.removeEventListener('keydown', tecla);
    };
  }

  /* ------------------------------------------------------------------------
     01 · HAMBÚRGUER EM CASCATA
     ------------------------------------------------------------------------ */
  function iniciarHamburguer(raiz) {
    var botao = $('.ma-hamb__botao', raiz);
    var cancelar = null;
    function definir(aberto) {
      botao.setAttribute('aria-expanded', String(aberto));
      botao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
      raiz.classList.toggle('is-aberto', aberto);
      if (cancelar) { cancelar(); cancelar = null; }
      if (aberto) cancelar = fechaFora(raiz, function () { definir(false); });
    }
    botao.addEventListener('click', function () { definir(botao.getAttribute('aria-expanded') !== 'true'); });
    // estado inicial vem do HTML (a demo começa aberta)
    definir(botao.getAttribute('aria-expanded') === 'true');
  }

  /* ------------------------------------------------------------------------
     02 · PÍLULAS COM HOLOFOTE
     ------------------------------------------------------------------------ */
  function iniciarHolofote(raiz) {
    var links = $$('a', raiz);
    function ativo() { return $('a[aria-current="page"]', raiz) || links[0]; }
    function mover(link) {
      raiz.style.setProperty('--x', link.offsetLeft + 'px');
      raiz.style.setProperty('--y', link.offsetTop + 'px');      // itens podem quebrar em 2 linhas no celular
      raiz.style.setProperty('--w', link.offsetWidth + 'px');
      raiz.style.setProperty('--h', link.offsetHeight + 'px');
    }
    links.forEach(function (link) {
      link.addEventListener('pointerenter', function () { raiz.classList.add('is-apontando'); mover(link); });
      link.addEventListener('focus', function () { raiz.classList.add('is-apontando'); mover(link); });
      link.addEventListener('pointermove', function (e) {
        // leve atração magnética do texto para o cursor
        var r = link.getBoundingClientRect();
        link.style.setProperty('--tx', ((e.clientX - r.left - r.width / 2) * 0.12).toFixed(1) + 'px');
        link.style.setProperty('--ty', ((e.clientY - r.top - r.height / 2) * 0.18).toFixed(1) + 'px');
      });
      link.addEventListener('pointerleave', function () { link.style.removeProperty('--tx'); link.style.removeProperty('--ty'); });
      link.addEventListener('click', function (e) {
        e.preventDefault();
        links.forEach(function (l) { l.removeAttribute('aria-current'); });
        link.setAttribute('aria-current', 'page');
      });
    });
    raiz.addEventListener('pointermove', function (e) {
      var r = raiz.getBoundingClientRect();
      raiz.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      raiz.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
    function voltar() { raiz.classList.remove('is-apontando'); mover(ativo()); }
    raiz.addEventListener('pointerleave', voltar);
    raiz.addEventListener('focusout', function () { setTimeout(function () { if (!raiz.contains(document.activeElement)) voltar(); }, 0); });
    mover(ativo());
    window.addEventListener('resize', function () { if (!raiz.classList.contains('is-apontando')) mover(ativo()); });
  }

  /* ------------------------------------------------------------------------
     03 · MEGA MENU QUE MORFA
     Um painel flutuante recebe largura, altura e --x conforme o item apontado.
     ------------------------------------------------------------------------ */
  function iniciarMega(raiz) {
    var botoes = $$('.ma-mega__barra button[aria-controls]', raiz);
    var flutuante = $('.ma-mega__flutuante', raiz);
    var paineis = $$('.ma-mega__painel', raiz);
    var atual = null;
    var timerFechar = 0;
    var cancelar = null;

    function medir(painel, largura) {
      painel.classList.add('is-medindo');
      flutuante.style.width = largura + 'px';
      var altura = painel.offsetHeight;
      painel.classList.remove('is-medindo');
      return altura;
    }

    function abrir(botao) {
      clearTimeout(timerFechar);
      var painel = $('#' + botao.getAttribute('aria-controls'), raiz);
      if (!painel) return;
      var primeira = flutuante.hidden;
      if (primeira) { flutuante.hidden = false; flutuante.classList.add('is-entrando'); }

      var larguraNav = raiz.clientWidth;
      var largura = Math.min(Number(painel.dataset.largura) || 320, larguraNav - 8);
      var altura = medir(painel, largura);
      var centro = botao.offsetLeft + botao.offsetWidth / 2;
      var x = Math.max(4, Math.min(centro - largura / 2, larguraNav - largura - 4));

      // direção do deslize do conteúdo: vem do lado de onde estava o item anterior
      var indiceNovo = botoes.indexOf(botao);
      var indiceVelho = atual ? botoes.indexOf(atual) : indiceNovo;
      paineis.forEach(function (p) {
        p.style.setProperty('--dir', (p === painel ? (indiceNovo > indiceVelho ? 24 : -24) : (indiceNovo > indiceVelho ? -24 : 24)) + 'px');
        p.classList.toggle('is-ativo', p === painel);
      });

      flutuante.style.width = largura + 'px';
      flutuante.style.height = altura + 'px';
      flutuante.style.setProperty('--x', x + 'px');
      flutuante.style.setProperty('--seta', (centro - x) + 'px');
      botoes.forEach(function (b) { b.setAttribute('aria-expanded', String(b === botao)); });
      atual = botao;

      // força o layout no 1º quadro para só depois ligar as transições
      void flutuante.offsetWidth;
      flutuante.classList.add('is-visivel');
      if (primeira) requestAnimationFrame(function () { flutuante.classList.remove('is-entrando'); });
      if (!cancelar) cancelar = fechaFora(raiz, fechar);
    }

    function fechar() {
      clearTimeout(timerFechar);
      flutuante.classList.remove('is-visivel');
      botoes.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      atual = null;
      if (cancelar) { cancelar(); cancelar = null; }
      setTimeout(function () { if (!atual) { flutuante.hidden = true; paineis.forEach(function (p) { p.classList.remove('is-ativo'); }); } }, reduzido ? 0 : 220);
    }
    function agendarFechar() { clearTimeout(timerFechar); timerFechar = setTimeout(fechar, 160); }

    botoes.forEach(function (b) {
      b.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') abrir(b); });
      b.addEventListener('focus', function () { abrir(b); });
      b.addEventListener('click', function () { if (atual === b && flutuante.classList.contains('is-visivel')) fechar(); else abrir(b); });
    });
    raiz.addEventListener('pointerleave', agendarFechar);
    raiz.addEventListener('pointerenter', function () { clearTimeout(timerFechar); });
    raiz.addEventListener('focusout', function () { setTimeout(function () { if (!raiz.contains(document.activeElement)) fechar(); }, 0); });
    $$('.ma-mega__barra > li > a', raiz).forEach(function (a) { a.addEventListener('pointerenter', agendarFechar); });
    window.addEventListener('resize', function () { if (atual) abrir(atual); });

    // Demo: data-demo-aberto="0" abre o primeiro item ao carregar (até o visitante mexer)
    var demo = raiz.dataset.demoAberto;
    if (demo != null && botoes[Number(demo)] && !reduzido) {
      setTimeout(function () { if (!atual) abrir(botoes[Number(demo)]); }, 350);
    }
  }

  /* ------------------------------------------------------------------------
     04 · BARRA LATERAL QUE EXPANDE
     ------------------------------------------------------------------------ */
  function iniciarLateral(raiz) {
    var pino = $('.ma-lateral__pino', raiz);
    var links = $$('.ma-lateral__lista a', raiz);
    function marcar(link) {
      raiz.style.setProperty('--y', link.offsetTop + 'px');
    }
    links.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        links.forEach(function (l) { l.removeAttribute('aria-current'); });
        link.setAttribute('aria-current', 'page');
        marcar(link);
      });
    });
    if (pino) {
      pino.addEventListener('click', function () {
        var fixa = pino.getAttribute('aria-pressed') !== 'true';
        pino.setAttribute('aria-pressed', String(fixa));
        pino.setAttribute('aria-label', fixa ? 'Soltar barra' : 'Manter aberta');
        raiz.classList.toggle('is-fixa', fixa);
      });
    }
    marcar($('.ma-lateral__lista a[aria-current="page"]', raiz) || links[0]);
  }

  /* ------------------------------------------------------------------------
     05 · SUBLINHADO DESLIZANTE
     ------------------------------------------------------------------------ */
  function iniciarSublinhado(raiz) {
    var links = $$('a', raiz);
    function ativo() { return $('a[aria-current="page"]', raiz) || links[0]; }
    function mover(link) {
      raiz.style.setProperty('--x', link.offsetLeft + 'px');
      raiz.style.setProperty('--y', (link.offsetTop + link.offsetHeight - 6) + 'px');  // linha sob o item, mesmo em 2 linhas
      raiz.style.setProperty('--w', link.offsetWidth + 'px');
    }
    links.forEach(function (link) {
      link.addEventListener('pointerenter', function () { mover(link); });
      link.addEventListener('focus', function () { mover(link); });
      link.addEventListener('click', function (e) {
        e.preventDefault();
        links.forEach(function (l) { l.removeAttribute('aria-current'); });
        link.setAttribute('aria-current', 'page');
        mover(link);
      });
    });
    raiz.addEventListener('pointerleave', function () { mover(ativo()); });
    raiz.addEventListener('focusout', function () { setTimeout(function () { if (!raiz.contains(document.activeElement)) mover(ativo()); }, 0); });
    mover(ativo());
    window.addEventListener('resize', function () { mover(ativo()); });
  }

  /* ------------------------------------------------------------------------
     06 · LETRAS QUE ROLAM — duplica o texto em duas camadas de letras
     ------------------------------------------------------------------------ */
  function iniciarRolagem(raiz) {
    $$('[data-rolagem]', raiz).forEach(function (link) {
      var texto = link.textContent.trim();
      link.setAttribute('aria-label', texto);
      link.textContent = '';
      for (var camada = 0; camada < 2; camada++) {
        var span = document.createElement('span');
        span.className = 'ma-rol__texto';
        span.setAttribute('aria-hidden', 'true');
        Array.from(texto).forEach(function (letra, i) {
          var el = document.createElement('i');
          el.textContent = letra === ' ' ? '\u00a0' : letra;
          el.style.setProperty('--i', i);
          span.appendChild(el);
        });
        link.appendChild(span);
      }
    });
  }

  /* ------------------------------------------------------------------------
     07 · MENU RADIAL
     ------------------------------------------------------------------------ */
  function iniciarRadial(raiz) {
    var gatilho = $('.ma-radial__gatilho', raiz);
    var cancelar = null;
    function definir(aberto) {
      gatilho.setAttribute('aria-expanded', String(aberto));
      raiz.classList.toggle('is-aberto', aberto);
      if (cancelar) { cancelar(); cancelar = null; }
      if (aberto) cancelar = fechaFora(raiz, function () { definir(false); });
    }
    gatilho.addEventListener('click', function () { definir(gatilho.getAttribute('aria-expanded') !== 'true'); });
    $$('.ma-radial__itens button', raiz).forEach(function (b) {
      b.addEventListener('click', function () { toast(b.getAttribute('aria-label')); definir(false); gatilho.focus(); });
    });
    definir(gatilho.getAttribute('aria-expanded') === 'true');
  }

  /* ------------------------------------------------------------------------
     08 · SANFONA EM ÁRVORE — só um grupo aberto por vez (tire o "unico" se quiser vários)
     ------------------------------------------------------------------------ */
  function iniciarSanfona(raiz, unico) {
    var botoes = $$('.ma-sanfona__grupo > button', raiz);
    botoes.forEach(function (b) {
      b.addEventListener('click', function () {
        var abrir = b.getAttribute('aria-expanded') !== 'true';
        if (unico !== false) botoes.forEach(function (o) { o.setAttribute('aria-expanded', 'false'); });
        b.setAttribute('aria-expanded', String(abrir));
      });
    });
    $$('.ma-sanfona__sub a', raiz).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        $$('.ma-sanfona__sub a', raiz).forEach(function (o) { o.removeAttribute('aria-current'); });
        a.setAttribute('aria-current', 'page');
      });
    });
  }

  /* ------------------------------------------------------------------------
     09 · MENU DE CONTEXTO
     ------------------------------------------------------------------------ */
  function iniciarContexto(raiz) {
    var zona = $('.ma-ctx__zona', raiz);
    var menu = $('.ma-ctx__menu', raiz);
    var itens = $$('[role="menuitem"]', menu);
    var cancelar = null;
    var pressao = 0;

    function abrirEm(x, y) {
      var r = raiz.getBoundingClientRect();
      menu.hidden = false;
      var mw = menu.offsetWidth, mh = menu.offsetHeight;
      // mantém o menu dentro do bloco e escolhe a origem conforme o lado em que abre
      var direita = x + mw > r.width - 8;
      var baixo = y + mh > r.height - 8;
      var px = direita ? Math.max(8, x - mw) : x;
      var py = baixo ? Math.max(8, y - mh) : y;
      menu.style.setProperty('--x', px + 'px');
      menu.style.setProperty('--y', py + 'px');
      menu.style.transformOrigin = (baixo ? 'bottom' : 'top') + ' ' + (direita ? 'right' : 'left');
      void menu.offsetWidth;
      menu.classList.add('is-aberto');
      zona.setAttribute('aria-expanded', 'true');
      itens[0].focus();
      if (cancelar) cancelar();
      cancelar = fechaFora(menu, fechar);
    }
    function fechar() {
      if (menu.hidden) return;
      menu.classList.remove('is-aberto');
      zona.setAttribute('aria-expanded', 'false');
      if (cancelar) { cancelar(); cancelar = null; }
      setTimeout(function () { menu.hidden = true; }, reduzido ? 0 : 200);
      if (menu.contains(document.activeElement)) zona.focus();
    }
    function abrirNoCentro() {
      abrirEm(raiz.clientWidth / 2 - 40, raiz.clientHeight / 2 - 60);
    }

    zona.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var r = raiz.getBoundingClientRect();
      abrirEm(e.clientX - r.left, e.clientY - r.top);
    });
    // toque e segure (sem o menu nativo do navegador)
    zona.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      var r = raiz.getBoundingClientRect();
      pressao = setTimeout(function () { abrirEm(e.clientX - r.left, e.clientY - r.top); }, 480);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { zona.addEventListener(ev, function () { clearTimeout(pressao); }); });
    zona.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || (e.key === 'F10' && e.shiftKey)) { e.preventDefault(); abrirNoCentro(); }
    });
    zona.addEventListener('click', function (e) { if (e.detail === 0) return; /* clique de mouse esquerdo: nada */ });

    menu.addEventListener('keydown', function (e) {
      var i = itens.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); itens[(i + 1) % itens.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); itens[(i - 1 + itens.length) % itens.length].focus(); }
      if (e.key === 'Home') { e.preventDefault(); itens[0].focus(); }
      if (e.key === 'End') { e.preventDefault(); itens[itens.length - 1].focus(); }
      if (e.key === 'Tab') fechar();
    });
    itens.forEach(function (item) {
      item.addEventListener('click', function () { toast(item.textContent.replace(/\s+/g, ' ').trim().replace(/\s*[↵⌘⌫]\S*$|\s*F\d$/, '')); fechar(); });
    });
  }

  /* ------------------------------------------------------------------------
     10 · CORTINA EM TELA CHEIA
     ------------------------------------------------------------------------ */
  function iniciarCortina(raiz) {
    var abrirBtn = $('.ma-cortina__abrir', raiz);
    var tela = $('.ma-cortina__tela', raiz);
    var fecharBtn = $('.ma-cortina__fechar', raiz);
    var timer = 0;
    var cancelar = null;

    function abrir() {
      clearTimeout(timer);
      tela.hidden = false;
      void tela.offsetWidth;
      raiz.classList.remove('is-fechando');
      raiz.classList.add('is-aberta');
      abrirBtn.setAttribute('aria-expanded', 'true');
      setTimeout(function () { fecharBtn.focus(); }, reduzido ? 0 : 400);
      cancelar = fechaFora(tela, fechar);
    }
    function fechar() {
      if (tela.hidden) return;
      raiz.classList.remove('is-aberta');
      raiz.classList.add('is-fechando');
      abrirBtn.setAttribute('aria-expanded', 'false');
      if (cancelar) { cancelar(); cancelar = null; }
      timer = setTimeout(function () { tela.hidden = true; raiz.classList.remove('is-fechando'); }, reduzido ? 0 : 700);
      abrirBtn.focus();
    }
    abrirBtn.addEventListener('click', abrir);
    fecharBtn.addEventListener('click', fechar);
    $$('nav a', tela).forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); fechar(); }); });
    // prende o foco dentro da tela enquanto aberta
    tela.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var focaveis = $$('button, a[href]', tela);
      var primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    });
  }

  /* ------------------------------------------------------------------------
     Início: cada raiz [data-ma] chama a sua função
     ------------------------------------------------------------------------ */
  var INICIOS = {
    hamburguer: iniciarHamburguer, holofote: iniciarHolofote, mega: iniciarMega, lateral: iniciarLateral,
    sublinhado: iniciarSublinhado, rolagem: iniciarRolagem, radial: iniciarRadial, sanfona: iniciarSanfona,
    contexto: iniciarContexto, cortina: iniciarCortina
  };

  /* ------------------------------------------------------------------------
     SÓ DA GALERIA: toast e "Copiar HTML" (guarda o HTML original de cada
     palco antes de o JS mexer nele). Pode apagar no seu projeto.
     ------------------------------------------------------------------------ */
  var toastEl = $('.ma-toast');
  var toastTimer = 0;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visivel'); }, 2200);
  }

  function dedent(html) {
    var linhas = html.replace(/^\s*\n/, '').replace(/\s+$/, '').split('\n');
    var base = Infinity;
    linhas.forEach(function (l) { if (l.trim()) base = Math.min(base, l.match(/^\s*/)[0].length); });
    return linhas.map(function (l) { return l.slice(Math.min(base, l.match(/^\s*/)[0].length)); }).join('\n');
  }
  function copiarTexto(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(texto).then(function () { return true; }, function () { return false; });
    try {
      var ta = document.createElement('textarea');
      ta.value = texto; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy'); document.body.removeChild(ta);
      return Promise.resolve(!!ok);
    } catch (_) { return Promise.resolve(false); }
  }

  $$('.ma-palco__area').forEach(function (area) { area.dataset.html = area.innerHTML; });

  $$('[data-ma]').forEach(function (raiz) {
    var f = INICIOS[raiz.dataset.ma];
    if (f) f(raiz);
  });

  $$('[data-copiar]').forEach(function (botao) {
    botao.addEventListener('click', function () {
      var area = document.getElementById(botao.dataset.copiar);
      var nome = $('.ma-palco__nome', botao.closest('.ma-palco')).textContent;
      var prefixo = (area.dataset.html.match(/class="(ma-[a-z]+)/) || [])[1] || 'ma-';
      var html = '<!-- ' + nome + ' · precisa do bloco .' + prefixo + ' do estilo.css e da função correspondente no script.js -->\n' + dedent(area.dataset.html);
      copiarTexto(html).then(function (ok) {
        toast(ok ? 'HTML de “' + nome + '” copiado' : 'Não foi possível copiar automaticamente');
        if (!ok) return;
        botao.classList.add('is-copiado');
        var rotulo = $('span', botao);
        if (rotulo) rotulo.textContent = 'Copiado!';
        setTimeout(function () { botao.classList.remove('is-copiado'); if (rotulo) rotulo.textContent = 'Copiar HTML'; }, 1600);
      });
    });
  });
})();
