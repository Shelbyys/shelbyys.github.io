/* =====================================================================
   UPLOAD DE ARQUIVOS — biblioteca + demonstração
   ---------------------------------------------------------------------
   Sem dependências. Tudo o que é público fica em window.Upload:

     Upload.criar(elemento, opcoes)   → zona de arrastar-e-soltar + lista
     Upload.botao(elemento, opcoes)   → botão que vira anel de progresso
     Upload.avatar(elemento, opcoes)  → foto de perfil com recorte circular
     Upload.enviarArquivo(arquivo, { aoProgresso, sinal })
                                      → A FUNÇÃO QUE VOCÊ TROCA pela sua API
     Upload.formatarTamanho(bytes)    → "1,2 MB"

   A parte de demonstração (arquivos de exemplo, foto ilustrada) está no
   fim do arquivo, no bloco "DEMONSTRAÇÃO" — apague-o no seu projeto.
   ===================================================================== */
(function (global) {
  'use strict';

  var KB = 1024;
  var MB = 1024 * 1024;

  /* =================================================================
     1. ENVIO — troque esta função pela sua chamada real
     ================================================================= */

  /**
   * Envia UM arquivo ao servidor e informa o progresso.
   *
   * É o único ponto que você precisa trocar para ligar o kit ao seu back-end.
   * Hoje ela chama simularEnvio(), que finge um upload com velocidade variável.
   *
   * @param {File} arquivo                 O arquivo escolhido/solto pelo usuário.
   * @param {Object} opcoes
   * @param {(enviados:number, total:number) => void} opcoes.aoProgresso
   *        Chame sempre que souber quantos bytes já subiram.
   * @param {AbortSignal} opcoes.sinal
   *        Fica "aborted" quando o usuário clica em Cancelar. Interrompa o envio.
   * @returns {Promise<any>} Resolva com a resposta do servidor (ex.: { url }).
   *        Rejeite com um Error cuja mensagem aparece na linha do arquivo.
   *        Rejeite com um erro de nome "AbortError" quando for cancelado.
   *
   * EXEMPLO REAL COM PROGRESSO (XMLHttpRequest — o fetch ainda não informa
   * o progresso de envio em todos os navegadores):
   *
   *   function enviarArquivo(arquivo, opcoes) {
   *     return new Promise(function (resolver, rejeitar) {
   *       var xhr = new XMLHttpRequest();
   *       var dados = new FormData();
   *       dados.append('arquivo', arquivo);
   *       xhr.open('POST', '/api/upload');
   *       xhr.upload.onprogress = function (e) {
   *         if (e.lengthComputable) opcoes.aoProgresso(e.loaded, e.total);
   *       };
   *       xhr.onload = function () {
   *         if (xhr.status >= 200 && xhr.status < 300) resolver(JSON.parse(xhr.responseText || '{}'));
   *         else rejeitar(new Error('O servidor recusou o arquivo (' + xhr.status + ')'));
   *       };
   *       xhr.onerror = function () { rejeitar(new Error('Falha na conexão')); };
   *       xhr.onabort = function () { var e = new Error('Envio cancelado'); e.name = 'AbortError'; rejeitar(e); };
   *       opcoes.sinal.addEventListener('abort', function () { xhr.abort(); });
   *       xhr.send(dados);
   *     });
   *   }
   */
  function enviarArquivo(arquivo, opcoes) {
    return simularEnvio(arquivo, opcoes);
  }

  /** Ajustes da simulação (só valem enquanto enviarArquivo usar simularEnvio). */
  var simulacao = {
    velocidadeMin: 0.7 * MB,   // bytes por segundo
    velocidadeMax: 3.4 * MB,
    duracaoMin: 1.6,           // segundos — arquivos pequenos não "piscam"
    duracaoMax: 6,             // segundos — arquivos grandes não demoram demais
    chanceDeFalha: 0           // 0 a 1 — ex.: 0.2 para testar o "Tentar de novo"
  };

  /**
   * Finge um envio: avança em "pacotes" com velocidade que oscila e trava
   * de vez em quando, como uma conexão real. Respeita o cancelamento.
   */
  function simularEnvio(arquivo, opcoes) {
    opcoes = opcoes || {};
    var total = Math.max(1, arquivo.size || 1);
    var enviados = Math.min(total, opcoes.inicio || 0);
    var sinal = opcoes.sinal;
    var aoProgresso = opcoes.aoProgresso || function () {};

    var restante = total - enviados;
    var base = simulacao.velocidadeMin + Math.random() * (simulacao.velocidadeMax - simulacao.velocidadeMin);
    base = Math.min(Math.max(base, restante / simulacao.duracaoMax), Math.max(restante / simulacao.duracaoMin, 1));
    var falharEm = Math.random() < simulacao.chanceDeFalha ? 0.35 + Math.random() * 0.45 : 2;

    return new Promise(function (resolver, rejeitar) {
      var ultimo = performance.now();
      var temporizador = 0;

      function abortado() {
        clearTimeout(temporizador);
        rejeitar(criarErroCancelado());
      }
      if (sinal) {
        if (sinal.aborted) return abortado();
        sinal.addEventListener('abort', abortado, { once: true });
      }

      (function passo() {
        var agora = performance.now();
        var dt = Math.min(0.25, (agora - ultimo) / 1000);
        ultimo = agora;
        // Oscila entre 45% e 145% da velocidade base; às vezes quase para.
        var fator = Math.random() < 0.07 ? 0.12 : 0.45 + Math.random();
        enviados = Math.min(total, enviados + base * fator * dt);
        aoProgresso(enviados, total);

        if (enviados / total >= falharEm) {
          if (sinal) sinal.removeEventListener('abort', abortado);
          return rejeitar(new Error('Falha na conexão'));
        }
        if (enviados >= total) {
          if (sinal) sinal.removeEventListener('abort', abortado);
          return resolver({ ok: true, nome: arquivo.name, tamanho: total });
        }
        temporizador = setTimeout(passo, 90 + Math.random() * 80);
      })();
    });
  }

  function criarErroCancelado() {
    var erro = new Error('Envio cancelado');
    erro.name = 'AbortError';
    return erro;
  }

  /* =================================================================
     2. UTILIDADES
     ================================================================= */

  /** 1536 → "1,5 KB" · 1258291 → "1,2 MB" (formato pt-BR). */
  function formatarTamanho(bytes) {
    if (!isFinite(bytes) || bytes < 0) return '—';
    if (bytes < KB) return Math.round(bytes) + ' B';
    var unidades = ['KB', 'MB', 'GB', 'TB'];
    var valor = bytes / KB;
    var i = 0;
    while (valor >= 1024 && i < unidades.length - 1) { valor /= 1024; i++; }
    var casas = valor < 100 ? 1 : 0;
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) + ' ' + unidades[i];
  }

  function formatarTempo(segundos) {
    if (!isFinite(segundos)) return '';
    if (segundos < 1) return '< 1 s';
    if (segundos < 60) return Math.ceil(segundos) + ' s';
    return Math.ceil(segundos / 60) + ' min';
  }

  function escaparHTML(texto) {
    return String(texto).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var contadorId = 0;
  function gerarId(prefixo) { contadorId += 1; return prefixo + '-' + contadorId; }

  // Endereços temporários (blob:) para miniaturas e prévias
  function criarEndereco(blob) { return global.URL.createObjectURL.call(global.URL, blob); }
  function liberarEndereco(endereco) {
    if (endereco && endereco.indexOf('blob:') === 0) global.URL.revokeObjectURL.call(global.URL, endereco);
  }

  var reduzMovimento = global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function extensao(nome) {
    var m = /\.([a-z0-9]+)$/i.exec(nome || '');
    return m ? m[1].toLowerCase() : '';
  }

  /** Classifica o arquivo para escolher o ícone. */
  function tipoDoArquivo(arquivo) {
    var mime = (arquivo.type || '').toLowerCase();
    var ext = extensao(arquivo.name);
    if (mime.indexOf('image/') === 0 || /^(jpe?g|png|gif|webp|avif|svg|heic)$/.test(ext)) return 'imagem';
    if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (/^(xlsx?|csv|ods|numbers)$/.test(ext) || /spreadsheet|excel|csv/.test(mime)) return 'planilha';
    if (mime.indexOf('video/') === 0 || /^(mp4|mov|webm|mkv|avi)$/.test(ext)) return 'video';
    if (/^(zip|rar|7z|tar|gz)$/.test(ext) || /zip|compressed|x-tar|gzip/.test(mime)) return 'zip';
    return 'arquivo';
  }

  /** Confere o arquivo contra a lista de tipos (".pdf", "image/*", "video/mp4"). */
  function tipoAceito(arquivo, tipos) {
    if (!tipos || !tipos.length) return true;
    var mime = (arquivo.type || '').toLowerCase();
    var ext = '.' + extensao(arquivo.name);
    return tipos.some(function (t) {
      t = t.trim().toLowerCase();
      if (t.charAt(0) === '.') return ext === t;
      if (t.slice(-2) === '/*') return mime.indexOf(t.slice(0, -1)) === 0;
      return mime === t;
    });
  }

  /** Texto amigável dos tipos: [".pdf","image/*"] → "PDF, imagens". */
  function descreverTipos(tipos) {
    if (!tipos || !tipos.length) return 'Qualquer tipo';
    return tipos.map(function (t) {
      if (t === 'image/*') return 'imagens';
      if (t === 'video/*') return 'vídeos';
      if (t.charAt(0) === '.') return t.slice(1).toUpperCase();
      return (t.split('/')[1] || t).toUpperCase();
    }).join(', ');
  }

  /* =================================================================
     3. ÍCONES (SVG em linha, traço 1,75 em grade 24×24)
     ================================================================= */
  function svg(conteudo, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"' + (extra || '') + '>' + conteudo + '</svg>';
  }
  var DOC = '<path d="M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8z"/><path d="M14 3v5h5"/>';
  var ICONES = {
    imagem: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="9.5" r="1.6"/><path d="M20.5 15l-4.6-4.6L6.5 19.5"/>'),
    pdf: svg(DOC + '<path d="M8.5 13h7M8.5 16.5h4.5"/>'),
    planilha: svg(DOC + '<path d="M8.5 12h7v6h-7zM12 12v6M8.5 15h7"/>'),
    video: svg('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M10.5 9.6v4.8l4-2.4z"/>'),
    zip: svg(DOC + '<path d="M10.5 3v1.5h1.5V6h-1.5v1.5H12V9h-1.5"/><path d="M10 12h2.5v3H10z"/>'),
    arquivo: svg(DOC + '<path d="M8.5 13h7M8.5 16.5h7"/>'),
    nuvem: svg('<path class="up-seta-sobe" d="M12 20v-8.5M8.8 14.6L12 11.4l3.2 3.2"/><path d="M16.5 17.5h.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 8.6 4.5 4.5 0 0 0 7 17.5h.5"/>'),
    seta: svg('<path d="M12 16V5M7.5 9.5L12 5l4.5 4.5"/><path d="M5 19h14"/>'),
    fechar: svg('<path d="M7 7l10 10M17 7L7 17"/>'),
    repetir: svg('<path d="M20 12a8 8 0 1 1-2.35-5.65"/><path d="M20 4.5V9h-4.5"/>'),
    lixeira: svg('<path d="M4.5 7h15M9.5 7V5.3c0-.7.5-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3V7M6.5 7l.8 11.6A2.2 2.2 0 0 0 9.5 20.7h5a2.2 2.2 0 0 0 2.2-2.1L17.5 7"/>'),
    ok: svg('<path d="M5.5 12.5l4 4L18.5 8"/>'),
    alerta: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.8v5M12 16.2h.01"/>'),
    pessoa: svg('<circle cx="12" cy="9" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'),
    camera: svg('<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l1.4-2h5.6l1.4 2h1.3A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.3" r="3.3"/>'),
    menos: svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4M8.5 11h5"/>'),
    mais: svg('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4M8.5 11h5M11 8.5v5"/>')
  };

  /* =================================================================
     4. ZONA DE SOLTAR + LISTA   →   Upload.criar(elemento, opcoes)
     ================================================================= */

  var PADRAO_ZONA = {
    limiteMB: 10,                 // tamanho máximo por arquivo
    tipos: [],                    // ex.: ['image/*', '.pdf', '.xlsx']  (vazio = qualquer)
    textoTipos: '',               // texto exibido; vazio = gerado a partir de "tipos"
    multiplo: true,               // aceitar vários arquivos de uma vez
    simultaneos: 3,               // envios ao mesmo tempo (os demais ficam na fila)
    colar: true,                  // aceitar Ctrl/⌘+V com arquivos na área de transferência
    aoEnviar: null,               // function(arquivo, { aoProgresso, sinal }) → Promise. Padrão: Upload.enviarArquivo
    aoConcluir: null,             // function(item, resposta)
    aoErro: null,                 // function(item, erro)
    aoRemover: null               // function(item)
  };

  var ESTADOS = {
    fila: 'Na fila',
    enviando: 'Enviando',
    concluido: 'Enviado',
    cancelado: 'Envio cancelado',
    falha: 'Falha no envio',
    invalido: 'Não enviado'
  };

  function criar(raiz, opcoes) {
    if (!raiz) throw new Error('Upload.criar: elemento não encontrado');
    var o = Object.assign({}, PADRAO_ZONA, opcoes || {});
    var limiteBytes = o.limiteMB * MB;
    var id = gerarId('up-arquivos');
    var ehMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    var textoTipos = o.textoTipos || descreverTipos(o.tipos);

    raiz.classList.add('up-kit');
    raiz.innerHTML =
      '<div class="up-zona">' +
        '<svg class="up-zona-borda" aria-hidden="true" focusable="false"><rect width="100%" height="100%" rx="18" ry="18"/></svg>' +
        '<span class="up-zona-icone" aria-hidden="true">' + ICONES.nuvem + '</span>' +
        '<p class="up-zona-titulo"><span class="up-zona-t1">Arraste arquivos para cá</span><span class="up-zona-t2">Solte para enviar</span></p>' +
        '<p class="up-zona-sub">ou <label class="up-link" for="' + id + '">escolha no computador</label>' +
          (o.colar ? '<span class="up-zona-colar"> · cole com <kbd>' + (ehMac ? '⌘' : 'Ctrl') + '</kbd><kbd>V</kbd></span>' : '') + '</p>' +
        '<p class="up-zona-regras" id="' + id + '-regras">' + escaparHTML(textoTipos) + ' · até ' + o.limiteMB.toLocaleString('pt-BR') + ' MB por arquivo</p>' +
        '<input class="up-input" id="' + id + '" type="file"' + (o.multiplo ? ' multiple' : '') +
          (o.tipos.length ? ' accept="' + escaparHTML(o.tipos.join(',')) + '"' : '') +
          ' aria-label="Escolher arquivos para enviar. Você também pode arrastar arquivos para esta área." aria-describedby="' + id + '-regras">' +
      '</div>' +
      '<div class="up-lista-topo">' +
        '<p class="up-resumo"><strong class="up-resumo-qtd">Nenhum arquivo</strong> <span class="up-resumo-det"></span></p>' +
        '<button class="up-limpar" type="button" hidden>Limpar enviados</button>' +
      '</div>' +
      '<div class="up-geral" aria-hidden="true"><span class="up-geral-fill"></span></div>' +
      '<ul class="up-lista" aria-label="Arquivos selecionados"></ul>' +
      '<p class="up-lista-vazia">Os arquivos aparecem aqui com o progresso do envio.</p>' +
      '<div class="up-oculto" aria-live="polite" aria-atomic="true" data-up-anuncio></div>' +
      '<div class="up-oculto" role="alert" data-up-alerta></div>';

    var zona = raiz.querySelector('.up-zona');
    var input = raiz.querySelector('.up-input');
    var lista = raiz.querySelector('.up-lista');
    var vazia = raiz.querySelector('.up-lista-vazia');
    var resumoQtd = raiz.querySelector('.up-resumo-qtd');
    var resumoDet = raiz.querySelector('.up-resumo-det');
    var geralFill = raiz.querySelector('.up-geral-fill');
    var botaoLimpar = raiz.querySelector('.up-limpar');
    var anuncio = raiz.querySelector('[data-up-anuncio]');
    var alerta = raiz.querySelector('[data-up-alerta]');

    var itens = [];
    var aoEnviar = o.aoEnviar || function (a, op) { return Upload.enviarArquivo(a, op); };

    /* ---------- Anúncios para leitores de tela ---------- */
    function anunciar(texto) {
      anuncio.textContent = '';
      setTimeout(function () { anuncio.textContent = texto; }, 30);
    }
    function alertar(texto) {
      alerta.textContent = '';
      setTimeout(function () { alerta.textContent = texto; }, 30);
    }

    /* ---------- Abrir o seletor ---------- */
    zona.addEventListener('click', function (ev) {
      if (ev.target.closest('label, input')) return;   // o <label for> já abre sozinho
      input.click();
    });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); input.click(); }
    });
    input.addEventListener('change', function () {
      if (input.files && input.files.length) adicionar(input.files);
      input.value = '';                                  // permite escolher o mesmo arquivo de novo
    });
    // Anel de foco na zona (reforço para navegadores sem :has)
    input.addEventListener('focus', function () {
      var visivel = true;
      try { visivel = input.matches(':focus-visible'); } catch (e) { /* navegador antigo */ }
      zona.classList.toggle('up-focada', visivel);
    });
    input.addEventListener('blur', function () { zona.classList.remove('up-focada'); });

    /* ---------- Arrastar e soltar ---------- */
    var profundidade = 0;
    function temArquivos(ev) {
      var tipos = ev.dataTransfer && ev.dataTransfer.types;
      return !!tipos && Array.prototype.indexOf.call(tipos, 'Files') !== -1;
    }
    zona.addEventListener('dragenter', function (ev) {
      if (!temArquivos(ev)) return;
      ev.preventDefault();
      profundidade++;
      zona.classList.add('up-arrastando');
    });
    zona.addEventListener('dragover', function (ev) {
      if (!temArquivos(ev)) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
    });
    zona.addEventListener('dragleave', function () {
      profundidade = Math.max(0, profundidade - 1);
      if (!profundidade) zona.classList.remove('up-arrastando');
    });
    zona.addEventListener('drop', function (ev) {
      if (!temArquivos(ev)) return;
      ev.preventDefault();
      profundidade = 0;
      zona.classList.remove('up-arrastando');
      zona.classList.add('up-soltou');
      setTimeout(function () { zona.classList.remove('up-soltou'); }, 500);
      adicionar(ev.dataTransfer.files);
    });
    ligarArrasteNaPagina();

    /* ---------- Colar arquivos ---------- */
    if (o.colar) {
      document.addEventListener('paste', function (ev) {
        var arquivos = ev.clipboardData && ev.clipboardData.files;
        if (!arquivos || !arquivos.length) return;
        var alvo = ev.target;
        if (alvo && (alvo.tagName === 'TEXTAREA' || (alvo.tagName === 'INPUT' && alvo.type !== 'file'))) return;
        ev.preventDefault();
        adicionar(arquivos);
      });
    }

    /* ---------- Lista ---------- */
    function criarLinha(item) {
      var li = document.createElement('li');
      li.className = 'up-item';
      li.dataset.tipo = item.tipo;
      var idNome = gerarId('up-nome');
      li.innerHTML =
        '<div class="up-item-dentro">' +
          '<span class="up-item-icone" aria-hidden="true">' + ICONES[item.tipo] + '</span>' +
          '<div class="up-item-info">' +
            '<div class="up-item-linha">' +
              '<span class="up-item-nome" id="' + idNome + '"></span>' +
              '<span class="up-item-pct" aria-hidden="true"></span>' +
            '</div>' +
            '<div class="up-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-labelledby="' + idNome + '"><span class="up-barra-fill"></span></div>' +
            '<p class="up-item-meta"><span class="up-item-tamanho"></span><span class="up-item-status"></span></p>' +
          '</div>' +
          '<div class="up-item-acoes">' +
            '<button class="up-acao up-acao-cancelar" type="button">' + ICONES.fechar + '</button>' +
            '<button class="up-acao up-acao-repetir" type="button">' + ICONES.repetir + '</button>' +
            '<button class="up-acao up-acao-remover" type="button">' + ICONES.lixeira + '</button>' +
          '</div>' +
        '</div>';

      var nome = li.querySelector('.up-item-nome');
      nome.textContent = item.nome;
      nome.title = item.nome;
      li.querySelector('.up-item-tamanho').textContent = formatarTamanho(item.tamanho);
      li.querySelector('.up-acao-cancelar').setAttribute('aria-label', 'Cancelar envio de ' + item.nome);
      li.querySelector('.up-acao-repetir').setAttribute('aria-label', 'Tentar enviar ' + item.nome + ' de novo');
      li.querySelector('.up-acao-remover').setAttribute('aria-label', 'Remover ' + item.nome + ' da lista');
      li.querySelector('.up-acao-cancelar').title = 'Cancelar';
      li.querySelector('.up-acao-repetir').title = 'Tentar de novo';
      li.querySelector('.up-acao-remover').title = 'Remover';

      // Miniatura real para imagens
      if (item.miniatura) {
        var img = document.createElement('img');
        img.alt = '';
        img.decoding = 'async';
        img.src = item.miniatura;
        img.addEventListener('error', function () { img.remove(); li.classList.remove('up-com-miniatura'); });
        li.querySelector('.up-item-icone').appendChild(img);
        li.classList.add('up-com-miniatura');
      }

      li.querySelector('.up-acao-cancelar').addEventListener('click', function () { cancelar(item); });
      li.querySelector('.up-acao-repetir').addEventListener('click', function () { repetir(item); });
      li.querySelector('.up-acao-remover').addEventListener('click', function () { remover(item); });

      item.el = li;
      item.partes = {
        pct: li.querySelector('.up-item-pct'),
        barra: li.querySelector('.up-barra'),
        fill: li.querySelector('.up-barra-fill'),
        status: li.querySelector('.up-item-status')
      };
      return li;
    }

    /** Atualiza a linha conforme item.estado / item.progresso. */
    function pintar(item) {
      var p = item.partes;
      var pct = Math.round(item.progresso * 100);
      var focoDentro = item.el.contains(document.activeElement);
      item.el.dataset.estado = item.estado;
      p.fill.style.transform = 'scaleX(' + item.progresso + ')';
      p.barra.setAttribute('aria-valuenow', String(pct));

      if (item.estado === 'enviando') {
        p.pct.textContent = pct + '%';
        var partes = [formatarTamanho(item.progresso * item.tamanho) + ' de ' + formatarTamanho(item.tamanho)];
        if (item.velocidade > 0) {
          partes.push(formatarTamanho(item.velocidade) + '/s');
          partes.push('faltam ' + formatarTempo((item.tamanho * (1 - item.progresso)) / item.velocidade));
        }
        p.status.textContent = partes.join(' · ');
      } else if (item.estado === 'concluido') {
        p.pct.innerHTML = ICONES.ok;
        p.status.textContent = 'Enviado';
      } else if (item.estado === 'fila') {
        p.pct.textContent = '—';
        p.status.textContent = 'Na fila';
      } else if (item.estado === 'cancelado') {
        p.pct.textContent = pct + '%';
        p.status.textContent = 'Envio cancelado';
      } else {
        p.pct.innerHTML = ICONES.alerta;
        p.status.textContent = item.mensagem || ESTADOS[item.estado];
      }

      // Se o botão focado sumiu (ex.: Cancelar), leva o foco para a próxima ação visível
      var ativo = document.activeElement;
      if (focoDentro && (!item.el.contains(ativo) || ativo.offsetParent === null)) {
        var proxima = Array.prototype.find.call(item.el.querySelectorAll('.up-acao'), function (b) { return b.offsetParent !== null; });
        if (proxima) proxima.focus();
      }
      atualizarResumo();
    }

    function atualizarResumo() {
      var total = itens.length;
      var cont = { concluido: 0, enviando: 0, fila: 0, erro: 0 };
      var somaBytes = 0, somaEnviados = 0;
      itens.forEach(function (i) {
        if (i.estado === 'concluido') cont.concluido++;
        else if (i.estado === 'enviando') cont.enviando++;
        else if (i.estado === 'fila') cont.fila++;
        else cont.erro++;
        if (i.estado !== 'invalido') { somaBytes += i.tamanho; somaEnviados += i.tamanho * i.progresso; }
      });
      resumoQtd.textContent = total ? (total === 1 ? '1 arquivo' : total + ' arquivos') : 'Nenhum arquivo';
      var det = [];
      if (cont.concluido) det.push(cont.concluido + (cont.concluido === 1 ? ' enviado' : ' enviados'));
      if (cont.enviando) det.push(cont.enviando + ' enviando');
      if (cont.fila) det.push(cont.fila + ' na fila');
      if (cont.erro) det.push(cont.erro + ' com problema');
      resumoDet.textContent = det.length ? det.join(' · ') : '';
      geralFill.style.transform = 'scaleX(' + (somaBytes ? somaEnviados / somaBytes : 0) + ')';
      raiz.classList.toggle('up-tem-itens', total > 0);
      botaoLimpar.hidden = !cont.concluido;
    }

    /* ---------- Entrada e saída de linhas ---------- */
    function entrar(li, atraso) {
      lista.appendChild(li);
      if (reduzMovimento.matches || !li.animate) return;
      li.animate([
        { opacity: 0, transform: 'translateY(10px)' },
        { opacity: 1, transform: 'none' }
      ], { duration: 380, delay: atraso || 0, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    }

    function sair(li, aoFim) {
      if (reduzMovimento.matches || !li.animate) { li.remove(); aoFim(); return; }
      var altura = li.offsetHeight;
      li.style.overflow = 'hidden';
      var anim = li.animate([
        { height: altura + 'px', opacity: 1, transform: 'none', marginBottom: getComputedStyle(li).marginBottom },
        { height: altura + 'px', opacity: 0, transform: 'translateX(16px)', offset: 0.45 },
        { height: '0px', opacity: 0, transform: 'translateX(16px)', marginBottom: '0px' }
      ], { duration: 420, easing: 'cubic-bezier(.4,0,.2,1)' });
      anim.onfinish = function () { li.remove(); aoFim(); };
    }

    /* ---------- Fluxo de um arquivo ---------- */
    function novoItem(dados) {
      return {
        id: gerarId('up-item'),
        arquivo: dados.arquivo || null,
        nome: dados.nome,
        tamanho: dados.tamanho,
        tipo: dados.tipo || 'arquivo',
        estado: dados.estado || 'fila',
        progresso: dados.progresso || 0,
        mensagem: dados.mensagem || '',
        miniatura: dados.miniatura || '',
        velocidade: 0,
        exemplo: !!dados.exemplo,
        controlador: null
      };
    }

    function validar(arquivo) {
      if (!tipoAceito(arquivo, o.tipos)) return 'Tipo não permitido (' + (extensao(arquivo.name).toUpperCase() || 'sem extensão') + ')';
      if (arquivo.size > limiteBytes) return 'Acima do limite de ' + o.limiteMB.toLocaleString('pt-BR') + ' MB';
      return '';
    }

    /** Adiciona arquivos (FileList ou array de File). Retorna os itens criados. */
    function adicionar(arquivos) {
      var lote = Array.prototype.slice.call(arquivos || []);
      if (!o.multiplo) lote = lote.slice(0, 1);
      var criados = [];
      var problemas = 0;
      lote.forEach(function (arquivo, i) {
        var erro = validar(arquivo);
        var tipo = tipoDoArquivo(arquivo);
        var item = novoItem({
          arquivo: arquivo,
          nome: arquivo.name,
          tamanho: arquivo.size,
          tipo: tipo,
          estado: erro ? 'invalido' : 'fila',
          mensagem: erro,
          miniatura: tipo === 'imagem' && !erro && arquivo.size < 25 * MB ? criarEndereco(arquivo) : ''
        });
        if (erro) problemas++;
        itens.push(item);
        entrar(criarLinha(item), i * 60);
        pintar(item);
        criados.push(item);
        if (erro && typeof o.aoErro === 'function') o.aoErro(item, new Error(erro));
      });
      if (lote.length) {
        var texto = lote.length === 1 ? '1 arquivo adicionado.' : lote.length + ' arquivos adicionados.';
        var invalidos = criados.filter(function (c) { return c.estado === 'invalido'; });
        if (problemas === 1) alertar(texto + ' ' + invalidos[0].nome + ' não pode ser enviado: ' + invalidos[0].mensagem + '.');
        else if (problemas > 1) alertar(texto + ' ' + problemas + ' arquivos não podem ser enviados.');
        else anunciar(texto + ' Enviando.');
      }
      processarFila();
      return criados;
    }

    function processarFila() {
      var ativos = itens.filter(function (i) { return i.estado === 'enviando'; }).length;
      itens.forEach(function (i) {
        if (i.estado === 'fila' && ativos < o.simultaneos) { ativos++; iniciar(i); }
      });
    }

    function iniciar(item) {
      var controlador = typeof AbortController === 'function' ? new AbortController() : null;
      var pctInicial = Math.round(item.progresso * 100);
      var marcos = { 25: pctInicial >= 25, 50: pctInicial >= 50, 75: pctInicial >= 75 };
      var ultimoBytes = item.progresso * item.tamanho;
      var ultimoTempo = performance.now();
      item.controlador = controlador;
      item.estado = 'enviando';
      item.velocidade = 0;
      item.mensagem = '';
      pintar(item);

      var opcoesEnvio = {
        sinal: controlador ? controlador.signal : undefined,
        inicio: item.exemplo ? item.progresso * item.tamanho : 0,
        aoProgresso: function (enviados, total) {
          if (item.controlador !== controlador || item.estado !== 'enviando') return;
          var agora = performance.now();
          var dt = (agora - ultimoTempo) / 1000;
          if (dt > 0.05) {
            var inst = Math.max(0, enviados - ultimoBytes) / dt;
            item.velocidade = item.velocidade ? item.velocidade * 0.7 + inst * 0.3 : inst;   // média suavizada
            ultimoBytes = enviados;
            ultimoTempo = agora;
          }
          item.progresso = Math.min(1, total ? enviados / total : 0);
          var pct = Math.round(item.progresso * 100);
          [25, 50, 75].forEach(function (m) {
            if (!marcos[m] && pct >= m) { marcos[m] = true; anunciar(item.nome + ': ' + m + '% enviado.'); }
          });
          pintar(item);
        }
      };

      // Exemplos da demonstração não têm arquivo real: sempre usam a simulação.
      var envio = item.exemplo
        ? simularEnvio({ name: item.nome, size: item.tamanho }, opcoesEnvio)
        : aoEnviar(item.arquivo, opcoesEnvio);

      Promise.resolve(envio).then(function (resposta) {
        if (item.controlador !== controlador || item.estado !== 'enviando') return;
        item.estado = 'concluido';
        item.progresso = 1;
        item.resposta = resposta;
        pintar(item);
        anunciar(item.nome + ' enviado com sucesso.');
        if (typeof o.aoConcluir === 'function') o.aoConcluir(item, resposta);
      }, function (erro) {
        if (item.controlador !== controlador) return;
        if (erro && erro.name === 'AbortError') {
          item.estado = 'cancelado';
          anunciar('Envio de ' + item.nome + ' cancelado.');
        } else {
          item.estado = 'falha';
          item.mensagem = (erro && erro.message) || 'Falha no envio';
          alertar('Erro ao enviar ' + item.nome + ': ' + item.mensagem + '.');
          if (typeof o.aoErro === 'function') o.aoErro(item, erro);
        }
        pintar(item);
      }).then(function () {
        if (item.controlador === controlador) item.controlador = null;
        processarFila();
      });
    }

    function cancelar(item) {
      if (item.estado === 'fila') {
        item.estado = 'cancelado';
        pintar(item);
        anunciar('Envio de ' + item.nome + ' cancelado.');
        return;
      }
      if (item.estado !== 'enviando') return;
      if (item.controlador) item.controlador.abort();
      else { item.estado = 'cancelado'; pintar(item); }
    }

    function repetir(item) {
      if (item.estado !== 'cancelado' && item.estado !== 'falha') return;
      item.progresso = 0;
      item.estado = 'fila';
      item.mensagem = '';
      pintar(item);
      anunciar('Tentando enviar ' + item.nome + ' de novo.');
      processarFila();
    }

    function remover(item) {
      var indice = itens.indexOf(item);
      if (indice === -1) return;
      if (item.estado === 'enviando' && item.controlador) {
        var c = item.controlador;
        item.controlador = null;
        c.abort();
      }
      itens.splice(indice, 1);
      // Para onde vai o foco depois de remover
      var vizinho = itens[indice] || itens[indice - 1];
      var focoNaLinha = item.el.contains(document.activeElement);
      sair(item.el, function () {
        liberarEndereco(item.miniatura);
        atualizarResumo();
        processarFila();
      });
      if (focoNaLinha) {
        var alvo = vizinho && Array.prototype.find.call(vizinho.el.querySelectorAll('.up-acao'), function (b) { return b.offsetParent !== null; });
        (alvo || input).focus({ preventScroll: true });
      }
      anunciar(item.nome + ' removido da lista.');
      if (typeof o.aoRemover === 'function') o.aoRemover(item);
    }

    botaoLimpar.addEventListener('click', function () {
      itens.filter(function (i) { return i.estado === 'concluido'; }).forEach(remover);
      input.focus({ preventScroll: true });
    });

    /**
     * SÓ PARA DEMONSTRAÇÃO: cria uma linha sem arquivo real (capa, protótipos).
     * dados: { nome, tamanho, estado: 'concluido'|'enviando'|'invalido'|'falha'|'cancelado',
     *          progresso (0–1), mensagem, miniatura (url), tipo, retomarEm (ms) }
     */
    function adicionarExemplo(dados) {
      var item = novoItem(Object.assign({ tipo: tipoDoArquivo({ name: dados.nome, type: '' }) }, dados, { exemplo: true }));
      if (item.estado === 'concluido') item.progresso = 1;
      itens.push(item);
      entrar(criarLinha(item), dados.atraso || 0);
      if (item.estado === 'enviando') item.velocidade = dados.velocidade || 1.4 * MB;
      pintar(item);
      if (item.estado === 'enviando' && dados.retomarEm) {
        // Fica "parado" para a capa e depois continua de onde estava
        setTimeout(function () { if (item.estado === 'enviando' && itens.indexOf(item) !== -1) iniciar(item); }, dados.retomarEm);
      }
      return item;
    }

    var api = {
      elemento: raiz,
      adicionar: adicionar,
      adicionarExemplo: adicionarExemplo,
      cancelar: cancelar,
      repetir: repetir,
      remover: remover,
      limpar: function () { itens.slice().forEach(remover); },
      arquivos: function () { return itens.slice(); },
      abrirSeletor: function () { input.click(); }
    };
    atualizarResumo();
    return api;
  }

  /** Evita que o navegador abra o arquivo se ele for solto fora da zona. */
  var arrasteLigado = false;
  function ligarArrasteNaPagina() {
    if (arrasteLigado) return;
    arrasteLigado = true;
    var contador = 0;
    function temArquivos(ev) {
      var t = ev.dataTransfer && ev.dataTransfer.types;
      return !!t && Array.prototype.indexOf.call(t, 'Files') !== -1;
    }
    document.addEventListener('dragenter', function (ev) {
      if (!temArquivos(ev)) return;
      contador++;
      document.documentElement.classList.add('up-pagina-arrastando');
    });
    document.addEventListener('dragleave', function () {
      contador = Math.max(0, contador - 1);
      if (!contador) document.documentElement.classList.remove('up-pagina-arrastando');
    });
    document.addEventListener('dragover', function (ev) { if (temArquivos(ev)) ev.preventDefault(); });
    document.addEventListener('drop', function (ev) {
      contador = 0;
      document.documentElement.classList.remove('up-pagina-arrastando');
      if (temArquivos(ev)) ev.preventDefault();
    });
  }

  /* =================================================================
     5. BOTÃO COM PROGRESSO   →   Upload.botao(elemento, opcoes)
     ================================================================= */

  var PADRAO_BOTAO = {
    rotulo: 'Enviar arquivo',
    rotuloDepois: 'Enviar outro arquivo',
    limiteMB: 10,
    tipos: [],
    textoTipos: '',
    aoEnviar: null,              // padrão: Upload.enviarArquivo
    aoConcluir: null,            // function(arquivo, resposta)
    exemplo: null                // { nome, tamanho } para o link "simular" (demo)
  };

  function botao(raiz, opcoes) {
    if (!raiz) throw new Error('Upload.botao: elemento não encontrado');
    var o = Object.assign({}, PADRAO_BOTAO, opcoes || {});
    var id = gerarId('up-bp');
    var textoTipos = o.textoTipos || descreverTipos(o.tipos);

    raiz.classList.add('up-kit');
    raiz.innerHTML =
      '<div class="up-bp">' +
        '<button class="up-bp-botao" type="button" data-estado="pronto" aria-describedby="' + id + '-dica">' +
          '<span class="up-bp-rotulo"><span class="up-bp-rotulo-in">' + ICONES.seta + '<span class="up-bp-texto"></span></span></span>' +
          '<svg class="up-bp-anel" viewBox="0 0 56 56" aria-hidden="true" focusable="false">' +
            '<circle class="up-bp-trilho" cx="28" cy="28" r="25"/>' +
            '<circle class="up-bp-progresso" cx="28" cy="28" r="25" pathLength="100"/>' +
          '</svg>' +
          '<span class="up-bp-pct" aria-hidden="true">0%</span>' +
          '<span class="up-bp-x" aria-hidden="true">' + ICONES.fechar + '</span>' +
          '<svg class="up-bp-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path pathLength="1" d="M6 12.5l4 4L18 8.5"/></svg>' +
        '</button>' +
        '<input class="up-oculto" type="file" tabindex="-1" aria-hidden="true"' + (o.tipos.length ? ' accept="' + escaparHTML(o.tipos.join(',')) + '"' : '') + '>' +
        '<p class="up-bp-dica" id="' + id + '-dica">' + escaparHTML(textoTipos) + ' · até ' + o.limiteMB.toLocaleString('pt-BR') + ' MB</p>' +
        (o.exemplo ? '<button class="up-link up-bp-simular" type="button">Sem arquivo à mão? Simule com <span>' + escaparHTML(o.exemplo.nome) + '</span></button>' : '') +
        '<div class="up-oculto" aria-live="polite" aria-atomic="true"></div>' +
      '</div>';

    var botaoEl = raiz.querySelector('.up-bp-botao');
    var rotuloIn = raiz.querySelector('.up-bp-rotulo-in');
    var texto = raiz.querySelector('.up-bp-texto');
    var progresso = raiz.querySelector('.up-bp-progresso');
    var pctEl = raiz.querySelector('.up-bp-pct');
    var input = raiz.querySelector('input[type=file]');
    var dica = raiz.querySelector('.up-bp-dica');
    var simular = raiz.querySelector('.up-bp-simular');
    var anuncio = raiz.querySelector('[aria-live]');
    var dicaOriginal = dica.innerHTML;
    var aoEnviar = o.aoEnviar || function (a, op) { return Upload.enviarArquivo(a, op); };
    var controlador = null;
    var temporizador = 0;
    var DIAMETRO = 56;

    function anunciar(t) { anuncio.textContent = ''; setTimeout(function () { anuncio.textContent = t; }, 30); }
    function estado(e) { botaoEl.dataset.estado = e; }
    function larguraDoRotulo() { return Math.ceil(rotuloIn.getBoundingClientRect().width) + 56; }
    function definirTexto(t) {
      texto.textContent = t;
      if (botaoEl.dataset.estado === 'pronto' || botaoEl.dataset.estado === 'erro') botaoEl.style.width = larguraDoRotulo() + 'px';
    }
    function definirProgresso(p) {
      var pct = Math.round(p * 100);
      progresso.style.strokeDashoffset = String(100 - pct);
      pctEl.textContent = pct + '%';
    }

    function voltar(textoBotao) {
      estado('pronto');
      botaoEl.removeAttribute('aria-disabled');
      botaoEl.removeAttribute('aria-label');
      definirTexto(textoBotao);
      definirProgresso(0);
    }

    function enviar(arquivo, simulado) {
      clearTimeout(temporizador);
      var limite = o.limiteMB * MB;
      if (!simulado && (!tipoAceito(arquivo, o.tipos) || arquivo.size > limite)) {
        var msg = arquivo.size > limite ? 'Acima de ' + o.limiteMB + ' MB' : 'Tipo não permitido';
        estado('erro');
        definirTexto(msg);
        dica.textContent = arquivo.name + ' — ' + (arquivo.size > limite ? 'acima do limite de ' + o.limiteMB + ' MB (' + formatarTamanho(arquivo.size) + ')' : 'esse tipo de arquivo não é aceito');
        anunciar('Erro: ' + dica.textContent);
        temporizador = setTimeout(function () { voltar(o.rotulo); dica.innerHTML = dicaOriginal; }, 2600);
        return;
      }

      // 1) encolhe até virar círculo
      botaoEl.style.width = botaoEl.getBoundingClientRect().width + 'px';
      void botaoEl.offsetWidth;
      estado('enviando');
      botaoEl.style.width = DIAMETRO + 'px';
      botaoEl.setAttribute('aria-label', 'Enviando ' + arquivo.name + '. Pressione para cancelar.');
      definirProgresso(0);
      dica.textContent = arquivo.name + ' · ' + formatarTamanho(arquivo.size);
      anunciar('Enviando ' + arquivo.name + '.');

      // 2) envia (depois que o morph termina)
      controlador = typeof AbortController === 'function' ? new AbortController() : null;
      var meu = controlador;
      var marcos = {};
      var espera = reduzMovimento.matches ? 0 : 420;
      temporizador = setTimeout(function () {
        if (controlador !== meu) return;
        var opcoesEnvio = {
          sinal: meu ? meu.signal : undefined,
          aoProgresso: function (enviados, total) {
            if (controlador !== meu) return;
            var p = total ? enviados / total : 0;
            definirProgresso(p);
            var pct = Math.round(p * 100);
            [50].forEach(function (m) { if (!marcos[m] && pct >= m) { marcos[m] = true; anunciar(m + '% enviado.'); } });
          }
        };
        var envio = simulado ? simularEnvio(arquivo, opcoesEnvio) : aoEnviar(arquivo, opcoesEnvio);
        Promise.resolve(envio).then(function (resposta) {
          if (controlador !== meu) return;
          controlador = null;
          definirProgresso(1);
          // 3) anel completo → círculo cheio com ✓
          estado('concluido');
          botaoEl.setAttribute('aria-label', arquivo.name + ' enviado');
          anunciar(arquivo.name + ' enviado com sucesso.');
          if (typeof o.aoConcluir === 'function') o.aoConcluir(arquivo, resposta);
          temporizador = setTimeout(function () {
            voltar(o.rotuloDepois);
            dica.innerHTML = '<span class="up-bp-feito">' + ICONES.ok + '</span>';
            dica.appendChild(document.createTextNode(arquivo.name + ' enviado · ' + formatarTamanho(arquivo.size)));
          }, 1700);
        }, function (erro) {
          if (controlador !== meu) return;
          controlador = null;
          var cancelado = erro && erro.name === 'AbortError';
          voltar(cancelado ? o.rotulo : 'Tentar de novo');
          dica.textContent = cancelado ? 'Envio cancelado.' : 'Erro: ' + ((erro && erro.message) || 'falha no envio');
          anunciar(dica.textContent);
        });
      }, espera);
    }

    botaoEl.addEventListener('click', function () {
      var e = botaoEl.dataset.estado;
      if (e === 'enviando') {                       // clicar durante o envio cancela
        var c = controlador;
        controlador = null;
        clearTimeout(temporizador);
        if (c) c.abort();
        voltar(o.rotulo);
        dica.textContent = 'Envio cancelado.';
        anunciar('Envio cancelado.');
        return;
      }
      if (e === 'concluido') return;
      input.click();
    });
    input.addEventListener('change', function () {
      var arquivo = input.files && input.files[0];
      input.value = '';
      if (arquivo) enviar(arquivo, false);
    });
    if (simular) {
      simular.addEventListener('click', function () {
        if (botaoEl.dataset.estado === 'enviando' || botaoEl.dataset.estado === 'concluido') return;
        enviar({ name: o.exemplo.nome, size: o.exemplo.tamanho, type: '' }, true);
      });
    }

    voltar(o.rotulo);
    // Recalcula a largura quando a fonte web terminar de carregar
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (botaoEl.dataset.estado === 'pronto') definirTexto(texto.textContent); });

    return {
      elemento: raiz,
      enviar: function (arquivo) { enviar(arquivo, false); },
      abrirSeletor: function () { input.click(); }
    };
  }

  /* =================================================================
     6. AVATAR COM RECORTE   →   Upload.avatar(elemento, opcoes)
     ================================================================= */

  var PADRAO_AVATAR = {
    limiteMB: 8,
    tamanhoSaida: 512,           // px do quadrado gerado ao salvar
    zoomMax: 3,
    formato: 'image/jpeg',       // ou 'image/png' / 'image/webp'
    qualidade: 0.9,
    imagemInicial: '',           // url da foto atual (opcional)
    zoomInicial: 1,
    aoSalvar: null               // function(blob, info) → Promise opcional (envie o blob ao servidor)
  };

  function avatar(raiz, opcoes) {
    if (!raiz) throw new Error('Upload.avatar: elemento não encontrado');
    var o = Object.assign({}, PADRAO_AVATAR, opcoes || {});
    var id = gerarId('up-av');

    raiz.classList.add('up-kit');
    raiz.innerHTML =
      '<div class="up-av">' +
        '<div class="up-av-palco">' +
          '<div class="up-av-recorte" tabindex="0" role="group" aria-roledescription="área de recorte" aria-label="Enquadramento da foto" aria-describedby="' + id + '-dica">' +
            '<img class="up-av-img" alt="" draggable="false">' +
            '<span class="up-av-vazio" aria-hidden="true">' + ICONES.pessoa + '</span>' +
            '<span class="up-av-guia" aria-hidden="true"></span>' +
          '</div>' +
          '<button class="up-av-camera" type="button" aria-label="Escolher outra foto" title="Escolher foto">' + ICONES.camera + '</button>' +
        '</div>' +
        '<div class="up-av-controles">' +
          '<div class="up-av-zoom">' +
            '<div class="up-av-zoom-topo"><label for="' + id + '-zoom">Zoom</label><output for="' + id + '-zoom" class="up-av-zoom-valor">100%</output></div>' +
            '<div class="up-av-faixa">' +
              '<button class="up-av-passo" type="button" data-passo="-1" aria-label="Diminuir zoom">' + ICONES.menos + '</button>' +
              '<input class="up-faixa" id="' + id + '-zoom" type="range" min="100" max="' + Math.round(o.zoomMax * 100) + '" step="1" value="100">' +
              '<button class="up-av-passo" type="button" data-passo="1" aria-label="Aumentar zoom">' + ICONES.mais + '</button>' +
            '</div>' +
          '</div>' +
          '<p class="up-av-dica" id="' + id + '-dica">Arraste a foto para enquadrar. No teclado: setas movem, + e − dão zoom.</p>' +
          '<div class="up-av-previas" aria-hidden="true">' +
            '<span class="up-av-previa" style="--p:48px"><img alt=""></span>' +
            '<span class="up-av-previa" style="--p:32px"><img alt=""></span>' +
            '<span class="up-av-previa" style="--p:24px"><img alt=""></span>' +
            '<span class="up-av-previa-rotulo">Prévia</span>' +
          '</div>' +
          '<div class="up-av-botoes">' +
            '<button class="up-btn up-btn-sec" type="button" data-acao="trocar">Trocar foto</button>' +
            '<button class="up-btn up-btn-pri" type="button" data-acao="salvar"><span class="up-btn-texto">Salvar foto</span></button>' +
          '</div>' +
          '<p class="up-av-status" aria-live="polite"></p>' +
        '</div>' +
        '<input class="up-oculto" type="file" accept="image/*" tabindex="-1" aria-hidden="true">' +
      '</div>';

    var palco = raiz.querySelector('.up-av-palco');
    var recorte = raiz.querySelector('.up-av-recorte');
    var img = raiz.querySelector('.up-av-img');
    var faixa = raiz.querySelector('.up-faixa');
    var zoomValor = raiz.querySelector('.up-av-zoom-valor');
    var previas = Array.prototype.slice.call(raiz.querySelectorAll('.up-av-previa img'));
    var input = raiz.querySelector('input[type=file]');
    var status = raiz.querySelector('.up-av-status');
    var botaoSalvar = raiz.querySelector('[data-acao=salvar]');
    var textoSalvar = botaoSalvar.querySelector('.up-btn-texto');

    // Estado do recorte: deslocamento em frações do diâmetro (independe do tamanho na tela)
    var zoom = 1, dx = 0, dy = 0;
    var enderecoAtual = '';
    var carregada = false;

    function dimensoes() {
      var S = recorte.clientWidth || 1;
      var nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
      var base = S / Math.min(nw, nh);              // escala que "cobre" o círculo
      return { S: S, nw: nw, nh: nh, escala: base * zoom, dw: nw * base * zoom, dh: nh * base * zoom };
    }

    function limitar() {
      var d = dimensoes();
      var maxX = Math.max(0, (d.dw - d.S) / 2) / d.S;
      var maxY = Math.max(0, (d.dh - d.S) / 2) / d.S;
      dx = Math.min(maxX, Math.max(-maxX, dx));
      dy = Math.min(maxY, Math.max(-maxY, dy));
    }

    function desenhar() {
      if (!carregada) return;
      limitar();
      var d = dimensoes();
      posicionar(img, d, 1);
      previas.forEach(function (p) {
        var tamanho = p.parentNode.getBoundingClientRect().width || 48;
        posicionar(p, d, tamanho / d.S);
      });
      var pct = Math.round(zoom * 100);
      faixa.value = String(pct);
      zoomValor.textContent = pct + '%';
      faixa.style.setProperty('--pct', ((pct - 100) / (o.zoomMax * 100 - 100)) * 100 + '%');
    }

    function posicionar(el, d, k) {
      el.style.width = d.dw * k + 'px';
      el.style.height = d.dh * k + 'px';
      el.style.transform = 'translate(' + ((-d.dw / 2 + dx * d.S) * k) + 'px,' + ((-d.dh / 2 + dy * d.S) * k) + 'px)';
    }

    function definirZoom(novo) {
      var z = Math.min(o.zoomMax, Math.max(1, novo));
      // mantém o ponto central da foto no centro ao dar zoom
      dx = dx * (z / zoom);
      dy = dy * (z / zoom);
      zoom = z;
      desenhar();
    }

    function carregar(endereco, zoomInicial) {
      raiz.classList.add('up-av-carregando');
      img.onload = function () {
        carregada = true;
        raiz.classList.remove('up-av-carregando');
        raiz.classList.add('up-av-com-foto');
        zoom = 1; dx = 0; dy = 0;
        definirZoom(zoomInicial || 1);
      };
      img.onerror = function () {
        raiz.classList.remove('up-av-carregando');
        status.textContent = 'Não foi possível abrir essa imagem.';
      };
      img.src = endereco;
      previas.forEach(function (p) { p.src = endereco; });
    }

    function carregarArquivo(arquivo) {
      if (!arquivo) return;
      if (!/^image\//.test(arquivo.type || '')) { mostrarStatus('Escolha um arquivo de imagem (JPG, PNG ou WebP).', true); return; }
      if (arquivo.size > o.limiteMB * MB) { mostrarStatus('A foto passa de ' + o.limiteMB + ' MB (' + formatarTamanho(arquivo.size) + ').', true); return; }
      var anterior = enderecoAtual;
      enderecoAtual = criarEndereco(arquivo);
      carregar(enderecoAtual, 1);
      setTimeout(function () { liberarEndereco(anterior); }, 1000);
      mostrarStatus('Foto carregada. Ajuste o enquadramento e salve.');
    }

    function mostrarStatus(texto, erro) {
      status.textContent = texto;
      status.classList.toggle('up-erro', !!erro);
    }

    /* ---------- Arrastar a foto dentro do círculo ---------- */
    var arraste = null;
    recorte.addEventListener('pointerdown', function (ev) {
      if (!carregada || ev.button !== 0) return;
      arraste = { x: ev.clientX, y: ev.clientY, dx: dx, dy: dy, id: ev.pointerId };
      recorte.setPointerCapture(ev.pointerId);
      recorte.classList.add('up-movendo');
      ev.preventDefault();
    });
    recorte.addEventListener('pointermove', function (ev) {
      if (!arraste || ev.pointerId !== arraste.id) return;
      var S = recorte.clientWidth || 1;
      dx = arraste.dx + (ev.clientX - arraste.x) / S;
      dy = arraste.dy + (ev.clientY - arraste.y) / S;
      desenhar();
    });
    function soltar(ev) {
      if (!arraste || (ev && ev.pointerId !== arraste.id)) return;
      arraste = null;
      recorte.classList.remove('up-movendo');
    }
    recorte.addEventListener('pointerup', soltar);
    recorte.addEventListener('pointercancel', soltar);

    // Roda do mouse / trackpad = zoom
    recorte.addEventListener('wheel', function (ev) {
      if (!carregada) return;
      ev.preventDefault();
      definirZoom(zoom * (ev.deltaY < 0 ? 1.06 : 1 / 1.06));
    }, { passive: false });

    // Teclado
    recorte.addEventListener('keydown', function (ev) {
      if (!carregada) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); input.click(); }
        return;
      }
      var passo = (ev.shiftKey ? 24 : 6) / (recorte.clientWidth || 1);
      var tratado = true;
      switch (ev.key) {
        case 'ArrowLeft': dx -= passo; break;
        case 'ArrowRight': dx += passo; break;
        case 'ArrowUp': dy -= passo; break;
        case 'ArrowDown': dy += passo; break;
        case '+': case '=': definirZoom(zoom + 0.1); break;
        case '-': case '_': definirZoom(zoom - 0.1); break;
        case 'Enter': case ' ': input.click(); break;
        default: tratado = false;
      }
      if (tratado) { ev.preventDefault(); desenhar(); }
    });

    faixa.addEventListener('input', function () { definirZoom(parseInt(faixa.value, 10) / 100); });
    Array.prototype.forEach.call(raiz.querySelectorAll('.up-av-passo'), function (b) {
      b.addEventListener('click', function () { definirZoom(zoom + 0.1 * parseInt(b.dataset.passo, 10)); });
    });

    /* ---------- Escolher / soltar uma foto ---------- */
    raiz.querySelector('.up-av-camera').addEventListener('click', function () { input.click(); });
    raiz.querySelector('[data-acao=trocar]').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var arquivo = input.files && input.files[0];
      input.value = '';
      carregarArquivo(arquivo);
    });
    palco.addEventListener('dragover', function (ev) {
      if (ev.dataTransfer && Array.prototype.indexOf.call(ev.dataTransfer.types || [], 'Files') !== -1) {
        ev.preventDefault();
        palco.classList.add('up-arrastando');
      }
    });
    palco.addEventListener('dragleave', function (ev) {
      if (!palco.contains(ev.relatedTarget)) palco.classList.remove('up-arrastando');
    });
    palco.addEventListener('drop', function (ev) {
      palco.classList.remove('up-arrastando');
      if (!ev.dataTransfer || !ev.dataTransfer.files.length) return;
      ev.preventDefault();
      carregarArquivo(ev.dataTransfer.files[0]);
    });

    /* ---------- Salvar: gera o recorte quadrado em <canvas> ---------- */
    function gerarRecorte() {
      return new Promise(function (resolver, rejeitar) {
        try {
          var d = dimensoes();
          var N = o.tamanhoSaida;
          var tela = document.createElement('canvas');
          tela.width = N;
          tela.height = N;
          var ctx = tela.getContext('2d');
          // canto superior esquerdo do círculo, em pixels da imagem original
          var sx = (d.dw / 2 - dx * d.S - d.S / 2) / d.escala;
          var sy = (d.dh / 2 - dy * d.S - d.S / 2) / d.escala;
          var lado = d.S / d.escala;
          ctx.imageSmoothingQuality = 'high';
          if (o.formato === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, N, N); }
          ctx.drawImage(img, sx, sy, lado, lado, 0, 0, N, N);
          tela.toBlob(function (blob) {
            if (blob) resolver(blob); else rejeitar(new Error('Falha ao gerar a imagem'));
          }, o.formato, o.qualidade);
        } catch (erro) {
          rejeitar(erro);
        }
      });
    }

    botaoSalvar.addEventListener('click', function () {
      if (!carregada || botaoSalvar.getAttribute('aria-disabled') === 'true') {
        if (!carregada) input.click();
        return;
      }
      botaoSalvar.setAttribute('aria-disabled', 'true');
      botaoSalvar.classList.add('up-ocupado');
      textoSalvar.textContent = 'Salvando…';
      mostrarStatus('Salvando a foto…');
      gerarRecorte().then(function (blob) {
        var info = { largura: o.tamanhoSaida, altura: o.tamanhoSaida, tamanho: blob.size, tipo: blob.type, zoom: zoom };
        return Promise.resolve(typeof o.aoSalvar === 'function' ? o.aoSalvar(blob, info) : null).then(function () {
          mostrarStatus('Foto salva · ' + o.tamanhoSaida + '×' + o.tamanhoSaida + ' px · ' + formatarTamanho(blob.size));
          textoSalvar.textContent = 'Salva';
          botaoSalvar.classList.add('up-salvo');
        });
      }).catch(function (erro) {
        mostrarStatus('Não foi possível salvar: ' + ((erro && erro.message) || 'erro desconhecido') + '.', true);
        textoSalvar.textContent = 'Salvar foto';
      }).then(function () {
        botaoSalvar.removeAttribute('aria-disabled');
        botaoSalvar.classList.remove('up-ocupado');
        setTimeout(function () {
          botaoSalvar.classList.remove('up-salvo');
          if (textoSalvar.textContent === 'Salva') textoSalvar.textContent = 'Salvar foto';
        }, 2200);
      });
    });

    global.addEventListener('resize', desenhar);
    if (o.imagemInicial) carregar(o.imagemInicial, o.zoomInicial);

    return {
      elemento: raiz,
      carregarArquivo: carregarArquivo,
      carregar: function (endereco, z) { carregar(endereco, z); },
      gerarRecorte: gerarRecorte,
      abrirSeletor: function () { input.click(); }
    };
  }

  /* =================================================================
     API pública
     ================================================================= */
  var Upload = {
    criar: criar,
    botao: botao,
    avatar: avatar,
    enviarArquivo: enviarArquivo,
    simularEnvio: simularEnvio,
    simulacao: simulacao,
    formatarTamanho: formatarTamanho,
    tipoDoArquivo: tipoDoArquivo
  };
  global.Upload = Upload;
})(window);


/* =====================================================================
   DEMONSTRAÇÃO — monta as três variações da página.
   No seu projeto, apague daqui para baixo e chame Upload.criar/botao/avatar
   com as suas opções.
   ===================================================================== */
(function () {
  'use strict';

  var MB = 1024 * 1024;
  var TIPOS = ['image/*', '.pdf', '.xlsx', '.xls', '.csv', 'video/mp4', '.zip'];

  /* ---------- 1. Zona de soltar ---------- */
  var zona = Upload.criar(document.getElementById('up-demo-zona'), {
    limiteMB: 10,
    tipos: TIPOS,
    textoTipos: 'JPG, PNG, PDF, XLSX, MP4 ou ZIP'
  });

  // Três linhas de exemplo para a página já abrir "viva" (sem arquivos reais)
  zona.adicionarExemplo({ nome: 'fachada-da-loja.jpg', tamanho: 2.4 * MB, estado: 'concluido', miniatura: miniaturaExemplo(), atraso: 500 });
  zona.adicionarExemplo({ nome: 'proposta-comercial-2026.pdf', tamanho: 3.8 * MB, estado: 'enviando', progresso: 0.62, velocidade: 1.1 * MB, retomarEm: 5000, atraso: 600 });
  zona.adicionarExemplo({ nome: 'video-institucional.mp4', tamanho: 18.6 * MB, estado: 'invalido', mensagem: 'Acima do limite de 10 MB', atraso: 700 });

  /* ---------- 2. Botão com progresso ---------- */
  Upload.botao(document.getElementById('up-demo-botao'), {
    limiteMB: 10,
    tipos: TIPOS,
    textoTipos: 'Imagem, PDF ou planilha',
    exemplo: { nome: 'contrato-assinado.pdf', tamanho: 4.2 * MB }
  });

  /* ---------- 3. Avatar ---------- */
  var perfilFoto = document.getElementById('up-perfil-foto');
  Upload.avatar(document.getElementById('up-demo-avatar'), {
    imagemInicial: 'img/retrato.jpg',   // foto atual do usuário (troque pela sua)
    zoomInicial: 1.18,
    aoSalvar: function (blob) {
      // Aqui você enviaria o blob ao servidor. Na demo: espera um pouco e
      // atualiza o cartão de perfil com a foto recortada.
      return new Promise(function (resolver) {
        setTimeout(function () {
          if (perfilFoto) {
            var antigo = perfilFoto.dataset.endereco;
            var novo = window.URL.createObjectURL.call(window.URL, blob);
            perfilFoto.src = novo;
            perfilFoto.dataset.endereco = novo;
            if (antigo) window.URL.revokeObjectURL.call(window.URL, antigo);
            perfilFoto.classList.remove('up-trocou');
            void perfilFoto.offsetWidth;
            perfilFoto.classList.add('up-trocou');
          }
          resolver();
        }, 700);
      });
    }
  });
  if (perfilFoto) perfilFoto.src = 'img/retrato.jpg';

  /* ---------- Miniatura gerada em <canvas> (nada vem da internet) ---------- */

  /** Converte um <canvas> em data: (endereço local, sem rede). */
  function paraDados(canvas, tipo, qualidade) { return canvas.toDataURL.call(canvas, tipo, qualidade); }

  /** Miniatura "foto da fachada" para o arquivo de exemplo concluído. */
  function miniaturaExemplo() {
    var c = document.createElement('canvas');
    c.width = c.height = 96;
    var g = c.getContext('2d');
    var ceu = g.createLinearGradient(0, 0, 0, 96);
    ceu.addColorStop(0, '#ffb879');
    ceu.addColorStop(1, '#f06f8b');
    g.fillStyle = ceu;
    g.fillRect(0, 0, 96, 96);
    g.fillStyle = 'rgba(255,240,200,.9)';
    g.beginPath(); g.arc(70, 28, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2b2440';
    g.fillRect(14, 40, 46, 56);
    g.fillRect(56, 56, 30, 40);
    g.fillStyle = '#2ee6a6';
    g.fillRect(22, 76, 30, 20);
    g.fillStyle = '#ffd89a';
    [[20, 48], [32, 48], [44, 48], [20, 60], [32, 60], [44, 60], [62, 64], [74, 64]].forEach(function (p) { g.fillRect(p[0], p[1], 7, 6); });
    return paraDados(c, 'image/png');
  }
})();
