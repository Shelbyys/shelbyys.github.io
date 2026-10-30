/* ==========================================================================
   Verificação OTP — script.js
   Parte 1: CampoOTP, uma mini-biblioteca reutilizável (sem dependências).
   Parte 2: a demonstração dos 8 estilos.
   ========================================================================== */

/* --------------------------------------------------------------------------
   PARTE 1 · CampoOTP
   Uso básico:
     const campo = CampoOTP.criar(document.querySelector('#meu-campo'), {
       tamanho: 6,
       aoCompletar(codigo, campo) { ... }
     });

   Opções principais:
     tamanho      quantas casas (padrão 6)
     alfabeto     'numerico' (padrão) ou 'alfanumerico' (A–Z e 0–9, em maiúsculas)
     campoUnico   true = UM <input> só por trás das casas (melhor preenchimento
                  automático do SMS); false = um <input> por casa (padrão)
     semTeclado   true = não abre o teclado do celular (para teclados na tela)

   Tentativas e bloqueio (estado "sem acesso"):
     maxTentativas  erros seguidos até travar o campo (padrão 3; 0 = sem limite)
     tempoBloqueio  segundos que o campo fica travado (padrão 30)
     tempoLiberar   ms da animação de liberação antes de voltar ao normal (padrão 900)
     aoBloquear(segundos, campo)  quando trava (mostre a mensagem e o tempo)
     aoContagem(restam, campo)    a cada segundo do bloqueio (atualize a contagem)
     aoLiberar(campo)             quando o tempo acaba e o campo volta, limpo
   Ligue ao backend: se a API responder 429 (rate limit), chame
     campo.bloquear(Number(resposta.headers.get('Retry-After')) || 30)
   — o servidor manda no tempo; o contador local é só a primeira barreira.

   Métodos: campo.valor, campo.definir('123456'), campo.limpar(), campo.focar(i),
            campo.escrever('7'), campo.apagar(),
            campo.estado('verificando' | 'erro' | 'sucesso' | 'bloqueado' | 'liberado' | ''),
            campo.erro(), campo.sucesso(), campo.bloquear(segundos), campo.liberar(),
            campo.zerarTentativas(), campo.habilitar(true/false), campo.destruir()
   Leitura: campo.travado, campo.bloqueado, campo.tentativas, campo.restantes,
            campo.restaBloqueio (segundos)
   Eventos no elemento raiz: "otp:mudou" e "otp:completo" (detail.codigo),
   "otp:bloqueado" (detail.segundos) e "otp:liberado".
   Utilitário: CampoOTP.tempo(75) → "1:15" (formato da contagem).
   Se o campo estiver dentro de um .otp-cartao, o cartão recebe data-estado
   igual ao do campo (é dele que o CSS de cada estilo tira as animações).
   -------------------------------------------------------------------------- */
const CampoOTP = (function () {
  'use strict';

  /* Alfabetos aceitos. Para aceitar outro conjunto, acrescente aqui. */
  const ALFABETOS = {
    numerico: { fora: /[^0-9]/g, teclado: 'numeric', padrao: '[0-9]*', maiusculas: false },
    alfanumerico: { fora: /[^0-9A-Za-z]/g, teclado: 'text', padrao: '[0-9A-Za-z]*', maiusculas: true },
  };

  const PADRAO = {
    tamanho: 6,
    alfabeto: 'numerico',
    campoUnico: false,
    semTeclado: false,
    rotulo: 'Código de verificação', // usado quando não há rotuloId
    rotuloId: null,                   // id de um elemento que rotula o grupo
    descricaoId: null,                // id de um texto de apoio (aria-describedby)
    tempoErro: 900,                   // ms até limpar depois de um erro
    limparNoErro: true,
    maxTentativas: 3,                 // erros seguidos até bloquear (0 = nunca bloqueia)
    tempoBloqueio: 30,                // segundos de bloqueio
    tempoLiberar: 900,                // ms do estado "liberado" (animação de saída do bloqueio)
    aoCriarSlot: null,                // (slot, indice) => adicionar decoração própria
    aoMudar: null,                    // (codigo, { indice, valores, campo })
    aoCompletar: null,                // (codigo, campo)
    aoBloquear: null,                 // (segundos, campo)
    aoContagem: null,                 // (restam, campo) — uma vez por segundo
    aoLiberar: null,                  // (campo)
  };

  /* Estados visuais aceitos por campo.estado(). */
  const ESTADOS = ['verificando', 'erro', 'sucesso', 'bloqueado', 'liberado'];

  /** 75 → "1:15" (formato da contagem regressiva). */
  function tempo(segundos) {
    const s = Math.max(0, Math.ceil(segundos));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function criar(alvo, opcoes) {
    if (!alvo) throw new Error('CampoOTP.criar: elemento não encontrado.');
    const op = Object.assign({}, PADRAO, opcoes);
    const alf = ALFABETOS[op.alfabeto] || ALFABETOS.numerico;
    const n = op.tamanho;
    const valores = new Array(n).fill('');
    let ultimoCompleto = '';
    let tempoErro = 0;          // timer do erro (limpar) e do "liberado" (voltar ao normal)
    let tentativas = 0;         // erros seguidos desde o último acerto/reenvio/liberação
    let timerBloqueio = 0;
    let fimBloqueio = 0;        // Date.now() em que o bloqueio acaba
    let restaBloqueio = 0;      // segundos que faltam (para a contagem)

    /** Deixa só os caracteres aceitos pelo alfabeto escolhido. */
    const limparTexto = (t) => {
      const s = String(t == null ? '' : t).replace(alf.fora, '');
      return alf.maiusculas ? s.toUpperCase() : s;
    };

    // ---------- Estrutura ----------
    const raiz = document.createElement('div');
    raiz.className = 'otp-campo' + (op.campoUnico ? ' otp-campo--unico' : '');
    raiz.setAttribute('role', 'group');
    raiz.style.setProperty('--otp-tamanho', n);
    if (op.rotuloId) raiz.setAttribute('aria-labelledby', op.rotuloId);
    else raiz.setAttribute('aria-label', op.rotulo);
    if (op.descricaoId) raiz.setAttribute('aria-describedby', op.descricaoId);

    const slots = [];
    const entradas = [];
    const glifos = [];

    /** Configura o que é comum a qualquer <input> do campo. */
    function prepararEntrada(entrada, rotulo, auto) {
      entrada.type = 'text';
      entrada.inputMode = op.semTeclado ? 'none' : alf.teclado;
      entrada.pattern = alf.padrao;
      entrada.autocomplete = auto;
      entrada.spellcheck = false;
      entrada.readOnly = !!op.semTeclado;   // bloqueia o teclado do sistema
      entrada.setAttribute('autocapitalize', alf.maiusculas ? 'characters' : 'off');
      entrada.setAttribute('aria-label', rotulo);
    }

    if (op.campoUnico) {
      /* ---- Modo campo único: um <input> transparente cobrindo as casas ---- */
      const entrada = document.createElement('input');
      entrada.className = 'otp-unico__entrada';
      entrada.maxLength = n;
      prepararEntrada(entrada, op.rotulo + ` de ${n} caracteres`, 'one-time-code');
      raiz.appendChild(entrada);
      entradas.push(entrada);

      for (let i = 0; i < n; i++) {
        const slot = document.createElement('div');
        slot.className = 'otp-slot';
        slot.style.setProperty('--otp-i', i);
        const glifo = document.createElement('span');
        glifo.className = 'otp-slot__glifo';
        glifo.setAttribute('aria-hidden', 'true');
        if (typeof op.aoCriarSlot === 'function') op.aoCriarSlot(slot, i);
        slot.appendChild(glifo);
        raiz.appendChild(slot);
        slots.push(slot);
        glifos.push(glifo);
      }
    } else {
      /* ---- Modo clássico: um <input> por casa ---- */
      for (let i = 0; i < n; i++) {
        const slot = document.createElement('div');
        slot.className = 'otp-slot';
        slot.style.setProperty('--otp-i', i);

        const entrada = document.createElement('input');
        entrada.className = 'otp-slot__entrada';
        prepararEntrada(entrada, `Caractere ${i + 1} de ${n}`, i === 0 ? 'one-time-code' : 'off');

        if (typeof op.aoCriarSlot === 'function') op.aoCriarSlot(slot, i);
        slot.appendChild(entrada);
        raiz.appendChild(slot);
        slots.push(slot);
        entradas.push(entrada);
      }
    }
    alvo.appendChild(raiz);

    // ---------- Estado interno ----------
    const codigo = () => valores.join('');
    const preenchidos = () => { const i = valores.indexOf(''); return i === -1 ? n : i; };

    function render(indiceMudou) {
      if (op.campoUnico) {
        const atual = codigo();
        if (entradas[0].value !== atual) entradas[0].value = atual;
        raiz.style.setProperty('--otp-ativo', Math.min(preenchidos(), n - 1));
      }
      for (let i = 0; i < n; i++) {
        if (!op.campoUnico && entradas[i].value !== valores[i]) entradas[i].value = valores[i];
        if (op.campoUnico) glifos[i].textContent = valores[i];
        slots[i].classList.toggle('otp-slot--cheio', valores[i] !== '');
        slots[i].dataset.valor = valores[i];
      }
      if (op.campoUnico) marcarAtivo();
      const atual = codigo();
      if (typeof op.aoMudar === 'function') op.aoMudar(atual, { indice: indiceMudou, valores: valores.slice(), campo: api });
      raiz.dispatchEvent(new CustomEvent('otp:mudou', { detail: { codigo: atual } }));
      if (atual.length === n && atual !== ultimoCompleto) {
        ultimoCompleto = atual;
        if (typeof op.aoCompletar === 'function') op.aoCompletar(atual, api);
        raiz.dispatchEvent(new CustomEvent('otp:completo', { detail: { codigo: atual } }));
      }
      if (atual.length < n) ultimoCompleto = '';
    }

    /** No campo único, a casa "ativa" é a próxima a ser preenchida. */
    function marcarAtivo() {
      const focado = raiz.classList.contains('otp-campo--focado');
      const ativo = Math.min(preenchidos(), n - 1);
      slots.forEach((s, i) => s.classList.toggle('otp-slot--ativo', focado && i === ativo));
    }

    function focar(i) {
      if (op.campoUnico) {
        const fim = codigo().length;
        entradas[0].focus();
        try { entradas[0].setSelectionRange(fim, fim); } catch (e) { /* alguns navegadores */ }
        return;
      }
      const alvoI = Math.max(0, Math.min(n - 1, i));
      entradas[alvoI].focus();
      // Seleciona o conteúdo para que digitar substitua o caractere
      entradas[alvoI].select();
    }

    const primeiroVazio = () => { const i = valores.indexOf(''); return i === -1 ? n - 1 : i; };

    /** Espalha vários caracteres a partir de uma posição (colar / preenchimento automático). */
    function distribuir(chars, inicio) {
      let i = inicio;
      for (const c of chars) {
        if (i >= n) break;
        valores[i] = c;
        i++;
      }
      render(inicio);
      focar(Math.min(i, n - 1));
    }

    // ---------- Eventos ----------
    if (op.campoUnico) {
      const entrada = entradas[0];
      const fimDoTexto = () => {
        const fim = codigo().length;
        try { entrada.setSelectionRange(fim, fim); } catch (e) { /* ignora */ }
      };
      entrada.addEventListener('focus', () => {
        raiz.classList.add('otp-campo--focado');
        marcarAtivo();
        requestAnimationFrame(fimDoTexto);
      });
      entrada.addEventListener('blur', () => {
        raiz.classList.remove('otp-campo--focado');
        marcarAtivo();
      });
      // O cursor fica sempre no fim: o código é preenchido em ordem
      entrada.addEventListener('pointerup', fimDoTexto);
      entrada.addEventListener('select', fimDoTexto);
      entrada.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') {
          e.preventDefault();
          return;
        }
        if (e.key.length === 1 && limparTexto(e.key) === '') e.preventDefault();
      });
      entrada.addEventListener('input', () => {
        const chars = limparTexto(entrada.value).slice(0, n);
        for (let i = 0; i < n; i++) valores[i] = chars[i] || '';
        render(Math.max(0, chars.length - 1));
        fimDoTexto();
      });
      entrada.addEventListener('paste', (e) => {
        e.preventDefault();
        const texto = (e.clipboardData || window.clipboardData).getData('text');
        const chars = limparTexto(texto).slice(0, n);
        if (!chars) return;
        for (let i = 0; i < n; i++) valores[i] = chars[i] || '';
        render(0);
        fimDoTexto();
      });
    } else {
      entradas.forEach((entrada, i) => {
        entrada.addEventListener('focus', () => {
          slots[i].classList.add('otp-slot--ativo');
          requestAnimationFrame(() => entrada.select());
        });
        entrada.addEventListener('blur', () => slots[i].classList.remove('otp-slot--ativo'));
        // Clique numa caixa depois de vazias leva ao primeiro espaço livre
        entrada.addEventListener('mousedown', (e) => {
          const livre = primeiroVazio();
          if (valores[i] === '' && i > livre) { e.preventDefault(); focar(livre); }
        });

        entrada.addEventListener('keydown', (e) => {
          if (e.ctrlKey || e.metaKey || e.altKey) return; // deixa Ctrl+V, Cmd+A etc.
          switch (e.key) {
            case 'Backspace':
              e.preventDefault();
              if (valores[i]) { valores[i] = ''; render(i); }
              else if (i > 0) { valores[i - 1] = ''; render(i - 1); focar(i - 1); }
              return;
            case 'Delete':
              e.preventDefault();
              valores[i] = '';
              render(i);
              return;
            case 'ArrowLeft': e.preventDefault(); focar(i - 1); return;
            case 'ArrowRight': e.preventDefault(); focar(i + 1); return;
            case 'Home': e.preventDefault(); focar(0); return;
            case 'End': e.preventDefault(); focar(primeiroVazio()); return;
            default: {
              if (e.key.length !== 1) return;
              const c = limparTexto(e.key);
              // Bloqueia o que não pertence ao alfabeto
              if (!c) { e.preventDefault(); return; }
              // Com o teclado do sistema bloqueado (semTeclado) o evento "input"
              // não acontece: escrevemos o caractere aqui.
              if (op.semTeclado) {
                e.preventDefault();
                valores[i] = c;
                render(i);
                if (i < n - 1) focar(i + 1);
                return;
              }
              // Digitar o mesmo caractere que já está na caixa: apenas avança
              if (valores[i] === c) { e.preventDefault(); if (i < n - 1) focar(i + 1); }
            }
          }
        });

        entrada.addEventListener('input', (e) => {
          const chars = limparTexto(entrada.value);
          if (!chars) {
            // Teclados móveis podem apagar sem disparar keydown "Backspace"
            if (e.inputType && e.inputType.indexOf('delete') === 0) valores[i] = '';
            render(i);
            return;
          }
          if (chars.length > 1) {
            // Autopreenchimento do SMS (one-time-code) ou colagem: código inteiro
            if (chars.length >= n) { distribuir(chars.slice(0, n), 0); return; }
            // Digitou por cima: fica o último caractere
            valores[i] = chars[chars.length - 1];
            render(i);
            if (i < n - 1) focar(i + 1);
            return;
          }
          valores[i] = chars;
          render(i);
          if (i < n - 1) focar(i + 1);
        });

        entrada.addEventListener('paste', (e) => {
          e.preventDefault();
          const texto = (e.clipboardData || window.clipboardData).getData('text');
          const chars = limparTexto(texto);
          if (!chars) return;
          distribuir(chars.slice(0, n), chars.length >= n ? 0 : i);
        });
      });
    }

    // ---------- Bloqueio (sem acesso) ----------
    /** Esvazia as casas sem mexer no foco (o campo pode estar desabilitado). */
    function esvaziar() {
      valores.fill('');
      ultimoCompleto = '';
      render(0);
    }

    function pararBloqueio() {
      clearInterval(timerBloqueio);
      timerBloqueio = 0;
      restaBloqueio = 0;
    }

    /** Confere o relógio 4× por segundo e avisa quando o segundo muda. */
    function conferirBloqueio() {
      const resta = Math.max(0, Math.ceil((fimBloqueio - Date.now()) / 1000));
      if (resta <= 0) { api.liberar(); return; }
      if (resta === restaBloqueio) return;
      restaBloqueio = resta;
      if (typeof op.aoContagem === 'function') op.aoContagem(resta, api);
    }

    // ---------- API pública ----------
    const api = {
      elemento: raiz,
      entradas,
      slots,
      get valor() { return codigo(); },
      definir(texto) {
        if (api.bloqueado) return api;
        const d = limparTexto(texto).slice(0, n);
        for (let i = 0; i < n; i++) valores[i] = d[i] || '';
        render(0);
        return api;
      },
      /** Escreve um caractere na primeira casa livre (usado por teclados na tela). */
      escrever(c) {
        if (api.bloqueado) return api;          // bloqueado: o teclado na tela não escreve
        const ch = limparTexto(c).slice(0, 1);
        if (!ch) return api;
        const i = valores.indexOf('');
        if (i === -1) return api;
        valores[i] = ch;
        render(i);
        return api;
      },
      /** Apaga o último caractere escrito. */
      apagar() {
        if (api.bloqueado) return api;
        const i = preenchidos() - 1;
        if (i < 0) return api;
        valores[i] = '';
        render(i);
        return api;
      },
      limpar(focarDepois) {
        valores.fill('');
        ultimoCompleto = '';
        render(0);
        if (focarDepois !== false) focar(0);
        return api;
      },
      focar(i) { focar(i == null ? primeiroVazio() : i); return api; },
      /** '' | 'verificando' | 'erro' | 'sucesso' | 'bloqueado' | 'liberado'
          — vira a classe .otp-campo--<estado> e o data-estado do cartão. */
      estado(nome) {
        clearTimeout(tempoErro);
        if (nome !== 'bloqueado') pararBloqueio();
        ESTADOS.forEach((e) => raiz.classList.remove('otp-campo--' + e));
        if (nome) { void raiz.offsetWidth; raiz.classList.add('otp-campo--' + nome); }
        raiz.dataset.estado = nome || '';
        const cartao = raiz.closest('.otp-cartao');
        if (cartao) cartao.dataset.estado = nome || '';
        // Trava as caixas enquanto verifica, no sucesso, no bloqueio e no erro que vai se limpar sozinho
        const travar = nome === 'verificando' || nome === 'sucesso' || nome === 'bloqueado' || (nome === 'erro' && op.limparNoErro);
        entradas.forEach((el) => { el.disabled = travar; });
        if (travar) {
          // Input desabilitado nem sempre dispara "blur": apaga o realce/cursor à mão
          slots.forEach((s) => s.classList.remove('otp-slot--ativo'));
          raiz.classList.remove('otp-campo--focado');
        }
        if (nome === 'erro') raiz.setAttribute('aria-invalid', 'true');
        else raiz.removeAttribute('aria-invalid');
        if (nome === 'bloqueado') raiz.setAttribute('aria-disabled', 'true');
        else raiz.removeAttribute('aria-disabled');
        return api;
      },
      /** true quando o campo está travado (verificando, sucesso, erro ou bloqueado). */
      get travado() { return !!entradas[0].disabled; },
      /** true durante o bloqueio por excesso de tentativas (ou um 429 do servidor). */
      get bloqueado() { return raiz.dataset.estado === 'bloqueado'; },
      /** Erros seguidos desde o último acerto, reenvio ou liberação. */
      get tentativas() { return tentativas; },
      /** Tentativas que ainda restam antes do bloqueio (Infinity se maxTentativas = 0). */
      get restantes() { return op.maxTentativas > 0 ? Math.max(0, op.maxTentativas - tentativas) : Infinity; },
      /** Segundos que faltam para liberar (0 fora do bloqueio). */
      get restaBloqueio() { return api.bloqueado ? restaBloqueio : 0; },
      /** Marca o código como errado. Na última tentativa permitida, bloqueia em vez de tremer. */
      erro() {
        if (api.bloqueado) return api;
        tentativas += 1;
        if (op.maxTentativas > 0 && tentativas >= op.maxTentativas) return api.bloquear(op.tempoBloqueio);
        api.estado('erro');
        if (op.limparNoErro) {
          tempoErro = setTimeout(() => { api.estado(''); api.limpar(); }, op.tempoErro);
        }
        return api;
      },
      sucesso() { tentativas = 0; api.estado('sucesso'); return api; },
      zerarTentativas() { tentativas = 0; return api; },
      /** Trava o campo por N segundos (padrão: tempoBloqueio), com contagem e liberação automática. */
      bloquear(segundos) {
        const s = Math.max(1, Math.round(Number(segundos) || op.tempoBloqueio));
        api.estado('bloqueado');
        esvaziar();
        restaBloqueio = s;
        fimBloqueio = Date.now() + s * 1000;
        clearInterval(timerBloqueio);
        timerBloqueio = setInterval(conferirBloqueio, 250);
        if (typeof op.aoBloquear === 'function') op.aoBloquear(s, api);
        raiz.dispatchEvent(new CustomEvent('otp:bloqueado', { detail: { segundos: s } }));
        return api;
      },
      /** Encerra o bloqueio já (o tempo acabou ou o suporte liberou): campo limpo e focável. */
      liberar() {
        const estava = api.bloqueado;
        pararBloqueio();
        tentativas = 0;
        if (!estava) return api;
        api.estado('liberado');
        esvaziar();
        if (typeof op.aoLiberar === 'function') op.aoLiberar(api);
        raiz.dispatchEvent(new CustomEvent('otp:liberado'));
        // "liberado" só dura a animação; depois o campo volta ao estado normal
        tempoErro = setTimeout(() => { if (raiz.dataset.estado === 'liberado') api.estado(''); }, op.tempoLiberar);
        return api;
      },
      habilitar(sim) { entradas.forEach((el) => { el.disabled = !sim; }); return api; },
      destruir() { clearTimeout(tempoErro); pararBloqueio(); raiz.remove(); },
    };

    render(0);
    return api;
  }

  /* Botão "Reenviar código" com contagem regressiva.
     CampoOTP.reenvio(botao, { segundos: 30, aoReenviar() { ... } }) */
  function reenvio(botao, opcoes) {
    const op = Object.assign({ segundos: 30, texto: 'Reenviar código', aoReenviar: null, iniciar: true }, opcoes);
    const CIRC = 37.7; // circunferência do anel (r = 6)
    let resta = 0;
    let timer = 0;

    function desenhar() {
      if (resta > 0) {
        botao.disabled = true;
        const m = Math.floor(resta / 60);
        const s = String(resta % 60).padStart(2, '0');
        botao.innerHTML =
          `<svg class="otp-reenviar__anel" viewBox="0 0 16 16" aria-hidden="true"><circle class="otp-anel-fundo" cx="8" cy="8" r="6"/>` +
          `<circle class="otp-anel-barra" cx="8" cy="8" r="6" style="stroke-dashoffset:${(CIRC * (1 - resta / op.segundos)).toFixed(2)}"/></svg>` +
          `<span>Reenviar em <span class="otp-reenviar__tempo">${m}:${s}</span></span>`;
        botao.setAttribute('aria-label', `Reenviar código disponível em ${resta} segundos`);
      } else {
        botao.disabled = false;
        botao.textContent = op.texto;
        botao.removeAttribute('aria-label');
      }
    }

    function iniciar() {
      clearInterval(timer);
      resta = op.segundos;
      desenhar();
      timer = setInterval(() => {
        resta -= 1;
        desenhar();
        if (resta <= 0) clearInterval(timer);
      }, 1000);
    }

    botao.addEventListener('click', () => {
      if (resta > 0) return;
      if (typeof op.aoReenviar === 'function') op.aoReenviar();
      iniciar();
    });

    if (op.iniciar) iniciar(); else desenhar();
    return { iniciar, parar() { clearInterval(timer); resta = 0; desenhar(); } };
  }

  return { criar, reenvio, tempo };
})();


/* --------------------------------------------------------------------------
   PARTE 2 · Demonstração
   Cada estilo tem três momentos próprios: aprovado (sucesso), recusado (erro)
   e sem acesso (bloqueado → liberado). O que dá para fazer só com CSS está no
   estilo.css (procure por data-estado); aqui ficam as coreografias que mexem
   no conteúdo: as placas do Letreiro, o log do Terminal e o Teclado seguro.
   -------------------------------------------------------------------------- */
(function () {
  'use strict';

  const CODIGO_DEMO = '123456';                  // código que dá sucesso nesta demo
  const CODIGOS = { terminal: 'AXY42K' };        // estilos com código próprio
  const ATRASO_VERIFICACAO = 700;                // simula a ida ao servidor
  const MAX_TENTATIVAS = 3;                      // erros seguidos até bloquear

  /* Tempos em segundos. Para testar sem esperar, abra index.html?bloqueio=5&reenvio=5
     (só muda nesta aba; o padrão do produto continua 30 s). */
  const parametros = new URLSearchParams(window.location.search);
  const lerSegundos = (nome, padrao) => {
    const v = Math.round(Number(parametros.get(nome)));
    return v >= 1 && v <= 3600 ? v : padrao;
  };
  const TEMPO_BLOQUEIO = lerSegundos('bloqueio', 30);
  const TEMPO_REENVIO = lerSegundos('reenvio', 30);

  const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, raiz) => (raiz || document).querySelector(sel);
  const $$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));
  /** Agenda uma etapa da animação; com movimento reduzido, roda na hora. */
  const depois = (ms, fn) => setTimeout(fn, semMovimento ? 0 : ms);

  /* ================= Decorações de cada estilo ================= */

  /* ---------- Cofre: fita de 0–9 repetida 4 vezes (para girar) ---------- */
  const VOLTAS = 4;
  function criarRolo(slot) {
    const rolo = document.createElement('span');
    rolo.className = 'otp-rolo';
    rolo.setAttribute('aria-hidden', 'true');
    let html = '';
    for (let v = 0; v < VOLTAS; v++) for (let d = 0; d < 10; d++) html += `<span>${d}</span>`;
    rolo.innerHTML = `<span class="otp-rolo__fita" style="--otp-pos:10">${html}</span>`;
    slot.appendChild(rolo);
  }

  /** Gira a fita até o dígito, sempre dando pelo menos uma volta completa. */
  function girarRolo(slot, valor) {
    const fita = $('.otp-rolo__fita', slot);
    const atual = Number(fita.style.getPropertyValue('--otp-pos')) || 10;
    const anterior = slot.dataset.roloValor || '';
    if (anterior === valor) return;
    slot.dataset.roloValor = valor;
    const destino = valor === '' ? 10 : 20 + Number(valor);
    if (semMovimento) { fita.style.setProperty('--otp-pos', destino); return; }
    // 1) volta, sem animar, para a mesma face na primeira volta da fita
    fita.classList.add('otp-rolo__fita--sem-transicao');
    fita.style.setProperty('--otp-pos', atual % 10);
    void fita.offsetWidth;
    // 2) anima até o destino (passa por 1–3 voltas)
    fita.classList.remove('otp-rolo__fita--sem-transicao');
    fita.style.setProperty('--otp-pos', destino);
  }

  /* ---------- Letreiro: placa que tomba em duas metades ---------- */
  const temposFlap = new WeakMap();
  function criarFlap(slot) {
    const flap = document.createElement('span');
    flap.className = 'otp-flap';
    flap.setAttribute('aria-hidden', 'true');
    flap.innerHTML =
      '<span class="otp-flap__meia otp-flap__meia--cima"><span></span></span>' +
      '<span class="otp-flap__meia otp-flap__meia--baixo"><span></span></span>' +
      '<span class="otp-flap__folha otp-flap__folha--cima"><span></span></span>' +
      '<span class="otp-flap__folha otp-flap__folha--baixo"><span></span></span>';
    slot.appendChild(flap);
    slot.dataset.flapValor = '';
  }

  /** Troca o caractere de uma placa: a metade de cima tomba e revela a nova.
      rapido = tombo curto (usado quando a placa "embaralha" várias vezes). */
  function tombarFlap(slot, valor, rapido) {
    const anterior = slot.dataset.flapValor || '';
    if (anterior === valor) return;
    slot.dataset.flapValor = valor;
    const cima = $('.otp-flap__meia--cima span', slot);
    const baixo = $('.otp-flap__meia--baixo span', slot);
    const folhaCima = $('.otp-flap__folha--cima span', slot);
    const folhaBaixo = $('.otp-flap__folha--baixo span', slot);
    cima.textContent = valor;          // o topo já mostra o novo caractere
    folhaCima.textContent = anterior;  // a folha que cai ainda mostra o antigo
    folhaBaixo.textContent = valor;
    clearTimeout(temposFlap.get(slot));
    // Sem animação: as duas metades já mostram o novo caractere
    if (semMovimento) { baixo.textContent = valor; folhaCima.textContent = valor; return; }
    baixo.textContent = anterior;      // a base só troca quando a folha a cobre
    slot.classList.remove('otp-slot--vira');
    slot.classList.toggle('otp-slot--rapido', !!rapido);
    void slot.offsetWidth;
    slot.classList.add('otp-slot--vira');
    temposFlap.set(slot, setTimeout(() => { baixo.textContent = valor; }, rapido ? 100 : 260));
  }

  /* Sequências do letreiro (embaralhar, "✓ OK", contagem do bloqueio). */
  const LETRAS_PAINEL = 'ABCDEFGHJKLMNPRSTUVXZ0123456789';
  const sortear = () => LETRAS_PAINEL[Math.floor(Math.random() * LETRAS_PAINEL.length)];
  const filasPainel = new WeakMap();
  const painelOcupado = new WeakSet();   // cartões em que o letreiro mostra uma mensagem

  function painelCancelar(slot) {
    (filasPainel.get(slot) || []).forEach(clearTimeout);
    filasPainel.delete(slot);
  }

  /** Leva cada placa até chars[i], placa por placa (cascata), passando antes
      por `embaralhar` caracteres aleatórios — como um painel de aeroporto atualizando. */
  function painelMostrar(slots, chars, { cascata = 55, embaralhar = 0, passo = 130, rapido = false } = {}) {
    slots.forEach((slot, i) => {
      painelCancelar(slot);
      const final = chars[i] || '';
      if (semMovimento) { tombarFlap(slot, final); return; }
      const fila = [];
      for (let k = 0; k < embaralhar; k++) {
        fila.push(setTimeout(() => tombarFlap(slot, sortear(), true), i * cascata + k * passo));
      }
      fila.push(setTimeout(() => tombarFlap(slot, final, rapido), i * cascata + embaralhar * passo));
      filasPainel.set(slot, fila);
    });
  }

  /** "0:27" centralizado nas 6 placas: ['', '0', ':', '2', '7', '']. */
  function placasDoTempo(segundos, total) {
    const t = CampoOTP.tempo(segundos).split('');
    const esquerda = Math.max(0, Math.floor((total - t.length) / 2));
    return Array.from({ length: total }, (_, i) => t[i - esquerda] || '');
  }

  /* ---------- Pontos: um círculo por dígito ---------- */
  function criarPonto(slot) {
    const ponto = document.createElement('span');
    ponto.className = 'otp-ponto';
    ponto.setAttribute('aria-hidden', 'true');
    slot.appendChild(ponto);
  }

  /* ---------- Terminal: linhas de log que rolam a janela ---------- */
  const filasTerm = new WeakMap();
  /** Escreve linhas no log do terminal, uma a uma. linhas = [[texto, tipo, cursor?], ...]
      tipo: 'ok' | 'erro' | 'frio' | 'info'. */
  function termLog(cartao, linhas, intervalo) {
    const saida = $('.otp-term__saida', cartao);
    const rolo = $('.otp-term__rolo', cartao);
    (filasTerm.get(cartao) || []).forEach(clearTimeout);
    saida.textContent = '';
    rolo.style.setProperty('--otp-rolagem', 0);
    rolo.classList.remove('otp-term__rolo--rolou');
    const fila = linhas.map(([texto, tipo, cursor], k) => depois(k * (intervalo || 0), () => {
      const p = document.createElement('p');
      p.className = 'otp-term__log otp-term__log--' + (tipo || 'info');
      p.textContent = texto;
      if (cursor) {
        const c = document.createElement('span');
        c.className = 'otp-term__cursor';
        p.appendChild(c);
      }
      saida.appendChild(p);
      // A janela tem altura fixa: cada linha nova empurra o conteúdo para cima
      rolo.style.setProperty('--otp-rolagem', Math.max(0, saida.children.length - 1));
      rolo.classList.toggle('otp-term__rolo--rolou', saida.children.length > 1);
    }));
    filasTerm.set(cartao, fila);
  }
  /** Troca o texto da última linha do log (a barra de espera do bloqueio). */
  function termUltima(cartao, texto) {
    const ultima = $('.otp-term__saida', cartao).lastElementChild;
    if (ultima) ultima.textContent = texto;
  }
  /** "aguarde [####......] 0:27" — barra ASCII que enche até liberar. */
  function termBarra(resta, total) {
    const cheios = Math.round((1 - resta / total) * 10);
    return `aguarde [${'#'.repeat(cheios)}${'.'.repeat(10 - cheios)}] ${CampoOTP.tempo(resta)}`;
  }

  /* ---------- Teclado seguro: o dígito some pouco depois de digitado ---------- */
  const TEMPO_MASCARA = 800;
  const temposMascara = new WeakMap();
  function mascarar(info) {
    info.campo.slots.forEach((slot, i) => {
      const cheio = info.valores[i] !== '';
      if (!cheio) {
        clearTimeout(temposMascara.get(slot));
        temposMascara.delete(slot);
        slot.classList.remove('otp-slot--mascara');
        return;
      }
      if (slot.classList.contains('otp-slot--mascara') || temposMascara.has(slot)) return;
      const t = setTimeout(() => {
        temposMascara.delete(slot);
        if (info.valores[i] !== '' || slot.classList.contains('otp-slot--cheio')) {
          slot.classList.add('otp-slot--mascara');
        }
      }, semMovimento ? 0 : TEMPO_MASCARA);
      temposMascara.set(slot, t);
    });
  }

  /* ================= Configuração de cada estilo =================
     Ganchos opcionais (ctx = { nome, cartao, status, campo }):
       sucesso(ctx) · erro(ctx) · bloquear(ctx, segundos) · contar(ctx, restam)
       liberar(ctx) · reiniciar(ctx)  (este no "Tentar de novo" e no reenvio) */
  const estilos = {
    classico: {},          // onda verde + selo, tremida, cadeado: tudo no CSS

    painel: {
      opcoes: { tempoErro: 1000 },
      aoCriarSlot: criarFlap,
      aoMudar(codigo, info, cartao) {
        // Enquanto o letreiro mostra "✓ OK" ou a contagem, os dígitos não mexem nas placas
        if (painelOcupado.has(cartao) || info.campo.bloqueado) return;
        info.campo.slots.forEach((slot, i) => { painelCancelar(slot); tombarFlap(slot, info.valores[i]); });
      },
      // Aprovado: as placas giram e formam "✓ OK" (o CSS faz o painel piscar)
      sucesso(ctx) {
        painelOcupado.add(ctx.cartao);
        painelMostrar(ctx.campo.slots, ['', '✓', '', 'O', 'K', ''], { cascata: 55, embaralhar: 1, passo: 140 });
      },
      // Erro: as placas embaralham letras em vermelho e depois voltam ao vazio
      erro(ctx) {
        const lixo = ctx.campo.slots.map(sortear);
        painelMostrar(ctx.campo.slots, lixo, { cascata: 35, embaralhar: 3, passo: 110, rapido: true });
      },
      // Bloqueio: o painel vira um relógio de partida com a contagem
      bloquear(ctx, segundos) {
        painelOcupado.add(ctx.cartao);
        painelMostrar(ctx.campo.slots, placasDoTempo(segundos, 6), { cascata: 50, embaralhar: 1 });
      },
      contar(ctx, restam) {
        painelMostrar(ctx.campo.slots, placasDoTempo(restam, 6), { cascata: 0 });
      },
      liberar(ctx) {
        painelOcupado.delete(ctx.cartao);
        painelMostrar(ctx.campo.slots, [], { cascata: 60 });
      },
      reiniciar(ctx) { painelOcupado.delete(ctx.cartao); },
    },

    cofre: {
      aoCriarSlot: criarRolo,
      aoMudar(codigo, info, cartao) {
        info.campo.slots.forEach((slot, i) => girarRolo(slot, info.valores[i]));
        // O volante da porta gira 60° a cada dígito
        $('.otp-cofre__volante', cartao).style.setProperty('--otp-giro', (codigo.length * 60) + 'deg');
      },
    },

    unico: { opcoes: { campoUnico: true } },
    pontos: { aoCriarSlot: criarPonto },

    terminal: {
      opcoes: { alfabeto: 'alfanumerico' },
      aoMudar(codigo, info, cartao) {
        // Voltou a digitar depois de um erro ou da liberação: limpa o log
        if (codigo.length > 0 && codigo.length < info.valores.length && $('.otp-term__saida', cartao).children.length) termLog(cartao, []);
      },
      sucesso(ctx) {
        termLog(ctx.cartao, [
          ['› assinatura verificada', 'info'],
          ['› sessão criada (12 h)', 'info'],
          ['✓ acesso autorizado', 'ok', true],
        ], 230);
      },
      erro(ctx) {
        const r = ctx.campo.restantes;
        termLog(ctx.cartao, [[`✗ código inválido (${r} restante${r === 1 ? '' : 's'})`, 'erro']]);
      },
      bloquear(ctx, segundos) {
        ctx.totalBloqueio = segundos;
        termLog(ctx.cartao, [
          ['! bloqueado: muitas tentativas', 'frio'],
          [termBarra(segundos, segundos), 'frio'],
        ], 260);
      },
      contar(ctx, restam) { termUltima(ctx.cartao, termBarra(restam, ctx.totalBloqueio || restam)); },
      liberar(ctx) { termLog(ctx.cartao, [['✓ liberado: digite de novo', 'ok']]); },
      reiniciar(ctx) { termLog(ctx.cartao, []); },
    },

    linha: {
      aoMudar(codigo, info, cartao) {
        const progresso = codigo.length / info.valores.length;
        $('.otp-linha__traco', cartao).style.strokeDashoffset = String(100 - progresso * 100);
      },
    },

    teclado: {
      opcoes: { semTeclado: true },
      aoMudar(codigo, info) { mascarar(info); },
      // Erro: os números trocam de lugar na hora (as teclas giram)
      erro() { embaralharTeclado(true); },
      // Bloqueio: as teclas viram de costas e o cadeado fecha
      bloquear() { travarTeclado(true); },
      liberar() { travarTeclado(false); embaralharTeclado(true); },
      reiniciar() { embaralharTeclado(); },
    },
  };

  const MENSAGENS = {
    ocioso: {
      classico: 'O código expira em 10 minutos.',
      painel: 'As placas tombam a cada dígito.',
      cofre: 'Gire os 6 números da combinação.',
      unico: 'Um campo só: o SMS preenche tudo de uma vez.',
      pontos: 'Os dígitos ficam ocultos na tela.',
      terminal: 'Aceita letras e números, sem diferenciar maiúsculas.',
      linha: 'Digite os 6 dígitos.',
      teclado: 'Os números mudam de lugar a cada tentativa.',
    },
    verificando: 'Verificando…',
    sucesso: {
      classico: 'Código confirmado. Acesso liberado!',
      painel: 'Embarque confirmado!',
      cofre: 'Combinação certa — cofre aberto!',
      unico: 'Código confirmado!',
      pontos: 'Identidade confirmada!',
      terminal: 'Sessão autorizada.',
      linha: 'Tudo certo, você está dentro.',
      teclado: 'Tudo certo, pagamento liberado!',
    },
    erro: (r) => `Código incorreto. Você tem ${r} tentativa${r === 1 ? '' : 's'}.`,
    liberado: 'Campo liberado. Digite o código de novo.',
    reenviado: 'Enviamos um novo código.',
  };

  /** Texto do bloqueio. A contagem fica num role="timer" (aria-live off): o leitor de
      tela anuncia uma vez "tente de novo em 30 segundos" e não repete a cada segundo. */
  function htmlBloqueio(segundos) {
    return 'Muitas tentativas · tente de novo em ' +
      '<span class="otp-status__tempo" role="timer" aria-live="off">' +
      `<span aria-hidden="true">${CampoOTP.tempo(segundos)}</span>` +
      `<span class="otp-sr">${segundos} segundos</span></span>`;
  }

  /* ================= Monta os campos ================= */
  const campos = {};
  const vitrine = new Set();   // estilos que a abertura verifica mais depressa

  $$('[data-otp]').forEach((wrap) => {
    const nome = wrap.dataset.otp;
    const cartao = wrap.closest('.otp-cartao');
    const status = $('.otp-status', cartao);
    const botaoReiniciar = $('[data-reiniciar]', cartao);
    const botaoReenviar = $('[data-reenviar]', cartao);
    const linkSuporte = $('[data-suporte]', cartao);
    const estilo = estilos[nome] || {};
    const esperado = CODIGOS[nome] || CODIGO_DEMO;
    const ctx = { nome, cartao, status, campo: null };

    /** Muda a mensagem do rodapé; tom = '', 'verificando', 'sucesso', 'erro', 'bloqueado', 'liberado'. */
    const avisar = (tom, texto, html) => {
      status.dataset.tom = tom || '';
      if (html) status.innerHTML = html;
      else status.textContent = texto || MENSAGENS.ocioso[nome];
    };
    avisar('', '');

    const campo = CampoOTP.criar(wrap, Object.assign({
      tamanho: 6,
      rotuloId: wrap.dataset.rotulo,
      descricaoId: wrap.dataset.descricao,
      maxTentativas: MAX_TENTATIVAS,
      tempoBloqueio: TEMPO_BLOQUEIO,
      aoCriarSlot: estilo.aoCriarSlot,
      aoMudar(codigo, info) {
        if (estilo.aoMudar) estilo.aoMudar(codigo, info, cartao);
        // Ao voltar a digitar depois de um erro (ou da liberação), limpa a mensagem
        const tom = status.dataset.tom;
        if ((tom === 'erro' || tom === 'liberado') && codigo.length > 0 && codigo.length < 6) avisar('', '');
      },
      /* INTEGRAÇÃO: troque o setTimeout por um fetch ao seu backend, por exemplo:
         const r = await fetch('/api/otp/verificar', { method: 'POST', body: JSON.stringify({ codigo }) });
         if (r.status === 429) return campo.bloquear(Number(r.headers.get('Retry-After')) || 30);
         r.ok ? campo.sucesso() : campo.erro(); */
      aoCompletar(codigo) {
        campo.estado('verificando');
        avisar('verificando', MENSAGENS.verificando);
        const atraso = vitrine.delete(nome) ? 150 : ATRASO_VERIFICACAO;
        setTimeout(() => {
          if (codigo === esperado) {
            campo.sucesso();
            avisar('sucesso', MENSAGENS.sucesso[nome]);
            botaoReiniciar.hidden = false;
            botaoReenviar.hidden = true;
            if (estilo.sucesso) estilo.sucesso(ctx);
            return;
          }
          campo.erro();                      // na 3ª vez a biblioteca chama aoBloquear
          if (campo.bloqueado) return;
          avisar('erro', MENSAGENS.erro(campo.restantes));
          if (estilo.erro) estilo.erro(ctx);
        }, atraso);
      },
      /* Sem acesso: some o "Reenviar", aparece o "Falar com o suporte" */
      aoBloquear(segundos) {
        avisar('bloqueado', '', htmlBloqueio(segundos));
        botaoReenviar.hidden = true;
        linkSuporte.hidden = false;
        if (estilo.bloquear) estilo.bloquear(ctx, segundos);
        // O input travado perdeu o foco: leva o foco do teclado para o link de suporte
        const foco = document.activeElement;
        if (!foco || foco === document.body) linkSuporte.focus({ preventScroll: true });
      },
      aoContagem(restam) {
        const tempo = $('.otp-status__tempo', status);
        if (tempo) {
          tempo.firstElementChild.textContent = CampoOTP.tempo(restam);
          tempo.lastElementChild.textContent = restam + ' segundos';
        }
        if (estilo.contar) estilo.contar(ctx, restam);
      },
      aoLiberar() {
        avisar('liberado', MENSAGENS.liberado);
        linkSuporte.hidden = true;
        botaoReenviar.hidden = false;
        if (estilo.liberar) estilo.liberar(ctx);
        // Devolve o foco só se ele não estiver em outro lugar da página
        const foco = document.activeElement;
        if (!foco || foco === document.body || foco === linkSuporte) campo.focar(0);
      },
    }, estilo.opcoes));
    ctx.campo = campo;

    // Volta ao estado inicial (depois do sucesso)
    botaoReiniciar.addEventListener('click', () => {
      botaoReiniciar.hidden = true;
      botaoReenviar.hidden = false;
      avisar('', '');
      if (estilo.reiniciar) estilo.reiniciar(ctx);
      campo.estado('');
      campo.limpar();
    });

    // "Falar com o suporte" é só visual nesta demo: troque o href pelo seu canal
    linkSuporte.addEventListener('click', (e) => e.preventDefault());

    // INTEGRAÇÃO: em aoReenviar, chame o endpoint que dispara um novo SMS/e-mail.
    CampoOTP.reenvio(botaoReenviar, {
      segundos: TEMPO_REENVIO,
      aoReenviar() {
        campo.zerarTentativas();             // código novo, tentativas novas
        if (estilo.reiniciar) estilo.reiniciar(ctx);
        campo.estado('');
        campo.limpar();
        avisar('', MENSAGENS.reenviado);
      },
    });

    campos[nome] = campo;
  });

  /* ================= Teclado seguro na tela ================= */
  const APAGAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7 6-7Z"/><path d="m12 10 5 4M17 10l-5 4"/></svg>';
  const TROCAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h12l-3-3M20 16H8l3 3"/></svg>';
  const caixaTeclas = $('#otp-teclas');
  let tecladoTravado = false;

  /** Sorteia a posição dos números. girar = as teclas giram ao trocar (erro / liberação). */
  function embaralharTeclado(girar) {
    if (!caixaTeclas) return;
    const digitos = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = digitos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [digitos[i], digitos[j]] = [digitos[j], digitos[i]];
    }
    const teclas = digitos.slice(0, 9).map((d) => ({ tipo: 'digito', valor: String(d) }));
    teclas.push({ tipo: 'trocar' }, { tipo: 'digito', valor: String(digitos[9]) }, { tipo: 'apagar' });
    const extra = girar ? ' otp-tecla--gira' : '';
    caixaTeclas.innerHTML = teclas.map((t, i) => {
      const atraso = `style="--otp-i:${i}"`;
      if (t.tipo === 'digito') return `<button class="otp-tecla${extra}" type="button" data-digito="${t.valor}" aria-label="Dígito ${t.valor}" ${atraso}>${t.valor}</button>`;
      if (t.tipo === 'trocar') return `<button class="otp-tecla otp-tecla--acao${extra}" type="button" data-trocar aria-label="Embaralhar os números" title="Embaralhar" ${atraso}>${TROCAR}</button>`;
      return `<button class="otp-tecla otp-tecla--acao${extra}" type="button" data-apagar aria-label="Apagar o último dígito" title="Apagar" ${atraso}>${APAGAR}</button>`;
    }).join('');
    if (tecladoTravado) travarTeclado(true);
  }

  /** Bloqueio: teclas desabilitadas (fora da ordem de Tab) e viradas de costas. */
  function travarTeclado(sim) {
    if (!caixaTeclas) return;
    tecladoTravado = sim;
    caixaTeclas.classList.toggle('otp-teclado--bloqueado', sim);
    if (sim) caixaTeclas.setAttribute('aria-disabled', 'true');
    else caixaTeclas.removeAttribute('aria-disabled');
    $$('.otp-tecla', caixaTeclas).forEach((t) => { t.disabled = sim; });
  }

  if (caixaTeclas) {
    embaralharTeclado();
    caixaTeclas.addEventListener('click', (e) => {
      const tecla = e.target.closest('.otp-tecla');
      if (!tecla || tecladoTravado) return;      // bloqueado: nenhuma tecla responde
      const campo = campos.teclado;
      if (tecla.hasAttribute('data-trocar')) { embaralharTeclado(); return; }
      if (campo.travado) return;                 // verificando / sucesso / erro
      if (tecla.hasAttribute('data-apagar')) { campo.apagar(); return; }
      campo.escrever(tecla.dataset.digito);
    });
  }

  /* ================= Abas (celular/tablet) x grade (desktop) ================= */
  const abas = $$('.otp-aba');
  const listaAbas = $('.otp-abas');
  const paineis = abas.map((a) => document.getElementById(a.getAttribute('aria-controls')));
  const modoGrade = window.matchMedia('(min-width: 1000px)');
  let abaAtiva = 0;

  function posicionarIndicador() {
    const a = abas[abaAtiva];
    if (!a.offsetWidth) return;
    listaAbas.style.setProperty('--otp-ind-x', a.offsetLeft + 'px');
    listaAbas.style.setProperty('--otp-ind-l', a.offsetWidth + 'px');
  }

  function aplicarModo() {
    const grade = modoGrade.matches;
    paineis.forEach((p, i) => {
      if (grade) {
        // No desktop os cartões são regiões independentes, rotuladas pelo título
        p.hidden = false;
        p.removeAttribute('role');
        p.setAttribute('aria-labelledby', $('.otp-cartao__titulo', p).id);
      } else {
        p.setAttribute('role', 'tabpanel');
        p.setAttribute('aria-labelledby', abas[i].id);
        p.hidden = i !== abaAtiva;
      }
    });
    posicionarIndicador();
  }

  function selecionarAba(i, focar) {
    abaAtiva = i;
    abas.forEach((a, k) => {
      a.setAttribute('aria-selected', String(k === i));
      a.tabIndex = k === i ? 0 : -1;
    });
    if (focar) abas[i].focus();
    aplicarModo();
    // A barra de abas rola na horizontal: traz a aba escolhida para a vista
    if (abas[i].scrollIntoView) abas[i].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: semMovimento ? 'auto' : 'smooth' });
  }

  abas.forEach((aba, i) => {
    aba.addEventListener('click', () => selecionarAba(i));
    aba.addEventListener('keydown', (e) => {
      const mapa = { ArrowRight: (i + 1) % abas.length, ArrowLeft: (i - 1 + abas.length) % abas.length, Home: 0, End: abas.length - 1 };
      if (e.key in mapa) { e.preventDefault(); selecionarAba(mapa[e.key], true); }
    });
  });
  if (modoGrade.addEventListener) modoGrade.addEventListener('change', aplicarModo);
  window.addEventListener('resize', posicionarIndicador);
  aplicarModo();

  /* ================= Abertura da demo ================
     No desktop a primeira dobra mostra os três momentos lado a lado:
       · Clássico já focado, esperando o código;
       · Letreiro digita o código certo e mostra o aprovado ("✓ OK");
       · Campo único abre bloqueado (persiana fechada + contagem) e se libera sozinho;
       · os demais "digitam" os 3 primeiros caracteres para mostrar o visual preenchido.
     Para desligar, mude para false. */
  const DEMO_ABERTURA = true;
  const BLOQUEIO_VITRINE = Math.min(TEMPO_BLOQUEIO, 20);

  if (modoGrade.matches) {
    campos.classico.focar(0);
    // Se a janela ainda não tem foco (aba em segundo plano), acende a 1ª caixa mesmo assim;
    // o destaque sai no primeiro foco real em qualquer lugar da página.
    const primeiro = campos.classico.slots[0];
    if (!document.hasFocus() || document.activeElement !== campos.classico.entradas[0]) {
      primeiro.classList.add('otp-slot--ativo');
      const soltar = (e) => {
        document.removeEventListener('focusin', soltar);
        if (e.target !== campos.classico.entradas[0]) primeiro.classList.remove('otp-slot--ativo');
      };
      document.addEventListener('focusin', soltar);
    }
    if (DEMO_ABERTURA) {
      vitrine.add('painel');
      CODIGO_DEMO.split('').forEach((c, j) => depois(200 + j * 70, () => campos.painel.escrever(c)));
      depois(380, () => campos.unico.bloquear(BLOQUEIO_VITRINE));
      ['cofre', 'pontos', 'terminal', 'linha', 'teclado'].forEach((nome, k) => {
        const inicio = (CODIGOS[nome] || CODIGO_DEMO).slice(0, 3).split('');
        inicio.forEach((c, j) => depois(240 + j * 130 + k * 55, () => campos[nome].escrever(c)));
      });
    }
  }
})();
