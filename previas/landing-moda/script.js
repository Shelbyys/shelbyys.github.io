/* =========================================================
   Landing Moda — Atelier Norte · Coleção Barro & Linho
   JavaScript puro, sem dependências.
   Edite a coleção na lista PRODUTOS e a data do drop em DROP.
   ========================================================= */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var $ = function (sel, raiz) { return (raiz || document).querySelector(sel); };
  var $$ = function (sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); };
  var movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  /* ---------------------------------------------------------
     CONFIGURAÇÃO
     --------------------------------------------------------- */
  // Data e hora do lançamento (com fuso). Em modo demonstração, se a data já
  // passou, o contador avança de 14 em 14 dias para nunca ficar zerado.
  var DROP = { data: '2026-11-20T10:00:00-03:00', repetirNaDemo: true, avancoDias: 14 };
  var FRETE_GRATIS = 299;      // valor mínimo para frete grátis (R$)
  var PARCELAS = 6;            // parcelas sem juros exibidas nos cartões
  var CHAVE_SACOLA = 'atelier-norte-sacola-v1'; // chave no localStorage

  /* Fotos: "s" (zoom) e "fx"/"fy" (ponto focal de 0 a 1) recortam a foto na caixa 4:5.
     Peças quadradas (900×900): s 1.25 enche a altura e mostra os 80% centrais.
     Opcional: "q" = quadrante (0 a 3) de uma folha 2×2 de peças (ex.: img/pecas-1.jpg). */
  var PRODUTOS = [
    {
      id: 'casaco-duna', nome: 'Casaco Longo Duna', cat: 'casacos', preco: 689, selo: 'Novo',
      desc: 'Casaco amplo de lã batida, ombro caído e bolsos embutidos. Vai do escritório ao fim de semana por cima de tudo.',
      detalhes: ['Lã batida 80% · poliamida reciclada 20%', 'Forro de viscose', 'Limpeza a seco'],
      cores: [{ nome: 'Camelo', hex: '#b88a5c' }, { nome: 'Grafite', hex: '#3b3835' }],
      tamanhos: ['PP', 'P', 'M', 'G', 'GG'], esgotados: ['GG'],
      fotos: [
        { src: 'img/peca-casaco.jpg', iw: 900, ih: 900, s: 1.25, fx: 0.5, fy: 0.5, alt: 'Casaco longo camelo com lapela larga e faixa na cintura' },
        { src: 'img/peca-casaco.jpg', iw: 900, ih: 900, s: 2.3, fx: 0.5, fy: 0.3, alt: 'Detalhe da lapela larga e da faixa amarrada do Casaco Longo Duna' }
      ]
    },
    {
      id: 'camisa-areia', nome: 'Camisa Linho Areia', cat: 'cima', preco: 289,
      desc: 'Camisa de linho lavado com bolso frontal e caimento solto. Fica ainda mais macia a cada lavagem.',
      detalhes: ['100% linho europeu certificado', 'Botões de corozo', 'Lavar à mão ou ciclo delicado'],
      cores: [{ nome: 'Creme', hex: '#efe8da' }, { nome: 'Oliva', hex: '#6c7150' }],
      tamanhos: ['PP', 'P', 'M', 'G', 'GG'], esgotados: [],
      fotos: [
        { src: 'img/peca-camisa.jpg', iw: 900, ih: 900, s: 1.25, fx: 0.5, fy: 0.5, alt: 'Camisa de linho creme de manga curta com gola, botões e bolso' },
        { src: 'img/peca-camisa.jpg', iw: 900, ih: 900, s: 2.3, fx: 0.5, fy: 0.3, alt: 'Detalhe da gola, dos botões de corozo e do bolso da Camisa Linho Areia' }
      ]
    },
    {
      id: 'calca-noite', nome: 'Calça Pantalona Noite', cat: 'baixo', preco: 359,
      desc: 'Pantalona de cintura alta com pregas e vinco marcado. Alfaiataria fluida que não amassa na mala.',
      detalhes: ['Sarja de algodão orgânico com elastano', 'Passantes para cinto', 'Lavar do avesso'],
      cores: [{ nome: 'Preto', hex: '#171513' }, { nome: 'Areia', hex: '#d8c6a6' }],
      tamanhos: ['36', '38', '40', '42', '44'], esgotados: ['36'],
      fotos: [
        { src: 'img/peca-calca.jpg', iw: 900, ih: 900, s: 1.25, fx: 0.5, fy: 0.5, alt: 'Calça pantalona preta com cós e vinco frontal' },
        { src: 'img/hero.jpg', iw: 1200, ih: 1600, s: 1.7, fx: 0.507, fy: 0.7, alt: 'Calça Pantalona Noite vestida' }
      ]
    },
    {
      id: 'trico-barro', nome: 'Tricô Barro', cat: 'cima', preco: 329, selo: 'Últimas peças', seloTerra: true,
      desc: 'Suéter oversized em ponto canelado, tricotado em lã brasileira de ovelhas criadas no Sul.',
      detalhes: ['Lã merino 70% · algodão 30%', 'Punhos e barra canelados', 'Secar na horizontal'],
      cores: [{ nome: 'Terracota', hex: '#b5502f' }, { nome: 'Cru', hex: '#e9dfcc' }],
      tamanhos: ['P', 'M', 'G'], esgotados: ['P'],
      fotos: [
        { src: 'img/peca-trico.jpg', iw: 900, ih: 900, s: 1.25, fx: 0.5, fy: 0.5, alt: 'Suéter de tricô terracota com punhos canelados' },
        { src: 'img/hero.jpg', iw: 1200, ih: 1600, s: 1.7, fx: 0.507, fy: 0.37, alt: 'Tricô Barro vestido' }
      ]
    },
    {
      id: 'vestido-oliva', nome: 'Vestido Midi Oliva', cat: 'vestidos', preco: 459, selo: 'Novo',
      desc: 'Vestido midi evasê com faixa para amarrar e decote redondo. Leve para o calor, fácil de sobrepor no frio.',
      detalhes: ['Viscose de fonte certificada', 'Faixa removível', 'Lavar à mão'],
      cores: [{ nome: 'Oliva', hex: '#6c7150' }, { nome: 'Barro', hex: '#9b4127' }],
      tamanhos: ['PP', 'P', 'M', 'G', 'GG'], esgotados: [],
      fotos: [
        { src: 'img/peca-vestido.jpg', iw: 900, ih: 900, s: 1.25, fx: 0.5, fy: 0.5, alt: 'Vestido midi verde-oliva com faixa na cintura' },
        { src: 'img/look-3.jpg', iw: 1067, ih: 1600, s: 1.5, fx: 0.48, fy: 0.48, alt: 'Vestido Midi Oliva vestido' }
      ]
    },
    {
      id: 'saia-trigo', nome: 'Saia Plissada Trigo', cat: 'baixo', preco: 319,
      desc: 'Saia midi com plissado permanente e cós com zíper lateral invisível. Movimento bonito a cada passo.',
      detalhes: ['Poliéster reciclado 100%', 'Plissado que não desmancha', 'Lavar a frio'],
      cores: [{ nome: 'Trigo', hex: '#d8c6a6' }],
      tamanhos: ['PP', 'P', 'M', 'G'], esgotados: [],
      fotos: [
        { src: 'img/peca-saia.jpg', iw: 900, ih: 900, s: 1.25, fx: 0.5, fy: 0.5, alt: 'Saia plissada cor de trigo' },
        { src: 'img/peca-saia.jpg', iw: 900, ih: 900, s: 2.2, fx: 0.5, fy: 0.58, alt: 'Detalhe do plissado e da barra da Saia Plissada Trigo' }
      ]
    },
    {
      id: 'bolsa-cacau', nome: 'Bolsa Tote Cacau', cat: 'acessorios', preco: 399,
      desc: 'Tote de couro curtido com tanino vegetal, alças longas e bolso interno com zíper. Cabe um notebook de 14".',
      detalhes: ['Couro curtido ao vegetal', 'Forro de algodão cru', '38 × 32 × 12 cm'],
      cores: [{ nome: 'Cacau', hex: '#4b3427' }, { nome: 'Preto', hex: '#171513' }],
      tamanhos: ['Único'], esgotados: [],
      fotos: [
        { src: 'img/peca-bolsa.jpg', iw: 900, ih: 900, s: 1.25, fx: 0.5, fy: 0.5, alt: 'Bolsa tote de couro marrom com alças longas e rebites' },
        { src: 'img/look-3.jpg', iw: 1067, ih: 1600, s: 2.6, fx: 0.63, fy: 0.47, alt: 'Bolsa Tote Cacau no ombro' }
      ]
    },
    {
      id: 'camiseta-essencial', nome: 'Camiseta Essencial', cat: 'cima', preco: 149,
      desc: 'A camiseta que vai com tudo: malha de algodão orgânico encorpada, gola canelada e modelagem reta.',
      detalhes: ['Algodão orgânico 100% · 180 g/m²', 'Tingimento de baixo impacto', 'Lavar a frio'],
      cores: [{ nome: 'Off-white', hex: '#f1ece2' }, { nome: 'Preto', hex: '#171513' }, { nome: 'Oliva', hex: '#6c7150' }],
      tamanhos: ['PP', 'P', 'M', 'G', 'GG'], esgotados: [],
      fotos: [
        { src: 'img/peca-camiseta.jpg', iw: 900, ih: 900, s: 1.25, fx: 0.5, fy: 0.5, alt: 'Camiseta off-white de gola canelada' },
        { src: 'img/peca-camiseta.jpg', iw: 900, ih: 900, s: 2.3, fx: 0.5, fy: 0.3, alt: 'Detalhe da gola canelada e da malha da Camiseta Essencial' }
      ]
    }
  ];
  var CATEGORIAS = { casacos: 'Casacos', cima: 'Blusas', baixo: 'Calças e saias', vestidos: 'Vestidos', acessorios: 'Acessórios' };
  var porId = {};
  PRODUTOS.forEach(function (p, i) { p.ordem = i; porId[p.id] = p; });

  /* ---------------------------------------------------------
     Utilitários
     --------------------------------------------------------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // Gera o HTML de uma foto recortada para caixas 4:5 (ver .lm-recorte no CSS)
  function recorte(f, classe, decorativa) {
    var s = f.s, fx = f.fx, fy = f.fy;
    if (typeof f.q === 'number') { s = 2.5; fx = f.q % 2 ? 0.75 : 0.25; fy = f.q > 1 ? 0.75 : 0.25; }
    var alturaRel = s * 0.8 * f.ih / f.iw; // altura da imagem em relação à altura da caixa
    var estilo = '--w:' + (s * 100).toFixed(2) + '%;--x:' + ((0.5 - fx * s) * 100).toFixed(2) + '%;--y:' + ((0.5 - fy * alturaRel) * 100).toFixed(2) + '%';
    return '<div class="lm-recorte ' + (classe || '') + '" style="' + estilo + '"><img src="' + f.src + '" width="' + f.iw + '" height="' + f.ih + '" loading="lazy" alt="' + (decorativa ? '' : esc(f.alt)) + '"' + (decorativa ? ' aria-hidden="true"' : '') + '></div>';
  }

  function prenderFoco(container, e) {
    if (e.key !== 'Tab') return;
    var f = $$('a[href], button:not([disabled]), input:not([disabled]), select, [tabindex]:not([tabindex="-1"])', container).filter(function (el) { return el.getClientRects().length; });
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
  function inerte(ligado) {
    $$('body > header, body > main, body > footer').forEach(function (el) { if (ligado) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
    document.body.style.overflow = ligado ? 'hidden' : '';
  }

  var toast = $('[data-toast]'), timerToast;
  function avisar(msg) {
    toast.textContent = msg;
    toast.classList.add('is-visivel');
    clearTimeout(timerToast);
    timerToast = setTimeout(function () { toast.classList.remove('is-visivel'); }, 2600);
  }

  /* ---------------------------------------------------------
     1. CABEÇALHO sólido ao rolar
     --------------------------------------------------------- */
  var topo = $('#topo');
  function aoRolar() { topo.classList.toggle('is-solido', window.scrollY > 30); }
  aoRolar();
  window.addEventListener('scroll', aoRolar, { passive: true });

  /* ---------------------------------------------------------
     2. CONTAGEM REGRESSIVA DO DROP
     --------------------------------------------------------- */
  var caixaDrop = $('[data-drop]');
  if (caixaDrop) {
    var alvo = new Date(DROP.data).getTime();
    if (DROP.repetirNaDemo) { var passo = DROP.avancoDias * 864e5; while (alvo <= Date.now()) alvo += passo; }
    var unidades = {}; $$('[data-unidade]', caixaDrop).forEach(function (el) { unidades[el.getAttribute('data-unidade')] = el; });
    var srDrop = $('[data-contagem-sr]'), ultimoMinuto = -1;
    var dois = function (n) { return String(n).padStart(2, '0'); };
    var tick = function () {
      var resta = Math.max(0, alvo - Date.now());
      if (!resta) {
        caixaDrop.classList.add('is-aberto');
        $('[data-drop-titulo]').textContent = 'A coleção está no ar';
        var cta = $('[data-cta-drop]'); cta.firstChild.textContent = 'Comprar agora '; cta.setAttribute('href', '#colecao');
        return false;
      }
      var s = Math.floor(resta / 1000);
      var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), seg = s % 60;
      unidades.dias.textContent = dois(d); unidades.horas.textContent = dois(h); unidades.min.textContent = dois(m); unidades.seg.textContent = dois(seg);
      if (m !== ultimoMinuto) { ultimoMinuto = m; srDrop.textContent = 'Faltam ' + d + ' dias, ' + h + ' horas e ' + m + ' minutos para o lançamento.'; }
      return true;
    };
    if (tick()) var intervalo = setInterval(function () { if (!tick()) clearInterval(intervalo); }, 1000);
  }

  /* ---------------------------------------------------------
     3. SACOLA (estado em localStorage)
     --------------------------------------------------------- */
  var sacola = [];
  try { sacola = JSON.parse(localStorage.getItem(CHAVE_SACOLA)) || []; } catch (e) { sacola = []; }
  sacola = sacola.filter(function (i) { return porId[i.id]; });
  function salvar() { try { localStorage.setItem(CHAVE_SACOLA, JSON.stringify(sacola)); } catch (e) { /* modo privado: segue só em memória */ } }

  function adicionar(id, cor, tam, qtd) {
    var achado = sacola.filter(function (i) { return i.id === id && i.cor === cor && i.tam === tam; })[0];
    if (achado) achado.qtd = Math.min(10, achado.qtd + qtd); else sacola.push({ id: id, cor: cor, tam: tam, qtd: qtd });
    salvar(); renderSacola(true);
    avisar(porId[id].nome + ' (' + cor + ', ' + tam + ') foi para a sacola');
  }

  var gaveta = $('#sacola'), veu = $('.lm-veu'), btnSacola = $('[data-abrir-sacola]');
  var contador = $('[data-contador]');
  function renderSacola(pular) {
    var total = 0, subtotal = 0;
    sacola.forEach(function (i) { total += i.qtd; subtotal += i.qtd * porId[i.id].preco; });
    contador.textContent = total;
    $('[data-contador-sr]').textContent = total ? 'Sacola com ' + total + (total === 1 ? ' item' : ' itens') : 'Sacola vazia';
    if (pular && !movimentoReduzido) { contador.classList.remove('is-pulo'); void contador.offsetWidth; contador.classList.add('is-pulo'); }
    $('[data-sacola-qtd]').textContent = total ? '(' + total + ')' : '';
    $('[data-subtotal]').textContent = moeda.format(subtotal);
    var falta = FRETE_GRATIS - subtotal;
    $('[data-frete-txt]').innerHTML = falta > 0 ? 'Faltam <strong>' + moeda.format(falta) + '</strong> para o frete grátis.' : '<strong>Você ganhou frete grátis.</strong>';
    $('[data-frete-barra]').style.width = Math.min(100, subtotal / FRETE_GRATIS * 100) + '%';
    $('[data-sacola-vazia]').hidden = total > 0;
    $('[data-sacola-rodape]').hidden = total === 0;
    $('[data-frete]').hidden = total === 0;
    var lista = $('[data-sacola-itens]');
    lista.innerHTML = sacola.map(function (i, n) {
      var p = porId[i.id];
      return '<li class="lm-item">' +
        '<div class="lm-item__foto">' + recorte(p.fotos[0], '', true) + '</div>' +
        '<div><p class="lm-item__nome">' + esc(p.nome) + '</p><p class="lm-item__var">' + esc(i.cor) + ' · Tam. ' + esc(i.tam) + '</p>' +
        '<div class="lm-item__acoes"><div class="lm-qtd" role="group" aria-label="Quantidade de ' + esc(p.nome) + '">' +
        '<button type="button" data-qtd="-1" data-n="' + n + '" aria-label="Diminuir">−</button><output aria-live="polite">' + i.qtd + '</output>' +
        '<button type="button" data-qtd="1" data-n="' + n + '" aria-label="Aumentar">+</button></div>' +
        '<span class="lm-item__preco">' + moeda.format(p.preco * i.qtd) + '</span>' +
        '<button type="button" class="lm-item__remover" data-remover="' + n + '" aria-label="Remover ' + esc(p.nome) + '"><svg aria-hidden="true"><use href="#i-lixo"/></svg></button></div></div></li>';
    }).join('');
  }
  // Botões de quantidade e remover dentro da sacola
  $('[data-sacola-itens]').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-remover')) {
      var n = +b.getAttribute('data-remover'), nome = porId[sacola[n].id].nome;
      sacola.splice(n, 1); salvar(); renderSacola();
      avisar(nome + ' saiu da sacola');
      var prox = $('[data-remover]', gaveta) || $('[data-fechar-sacola]', gaveta); prox.focus();
    } else if (b.hasAttribute('data-qtd')) {
      var k = +b.getAttribute('data-n');
      sacola[k].qtd = Math.max(1, Math.min(10, sacola[k].qtd + +b.getAttribute('data-qtd')));
      salvar(); renderSacola();
      var mesmo = $('[data-qtd="' + b.getAttribute('data-qtd') + '"][data-n="' + k + '"]', gaveta); if (mesmo) mesmo.focus();
    }
  });

  var focoAntesSacola = null;
  function abrirSacola() {
    focoAntesSacola = document.activeElement;
    toast.classList.remove('is-visivel');
    gaveta.hidden = false; veu.hidden = false;
    requestAnimationFrame(function () { gaveta.classList.add('is-aberto'); veu.classList.add('is-aberto'); });
    btnSacola.setAttribute('aria-expanded', 'true');
    inerte(true);
    setTimeout(function () { $('[data-fechar-sacola]', gaveta).focus(); }, 50);
  }
  function fecharSacola() {
    gaveta.classList.remove('is-aberto'); veu.classList.remove('is-aberto');
    btnSacola.setAttribute('aria-expanded', 'false');
    inerte(false);
    setTimeout(function () { gaveta.hidden = true; veu.hidden = true; }, movimentoReduzido ? 0 : 450);
    if (focoAntesSacola && focoAntesSacola.focus) focoAntesSacola.focus();
  }
  btnSacola.addEventListener('click', abrirSacola);
  $$('[data-fechar-sacola]').forEach(function (b) { b.addEventListener('click', fecharSacola); });
  $('[data-ir-colecao]').addEventListener('click', function () { setTimeout(function () { $('#colecao').scrollIntoView({ behavior: movimentoReduzido ? 'auto' : 'smooth' }); }, 50); });
  gaveta.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharSacola(); prenderFoco(gaveta, e); });
  $('[data-finalizar]').addEventListener('click', function () {
    $('[data-finalizar-aviso]').textContent = 'Demonstração: conecte aqui o seu checkout (Nuvemshop, Shopify, Mercado Pago…).';
  });

  /* ---------------------------------------------------------
     4. GRADE DE PRODUTOS
     --------------------------------------------------------- */
  // Bloco de opções (cores + tamanhos) — usado no cartão e no quick view
  function opcoesHTML(p, prefixo) {
    var cores = p.cores.map(function (c, i) {
      return '<label class="lm-cor"><input type="radio" name="' + prefixo + '-cor" value="' + esc(c.nome) + '"' + (i === 0 ? ' checked' : '') + ' aria-label="' + esc(c.nome) + '"><span style="--cor:' + c.hex + '"></span></label>';
    }).join('');
    var unico = p.tamanhos.length === 1;
    var tams = p.tamanhos.map(function (t) {
      var fora = p.esgotados.indexOf(t) > -1;
      return '<label class="lm-tam"><input type="radio" name="' + prefixo + '-tam" value="' + esc(t) + '"' + (fora ? ' disabled' : '') + (unico ? ' checked' : '') + ' aria-label="Tamanho ' + esc(t) + (fora ? ' (esgotado)' : '') + '"><span aria-hidden="true">' + esc(t) + '</span></label>';
    }).join('');
    return '<div class="lm-opcoes">' +
      '<fieldset class="lm-opcoes__linha"><legend class="lm-sr">Cor</legend><span class="lm-opcoes__rotulo" aria-hidden="true">Cor: <b data-nome-cor>' + esc(p.cores[0].nome) + '</b></span><div class="lm-cores">' + cores + '</div></fieldset>' +
      '<fieldset class="lm-opcoes__linha"><legend class="lm-sr">Tamanho</legend><div class="lm-tamanhos">' + tams + '</div></fieldset>' +
      '</div>';
  }
  function cartaoHTML(p) {
    var parcela = moeda.format(p.preco / PARCELAS);
    return '<li class="lm-card" data-id="' + p.id + '" data-cat="' + p.cat + '">' +
      '<div class="lm-card__midia">' +
        (p.selo ? '<span class="lm-card__selo' + (p.seloTerra ? ' lm-card__selo--terra' : '') + '">' + esc(p.selo) + '</span>' : '') +
        recorte(p.fotos[0], 'lm-foto-1') + recorte(p.fotos[1], 'lm-foto-2', true) +
        '<button type="button" class="lm-card__ver" data-quickview aria-label="Visualização rápida: ' + esc(p.nome) + '"><svg aria-hidden="true"><use href="#i-olho"/></svg>Ver rápido</button>' +
      '</div>' +
      '<div class="lm-card__topo"><h3 class="lm-card__nome">' + esc(p.nome) + '</h3><span class="lm-card__preco">' + moeda.format(p.preco) + '</span></div>' +
      '<p class="lm-card__parcela">ou ' + PARCELAS + '× de ' + parcela + ' sem juros</p>' +
      opcoesHTML(p, 'c-' + p.id) +
      '<p class="lm-card__erro" id="erro-' + p.id + '" role="alert"></p>' +
      '<button type="button" class="lm-adicionar" data-adicionar aria-describedby="erro-' + p.id + '"><svg aria-hidden="true"><use href="#i-sacola"/></svg><span>Adicionar</span></button>' +
    '</li>';
  }
  var grade = $('[data-grade]');
  grade.innerHTML = PRODUTOS.map(cartaoHTML).join('');

  // Atualiza o nome da cor ao escolher uma bolinha
  document.addEventListener('change', function (e) {
    if (e.target.name && /-cor$/.test(e.target.name)) {
      var bloco = e.target.closest('.lm-opcoes'); var rot = $('[data-nome-cor]', bloco); if (rot) rot.textContent = e.target.value;
    }
    if (e.target.name && /-tam$/.test(e.target.name)) {
      var raiz = e.target.closest('.lm-card, .lm-modal__info'); var er = $('.lm-card__erro', raiz); if (er) er.textContent = '';
    }
  });

  // Lê as escolhas de um bloco e adiciona à sacola (cartão ou quick view)
  function tentarAdicionar(raiz, id, botao, qtd) {
    var cor = $('input[name$="-cor"]:checked', raiz), tam = $('input[name$="-tam"]:checked', raiz);
    var erro = $('.lm-card__erro', raiz);
    if (!tam) {
      erro.textContent = 'Escolha um tamanho.';
      var t = $('.lm-tamanhos', raiz);
      if (!movimentoReduzido) { t.classList.remove('is-tremendo'); void t.offsetWidth; t.classList.add('is-tremendo'); }
      var primeiro = $('input[name$="-tam"]:not(:disabled)', raiz); if (primeiro) primeiro.focus();
      return;
    }
    adicionar(id, cor.value, tam.value, qtd || 1);
    var txt = $('span', botao), original = txt.textContent;
    botao.classList.add('is-ok'); txt.textContent = 'Adicionado ✓';
    setTimeout(function () { botao.classList.remove('is-ok'); txt.textContent = original; }, 1600);
  }
  grade.addEventListener('click', function (e) {
    var card = e.target.closest('.lm-card'); if (!card) return;
    if (e.target.closest('[data-adicionar]')) tentarAdicionar(card, card.getAttribute('data-id'), e.target.closest('[data-adicionar]'));
    if (e.target.closest('[data-quickview]')) abrirQuickView(card.getAttribute('data-id'), e.target.closest('[data-quickview]'));
  });

  // Filtro por categoria + ordenação, com animação FLIP
  var categoria = 'todos', ordem = 'destaque';
  function atualizarGrade() {
    var cards = $$('.lm-card', grade);
    var antes = new Map();
    cards.forEach(function (c) { if (!c.hidden) antes.set(c, c.getBoundingClientRect()); });
    var lista = PRODUTOS.slice().sort(function (a, b) {
      if (ordem === 'menor') return a.preco - b.preco;
      if (ordem === 'maior') return b.preco - a.preco;
      return a.ordem - b.ordem;
    });
    var visiveis = 0;
    lista.forEach(function (p) {
      var c = $('.lm-card[data-id="' + p.id + '"]', grade);
      var mostra = categoria === 'todos' || p.cat === categoria;
      c.hidden = !mostra; if (mostra) visiveis++;
      grade.appendChild(c);
    });
    $('[data-grade-aviso]').textContent = visiveis + (visiveis === 1 ? ' peça exibida' : ' peças exibidas');
    if (movimentoReduzido || !Element.prototype.animate) return;
    cards.forEach(function (c) {
      if (c.hidden) return;
      var r0 = antes.get(c), r1 = c.getBoundingClientRect();
      if (r0) {
        var dx = r0.left - r1.left, dy = r0.top - r1.top;
        if (dx || dy) c.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)' });
      } else {
        c.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', delay: 80 });
      }
    });
  }
  $$('[data-categoria]').forEach(function (b) {
    b.addEventListener('click', function () {
      categoria = b.getAttribute('data-categoria');
      $$('[data-categoria]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      atualizarGrade();
    });
  });
  $('[data-ordenar]').addEventListener('change', function (e) { ordem = e.target.value; atualizarGrade(); });

  /* ---------------------------------------------------------
     5. QUICK VIEW (modal acessível)
     --------------------------------------------------------- */
  var modal = $('#quickview'), gatilhoModal = null, qtdModal = 1, idModal = null;
  function abrirQuickView(id, gatilho) {
    var p = porId[id]; gatilhoModal = gatilho; qtdModal = 1; idModal = id;
    $('[data-qv-cat]', modal).textContent = CATEGORIAS[p.cat];
    $('[data-qv-nome]', modal).textContent = p.nome;
    $('[data-qv-preco]', modal).textContent = moeda.format(p.preco) + ' · ' + PARCELAS + '× de ' + moeda.format(p.preco / PARCELAS);
    $('[data-qv-desc]', modal).textContent = p.desc;
    $('[data-qv-detalhes]', modal).innerHTML = p.detalhes.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('');
    var trocarFoto = function (i) {
      var tmp = document.createElement('div');
      tmp.innerHTML = recorte(p.fotos[i], 'lm-modal__foto');
      var nova = tmp.firstChild; nova.setAttribute('data-qv-foto', '');
      $('[data-qv-foto]', modal).replaceWith(nova);
      $$('.lm-mini', modal).forEach(function (m, k) { m.setAttribute('aria-pressed', String(k === i)); });
    };
    $('[data-qv-minis]', modal).innerHTML = p.fotos.map(function (f, i) {
      return '<button type="button" class="lm-mini" aria-pressed="' + (i === 0) + '" aria-label="Foto ' + (i + 1) + ': ' + esc(f.alt) + '">' + recorte(f, '', true) + '</button>';
    }).join('');
    $$('.lm-mini', modal).forEach(function (m, i) { m.addEventListener('click', function () { trocarFoto(i); }); });
    trocarFoto(0);
    $('[data-qv-opcoes]', modal).innerHTML = opcoesHTML(p, 'qv') +
      '<p class="lm-card__erro" id="erro-qv" role="alert"></p>' +
      '<div class="lm-modal__compra"><div class="lm-qtd" role="group" aria-label="Quantidade"><button type="button" data-qv-qtd="-1" aria-label="Diminuir quantidade">−</button><output aria-live="polite" data-qv-qtd-valor>1</output><button type="button" data-qv-qtd="1" aria-label="Aumentar quantidade">+</button></div>' +
      '<button type="button" class="lm-adicionar" data-qv-adicionar aria-describedby="erro-qv"><svg aria-hidden="true"><use href="#i-sacola"/></svg><span>Adicionar à sacola</span></button></div>';
    modal.hidden = false;
    requestAnimationFrame(function () { modal.classList.add('is-aberto'); });
    inerte(true);
    $('.lm-modal__fechar', modal).focus();
  }
  function fecharQuickView() {
    modal.classList.remove('is-aberto');
    inerte(false);
    setTimeout(function () { modal.hidden = true; }, movimentoReduzido ? 0 : 300);
    if (gatilhoModal) gatilhoModal.focus();
  }
  modal.addEventListener('click', function (e) {
    if (e.target.closest('[data-fechar-modal]')) return fecharQuickView();
    var q = e.target.closest('[data-qv-qtd]');
    if (q) { qtdModal = Math.max(1, Math.min(10, qtdModal + +q.getAttribute('data-qv-qtd'))); $('[data-qv-qtd-valor]', modal).textContent = qtdModal; }
    var add = e.target.closest('[data-qv-adicionar]');
    if (add) tentarAdicionar($('.lm-modal__info', modal), idModal, add, qtdModal);
  });
  modal.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharQuickView(); prenderFoco(modal, e); });

  /* ---------------------------------------------------------
     6. LOOKBOOK: rolagem arrastável + parallax leve
     --------------------------------------------------------- */
  var trilho = $('[data-lookbook]');
  if (trilho) {
    var barra = $('[data-look-progresso]');
    var molduras = $$('.lm-look__moldura img', trilho);
    var pendente = false;
    function atualizarLook() {
      pendente = false;
      var max = trilho.scrollWidth - trilho.clientWidth;
      var vis = trilho.clientWidth / trilho.scrollWidth;
      barra.style.width = (vis * 100) + '%';
      barra.style.transform = 'translateX(' + (max > 0 ? (trilho.scrollLeft / max) * (1 / vis - 1) * 100 : 0) + '%)';
      if (movimentoReduzido) return;
      var centro = trilho.getBoundingClientRect().left + trilho.clientWidth / 2;
      molduras.forEach(function (img) {
        var r = img.parentElement.getBoundingClientRect();
        var desvio = (r.left + r.width / 2 - centro) / trilho.clientWidth; // -1 … 1
        img.style.setProperty('--px', (desvio * -28).toFixed(1) + 'px');
      });
    }
    var agendar = function () { if (!pendente) { pendente = true; requestAnimationFrame(atualizarLook); } };
    trilho.addEventListener('scroll', agendar, { passive: true });
    window.addEventListener('resize', agendar);
    atualizarLook();

    // Arrastar com o mouse (no toque, a rolagem nativa já funciona)
    var arrastando = false, inicioX = 0, inicioScroll = 0, moveu = false;
    trilho.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      arrastando = true; moveu = false; inicioX = e.clientX; inicioScroll = trilho.scrollLeft;
    });
    trilho.addEventListener('pointermove', function (e) {
      if (!arrastando) return;
      var dx = e.clientX - inicioX;
      if (Math.abs(dx) > 4 && !moveu) { moveu = true; trilho.classList.add('is-arrastando'); trilho.setPointerCapture(e.pointerId); }
      if (moveu) trilho.scrollLeft = inicioScroll - dx;
    });
    var soltar = function () {
      if (!arrastando) return;
      arrastando = false;
      trilho.classList.remove('is-arrastando');
    };
    trilho.addEventListener('pointerup', soltar);
    trilho.addEventListener('pointercancel', soltar);
    trilho.addEventListener('lostpointercapture', soltar);
    trilho.addEventListener('dragstart', function (e) { e.preventDefault(); });

    var passoLook = function () { var item = $('.lm-look:not(.lm-look--intro)', trilho); return item ? item.offsetWidth + 22 : 300; };
    $('[data-look-prox]').addEventListener('click', function () { trilho.scrollBy({ left: passoLook(), behavior: movimentoReduzido ? 'auto' : 'smooth' }); });
    $('[data-look-ant]').addEventListener('click', function () { trilho.scrollBy({ left: -passoLook(), behavior: movimentoReduzido ? 'auto' : 'smooth' }); });
  }

  /* ---------------------------------------------------------
     7. REVELAÇÃO AO ROLAR
     --------------------------------------------------------- */
  var revelar = $$('.lm-revela');
  if ('IntersectionObserver' in window) {
    revelar.forEach(function (el) {
      var irmaos = $$('.lm-revela', el.parentElement).filter(function (x) { return x.parentElement === el.parentElement; });
      var i = irmaos.indexOf(el); if (i > 0) el.style.setProperty('--atraso', Math.min(i * 0.08, 0.4) + 's');
    });
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-visivel'); obs.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revelar.forEach(function (el) { obs.observe(el); });
  } else revelar.forEach(function (el) { el.classList.add('is-visivel'); });

  /* ---------------------------------------------------------
     8. NEWSLETTER / LISTA DO DROP
     --------------------------------------------------------- */
  var form = $('[data-form-lista]');
  if (form) {
    var email = $('#email', form), aceite = $('input[name="aceite"]', form);
    var erroEmail = $('[data-erro]', form), erroAceite = $('[data-erro-aceite]', form);
    var valido = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); };
    function checarEmail() {
      var v = email.value.trim();
      var msg = !v ? 'Informe seu e-mail.' : !valido(v) ? 'Esse e-mail parece incompleto. Confira, por favor.' : '';
      email.setAttribute('aria-invalid', String(!!msg)); erroEmail.textContent = msg; return !msg;
    }
    function checarAceite() {
      var msg = aceite.checked ? '' : 'Marque a caixa para receber nossos e-mails.';
      aceite.setAttribute('aria-invalid', String(!!msg)); erroAceite.textContent = msg; return !msg;
    }
    email.addEventListener('blur', function () { if (email.value) checarEmail(); });
    email.addEventListener('input', function () { if (email.getAttribute('aria-invalid') === 'true') checarEmail(); });
    aceite.addEventListener('change', checarAceite);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var okEmail = checarEmail(), okAceite = checarAceite();
      if (!okEmail) return email.focus();
      if (!okAceite) return aceite.focus();
      var btn = $('[data-enviar]', form); btn.disabled = true; $('[data-enviar-txt]', btn).textContent = 'Enviando…';
      // Envio simulado — troque por fetch() para o seu serviço de e-mail (Mailchimp, Brevo, RD Station…)
      setTimeout(function () {
        var ok = $('[data-sucesso]');
        $('[data-email-final]', ok).textContent = email.value.trim();
        form.hidden = true; ok.hidden = false; ok.focus();
      }, 1100);
    });
  }

  /* Inicialização */
  renderSacola();
  var ano = $('[data-ano]'); if (ano) ano.textContent = new Date().getFullYear();
})();
