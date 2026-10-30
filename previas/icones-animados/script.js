/* =====================================================================
   ÍCONES ANIMADOS — script da galeria
   - ajustes ao vivo (cor, tamanho, traço) via variáveis CSS no :root
   - chave "Duotone": liga/desliga o preenchimento sutil (.ia-so-traco)
   - clique no cartão: reinicia a animação (toque) e copia o SVG
   - botão ".svg": baixa o ícone como arquivo (versão estática, sem CSS)
   - busca por nome (ignora acentos)
   Nenhuma dependência. Nada aqui lança erro se a API não existir.
   ===================================================================== */
(function () {
  'use strict';

  var raiz = document.documentElement;
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var PADRAO = { cor: '#2f5bd3', tamanho: 44, traco: 1.75, duotone: true };

  var campoCor = $('#ia-cor');
  var campoTamanho = $('#ia-tamanho');
  var campoTraco = $('#ia-traco');
  var saidaCor = $('#ia-cor-valor');
  var saidaTamanho = $('#ia-tamanho-valor');
  var saidaTraco = $('#ia-traco-valor');
  var amostras = $$('.ia-amostra');
  var itens = $$('.ia-item');
  var busca = $('#ia-busca');
  var contagem = $('#ia-contagem');
  var vazio = $('#ia-vazio');
  var vazioTermo = $('#ia-vazio-termo');
  var toast = $('#ia-toast');
  var grade = $('#ia-grade');
  var chaveDuotone = $('#ia-duotone');

  /* ---------------------------------------------------------------
     Ajustes ao vivo
     --------------------------------------------------------------- */

  /** Preenche a parte "andada" do slider (usada pelo CSS em --pct). */
  function pintarFaixa(faixa) {
    var min = parseFloat(faixa.min), max = parseFloat(faixa.max), v = parseFloat(faixa.value);
    faixa.style.setProperty('--pct', ((v - min) / (max - min)) * 100 + '%');
  }

  function aplicarCor(hex) {
    raiz.style.setProperty('--ia-cor', hex);
    saidaCor.textContent = hex.toUpperCase();
    if (campoCor.value.toLowerCase() !== hex.toLowerCase()) campoCor.value = hex;
    amostras.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.cor.toLowerCase() === hex.toLowerCase()));
    });
  }

  function aplicarTamanho(px) {
    raiz.style.setProperty('--ia-tamanho', px + 'px');
    saidaTamanho.textContent = px + ' px';
    pintarFaixa(campoTamanho);
  }

  function aplicarTraco(valor) {
    raiz.style.setProperty('--ia-traco', String(valor));
    saidaTraco.textContent = String(valor).replace('.', ',');
    pintarFaixa(campoTraco);
  }

  /** Duotone ligado = camadas .ia-tom visíveis; desligado = só o traço. */
  function aplicarDuotone(ligado) {
    grade.classList.toggle('ia-so-traco', !ligado);
    chaveDuotone.setAttribute('aria-pressed', String(ligado));
  }
  function duotoneLigado() {
    return chaveDuotone.getAttribute('aria-pressed') === 'true';
  }
  chaveDuotone.addEventListener('click', function () {
    aplicarDuotone(!duotoneLigado());
    mostrarAviso(duotoneLigado() ? 'Duotone ligado' : 'Só o traço');
  });

  campoCor.addEventListener('input', function () { aplicarCor(campoCor.value); });
  campoTamanho.addEventListener('input', function () { aplicarTamanho(parseInt(campoTamanho.value, 10)); });
  campoTraco.addEventListener('input', function () { aplicarTraco(parseFloat(campoTraco.value)); });
  amostras.forEach(function (b) {
    b.addEventListener('click', function () { aplicarCor(b.dataset.cor); });
  });

  $('#ia-restaurar').addEventListener('click', function () {
    campoTamanho.value = PADRAO.tamanho;
    campoTraco.value = PADRAO.traco;
    aplicarCor(PADRAO.cor);
    aplicarTamanho(PADRAO.tamanho);
    aplicarTraco(PADRAO.traco);
    aplicarDuotone(PADRAO.duotone);
    mostrarAviso('Ajustes restaurados');
  });

  aplicarTamanho(parseInt(campoTamanho.value, 10));
  aplicarTraco(parseFloat(campoTraco.value));
  aplicarCor(campoCor.value);

  /* ---------------------------------------------------------------
     Gerar o código SVG
     --------------------------------------------------------------- */

  function escapar(valor) {
    return String(valor).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  /** Serializa um elemento SVG com recuo de 2 espaços (sem espaços soltos do HTML). */
  function serializar(el, nivel) {
    var recuo = new Array(nivel + 1).join('  ');
    var atributos = Array.prototype.map.call(el.attributes, function (a) {
      return ' ' + a.name + '="' + escapar(a.value) + '"';
    }).join('');
    var filhos = Array.prototype.slice.call(el.children);
    if (!filhos.length) return recuo + '<' + el.localName + atributos + '/>';
    return recuo + '<' + el.localName + atributos + '>\n' +
      filhos.map(function (f) { return serializar(f, nivel + 1); }).join('\n') +
      '\n' + recuo + '</' + el.localName + '>';
  }

  /**
   * Monta o SVG de um ícone.
   * - modo "copiar": mantém classes e partes animadas (use com icones.css);
   *   cor em currentColor para herdar do texto.
   * - modo "arquivo": versão estática para .svg avulso — remove as partes que
   *   só aparecem na animação (data-ia-extra) e grava a cor escolhida.
   * Nos dois modos, com o Duotone desligado as camadas .ia-tom saem do código.
   */
  function gerarSVG(svg, modo) {
    var copia = svg.cloneNode(true);
    var tamanho = parseInt(campoTamanho.value, 10);
    var traco = parseFloat(campoTraco.value);
    copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copia.setAttribute('width', modo === 'arquivo' ? '24' : String(tamanho));
    copia.setAttribute('height', modo === 'arquivo' ? '24' : String(tamanho));
    copia.setAttribute('stroke-width', String(traco));
    copia.removeAttribute('focusable');

    if (!duotoneLigado()) {
      Array.prototype.forEach.call(copia.querySelectorAll('.ia-tom'), function (n) { n.remove(); });
    }

    if (modo === 'arquivo') {
      Array.prototype.forEach.call(copia.querySelectorAll('[data-ia-extra]'), function (n) { n.remove(); });
      // Fora do navegador "currentColor" não tem a quem herdar: grava a cor de verdade
      Array.prototype.forEach.call(copia.querySelectorAll('.ia-tom'), function (n) { n.setAttribute('fill', campoCor.value); });
      copia.setAttribute('stroke', campoCor.value);
      copia.removeAttribute('aria-hidden');
    }

    // Ordem amigável dos atributos do <svg>
    var ordem = ['xmlns', 'class', 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'aria-hidden'];
    var valores = {};
    Array.prototype.slice.call(copia.attributes).forEach(function (a) { valores[a.name] = a.value; copia.removeAttribute(a.name); });
    ordem.forEach(function (n) { if (n in valores) { copia.setAttribute(n, valores[n]); delete valores[n]; } });
    Object.keys(valores).forEach(function (n) { copia.setAttribute(n, valores[n]); });

    return serializar(copia, 0);
  }

  /* ---------------------------------------------------------------
     Copiar para a área de transferência (nunca lança erro)
     --------------------------------------------------------------- */

  function copiarComTextarea(texto) {
    var focoAnterior = document.activeElement;
    var area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.setAttribute('aria-hidden', 'true');
    area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(area);
    var ok = false;
    try {
      area.select();
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    area.remove();
    if (focoAnterior && typeof focoAnterior.focus === 'function') focoAnterior.focus({ preventScroll: true });
    return ok;
  }

  function copiarTexto(texto) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(texto)
          .then(function () { return true; })
          .catch(function () { return copiarComTextarea(texto); });
      }
    } catch (e) { /* segue para o plano B */ }
    return Promise.resolve(copiarComTextarea(texto));
  }

  /* ---------------------------------------------------------------
     Toast
     --------------------------------------------------------------- */
  var temporizadorAviso = 0;
  var ICONE_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';

  function mostrarAviso(texto) {
    toast.innerHTML = ICONE_OK + '<span></span>';
    toast.lastChild.textContent = texto;
    toast.classList.add('ia-visivel');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(function () { toast.classList.remove('ia-visivel'); }, 2200);
  }

  /* ---------------------------------------------------------------
     Disparo da animação no clique/toque (.ia-ativo)
     --------------------------------------------------------------- */
  function animar(item) {
    // Tira as animações por um quadro para reiniciá-las mesmo com o mouse em cima
    item.classList.add('ia-reinicia');
    item.classList.remove('ia-ativo');
    void item.offsetWidth;
    item.classList.remove('ia-reinicia');
    item.classList.add('ia-ativo');
    clearTimeout(item._iaTempo);
    item._iaTempo = setTimeout(function () { item.classList.remove('ia-ativo'); }, 1600);
  }

  function rotulo(item) {
    return item.querySelector('.ia-nome').textContent.trim();
  }

  // Endereços temporários (blob:) para o download do .svg
  function criarEndereco(blob) { return window.URL.createObjectURL.call(window.URL, blob); }
  function liberarEndereco(endereco) { window.URL.revokeObjectURL.call(window.URL, endereco); }

  itens.forEach(function (item) {
    var svg = item.querySelector('.ia-icone');

    item.querySelector('.ia-cartao').addEventListener('click', function () {
      animar(item);
      copiarTexto(gerarSVG(svg, 'copiar')).then(function (ok) {
        mostrarAviso(ok ? 'SVG do ícone ' + rotulo(item) + ' copiado' : 'Não foi possível copiar — use o botão .svg');
      });
    });

    item.querySelector('.ia-baixar').addEventListener('click', function (ev) {
      ev.stopPropagation();
      try {
        var blob = new Blob([gerarSVG(svg, 'arquivo') + '\n'], { type: 'image/svg+xml' });
        var endereco = criarEndereco(blob);
        var link = document.createElement('a');
        link.href = endereco;
        link.download = item.dataset.nome + '.svg';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { liberarEndereco(endereco); }, 1500);
        mostrarAviso(item.dataset.nome + '.svg baixado');
      } catch (e) {
        mostrarAviso('Não foi possível baixar o arquivo');
      }
    });
  });

  /* ---------------------------------------------------------------
     Busca (ignora maiúsculas e acentos)
     --------------------------------------------------------------- */
  function normalizar(texto) {
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  itens.forEach(function (item) {
    item._iaBusca = normalizar(item.dataset.busca + ' ' + rotulo(item));
  });

  function filtrar() {
    var termo = normalizar(busca.value);
    var visiveis = 0;
    itens.forEach(function (item) {
      var mostra = !termo || item._iaBusca.indexOf(termo) !== -1;
      item.hidden = !mostra;
      if (mostra) visiveis++;
    });
    contagem.textContent = visiveis === 1 ? '1 ícone' : visiveis + ' ícones';
    vazio.hidden = visiveis > 0;
    vazioTermo.textContent = busca.value.trim();
  }

  busca.addEventListener('input', filtrar);
  busca.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && busca.value) { busca.value = ''; filtrar(); }
  });

  // Atalho "/" foca a busca (exceto quando já se está digitando)
  document.addEventListener('keydown', function (ev) {
    var alvo = ev.target;
    var digitando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable);
    if (ev.key === '/' && !digitando && !ev.metaKey && !ev.ctrlKey) {
      ev.preventDefault();
      busca.focus();
    }
  });
})();
