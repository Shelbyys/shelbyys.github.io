/* =========================================================
   Landing Restaurante — Brasa & Sal
   JavaScript puro, sem dependências. Cada bloco é independente:
   se você remover uma seção do HTML, o bloco correspondente é ignorado.
   ========================================================= */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var $ = function (sel, raiz) { return (raiz || document).querySelector(sel); };
  var $$ = function (sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); };
  var movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------
     CONFIGURAÇÃO — edite aqui horários e regras de reserva
     Dias: 0 = domingo, 1 = segunda ... 6 = sábado.
     Cada turno é [horaAbre, horaFecha] (24 = meia-noite).
     --------------------------------------------------------- */
  var HORARIOS = {
    0: [[12, 17]],
    1: [],
    2: [[12, 15], [19, 23]],
    3: [[12, 15], [19, 23]],
    4: [[12, 15], [19, 23]],
    5: [[12, 16], [19, 24]],
    6: [[12, 16], [19, 24]]
  };
  var RESERVA = {
    intervaloMin: 30,      // de quanto em quanto tempo há horários
    ultimaAntesDeFechar: 1, // último horário = fechamento − 1h
    pessoasMin: 1,
    pessoasMax: 12,
    diasAFrente: 60
  };
  var NOMES_DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  var moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var horaTxt = function (h) { return (h % 24) + 'h'; };

  /* Utilitário: prende o foco dentro de um elemento (modais e gaveta) */
  function prenderFoco(container, evento) {
    if (evento.key !== 'Tab') return;
    var focaveis = $$('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])', container)
      .filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
    if (!focaveis.length) return;
    var primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
    if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo.focus(); }
    else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
  }
  /* Deixa o resto da página inerte enquanto um modal está aberto */
  function inerte(ligado, excecao) {
    $$('body > header, body > main, body > footer').forEach(function (el) {
      if (excecao && el.contains(excecao)) return;
      if (ligado) el.setAttribute('inert', ''); else el.removeAttribute('inert');
    });
    document.body.style.overflow = ligado ? 'hidden' : '';
  }

  /* ---------------------------------------------------------
     1. STATUS ABERTO / FECHADO (hora real do visitante)
     --------------------------------------------------------- */
  function calcularStatus(agora) {
    var dia = agora.getDay();
    var hora = agora.getHours() + agora.getMinutes() / 60;
    var turnos = HORARIOS[dia] || [];
    for (var i = 0; i < turnos.length; i++) {
      if (hora >= turnos[i][0] && hora < turnos[i][1]) {
        return { aberto: true, texto: 'Aberto agora · fecha às ' + horaTxt(turnos[i][1]) };
      }
    }
    // Procura o próximo turno (hoje mais tarde ou nos próximos dias)
    for (var d = 0; d < 8; d++) {
      var diaBusca = (dia + d) % 7;
      var lista = HORARIOS[diaBusca] || [];
      for (var j = 0; j < lista.length; j++) {
        if (d === 0 && lista[j][0] <= hora) continue;
        var quando = d === 0 ? 'hoje' : d === 1 ? 'amanhã' : NOMES_DIAS[diaBusca];
        return { aberto: false, texto: 'Fechado agora · abre ' + quando + ' às ' + horaTxt(lista[j][0]) };
      }
    }
    return { aberto: false, texto: 'Fechado no momento' };
  }
  function atualizarStatus() {
    var st = calcularStatus(new Date());
    $$('[data-status-texto]').forEach(function (el) { el.textContent = st.texto; });
    var chip = $('[data-status]');
    if (chip) { chip.classList.toggle('is-aberto', st.aberto); chip.classList.toggle('is-fechado', !st.aberto); }
    var hoje = new Date().getDay();
    $$('[data-tabela-horarios] tr').forEach(function (tr) {
      tr.classList.toggle('is-hoje', (tr.getAttribute('data-dias') || '').split(',').indexOf(String(hoje)) > -1);
    });
  }
  atualizarStatus();
  setInterval(atualizarStatus, 60000);

  /* ---------------------------------------------------------
     2. MENU FIXO (fica sólido ao rolar) + link ativo
     --------------------------------------------------------- */
  var topo = $('#topo');
  function aoRolar() { if (topo) topo.classList.toggle('is-solido', window.scrollY > 40); }
  aoRolar();
  window.addEventListener('scroll', aoRolar, { passive: true });

  var linksNav = $$('.lr-nav a');
  if ('IntersectionObserver' in window && linksNav.length) {
    var obsNav = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        linksNav.forEach(function (a) {
          var ativo = a.getAttribute('href') === '#' + e.target.id;
          a.classList.toggle('is-ativo', ativo);
          if (ativo) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    linksNav.forEach(function (a) { var s = $(a.getAttribute('href')); if (s) obsNav.observe(s); });
  }

  /* ---------------------------------------------------------
     3. GAVETA DO MENU MOBILE (acessível: Esc, foco preso)
     --------------------------------------------------------- */
  var gaveta = $('#gaveta'), veu = $('.lr-veu'), hamb = $('.lr-hamburguer');
  function abrirGaveta() {
    gaveta.hidden = false; veu.hidden = false;
    requestAnimationFrame(function () { gaveta.classList.add('is-aberto'); veu.classList.add('is-aberto'); });
    hamb.setAttribute('aria-expanded', 'true');
    inerte(true);
    setTimeout(function () { var a = $('a', gaveta); if (a) a.focus(); }, 60);
  }
  function fecharGaveta(devolverFoco) {
    gaveta.classList.remove('is-aberto'); veu.classList.remove('is-aberto');
    hamb.setAttribute('aria-expanded', 'false');
    inerte(false);
    setTimeout(function () { gaveta.hidden = true; veu.hidden = true; }, movimentoReduzido ? 0 : 450);
    if (devolverFoco !== false) hamb.focus();
  }
  if (gaveta && hamb) {
    hamb.addEventListener('click', abrirGaveta);
    $$('[data-fechar-gaveta]').forEach(function (b) { b.addEventListener('click', function () { fecharGaveta(); }); });
    $$('a', gaveta).forEach(function (a) { a.addEventListener('click', function () { fecharGaveta(false); }); });
    gaveta.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') fecharGaveta();
      prenderFoco(gaveta, e);
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 1080 && !gaveta.hidden) fecharGaveta(false); });
  }

  /* ---------------------------------------------------------
     4. REVELAÇÃO AO ROLAR + CONTADORES
     --------------------------------------------------------- */
  var formatoNum = function (v, dec) { return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }); };
  function contar(el) {
    var alvo = parseFloat(el.getAttribute('data-contar'));
    var dec = parseInt(el.getAttribute('data-decimais') || '0', 10);
    if (movimentoReduzido) { el.textContent = formatoNum(alvo, dec); return; }
    var inicio = null, dur = 1600;
    function passo(t) {
      if (!inicio) inicio = t;
      var p = Math.min((t - inicio) / dur, 1);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = formatoNum(alvo * e, dec);
      if (p < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }
  var revelar = $$('.lr-revela');
  var contadores = $$('[data-contar]');
  if ('IntersectionObserver' in window) {
    // Atraso escalonado para itens irmãos (efeito cascata)
    revelar.forEach(function (el) {
      var irmaos = $$('.lr-revela', el.parentElement).filter(function (x) { return x.parentElement === el.parentElement; });
      var i = irmaos.indexOf(el);
      if (i > 0 && !el.style.getPropertyValue('--atraso')) el.style.setProperty('--atraso', Math.min(i * 0.08, 0.4) + 's');
    });
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visivel'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revelar.forEach(function (el) { obs.observe(el); });

    contadores.forEach(function (el) { el.textContent = formatoNum(0, parseInt(el.getAttribute('data-decimais') || '0', 10)); });
    var obsNum = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) { if (e.isIntersecting) { contar(e.target); obsNum.unobserve(e.target); } });
    }, { threshold: 0.6 });
    contadores.forEach(function (el) { obsNum.observe(el); });
  } else {
    revelar.forEach(function (el) { el.classList.add('is-visivel'); });
  }

  /* ---------------------------------------------------------
     5. CARDÁPIO: preços pt-BR, selos, abas e filtros animados
     --------------------------------------------------------- */
  var ICONE = function (id) { return '<svg aria-hidden="true"><use href="#' + id + '"/></svg>'; };
  $$('.lr-prato').forEach(function (prato) {
    var preco = $('.lr-preco', prato);
    if (preco) preco.textContent = moeda.format(parseFloat(preco.getAttribute('data-preco')));
    var tags = (prato.getAttribute('data-tags') || '').split(/\s+/);
    var selos = '';
    if (prato.hasAttribute('data-chef')) selos += '<span class="lr-selo lr-selo--chef">' + ICONE('i-estrela') + 'do chef</span>';
    if (tags.indexOf('veg') > -1) selos += '<span class="lr-selo lr-selo--veg" title="Vegetariano">' + ICONE('i-folha') + '<span class="lr-sr">vegetariano</span></span>';
    if (tags.indexOf('sg') > -1) selos += '<span class="lr-selo lr-selo--sg" title="Sem glúten">' + ICONE('i-trigo') + '<span class="lr-sr">sem glúten</span></span>';
    if (selos) $('h3', prato).insertAdjacentHTML('beforeend', '<span class="lr-selos">' + selos + '</span>');
  });

  var abas = $$('.lr-aba'), marca = $('.lr-abas__marca');
  var filtrosAtivos = [];
  function moverMarca() {
    var ativa = $('.lr-aba[aria-selected="true"]');
    if (!ativa || !marca) return;
    marca.style.width = ativa.offsetWidth + 'px';
    marca.style.transform = 'translateX(' + ativa.offsetLeft + 'px)';
  }
  function selecionarAba(aba, focar) {
    abas.forEach(function (a) {
      var sel = a === aba;
      a.setAttribute('aria-selected', String(sel));
      a.tabIndex = sel ? 0 : -1;
      var painel = document.getElementById(a.getAttribute('aria-controls'));
      if (painel) painel.hidden = !sel;
    });
    if (focar) aba.focus();
    moverMarca();
    aplicarFiltros(true);
  }
  abas.forEach(function (aba, i) {
    aba.addEventListener('click', function () { selecionarAba(aba); });
    aba.addEventListener('keydown', function (e) {
      var alvo = null;
      if (e.key === 'ArrowRight') alvo = abas[(i + 1) % abas.length];
      if (e.key === 'ArrowLeft') alvo = abas[(i - 1 + abas.length) % abas.length];
      if (e.key === 'Home') alvo = abas[0];
      if (e.key === 'End') alvo = abas[abas.length - 1];
      if (alvo) { e.preventDefault(); selecionarAba(alvo, true); }
    });
  });
  window.addEventListener('resize', moverMarca);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(moverMarca);
  moverMarca();

  function combina(prato) {
    var tags = (prato.getAttribute('data-tags') || '').split(/\s+/);
    return filtrosAtivos.every(function (f) { return tags.indexOf(f) > -1; });
  }
  // Mostra/esconde pratos com animação: sai com fade, entra em cascata
  function aplicarFiltros(semSaida) {
    var painel = $('.lr-painel:not([hidden])');
    if (!painel) return;
    var pratos = $$('.lr-prato', painel);
    var saindo = pratos.filter(function (p) { return !p.hidden && !combina(p); });
    var finalizar = function () {
      var visiveis = 0;
      pratos.forEach(function (p) {
        var ok = combina(p);
        var estavaOculto = p.hidden;
        p.hidden = !ok;
        p.classList.remove('is-saindo');
        if (ok) {
          if (estavaOculto || semSaida) {
            p.classList.remove('is-entrando'); void p.offsetWidth;
            p.style.setProperty('--atraso', (visiveis * 0.05) + 's');
            p.classList.add('is-entrando');
          }
          visiveis++;
        }
      });
      $('[data-vazio]').hidden = visiveis > 0;
      var aviso = $('[data-filtro-aviso]');
      if (aviso) aviso.textContent = visiveis + (visiveis === 1 ? ' item exibido' : ' itens exibidos');
    };
    if (saindo.length && !semSaida && !movimentoReduzido) {
      saindo.forEach(function (p) { p.classList.add('is-saindo'); });
      setTimeout(finalizar, 300);
    } else finalizar();
  }
  $$('.lr-filtro').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var f = btn.getAttribute('data-filtro');
      var ativo = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(ativo));
      filtrosAtivos = ativo ? filtrosAtivos.concat(f) : filtrosAtivos.filter(function (x) { return x !== f; });
      aplicarFiltros();
    });
  });
  var limpar = $('[data-limpar-filtros]');
  if (limpar) limpar.addEventListener('click', function () {
    filtrosAtivos = [];
    $$('.lr-filtro').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    aplicarFiltros();
  });

  /* ---------------------------------------------------------
     6. GALERIA + LIGHTBOX (setas, Esc, foco preso)
     --------------------------------------------------------- */
  var lightbox = $('#lightbox');
  var itensGaleria = $$('.lr-galeria__item');
  var indiceAtual = 0, gatilho = null;
  function mostrarImagem(i) {
    indiceAtual = (i + itensGaleria.length) % itensGaleria.length;
    var origem = $('img', itensGaleria[indiceAtual]);
    var img = $('[data-lightbox-img]', lightbox);
    img.classList.add('is-trocando');
    setTimeout(function () {
      img.src = origem.getAttribute('src');
      img.alt = origem.alt;
      img.width = origem.width; img.height = origem.height;
      $('[data-lightbox-legenda]', lightbox).textContent = origem.alt;
      $('[data-lightbox-conta]', lightbox).textContent = (indiceAtual + 1) + ' / ' + itensGaleria.length;
      img.classList.remove('is-trocando');
    }, movimentoReduzido ? 0 : 160);
  }
  function abrirLightbox(i, origemBtn) {
    gatilho = origemBtn;
    lightbox.hidden = false;
    mostrarImagem(i);
    requestAnimationFrame(function () { lightbox.classList.add('is-aberto'); });
    inerte(true, lightbox);
    $('.lr-lightbox__fechar', lightbox).focus();
  }
  function fecharLightbox() {
    lightbox.classList.remove('is-aberto');
    inerte(false);
    setTimeout(function () { lightbox.hidden = true; }, movimentoReduzido ? 0 : 350);
    if (gatilho) gatilho.focus();
  }
  if (lightbox) {
    itensGaleria.forEach(function (btn) {
      btn.addEventListener('click', function () { abrirLightbox(parseInt(btn.getAttribute('data-indice'), 10), btn); });
    });
    $$('[data-fechar-lightbox]', lightbox).forEach(function (b) { b.addEventListener('click', fecharLightbox); });
    $('[data-lightbox-ant]', lightbox).addEventListener('click', function () { mostrarImagem(indiceAtual - 1); });
    $('[data-lightbox-prox]', lightbox).addEventListener('click', function () { mostrarImagem(indiceAtual + 1); });
    lightbox.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') fecharLightbox();
      else if (e.key === 'ArrowLeft') mostrarImagem(indiceAtual - 1);
      else if (e.key === 'ArrowRight') mostrarImagem(indiceAtual + 1);
      prenderFoco(lightbox, e);
    });
  }

  /* ---------------------------------------------------------
     7. CARROSSEL DE DEPOIMENTOS (arrastar + autoplay com pausa)
     --------------------------------------------------------- */
  var carrossel = $('.lr-carrossel'), trilho = $('[data-trilho]');
  if (carrossel && trilho) {
    var slides = $$('.lr-depo__card', trilho);
    var caixaPontos = $('[data-pontos]');
    var btnPausa = $('[data-depo-pausa]');
    var atual = 0, timer = null, pausadoPeloUsuario = movimentoReduzido, emFoco = false, sobre = false;
    var porVez = function () { return parseInt(getComputedStyle(trilho).getPropertyValue('--por-vez'), 10) || 1; };
    var maxIndice = function () { return Math.max(0, slides.length - porVez()); };

    function montarPontos() {
      caixaPontos.innerHTML = '';
      for (var i = 0; i <= maxIndice(); i++) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'lr-ponto';
        b.setAttribute('aria-label', 'Ir para o depoimento ' + (i + 1));
        b.addEventListener('click', (function (n) { return function () { irPara(n); }; })(i));
        caixaPontos.appendChild(b);
      }
    }
    function irPara(n) {
      atual = Math.max(0, Math.min(n, maxIndice()));
      trilho.style.transform = 'translateX(' + (-atual * slides[0].offsetWidth) + 'px)';
      $$('.lr-ponto', caixaPontos).forEach(function (p, i) { if (i === atual) p.setAttribute('aria-current', 'true'); else p.removeAttribute('aria-current'); });
      slides.forEach(function (s, i) {
        var visivel = i >= atual && i < atual + porVez();
        s.setAttribute('aria-hidden', String(!visivel));
      });
    }
    var proximo = function () { irPara(atual >= maxIndice() ? 0 : atual + 1); };
    var anterior = function () { irPara(atual <= 0 ? maxIndice() : atual - 1); };

    function sincronizarAutoplay() {
      clearInterval(timer);
      if (!pausadoPeloUsuario && !emFoco && !sobre && !document.hidden) timer = setInterval(proximo, 5500);
    }
    function atualizarBotaoPausa() {
      if (!btnPausa) return;
      btnPausa.setAttribute('aria-label', pausadoPeloUsuario ? 'Retomar rotação automática' : 'Pausar rotação automática');
      $('use', btnPausa).setAttribute('href', pausadoPeloUsuario ? '#i-play' : '#i-pausa');
    }
    $('[data-depo-prox]').addEventListener('click', proximo);
    $('[data-depo-ant]').addEventListener('click', anterior);
    if (btnPausa) btnPausa.addEventListener('click', function () { pausadoPeloUsuario = !pausadoPeloUsuario; atualizarBotaoPausa(); sincronizarAutoplay(); });
    carrossel.addEventListener('mouseenter', function () { sobre = true; sincronizarAutoplay(); });
    carrossel.addEventListener('mouseleave', function () { sobre = false; sincronizarAutoplay(); });
    var secaoDepo = $('#depoimentos');
    secaoDepo.addEventListener('focusin', function () { emFoco = true; sincronizarAutoplay(); });
    secaoDepo.addEventListener('focusout', function (e) { if (!secaoDepo.contains(e.relatedTarget)) { emFoco = false; sincronizarAutoplay(); } });
    document.addEventListener('visibilitychange', sincronizarAutoplay);

    // Arrastar com Pointer Events (mouse, toque e caneta)
    var inicioX = 0, deltaX = 0, arrastando = false, idPonteiro = null;
    trilho.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      arrastando = true; inicioX = e.clientX; deltaX = 0; idPonteiro = e.pointerId;
      carrossel.classList.add('is-arrastando');
      clearInterval(timer);
    });
    trilho.addEventListener('pointermove', function (e) {
      if (!arrastando || e.pointerId !== idPonteiro) return;
      deltaX = e.clientX - inicioX;
      if (Math.abs(deltaX) > 4 && !trilho.hasPointerCapture(e.pointerId)) trilho.setPointerCapture(e.pointerId);
      var base = -atual * slides[0].offsetWidth;
      // resistência nas pontas
      var borda = (atual === 0 && deltaX > 0) || (atual === maxIndice() && deltaX < 0) ? 0.35 : 1;
      trilho.style.transform = 'translateX(' + (base + deltaX * borda) + 'px)';
    });
    function soltar() {
      if (!arrastando) return;
      arrastando = false;
      carrossel.classList.remove('is-arrastando');
      var limite = Math.min(80, slides[0].offsetWidth * 0.2);
      if (deltaX < -limite) irPara(atual + 1);
      else if (deltaX > limite) irPara(atual - 1);
      else irPara(atual);
      sincronizarAutoplay();
    }
    trilho.addEventListener('pointerup', soltar);
    trilho.addEventListener('pointercancel', soltar);
    trilho.addEventListener('lostpointercapture', soltar);
    trilho.addEventListener('dragstart', function (e) { e.preventDefault(); });

    window.addEventListener('resize', function () { montarPontos(); irPara(atual); });
    montarPontos(); irPara(0); atualizarBotaoPausa(); sincronizarAutoplay();
  }

  /* ---------------------------------------------------------
     8. FORMULÁRIO DE RESERVA
     --------------------------------------------------------- */
  var form = $('[data-form-reserva]');
  if (form) {
    var campoData = $('#r-data', form), caixaHorarios = $('[data-horarios]', form);
    var campoNome = $('#r-nome', form), campoWhats = $('#r-whats', form);
    var saidaPessoas = $('[data-pessoas-valor]', form), rotuloPessoas = $('[data-pessoas-rotulo]', form);
    var sucesso = $('[data-sucesso]'), dicaData = $('[data-dica-data]', form);
    var pessoas = 2;

    // Datas em formato local AAAA-MM-DD (evita erro de fuso com toISOString)
    var paraISO = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    var deISO = function (s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var limiteMax = new Date(hoje); limiteMax.setDate(limiteMax.getDate() + RESERVA.diasAFrente);
    campoData.min = paraISO(hoje);
    campoData.max = paraISO(limiteMax);

    // Primeira data com horário disponível como sugestão
    function horariosDoDia(data) {
      var lista = [], turnos = HORARIOS[data.getDay()] || [];
      var agora = new Date();
      var mesmoDia = paraISO(data) === paraISO(agora);
      var semente = data.getDate() * 7 + data.getMonth() * 13; // "lotação" simulada e estável por data
      turnos.forEach(function (t) {
        for (var m = t[0] * 60; m <= (t[1] - RESERVA.ultimaAntesDeFechar) * 60; m += RESERVA.intervaloMin) {
          var h = Math.floor(m / 60), min = m % 60;
          var passado = mesmoDia && (m <= agora.getHours() * 60 + agora.getMinutes() + 30);
          var lotado = ((m / 30 + semente) % 5) === 0;
          lista.push({ valor: String(h % 24).padStart(2, '0') + ':' + String(min).padStart(2, '0'), livre: !passado && !lotado, passado: passado });
        }
      });
      return lista;
    }
    var sugestao = new Date(hoje);
    for (var k = 0; k < 14; k++) {
      if (horariosDoDia(sugestao).some(function (h) { return h.livre; })) break;
      sugestao.setDate(sugestao.getDate() + 1);
    }
    campoData.value = paraISO(sugestao);

    function montarHorarios() {
      var valor = campoData.value;
      caixaHorarios.innerHTML = '';
      if (!valor) { caixaHorarios.innerHTML = '<p class="lr-chips__aviso">Escolha uma data para ver os horários.</p>'; return; }
      var data = deISO(valor);
      var lista = horariosDoDia(data);
      dicaData.textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(data);
      if (!lista.length) { caixaHorarios.innerHTML = '<p class="lr-chips__aviso">Não abrimos neste dia. Escolha outra data.</p>'; return; }
      var algumLivre = false;
      lista.forEach(function (h) {
        var rotulo = document.createElement('label');
        rotulo.className = 'lr-chip';
        var motivo = h.livre ? '' : (h.passado ? ' (horário já passou)' : ' (esgotado)');
        rotulo.innerHTML = '<input type="radio" name="horario" value="' + h.valor + '"' + (h.livre ? '' : ' disabled') + ' aria-label="' + h.valor + motivo + '"><span aria-hidden="true">' + h.valor + '</span>';
        caixaHorarios.appendChild(rotulo);
        if (h.livre) algumLivre = true;
      });
      if (!algumLivre) caixaHorarios.insertAdjacentHTML('beforeend', '<p class="lr-chips__aviso">Todos os horários deste dia estão ocupados.</p>');
    }
    caixaHorarios.setAttribute('role', 'radiogroup');
    caixaHorarios.setAttribute('aria-labelledby', 'r-horario-rotulo');
    campoData.addEventListener('change', function () { montarHorarios(); validarCampo('data'); });
    caixaHorarios.addEventListener('change', function () { validarCampo('horario'); });
    montarHorarios();

    // Contador de pessoas (− +)
    function atualizarPessoas() {
      saidaPessoas.textContent = pessoas;
      rotuloPessoas.textContent = pessoas === 1 ? 'pessoa' : 'pessoas';
      $('[data-pessoas="-1"]', form).disabled = pessoas <= RESERVA.pessoasMin;
      $('[data-pessoas="1"]', form).disabled = pessoas >= RESERVA.pessoasMax;
    }
    $$('[data-pessoas]', form).forEach(function (b) {
      b.addEventListener('click', function () {
        pessoas = Math.max(RESERVA.pessoasMin, Math.min(RESERVA.pessoasMax, pessoas + parseInt(b.getAttribute('data-pessoas'), 10)));
        atualizarPessoas();
      });
    });
    atualizarPessoas();

    // Máscara de WhatsApp: (11) 98765-4321
    function mascarar(v) {
      var d = v.replace(/\D/g, '').slice(0, 11);
      if (d.length <= 2) return d.length ? '(' + d : '';
      if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
      if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
      return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    }
    campoWhats.addEventListener('input', function () { campoWhats.value = mascarar(campoWhats.value); if (campoWhats.getAttribute('aria-invalid') === 'true') validarCampo('whats'); });
    campoNome.addEventListener('input', function () { if (campoNome.getAttribute('aria-invalid') === 'true') validarCampo('nome'); });
    campoNome.addEventListener('blur', function () { if (campoNome.value) validarCampo('nome'); });
    campoWhats.addEventListener('blur', function () { if (campoWhats.value) validarCampo('whats'); });

    // Validação acessível: mensagem ligada ao campo por aria-describedby
    function erro(el, msgEl, msg) {
      if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
      msgEl.textContent = msg || '';
      return !msg;
    }
    function validarCampo(qual) {
      if (qual === 'data') {
        var v = campoData.value, msg = '';
        if (!v) msg = 'Escolha a data da reserva.';
        else if (v < campoData.min) msg = 'Escolha uma data a partir de hoje.';
        else if (v > campoData.max) msg = 'Aceitamos reservas para os próximos ' + RESERVA.diasAFrente + ' dias.';
        else if (!(HORARIOS[deISO(v).getDay()] || []).length) msg = 'Não abrimos neste dia da semana.';
        return erro(campoData, $('#r-data-erro'), msg);
      }
      if (qual === 'horario') {
        var marcado = $('input[name="horario"]:checked', form);
        return erro(null, $('#r-horario-erro'), marcado ? '' : 'Escolha um horário disponível.');
      }
      if (qual === 'nome') {
        var n = campoNome.value.trim();
        return erro(campoNome, $('#r-nome-erro'), n.length < 2 ? 'Informe seu nome.' : '');
      }
      if (qual === 'whats') {
        var dig = campoWhats.value.replace(/\D/g, '');
        return erro(campoWhats, $('#r-whats-erro'), dig.length < 10 ? 'Informe um WhatsApp válido com DDD.' : '');
      }
      return true;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ordem = ['data', 'horario', 'nome', 'whats'];
      var invalidos = ordem.filter(function (q) { return !validarCampo(q); });
      if (invalidos.length) {
        var primeiro = invalidos[0];
        var alvo = primeiro === 'data' ? campoData : primeiro === 'horario' ? ($('input[name="horario"]:not(:disabled)', form) || campoData) : primeiro === 'nome' ? campoNome : campoWhats;
        alvo.focus();
        return;
      }
      var botao = $('[data-enviar]', form);
      botao.classList.add('is-carregando'); botao.disabled = true;
      $('.lr-btn__texto', botao).textContent = 'Reservando…';
      // Envio simulado — troque por fetch() para a sua API ou serviço de reservas
      setTimeout(function () {
        var data = deISO(campoData.value);
        var dados = [
          ['Data', new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(data)],
          ['Horário', $('input[name="horario"]:checked', form).value],
          ['Pessoas', pessoas + (pessoas === 1 ? ' pessoa' : ' pessoas')],
          ['Em nome de', campoNome.value.trim()],
          ['WhatsApp', campoWhats.value]
        ];
        var resumo = $('[data-resumo]', sucesso);
        resumo.innerHTML = '';
        dados.forEach(function (par) {
          var div = document.createElement('div');
          var dt = document.createElement('dt'); dt.textContent = par[0];
          var dd = document.createElement('dd'); dd.textContent = par[1];
          div.appendChild(dt); div.appendChild(dd); resumo.appendChild(div);
        });
        form.hidden = true; sucesso.hidden = false; sucesso.focus();
        botao.classList.remove('is-carregando'); botao.disabled = false;
        $('.lr-btn__texto', botao).textContent = 'Confirmar reserva';
      }, 1300);
    });

    $('[data-nova-reserva]').addEventListener('click', function () {
      form.reset();
      campoData.value = paraISO(sugestao);
      pessoas = 2; atualizarPessoas(); montarHorarios();
      $$('[aria-invalid]', form).forEach(function (el) { el.setAttribute('aria-invalid', 'false'); });
      $$('[data-erro]', form).forEach(function (el) { el.textContent = ''; });
      sucesso.hidden = true; form.hidden = false; campoData.focus();
    });
  }

  /* Ano atual no rodapé */
  var ano = $('[data-ano]');
  if (ano) ano.textContent = new Date().getFullYear();
})();
