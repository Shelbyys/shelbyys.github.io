/* =========================================================
   NAVEGAÇÃO FLUIDA — script.js
   Cada componente tem sua função iniciar…(raiz) e procura só
   dentro da própria raiz: dá para ter várias cópias na página.
   Os componentes são ligados pelo atributo data-nf="…".
   ========================================================= */
(() => {
  'use strict';

  /* ---------- Utilidades ---------- */
  const consultaMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
  const semMovimento = () => consultaMovimento.matches;

  /**
   * Navegação por setas num grupo de botões (padrão "roving tabindex").
   * Devolve o novo índice ou -1 se a tecla não for de navegação.
   */
  function indicePorTecla(tecla, atual, total) {
    switch (tecla) {
      case 'ArrowRight': case 'ArrowDown': return (atual + 1) % total;
      case 'ArrowLeft': case 'ArrowUp': return (atual - 1 + total) % total;
      case 'Home': return 0;
      case 'End': return total - 1;
      default: return -1;
    }
  }

  /** Marca qual botão do grupo recebe o Tab (tabindex 0) e quais ficam fora (-1). */
  function definirTabindex(itens, ativo) {
    itens.forEach((item, i) => item.setAttribute('tabindex', i === ativo ? '0' : '-1'));
  }

  /* =========================================================
     01 · ABAS COM INDICADOR DESLIZANTE
     ========================================================= */
  function iniciarAbas(raiz) {
    const lista = raiz.querySelector('.nf-abas__lista');
    const indicador = raiz.querySelector('.nf-abas__indicador');
    const abas = [...raiz.querySelectorAll('[role="tab"]')];
    const paineis = abas.map((aba) => document.getElementById(aba.getAttribute('aria-controls')));
    let atual = Math.max(0, abas.findIndex((a) => a.getAttribute('aria-selected') === 'true'));

    // Posiciona o indicador por "left" e "right" (o CSS anima as duas bordas em tempos diferentes)
    function posicionar(instantaneo) {
      const aba = abas[atual];
      if (instantaneo) lista.classList.add('is-sem-transicao');
      indicador.style.left = aba.offsetLeft + 'px';
      indicador.style.right = (lista.clientWidth - aba.offsetLeft - aba.offsetWidth) + 'px';
      if (instantaneo) {
        void indicador.offsetWidth; // força o navegador a aplicar antes de religar a transição
        lista.classList.remove('is-sem-transicao');
      }
    }

    function selecionar(novo, focar) {
      if (novo === atual) { if (focar) abas[novo].focus(); return; }
      const direcao = novo > atual ? 1 : -1;
      lista.dataset.direcao = direcao > 0 ? 'direita' : 'esquerda';

      abas[atual].setAttribute('aria-selected', 'false');
      if (paineis[atual]) paineis[atual].hidden = true;

      atual = novo;
      abas[atual].setAttribute('aria-selected', 'true');
      definirTabindex(abas, atual);
      posicionar(false);

      const painel = paineis[atual];
      if (painel) {
        painel.hidden = false;
        // Fade direcional: o conteúdo entra vindo do lado para onde a aba andou
        if (!semMovimento() && painel.animate) {
          painel.animate(
            [{ opacity: 0, transform: `translateX(${direcao * 22}px)` }, { opacity: 1, transform: 'none' }],
            { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)' }
          );
        }
      }
      if (focar) abas[atual].focus();
    }

    abas.forEach((aba, i) => aba.addEventListener('click', () => selecionar(i, false)));
    lista.addEventListener('keydown', (e) => {
      const novo = indicePorTecla(e.key, atual, abas.length);
      if (novo < 0) return;
      e.preventDefault();
      selecionar(novo, true);
    });

    // Interruptores de exemplo do painel "Ajustes"
    raiz.querySelectorAll('[role="switch"]').forEach((chave) => {
      chave.addEventListener('click', () => {
        chave.setAttribute('aria-checked', String(chave.getAttribute('aria-checked') !== 'true'));
      });
    });

    definirTabindex(abas, atual);
    posicionar(true);
    if ('ResizeObserver' in window) new ResizeObserver(() => posicionar(true)).observe(lista);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => posicionar(true));
  }

  /* =========================================================
     02 · PÍLULA GOOEY
     ========================================================= */
  function iniciarGoo(raiz) {
    const opcoes = [...raiz.querySelectorAll('[role="tab"]')];
    const gotas = [...raiz.querySelectorAll('.nf-goo__gota')];
    const painel = raiz.querySelector('[role="tabpanel"]');
    const total = raiz.querySelector('.nf-goo__total');
    const barras = [...raiz.querySelectorAll('.nf-goo__barras i')];
    let atual = Math.max(0, opcoes.findIndex((o) => o.getAttribute('aria-selected') === 'true'));

    // Todas as gotas recebem o mesmo destino; o CSS dá a cada uma uma velocidade
    function posicionar(instantaneo) {
      const opcao = opcoes[atual];
      if (instantaneo) raiz.classList.add('is-sem-transicao');
      gotas.forEach((gota) => {
        gota.style.setProperty('--x', opcao.offsetLeft + 'px');
        gota.style.setProperty('--w', opcao.offsetWidth + 'px');
      });
      if (instantaneo) { void raiz.offsetWidth; raiz.classList.remove('is-sem-transicao'); }
    }

    // Atualiza o gráfico de exemplo com os valores do data-valores da opção
    function atualizarPainel() {
      const opcao = opcoes[atual];
      const valores = (opcao.dataset.valores || '').split(',').map(Number);
      barras.forEach((barra, i) => barra.style.setProperty('--v', ((valores[i] || 0) / 100).toFixed(3)));
      if (total && opcao.dataset.total) total.textContent = opcao.dataset.total;
      if (painel) painel.setAttribute('aria-labelledby', opcao.id);
    }

    function selecionar(novo, focar) {
      if (novo !== atual) {
        opcoes[atual].setAttribute('aria-selected', 'false');
        atual = novo;
        opcoes[atual].setAttribute('aria-selected', 'true');
        definirTabindex(opcoes, atual);
        posicionar(false);
        atualizarPainel();
      }
      if (focar) opcoes[atual].focus();
    }

    opcoes.forEach((opcao, i) => opcao.addEventListener('click', () => selecionar(i, false)));
    raiz.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
      const novo = indicePorTecla(e.key, atual, opcoes.length);
      if (novo < 0) return;
      e.preventDefault();
      selecionar(novo, true);
    });

    definirTabindex(opcoes, atual);
    posicionar(true);
    atualizarPainel();
    if ('ResizeObserver' in window) new ResizeObserver(() => posicionar(true)).observe(raiz);
  }

  /* =========================================================
     03 · DOCK COM MAGNIFICAÇÃO
     ========================================================= */
  function iniciarDock(raiz) {
    const barra = raiz.querySelector('.nf-dock__barra');
    const apps = [...raiz.querySelectorAll('.nf-dock__app')];
    const hora = raiz.querySelector('.nf-dock__hora');
    const data = raiz.querySelector('.nf-dock__data');
    let base = 42;
    let maximo = 68;
    let alcance = 140;
    let tamanhos = [];
    let ponteiroX = null;     // posição X do ponteiro (ou do foco); null = ninguém sobre o dock
    let rodando = false;
    let focado = 0;

    // Lê os tamanhos das variáveis CSS (mudam por container query no celular)
    function lerMedidas() {
      const estilo = getComputedStyle(raiz);
      base = parseFloat(estilo.getPropertyValue('--nf-dock-base')) || 42;
      maximo = parseFloat(estilo.getPropertyValue('--nf-dock-max')) || 68;
      alcance = base * 3.2;
      tamanhos = apps.map(() => base);
      apps.forEach((app) => app.style.removeProperty('--s'));
    }

    // Tamanho-alvo de cada ícone: curva suave (smoothstep) pela distância ao ponteiro
    function alvo(app) {
      if (ponteiroX === null || semMovimento()) return base;
      const r = app.getBoundingClientRect();
      const distancia = Math.abs(ponteiroX - (r.left + r.width / 2));
      const f = Math.max(0, 1 - distancia / alcance);
      return base + (maximo - base) * f * f * (3 - 2 * f);
    }

    // Cada quadro aproxima o tamanho atual do alvo (interpolação = sensação de mola macia)
    function quadro() {
      let mexeu = false;
      apps.forEach((app, i) => {
        const destino = alvo(app);
        const diferenca = destino - tamanhos[i];
        if (Math.abs(diferenca) > 0.15) { tamanhos[i] += diferenca * 0.24; mexeu = true; }
        else tamanhos[i] = destino;
        app.style.setProperty('--s', tamanhos[i].toFixed(2) + 'px');
      });
      if (mexeu) requestAnimationFrame(quadro);
      else rodando = false;
    }
    function animar() {
      if (rodando) return;
      rodando = true;
      requestAnimationFrame(quadro);
    }

    barra.addEventListener('pointermove', (e) => { ponteiroX = e.clientX; animar(); });
    barra.addEventListener('pointerleave', () => { ponteiroX = null; animar(); });
    barra.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') { ponteiroX = null; animar(); } // no toque, solta e volta ao normal
    });
    barra.addEventListener('pointercancel', () => { ponteiroX = null; animar(); });

    // Teclado: o foco "faz as vezes" do ponteiro
    barra.addEventListener('focusin', (e) => {
      const app = e.target.closest('.nf-dock__app');
      if (!app) return;
      focado = apps.indexOf(app);
      const r = app.getBoundingClientRect();
      ponteiroX = r.left + r.width / 2;
      animar();
    });
    barra.addEventListener('focusout', (e) => {
      if (!barra.contains(e.relatedTarget)) { ponteiroX = null; animar(); }
    });
    barra.addEventListener('keydown', (e) => {
      const novo = indicePorTecla(e.key, focado, apps.length);
      if (novo < 0) return;
      e.preventDefault();
      definirTabindex(apps, novo);
      apps[novo].focus();
    });

    // Clique: abre/fecha o app (ponto embaixo) com um pulinho
    apps.forEach((app) => {
      app.addEventListener('click', () => {
        const abrir = app.getAttribute('aria-pressed') !== 'true';
        app.setAttribute('aria-pressed', String(abrir));
        if (abrir && !semMovimento() && app.animate) {
          app.querySelector('.nf-dock__icone').animate(
            [{ transform: 'translateY(0)' }, { transform: 'translateY(-16px)', offset: 0.35 }, { transform: 'translateY(0)', offset: 0.7 }, { transform: 'translateY(-5px)', offset: 0.85 }, { transform: 'translateY(0)' }],
            { duration: 700, easing: 'ease-out' }
          );
        }
      });
    });

    // Relógio da "tela" de fundo
    function atualizarHora() {
      const agora = new Date();
      if (hora) hora.textContent = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (data) data.textContent = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    }
    atualizarHora();
    setInterval(atualizarHora, 30000);

    definirTabindex(apps, 0);
    lerMedidas();
    if ('ResizeObserver' in window) new ResizeObserver(lerMedidas).observe(raiz);
  }

  /* =========================================================
     04 · BARRA INFERIOR COM RECORTE
     ========================================================= */
  function iniciarNotch(raiz) {
    const barra = raiz.querySelector('.nf-notch__barra');
    const svg = raiz.querySelector('.nf-notch__fundo');
    const caminho = raiz.querySelector('.nf-notch__caminho');
    const bolha = raiz.querySelector('.nf-notch__bolha');
    const itens = [...raiz.querySelectorAll('[role="tab"]')];
    const painel = raiz.querySelector('[role="tabpanel"]');
    const titulo = raiz.querySelector('.nf-notch__titulo');
    const texto = raiz.querySelector('.nf-notch__texto-tela');

    // Medidas do recorte (px)
    const RAIO = 32;          // meia-largura da "boca" do recorte
    const OMBRO = 12;         // curva suave na borda do recorte
    const FUNDO = 33;         // profundidade
    const BOLHA = 46;         // diâmetro do círculo (igual ao CSS)
    // Mola: rigidez e amortecimento (menor amortecimento = mais balanço)
    const RIGIDEZ = 240;
    const AMORTECIMENTO = 21;

    let atual = Math.max(0, itens.findIndex((i) => i.getAttribute('aria-selected') === 'true'));
    let largura = 0;
    let altura = 0;
    let x = 0;
    let destino = 0;
    let velocidade = 0;
    let rodando = false;
    let ultimo = 0;

    const centro = (item) => item.offsetLeft + item.offsetWidth / 2;

    // Desenha a barra com o recorte centrado em cx
    function desenhar(cx) {
      const a = cx - RAIO - OMBRO;
      const b = cx + RAIO + OMBRO;
      const ini = Math.min(-2, a);           // sobra para fora: o SVG corta as laterais
      const fim = Math.max(largura + 2, b);
      const d = [
        `M${ini} 0`, `L${a} 0`,
        `C${cx - RAIO + 2} 0 ${cx - RAIO * 0.72} ${FUNDO} ${cx} ${FUNDO}`,
        `C${cx + RAIO * 0.72} ${FUNDO} ${cx + RAIO - 2} 0 ${b} 0`,
        `L${fim} 0`, `L${fim} ${altura + 2}`, `L${ini} ${altura + 2}`, 'Z',
      ].join(' ');
      caminho.setAttribute('d', d);
      bolha.style.transform = `translateX(${(cx - BOLHA / 2).toFixed(2)}px)`;
    }

    function medir() {
      largura = barra.clientWidth;
      altura = barra.clientHeight;
      svg.setAttribute('viewBox', `0 0 ${largura} ${altura}`);
      x = destino = centro(itens[atual]);
      velocidade = 0;
      desenhar(x);
    }

    // Integração simples de mola (passo a passo, limitado para não "explodir")
    function passo(tempo) {
      const dt = Math.min(0.032, (tempo - ultimo) / 1000 || 0.016);
      ultimo = tempo;
      const forca = (destino - x) * RIGIDEZ - velocidade * AMORTECIMENTO;
      velocidade += forca * dt;
      x += velocidade * dt;
      if (Math.abs(destino - x) < 0.2 && Math.abs(velocidade) < 0.5) {
        x = destino;
        rodando = false;
      }
      desenhar(x);
      if (rodando) requestAnimationFrame(passo);
    }

    function selecionar(novo, focar) {
      if (novo !== atual) {
        itens[atual].setAttribute('aria-selected', 'false');
        atual = novo;
        const item = itens[atual];
        item.setAttribute('aria-selected', 'true');
        definirTabindex(itens, atual);
        painel.setAttribute('aria-labelledby', item.id);
        titulo.textContent = item.querySelector('.nf-notch__texto').textContent;
        texto.textContent = item.dataset.texto || '';
        destino = centro(item);

        if (semMovimento()) { x = destino; desenhar(x); }
        else {
          painel.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'ease-out' });
          if (!rodando) { rodando = true; ultimo = performance.now(); requestAnimationFrame(passo); }
        }
      }
      if (focar) itens[atual].focus();
    }

    itens.forEach((item, i) => item.addEventListener('click', () => selecionar(i, false)));
    raiz.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
      const novo = indicePorTecla(e.key, atual, itens.length);
      if (novo < 0) return;
      e.preventDefault();
      selecionar(novo, true);
    });

    definirTabindex(itens, atual);
    medir();
    if ('ResizeObserver' in window) new ResizeObserver(medir).observe(barra);
  }

  /* =========================================================
     05 · NAVBAR QUE ENCOLHE AO ROLAR
     ========================================================= */
  function iniciarEncolhe(raiz) {
    const tela = raiz.querySelector('.nf-encolhe__tela');   // quem rola (troque por window numa página real)
    const progresso = raiz.querySelector('.nf-encolhe__progresso');
    const LIMITE = 24;                                       // px rolados até virar ilha
    let agendado = false;

    function atualizar() {
      agendado = false;
      const y = tela.scrollTop;
      raiz.classList.toggle('is-compacta', y > LIMITE);
      const maximo = tela.scrollHeight - tela.clientHeight;
      progresso.style.transform = `scaleX(${maximo > 0 ? Math.min(1, y / maximo).toFixed(3) : 0})`;
    }

    // Rolagem agrupada em um quadro de animação: leve mesmo com rolagem rápida
    tela.addEventListener('scroll', () => {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(atualizar);
    }, { passive: true });
    atualizar();
  }

  /* =========================================================
     06 · MENU HAMBÚRGUER EM TELA CHEIA
     ========================================================= */
  function iniciarMenu(raiz) {
    const botao = raiz.querySelector('.nf-menu__botao');
    const overlay = raiz.querySelector('.nf-menu__overlay');
    let aberto = false;

    const focaveis = () => [botao, ...overlay.querySelectorAll('a[href], button')];

    function abrir() {
      aberto = true;
      raiz.classList.add('is-aberto');
      overlay.removeAttribute('inert');
      botao.setAttribute('aria-expanded', 'true');
      botao.setAttribute('aria-label', 'Fechar menu');
      // Leva o foco ao primeiro link quando a animação já começou
      setTimeout(() => {
        const primeiro = overlay.querySelector('a[href]');
        if (aberto && primeiro) primeiro.focus({ preventScroll: true });
      }, semMovimento() ? 0 : 220);
    }

    function fechar(devolverFoco) {
      if (!aberto) return;
      aberto = false;
      raiz.classList.remove('is-aberto');
      overlay.setAttribute('inert', '');
      botao.setAttribute('aria-expanded', 'false');
      botao.setAttribute('aria-label', 'Abrir menu');
      if (devolverFoco) botao.focus({ preventScroll: true });
    }

    botao.addEventListener('click', () => (aberto ? fechar(false) : abrir()));

    // Clicar num link fecha o menu (na demo os links não navegam)
    overlay.addEventListener('click', (e) => {
      if (e.target.closest('a')) fechar(true);
    });

    raiz.addEventListener('keydown', (e) => {
      if (!aberto) return;
      if (e.key === 'Escape') { e.preventDefault(); fechar(true); return; }
      // Foco preso dentro do menu aberto
      if (e.key === 'Tab') {
        const lista = focaveis();
        const primeiro = lista[0];
        const ultimo = lista[lista.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      }
    });
  }

  /* =========================================================
     GALERIA: "Copiar HTML" + toast
     ========================================================= */

  /** Remove o recuo comum das linhas, para o HTML colado ficar alinhado. */
  function tirarRecuo(html) {
    const linhas = html.replace(/^\s*\n/, '').replace(/\s+$/, '').split('\n');
    const recuos = linhas.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length);
    const menor = recuos.length ? Math.min(...recuos) : 0;
    return linhas.map((l) => l.slice(menor)).join('\n');
  }

  /** Copia texto sem nunca lançar erro: tenta a Clipboard API e cai para execCommand. */
  async function copiarTexto(texto) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
        return true;
      }
    } catch (erro) { /* segue para o plano B */ }
    try {
      const area = document.createElement('textarea');
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch (erro) {
      return false;
    }
  }

  const toast = document.querySelector('.nf-toast');
  let tempoToast = 0;
  function mostrarToast(mensagem) {
    if (!toast) return;
    toast.textContent = mensagem;
    toast.classList.add('is-visivel');
    clearTimeout(tempoToast);
    tempoToast = setTimeout(() => toast.classList.remove('is-visivel'), 2200);
  }

  // Guarda o HTML original de cada palco ANTES de os scripts mexerem nele
  const htmlOriginal = new Map();
  document.querySelectorAll('[data-copiar]').forEach((botao) => {
    const alvo = document.getElementById(botao.dataset.copiar);
    if (alvo) htmlOriginal.set(botao, tirarRecuo(alvo.innerHTML));
  });

  document.querySelectorAll('[data-copiar]').forEach((botao) => {
    const rotulo = botao.querySelector('span');
    botao.addEventListener('click', async () => {
      const ok = await copiarTexto(htmlOriginal.get(botao) || '');
      botao.focus({ preventScroll: true });
      if (ok) {
        mostrarToast('HTML copiado! Cole junto com o CSS e o JS do componente.');
        botao.classList.add('is-copiado');
        if (rotulo) rotulo.textContent = 'Copiado';
        setTimeout(() => {
          botao.classList.remove('is-copiado');
          if (rotulo) rotulo.textContent = 'Copiar HTML';
        }, 1600);
      } else {
        mostrarToast('Não foi possível copiar aqui. Abra o index.html e copie o trecho do palco.');
      }
    });
  });

  // Links de demonstração (href="#") não devem pular a página
  document.querySelectorAll('.nf-galeria a[href="#"]').forEach((link) => {
    link.addEventListener('click', (e) => e.preventDefault());
  });

  /* ---------- Liga cada componente pela sua marcação ---------- */
  const iniciadores = {
    abas: iniciarAbas,
    goo: iniciarGoo,
    dock: iniciarDock,
    notch: iniciarNotch,
    encolhe: iniciarEncolhe,
    menu: iniciarMenu,
  };
  document.querySelectorAll('[data-nf]').forEach((raiz) => {
    const iniciar = iniciadores[raiz.dataset.nf];
    if (iniciar) iniciar(raiz);
  });
})();
