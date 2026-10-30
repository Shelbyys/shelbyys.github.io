/* ==========================================================================
   LOADERS ESSENCIAIS — script.js
   --------------------------------------------------------------------------
   ATENÇÃO: os loaders NÃO dependem deste arquivo — eles são CSS puro.
   Este script cuida apenas da interface da galeria:
     1. Painel de controle: cor, velocidade e tamanho (escreve variáveis --ld-*)
     2. Clicar num cartão copia o HTML do loader (com toast de confirmação)
   Você pode apagar este arquivo ao levar os loaders para seu projeto.
   ========================================================================== */
(function () {
  'use strict';

  var raiz = document.documentElement;

  /* Valores iniciais (devem bater com o :root do estilo.css) */
  var PADRAO = { cor: '#ee4d2a', velocidade: 1, tamanho: 56 };
  var estado = { cor: PADRAO.cor, velocidade: PADRAO.velocidade, tamanho: PADRAO.tamanho };


  /* ------------------------------------------------------------------------
     1. PAINEL DE CONTROLE
     Basta escrever as variáveis em :root — todos os loaders reagem.
     ------------------------------------------------------------------------ */
  var campoCor = document.getElementById('cor');
  var campoVelocidade = document.getElementById('velocidade');
  var campoTamanho = document.getElementById('tamanho');
  var saidaVelocidade = document.getElementById('velocidade-valor');
  var saidaTamanho = document.getElementById('tamanho-valor');
  var amostras = Array.prototype.slice.call(document.querySelectorAll('.pg-amostra'));
  var botaoRestaurar = document.getElementById('restaurar');

  function formatarVelocidade(v) {
    return (Math.round(v * 100) / 100).toString().replace('.', ',') + '×';
  }

  function aplicarCor(cor) {
    estado.cor = cor;
    raiz.style.setProperty('--ld-cor', cor);
    if (campoCor && campoCor.value.toLowerCase() !== cor.toLowerCase()) campoCor.value = cor;
    // marca a amostra correspondente (se houver)
    amostras.forEach(function (a) {
      a.setAttribute('aria-pressed', String(a.getAttribute('data-cor').toLowerCase() === cor.toLowerCase()));
    });
  }

  function aplicarVelocidade(mult) {
    estado.velocidade = mult;
    // "mais rápido" = duração MENOR: 2× → 0.5s, 0.5× → 2s
    raiz.style.setProperty('--ld-velocidade', (1 / mult).toFixed(3) + 's');
    if (saidaVelocidade) saidaVelocidade.textContent = formatarVelocidade(mult);
  }

  function aplicarTamanho(px) {
    estado.tamanho = px;
    raiz.style.setProperty('--ld-tamanho', px + 'px');
    if (saidaTamanho) saidaTamanho.textContent = px + ' px';
  }

  if (campoCor) campoCor.addEventListener('input', function () { aplicarCor(campoCor.value); });
  if (campoVelocidade) campoVelocidade.addEventListener('input', function () { aplicarVelocidade(parseFloat(campoVelocidade.value)); });
  if (campoTamanho) campoTamanho.addEventListener('input', function () { aplicarTamanho(parseInt(campoTamanho.value, 10)); });

  amostras.forEach(function (amostra) {
    amostra.addEventListener('click', function () { aplicarCor(amostra.getAttribute('data-cor')); });
  });

  if (botaoRestaurar) {
    botaoRestaurar.addEventListener('click', function () {
      aplicarCor(PADRAO.cor);
      aplicarVelocidade(PADRAO.velocidade);
      aplicarTamanho(PADRAO.tamanho);
      if (campoVelocidade) campoVelocidade.value = String(PADRAO.velocidade);
      if (campoTamanho) campoTamanho.value = String(PADRAO.tamanho);
    });
  }


  /* ------------------------------------------------------------------------
     2. COPIAR HTML
     ------------------------------------------------------------------------ */

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

  var toast = document.querySelector('.pg-toast');
  var toastTexto = toast ? toast.querySelector('.pg-toast__texto') : null;
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

  /**
   * Monta o HTML do loader. Se você mexeu nos controles, as variáveis alteradas
   * vão num atributo style no próprio loader — assim ele já sai com a sua cor.
   */
  function montarSnippet(loader, nome) {
    var classe = (loader.className.match(/ld-[\w-]+/) || ['ld-loader'])[0];
    var copia = loader.cloneNode(true);
    var vars = [];
    if (estado.cor.toLowerCase() !== PADRAO.cor.toLowerCase()) vars.push('--ld-cor:' + estado.cor);
    if (estado.velocidade !== PADRAO.velocidade) vars.push('--ld-velocidade:' + (1 / estado.velocidade).toFixed(2) + 's');
    if (estado.tamanho !== PADRAO.tamanho) vars.push('--ld-tamanho:' + estado.tamanho + 'px');
    if (vars.length) copia.setAttribute('style', vars.join('; '));

    return '<!-- Loader ' + nome + ' · precisa do bloco "Base" e do bloco .' + classe + ' do estilo.css (sem JS) -->\n' +
           alinharSnippet(copia.outerHTML);
  }

  var cartoes = document.querySelectorAll('.pg-cartao');
  cartoes.forEach(function (cartao) {
    var loader = cartao.querySelector('.pg-palco > *');
    var nome = cartao.getAttribute('data-nome') || 'loader';
    var rotulo = cartao.querySelector('.pg-copiar span');
    var temporizador = 0;
    if (!loader) return;

    // O cartão inteiro é clicável (mouse/toque); o botão "Copiar" serve ao teclado.
    // O clique do botão borbulha até o cartão, então há um único tratamento.
    cartao.addEventListener('click', function () {
      copiarTexto(montarSnippet(loader, nome)).then(function (ok) {
        if (!ok) { mostrarToast('Não foi possível copiar automaticamente'); return; }
        mostrarToast('HTML do loader “' + nome + '” copiado');
        cartao.classList.add('is-copiado');
        if (rotulo) rotulo.textContent = 'Copiado!';
        clearTimeout(temporizador);
        temporizador = setTimeout(function () {
          cartao.classList.remove('is-copiado');
          if (rotulo) rotulo.textContent = 'Copiar';
        }, 1600);
      });
    });
  });
})();
