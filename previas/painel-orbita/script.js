/* ==========================================================================
   Painel Órbita — script.js
   JavaScript puro (vanilla), sem dependências e sem build.
   --------------------------------------------------------------------------
   ÍNDICE
   1. Configuração
   2. Dados  ← PONTO DE INTEGRAÇÃO: troque obterDados() pelos seus dados reais
   3. Utilitários (formatação pt-BR, animação, SVG, curvas)
   4. Componentes
      4.1 KPI · 4.2 Gráfico de receita · 4.3 Canais · 4.4 Donut
      4.5 Tabela de páginas · 4.6 Feed ao vivo
   5. Interface (tema, período, busca, gaveta)
   6. Inicialização + API pública (window.PainelOrbita)
   ========================================================================== */
(function () {
  'use strict';

  /* ========================================================================
     1. CONFIGURAÇÃO
     ======================================================================== */
  const CONFIG = {
    periodoInicial: '30d',
    // "Hoje" nos dados de demonstração (fixo para a demo ficar sempre igual).
    dataReferencia: new Date(2026, 9, 29),
    // Semente do gerador pseudoaleatório: mesma semente = mesmos números.
    semente: 2026,
    feed: {
      simular: true,          // false = não gera eventos falsos (use PainelOrbita.adicionarEvento)
      intervaloMs: 3000,      // um evento novo a cada ~3 s
      maxItens: 6,            // itens visíveis no feed
    },
    duracoes: {
      entrada: 1100,          // animações da primeira carga (ms)
      troca: 700,             // transição ao trocar o período (ms)
    },
    chaveTema: 'orbita-tema', // chave do localStorage
  };

  /** Períodos disponíveis no controle segmentado. */
  const PERIODOS = {
    '7d':  { dias: 7,  nome: 'Últimos 7 dias',  comparacao: 'vs. 7 dias anteriores' },
    '30d': { dias: 30, nome: 'Últimos 30 dias', comparacao: 'vs. 30 dias anteriores' },
    '90d': { dias: 90, nome: 'Últimos 90 dias', comparacao: 'vs. 90 dias anteriores' },
  };


  /* ========================================================================
     2. DADOS
     ------------------------------------------------------------------------
     ► PONTO DE INTEGRAÇÃO
     O painel inteiro é desenhado a partir de UM objeto, devolvido por
     obterDados(periodo). Para usar dados reais, troque o corpo da função:

       async function obterDados(periodo) {
         const resposta = await fetch(`/api/analytics?periodo=${periodo}`);
         return resposta.json(); // mesmo formato descrito abaixo
       }

     FORMATO ESPERADO (DadosPainel):
     {
       kpis: [{
         id: 'mrr' | 'usuarios' | 'conversao' | 'churn',  // casa com data-kpi no HTML
         valor: 48920,              // valor do período atual
         anterior: 43523,           // valor do período anterior (para a variação %)
         formato: 'moeda' | 'inteiro' | 'porcentagem',
         melhorQuando: 'sobe' | 'desce',  // define se a variação é verde ou âmbar
         serie: [ ...números ]      // pontos da sparkline (qualquer quantidade ≥ 2)
       }],
       receita: {
         datas:    [ Date, ... ],   // um item por ponto do gráfico
         atual:    [ número, ... ], // mesma quantidade de datas
         anterior: [ número, ... ]  // período anterior alinhado ponto a ponto
       },
       canais:       [{ nome: 'Orgânico', valor: 1284 }, ...],
       dispositivos: [{ nome: 'Desktop',  valor: 14380 }, ...],   // até 3 (cores --donut-1..3)
       paginas: [{
         caminho: '/precos', visualizacoes: 9840, visitantes: 7120,
         tempoMedio: 118,           // segundos
         rejeicao: 24.6             // porcentagem (0–100)
       }]
     }
     ======================================================================== */

  /** ► Troque esta função pela sua API. Pode devolver um objeto ou uma Promise. */
  function obterDados(periodo) {
    return Promise.resolve(gerarDadosDemo(periodo));
  }

  /** Gerador pseudoaleatório determinístico (mulberry32). */
  function criarAleatorio(semente) {
    let a = semente >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Bases da demonstração (valores do período de 30 dias) */
  const DEMO_KPIS = {
    //          [valor, anterior]
    '7d':  { mrr: [48920, 47610], usuarios: [8412, 8106],   conversao: [3.9, 3.6], churn: [2.3, 2.1] },
    '30d': { mrr: [48920, 43523], usuarios: [12384, 11207], conversao: [3.8, 3.4], churn: [2.1, 2.4] },
    '90d': { mrr: [48920, 38190], usuarios: [21760, 19944], conversao: [3.6, 3.7], churn: [2.2, 2.6] },
  };
  const DEMO_CANAIS = [['Orgânico', 1284], ['Pago', 842], ['Direto', 611], ['Indicação', 397], ['E-mail', 268]];
  const DEMO_DISPOSITIVOS = [['Desktop', 58], ['Mobile', 36], ['Tablet', 6]];
  const DEMO_PAGINAS = [
    // caminho, visualizações, visitantes, tempo médio (s), rejeição (%)
    ['/',                   18420, 12960,  72, 38.2],
    ['/precos',              9840,  7120, 118, 24.6],
    ['/blog/metricas-saas',  7310,  6480, 246, 61.8],
    ['/cadastro',            5120,  4390,  95, 18.3],
    ['/docs/api',            3980,  2210, 312, 29.4],
    ['/integracoes',         2760,  2140,  84, 52.7],
  ];

  /** Gera os dados de demonstração de um período (sempre os mesmos números). */
  function gerarDadosDemo(periodo) {
    const { dias } = PERIODOS[periodo];
    const aleatorio = criarAleatorio(CONFIG.semente + dias * 101);
    const ruido = (amplitude) => (aleatorio() - 0.5) * 2 * amplitude;
    const fator = dias / 30;

    // Datas do período, terminando na data de referência
    const datas = Array.from({ length: dias }, (_, i) => {
      const d = new Date(CONFIG.dataReferencia);
      d.setDate(d.getDate() - (dias - 1 - i));
      return d;
    });

    // Receita diária: tendência de alta + fim de semana mais fraco + ruído
    const crescimento = 330 * Math.sqrt(fator);
    const inicio = 1860 - crescimento;
    const sazonal = (d) => (d.getDay() === 0 || d.getDay() === 6 ? -0.13 : 0.03);
    const atual = datas.map((d, i) => {
      const tendencia = inicio + crescimento * (i / Math.max(1, dias - 1));
      const onda = Math.sin(i / 6.5) * 0.035;
      return Math.round(tendencia * (1 + sazonal(d) + onda + ruido(0.045)));
    });
    const anterior = datas.map((d, i) => {
      const tendencia = inicio * 0.9 + crescimento * 0.6 * (i / Math.max(1, dias - 1));
      return Math.round(tendencia * (1 + sazonal(d) + ruido(0.05)));
    });

    // KPIs com sparklines que vão do valor anterior ao atual
    const base = DEMO_KPIS[periodo];
    const pontosSpark = Math.min(dias, 30);
    const serieEntre = (de, para) => Array.from({ length: pontosSpark }, (_, i) => {
      const p = i / (pontosSpark - 1);
      const v = de + (para - de) * p;
      return i === pontosSpark - 1 ? para : v * (1 + ruido(0.025));
    });
    const kpi = (id, formato, melhorQuando) => ({
      id, formato, melhorQuando,
      valor: base[id][0],
      anterior: base[id][1],
      serie: serieEntre(base[id][1], base[id][0]),
    });

    return {
      periodo,
      kpis: [
        kpi('mrr', 'moeda', 'sobe'),
        kpi('usuarios', 'inteiro', 'sobe'),
        kpi('conversao', 'porcentagem', 'sobe'),
        kpi('churn', 'porcentagem', 'desce'),
      ],
      receita: { datas, atual, anterior },
      canais: DEMO_CANAIS.map(([nome, v]) => ({ nome, valor: Math.round(v * fator * (1 + ruido(0.14))) })),
      dispositivos: DEMO_DISPOSITIVOS.map(([nome, pct]) => ({
        nome,
        valor: Math.round(24810 * Math.pow(fator, 0.92) * (pct + ruido(pct * 0.12)) / 100),
      })),
      paginas: DEMO_PAGINAS.map(([caminho, vis, uni, tempo, rej]) => {
        const escala = fator * (1 + ruido(0.16));
        return {
          caminho,
          visualizacoes: Math.round(vis * escala),
          visitantes: Math.round(uni * escala * (1 + ruido(0.05))),
          tempoMedio: Math.round(tempo * (1 + ruido(0.12))),
          rejeicao: Math.max(5, Math.round((rej + ruido(5)) * 10) / 10),
        };
      }),
    };
  }

  /* Eventos simulados do feed "Ao vivo" ----------------------------------- */
  const DEMO_CLIENTES = ['Lumen Studio', 'Casa Verde Café', 'Nuvem Contábil', 'Pixel & Prosa', 'Rota Norte Log',
    'Ateliê Maré', 'Brisa Tech', 'Arara Pagamentos', 'Ponto Zero Fit', 'Vila Dados', 'Farol Imóveis', 'Quintal Kids'];
  const DEMO_CIDADES = ['São Paulo', 'Recife', 'Curitiba', 'Porto Alegre', 'Belo Horizonte', 'Florianópolis',
    'Fortaleza', 'Goiânia', 'Salvador', 'Lisboa'];
  const DEMO_PLANOS = [['Starter', 89], ['Pro', 249], ['Business', 690]];
  const aleatorioFeed = criarAleatorio(CONFIG.semente * 7);

  /**
   * Gera um evento falso. Formato de um evento (use o mesmo com dados reais):
   * { tipo: 'assinatura'|'teste'|'upgrade'|'cancelamento'|'falha',
   *   cliente: 'Lumen Studio', plano: 'Pro', valor: 249, cidade: 'Recife', quando: Date|number }
   */
  function gerarEventoDemo(quando = Date.now()) {
    const r = aleatorioFeed;
    const escolher = (lista) => lista[Math.floor(r() * lista.length)];
    const sorteio = r();
    const tipo = sorteio < 0.36 ? 'assinatura' : sorteio < 0.6 ? 'teste' : sorteio < 0.8 ? 'upgrade' : sorteio < 0.91 ? 'cancelamento' : 'falha';
    const [plano, preco] = tipo === 'upgrade' ? escolher(DEMO_PLANOS.slice(1)) : escolher(DEMO_PLANOS);
    return {
      tipo,
      cliente: escolher(DEMO_CLIENTES),
      plano,
      valor: tipo === 'upgrade' ? preco - 89 : preco,
      cidade: escolher(DEMO_CIDADES),
      quando,
    };
  }


  /* ========================================================================
     3. UTILITÁRIOS
     ======================================================================== */
  const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
  const $$ = (seletor, raiz = document) => Array.from(raiz.querySelectorAll(seletor));
  const NBSP = '\u00a0';
  const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Formatação pt-BR ------------------------------------------------------ */
  const fmtInteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const fmtDecimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmtCompacto = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  /** Formata um número: 'moeda' → R$ 48.920 · 'porcentagem' → 3,8% · 'inteiro' → 12.384 */
  function formatar(valor, formato) {
    if (formato === 'moeda') return 'R$' + NBSP + fmtInteiro.format(Math.round(valor));
    if (formato === 'porcentagem') return fmtDecimal.format(valor) + '%';
    return fmtInteiro.format(Math.round(valor));
  }
  /** Rótulo curto de eixo: 1.250 → "1,25 mil" */
  function formatarCompacto(valor) {
    if (Math.abs(valor) >= 1e6) return fmtCompacto.format(valor / 1e6) + ' mi';
    if (Math.abs(valor) >= 1e3) return fmtCompacto.format(valor / 1e3) + ' mil';
    return fmtInteiro.format(valor);
  }
  /** Variação com sinal: +12,4% / −3,1% */
  function formatarVariacao(pct) {
    const sinal = pct > 0.05 ? '+' : pct < -0.05 ? '−' : '';
    return sinal + fmtDecimal.format(Math.abs(pct)) + '%';
  }
  /** 118 → "1m 58s" */
  function formatarDuracao(segundos) {
    const m = Math.floor(segundos / 60);
    const s = Math.round(segundos % 60);
    return m ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
  }
  const dataCurta = (d) => `${d.getDate()} ${MESES[d.getMonth()]}`;
  const dataComDia = (d) => `${DIAS_SEMANA[d.getDay()]}, ${dataCurta(d)}`;
  const variacaoPct = (valor, anterior) => (anterior ? ((valor - anterior) / Math.abs(anterior)) * 100 : 0);

  /** Tempo relativo para o feed: "agora", "há 12 s", "há 3 min" */
  function tempoRelativo(quando) {
    const s = Math.max(0, Math.floor((Date.now() - quando) / 1000));
    if (s < 5) return 'agora';
    if (s < 60) return `há ${s} s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `há ${m} min`;
    return `há ${Math.floor(m / 60)} h`;
  }

  /* Animação --------------------------------------------------------------- */
  const suavizar = (t) => 1 - Math.pow(1 - t, 3); // ease-out cúbico
  const misturar = (a, b, t) => a + (b - a) * t;
  const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

  /**
   * Anima de 0 a 1 em `duracao` ms chamando aoQuadro(t) a cada frame.
   * Respeita prefers-reduced-motion (vai direto ao fim) e devolve uma função
   * para cancelar. Tem uma "garantia" por setTimeout: se o navegador pausar o
   * requestAnimationFrame (aba em segundo plano), o estado final é aplicado.
   */
  function animar(duracao, aoQuadro) {
    if (movimentoReduzido.matches || duracao <= 0) { aoQuadro(1); return () => {}; }
    let terminou = false;
    let idQuadro = 0;
    const inicio = performance.now();
    const passo = (agora) => {
      if (terminou) return;
      const p = Math.min(1, (agora - inicio) / duracao);
      aoQuadro(suavizar(p));
      if (p < 1) idQuadro = requestAnimationFrame(passo);
      else { terminou = true; clearTimeout(garantia); }
    };
    const garantia = setTimeout(() => {
      if (terminou) return;
      terminou = true; cancelAnimationFrame(idQuadro); aoQuadro(1);
    }, duracao + 200);
    idQuadro = requestAnimationFrame(passo);
    return () => { terminou = true; cancelAnimationFrame(idQuadro); clearTimeout(garantia); };
  }

  /** Reamostra uma lista para `n` pontos (interpolação linear). Permite transições 7d ↔ 90d. */
  function reamostrar(lista, n) {
    if (!lista.length) return new Array(n).fill(0);
    if (lista.length === 1 || n === 1) return new Array(n).fill(lista[lista.length - 1]);
    return Array.from({ length: n }, (_, j) => {
      const pos = (j * (lista.length - 1)) / (n - 1);
      const i = Math.floor(pos);
      return i >= lista.length - 1 ? lista[lista.length - 1] : misturar(lista[i], lista[i + 1], pos - i);
    });
  }

  /* SVG ------------------------------------------------------------------- */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let contadorIds = 0;
  const novoId = (prefixo) => `${prefixo}-${++contadorIds}`;

  function criarSvg(tag, atributos = {}, pai = null) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const nome in atributos) el.setAttribute(nome, atributos[nome]);
    if (pai) pai.appendChild(el);
    return el;
  }

  /** Ícones pequenos usados pelo script (traço 24×24). */
  const ICONES = {
    sobe: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    desce: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    assinatura: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    teste: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/></svg>',
    upgrade: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>',
    cancelamento: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>',
    falha: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 2.8 19.5h18.4L12 4z"/><path d="M12 10v4M12 17h.01"/></svg>',
  };

  /** Preenche um chip de variação (+12,4% verde/âmbar com seta). */
  function preencherVariacao(el, pct, melhorQuando = 'sobe') {
    const subiu = pct >= 0;
    const bom = (melhorQuando === 'sobe') === subiu;
    el.className = 'variacao ' + (bom ? 'variacao--bom' : 'variacao--ruim');
    el.innerHTML = (subiu ? ICONES.sobe : ICONES.desce) + `<span>${formatarVariacao(pct)}</span>`;
    el.setAttribute('aria-label', `${subiu ? 'Alta' : 'Queda'} de ${fmtDecimal.format(Math.abs(pct))}%`);
    return bom;
  }

  /**
   * Curva suave monotônica (Fritsch–Carlson) — não "passa do ponto" entre
   * valores, então o gráfico nunca mostra picos que não existem.
   * pontos: [[x, y], ...] → atributo "d" de um <path>.
   */
  function caminhoSuave(pontos) {
    const n = pontos.length;
    if (!n) return '';
    const f = (v) => Math.round(v * 10) / 10;
    if (n === 1) return `M${f(pontos[0][0])},${f(pontos[0][1])}`;
    if (n === 2) return `M${f(pontos[0][0])},${f(pontos[0][1])}L${f(pontos[1][0])},${f(pontos[1][1])}`;
    const dx = [], m = [];
    for (let i = 0; i < n - 1; i++) {
      dx[i] = pontos[i + 1][0] - pontos[i][0] || 1e-6;
      m[i] = (pontos[i + 1][1] - pontos[i][1]) / dx[i];
    }
    const t = new Array(n);
    t[0] = m[0];
    t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) {
      t[i] = m[i - 1] * m[i] <= 0 ? 0
        : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
    }
    let d = `M${f(pontos[0][0])},${f(pontos[0][1])}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      const [x0, y0] = pontos[i];
      const [x1, y1] = pontos[i + 1];
      d += `C${f(x0 + h)},${f(y0 + h * t[i])} ${f(x1 - h)},${f(y1 - h * t[i + 1])} ${f(x1)},${f(y1)}`;
    }
    return d;
  }

  /** Domínio "bonito" para o eixo Y (passos 1, 2, 2,5 ou 5 × 10ⁿ). */
  function dominioBonito(valores, divisoes = 4) {
    let min = Math.min(...valores);
    let max = Math.max(...valores);
    const folga = (max - min) * 0.1 || Math.abs(max) * 0.1 || 1;
    min -= folga; max += folga * 0.6;
    const bruto = (max - min) / divisoes;
    const magnitude = Math.pow(10, Math.floor(Math.log10(bruto)));
    for (const mult of [1, 2, 2.5, 5, 10, 20, 25, 50]) {
      const passo = mult * magnitude;
      const inicio = Math.max(0, Math.floor(min / passo) * passo);
      if (inicio + passo * divisoes >= max) return { min: inicio, max: inicio + passo * divisoes };
    }
    return { min: Math.max(0, min), max };
  }


  /* ========================================================================
     4. COMPONENTES
     Cada componente é criado uma vez e expõe .atualizar(dados, opções).
     ======================================================================== */

  /* 4.1 KPI — valor com contagem animada, variação e sparkline ------------- */
  function criarKpi(cartao) {
    const elValor = $('[data-valor]', cartao);
    const elVariacao = $('[data-variacao]', cartao);
    const elComparacao = $('[data-comparacao]', cartao);
    const svg = criarSvg('svg', { viewBox: '0 0 100 32', preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' }, $('[data-spark]', cartao));
    const idGradiente = novoId('spark');
    const gradiente = criarSvg('linearGradient', { id: idGradiente, x1: 0, y1: 0, x2: 0, y2: 1 }, criarSvg('defs', {}, svg));
    criarSvg('stop', { offset: '0%', class: 'spark-grad-topo' }, gradiente);
    criarSvg('stop', { offset: '100%', class: 'spark-grad-base' }, gradiente);
    const area = criarSvg('path', { fill: `url(#${idGradiente})` }, svg);
    const linha = criarSvg('path', { class: 'spark-linha' }, svg);

    let atual = null; // { valor, serie, min, max }
    let cancelar = () => {};

    function desenhar(serie, min, max) {
      const faixa = max - min || 1;
      const pontos = serie.map((v, i) => [(i / (serie.length - 1)) * 100, 3 + (1 - (v - min) / faixa) * 26]);
      const d = caminhoSuave(pontos);
      linha.setAttribute('d', d);
      area.setAttribute('d', `${d}L100,32L0,32Z`);
    }

    return {
      atualizar(kpi, { periodo, duracao }) {
        cancelar();
        const n = kpi.serie.length;
        const min = Math.min(...kpi.serie);
        const max = Math.max(...kpi.serie);
        // Na primeira vez, a sparkline "cresce" a partir da base.
        const de = atual
          ? { valor: atual.valor, serie: reamostrar(atual.serie, n), min: atual.min, max: atual.max }
          : { valor: 0, serie: new Array(n).fill(min), min, max };

        const bom = preencherVariacao(elVariacao, variacaoPct(kpi.valor, kpi.anterior), kpi.melhorQuando);
        cartao.classList.toggle('kpi--ruim', !bom);
        elComparacao.textContent = PERIODOS[periodo].comparacao;

        cancelar = animar(duracao, (t) => {
          elValor.textContent = formatar(misturar(de.valor, kpi.valor, t), kpi.formato);
          desenhar(de.serie.map((v, i) => misturar(v, kpi.serie[i], t)), misturar(de.min, min, t), misturar(de.max, max, t));
        });
        atual = { valor: kpi.valor, serie: kpi.serie.slice(), min, max };
      },
    };
  }

  /* 4.2 Gráfico de receita — área + linha + crosshair + tooltip ------------- */
  function criarGraficoReceita(caixa, anuncio) {
    const margem = { topo: 12, direita: 14, base: 28, esquerda: 54 };
    const tooltip = $('.tooltip', caixa);
    const svg = criarSvg('svg', { 'aria-hidden': 'true', focusable: 'false' });
    caixa.prepend(svg);

    const idGradiente = novoId('grad-receita');
    const gradiente = criarSvg('linearGradient', { id: idGradiente, x1: 0, y1: 0, x2: 0, y2: 1 }, criarSvg('defs', {}, svg));
    criarSvg('stop', { offset: '0%', class: 'g-grad-topo' }, gradiente);
    criarSvg('stop', { offset: '100%', class: 'g-grad-base' }, gradiente);

    const gGrade = criarSvg('g', { class: 'g-grade' }, svg);
    const gEixoY = criarSvg('g', { class: 'g-eixo g-eixo-y' }, svg);
    const gEixoX = criarSvg('g', { class: 'g-eixo g-eixo-x' }, svg);
    const DIVISOES = 4;
    const linhasGrade = Array.from({ length: DIVISOES + 1 }, (_, k) => criarSvg('line', { class: k === 0 ? 'g-base' : '' }, gGrade));
    const rotulosY = Array.from({ length: DIVISOES + 1 }, () => criarSvg('text', { 'text-anchor': 'end' }, gEixoY));

    const area = criarSvg('path', { class: 'g-area', fill: `url(#${idGradiente})` }, svg);
    const linhaAnterior = criarSvg('path', { class: 'g-linha-anterior' }, svg);
    const linha = criarSvg('path', { class: 'g-linha' }, svg);
    const mira = criarSvg('line', { class: 'g-mira' }, svg);
    const pontoAnterior = criarSvg('circle', { class: 'g-ponto-anterior', r: 3.5 }, svg);
    const ponto = criarSvg('circle', { class: 'g-ponto', r: 4.5 }, svg);
    const pulso = criarSvg('g', { class: 'g-pulso' }, svg);
    criarSvg('circle', { class: 'g-pulso-anel', r: 4 }, pulso);
    criarSvg('circle', { class: 'g-pulso-nucleo', r: 4.5 }, pulso);

    const estado = { datas: [], atual: [], anterior: [], min: 0, max: 1, periodo: '30d' };
    let largura = 0;
    let altura = 0;
    let indiceMira = -1;
    let animando = false;
    let cancelar = () => {};

    const larguraUtil = () => largura - margem.esquerda - margem.direita;
    const escalaX = (i) => margem.esquerda + (estado.atual.length > 1 ? i / (estado.atual.length - 1) : 0.5) * larguraUtil();
    const escalaY = (v) => margem.topo + (1 - (v - estado.min) / (estado.max - estado.min || 1)) * (altura - margem.topo - margem.base);

    function medir() {
      const r = caixa.getBoundingClientRect();
      const mudou = Math.round(r.width) !== largura || Math.round(r.height) !== altura;
      largura = Math.max(160, Math.round(r.width));
      altura = Math.max(140, Math.round(r.height));
      svg.setAttribute('viewBox', `0 0 ${largura} ${altura}`);
      return mudou;
    }

    function desenharEixoX() {
      gEixoX.textContent = '';
      const n = estado.datas.length;
      if (!n) return;
      const maxRotulos = Math.max(2, Math.floor(larguraUtil() / 78));
      const k = Math.min(n, maxRotulos);
      const y = altura - 8;
      for (let j = 0; j < k; j++) {
        const i = k === 1 ? n - 1 : Math.round((j * (n - 1)) / (k - 1));
        const d = estado.datas[i];
        const texto = criarSvg('text', {
          x: escalaX(i), y,
          'text-anchor': j === 0 && k > 1 ? 'start' : j === k - 1 && k > 1 ? 'end' : 'middle',
        }, gEixoX);
        texto.textContent = estado.periodo === '7d' ? `${DIAS_SEMANA[d.getDay()]} ${d.getDate()}` : dataCurta(d);
      }
    }

    function desenhar() {
      // Grade horizontal e rótulos do eixo Y
      for (let k = 0; k <= DIVISOES; k++) {
        const valor = estado.min + ((estado.max - estado.min) * k) / DIVISOES;
        const y = Math.round(escalaY(valor)) + 0.5;
        linhasGrade[k].setAttribute('x1', margem.esquerda);
        linhasGrade[k].setAttribute('x2', largura - margem.direita);
        linhasGrade[k].setAttribute('y1', y);
        linhasGrade[k].setAttribute('y2', y);
        rotulosY[k].setAttribute('x', margem.esquerda - 10);
        rotulosY[k].setAttribute('y', y + 4);
        rotulosY[k].textContent = formatarCompacto(Math.round(valor));
      }
      if (!estado.atual.length) return;

      // Séries
      const pontosAtual = estado.atual.map((v, i) => [escalaX(i), escalaY(v)]);
      const pontosAnterior = estado.anterior.map((v, i) => [escalaX(i), escalaY(v)]);
      const d = caminhoSuave(pontosAtual);
      const base = altura - margem.base;
      linha.setAttribute('d', d);
      area.setAttribute('d', `${d}L${pontosAtual[pontosAtual.length - 1][0]},${base}L${pontosAtual[0][0]},${base}Z`);
      linhaAnterior.setAttribute('d', caminhoSuave(pontosAnterior));

      // Ponto pulsante no último valor
      const [ux, uy] = pontosAtual[pontosAtual.length - 1];
      pulso.setAttribute('transform', `translate(${ux.toFixed(1)} ${uy.toFixed(1)})`);

      if (indiceMira >= 0 && caixa.classList.contains('com-mira')) posicionarMira(indiceMira);
    }

    /* Crosshair + tooltip */
    function posicionarMira(i) {
      const n = estado.atual.length;
      if (!n) return;
      indiceMira = limitar(i, 0, n - 1);
      const x = escalaX(indiceMira);
      const valor = estado.atual[indiceMira];
      const valorAnterior = estado.anterior[indiceMira];
      const yA = escalaY(valor);
      mira.setAttribute('x1', x); mira.setAttribute('x2', x);
      mira.setAttribute('y1', margem.topo); mira.setAttribute('y2', altura - margem.base);
      ponto.setAttribute('cx', x); ponto.setAttribute('cy', yA);
      pontoAnterior.setAttribute('cx', x); pontoAnterior.setAttribute('cy', escalaY(valorAnterior));

      const pct = variacaoPct(valor, valorAnterior);
      const data = estado.datas[indiceMira];
      tooltip.innerHTML =
        `<p class="tooltip__data">${data ? dataComDia(data) : ''}</p>` +
        `<p class="tooltip__linha"><span class="tooltip__marca"></span>Atual<strong class="num">${formatar(valor, 'moeda')}</strong></p>` +
        `<p class="tooltip__linha"><span class="tooltip__marca tooltip__marca--anterior"></span>Anterior<strong class="num">${formatar(valorAnterior, 'moeda')}</strong></p>` +
        `<span class="variacao"></span>`;
      preencherVariacao($('.variacao', tooltip), pct);

      // Mantém o tooltip dentro do gráfico (vira para a esquerda perto da borda)
      const lt = tooltip.offsetWidth;
      const at = tooltip.offsetHeight;
      let esquerda = x + 16;
      if (esquerda + lt > largura - 4) esquerda = x - 16 - lt;
      esquerda = limitar(esquerda, 0, Math.max(0, largura - lt));
      const topo = limitar(yA - at / 2, 0, Math.max(0, altura - margem.base - at));
      tooltip.style.transform = `translate(${Math.round(esquerda)}px, ${Math.round(topo)}px)`;
      return { data, valor, valorAnterior, pct };
    }
    const mostrarMira = () => caixa.classList.add('com-mira');
    const esconderMira = () => caixa.classList.remove('com-mira');

    function indicePorPonteiro(evento) {
      const r = caixa.getBoundingClientRect();
      const x = evento.clientX - r.left;
      return Math.round(((x - margem.esquerda) / larguraUtil()) * (estado.atual.length - 1));
    }
    caixa.addEventListener('pointermove', (e) => {
      if (animando || !estado.atual.length) return;
      posicionarMira(indicePorPonteiro(e));
      mostrarMira();
    });
    caixa.addEventListener('pointerdown', (e) => {
      if (animando || !estado.atual.length) return;
      posicionarMira(indicePorPonteiro(e));
      mostrarMira();
    });
    caixa.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') esconderMira(); });
    document.addEventListener('pointerdown', (e) => { if (!caixa.contains(e.target)) esconderMira(); });

    // Teclado: setas percorrem os dias e anunciam o valor para leitores de tela
    caixa.addEventListener('keydown', (e) => {
      const n = estado.atual.length;
      if (!n) return;
      const mapa = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
      if (!(e.key in mapa)) return;
      e.preventDefault();
      const alvo = mapa[e.key] === -Infinity ? 0 : mapa[e.key] === Infinity ? n - 1 : (indiceMira < 0 ? n - 1 : indiceMira + mapa[e.key]);
      const info = posicionarMira(alvo);
      mostrarMira();
      if (info && anuncio) {
        anuncio.textContent = `${dataComDia(info.data)}: ${formatar(info.valor, 'moeda')}, período anterior ${formatar(info.valorAnterior, 'moeda')}, ${formatarVariacao(info.pct)}`;
      }
    });
    caixa.addEventListener('focus', () => {
      if (!estado.atual.length || caixa.matches(':hover')) return;
      posicionarMira(indiceMira < 0 ? estado.atual.length - 1 : indiceMira);
      mostrarMira();
    });
    caixa.addEventListener('blur', esconderMira);

    // Redesenha quando o tamanho do contêiner muda (responsivo de verdade)
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => {
        if (medir()) { desenharEixoX(); desenhar(); }
      }).observe(caixa);
    }
    window.addEventListener('resize', () => { if (medir()) { desenharEixoX(); desenhar(); } });

    /** Traço da linha "desenhado" na primeira carga. */
    function animarEntrada() {
      if (movimentoReduzido.matches) return;
      const comprimento = Math.ceil(linha.getTotalLength());
      caixa.classList.add('entrando');
      linha.style.strokeDasharray = `${comprimento} ${comprimento}`;
      linha.style.strokeDashoffset = comprimento;
      linha.getBoundingClientRect(); // força o navegador a aplicar o estado inicial
      linha.style.transition = `stroke-dashoffset ${CONFIG.duracoes.entrada}ms cubic-bezier(.45,.05,.25,1)`;
      linha.style.strokeDashoffset = '0';
      setTimeout(() => {
        linha.style.transition = linha.style.strokeDasharray = linha.style.strokeDashoffset = '';
        caixa.classList.remove('entrando');
      }, CONFIG.duracoes.entrada + 300);
    }

    return {
      atualizar(receita, { periodo, duracao, primeiraVez }) {
        cancelar();
        const n = receita.atual.length;
        const dominio = dominioBonito(receita.atual.concat(receita.anterior));
        estado.periodo = periodo;
        estado.datas = receita.datas.slice();
        medir();

        if (primeiraVez || !estado.atual.length) {
          Object.assign(estado, { atual: receita.atual.slice(), anterior: receita.anterior.slice(), min: dominio.min, max: dominio.max });
          desenharEixoX();
          desenhar();
          animarEntrada();
          return;
        }

        // Transição entre períodos: as séries antigas são reamostradas para o
        // novo número de pontos e "morfam" até os novos valores.
        const de = {
          atual: reamostrar(estado.atual, n),
          anterior: reamostrar(estado.anterior, n),
          min: estado.min,
          max: estado.max,
        };
        animando = true;
        esconderMira();
        estado.atual = de.atual.slice();
        estado.anterior = de.anterior.slice();
        desenharEixoX();
        cancelar = animar(duracao, (t) => {
          estado.atual = de.atual.map((v, i) => misturar(v, receita.atual[i], t));
          estado.anterior = de.anterior.map((v, i) => misturar(v, receita.anterior[i], t));
          estado.min = misturar(de.min, dominio.min, t);
          estado.max = misturar(de.max, dominio.max, t);
          desenhar();
          if (t >= 1) animando = false;
        });
      },
    };
  }

  /* 4.3 Canais — barras horizontais que crescem ----------------------------- */
  function criarCanais(lista, elTotal) {
    const itens = new Map(); // nome → { li, valor, pct, barra, atual }
    let cancelar = () => {};
    let totalAtual = 0;

    function obterItem(nome) {
      if (itens.has(nome)) return itens.get(nome);
      const li = document.createElement('li');
      li.className = 'canal';
      li.innerHTML =
        `<div class="canal__linha"><span class="canal__nome"></span><span class="canal__valor num"></span><span class="canal__pct num"></span></div>` +
        `<div class="canal__trilho" aria-hidden="true"><div class="canal__barra"></div></div>`;
      $('.canal__nome', li).textContent = nome;
      const item = { li, valor: $('.canal__valor', li), pct: $('.canal__pct', li), barra: $('.canal__barra', li), atual: 0 };
      lista.appendChild(li);
      itens.set(nome, item);
      return item;
    }

    return {
      atualizar(canais, { duracao }) {
        cancelar();
        const total = canais.reduce((s, c) => s + c.valor, 0) || 1;
        const maior = Math.max(...canais.map((c) => c.valor)) || 1;
        const transicoes = canais.map((c) => {
          const item = obterItem(c.nome);
          item.li.classList.toggle('canal--lider', c.valor === maior);
          item.pct.textContent = fmtDecimal.format((c.valor / total) * 100) + '%';
          const de = item.atual;
          item.atual = c.valor;
          return { item, de, para: c.valor };
        });
        // Força o navegador a registrar a largura atual (0 na 1ª carga) para a barra "crescer".
        void lista.offsetWidth;
        transicoes.forEach(({ item, para }) => item.barra.style.setProperty('--progresso', (para / maior).toFixed(4)));
        const totalDe = totalAtual;
        totalAtual = total;
        cancelar = animar(duracao, (t) => {
          transicoes.forEach(({ item, de, para }) => { item.valor.textContent = fmtInteiro.format(Math.round(misturar(de, para, t))); });
          elTotal.textContent = fmtInteiro.format(Math.round(misturar(totalDe, total, t)));
        });
      },
    };
  }

  /* 4.4 Donut de dispositivos — fatias SVG com hover ligado à legenda ------- */
  function criarDonut(raiz) {
    const svg = $('svg', raiz);
    const legenda = $('.legenda-donut', raiz);
    const elValor = $('#donut-valor', raiz);
    const elRotulo = $('#donut-rotulo', raiz);
    const RAIO = 48;
    const CIRCUNFERENCIA = 2 * Math.PI * RAIO;
    const VAO = 2.5; // espaço entre fatias
    const g = criarSvg('g', { transform: 'rotate(-90 60 60)' }, svg);
    criarSvg('circle', { class: 'donut__trilho', cx: 60, cy: 60, r: RAIO }, g);

    let fatias = [];       // elementos <circle>
    let botoes = [];       // itens da legenda
    let dados = [];        // [{ nome, valor }]
    let fracoes = [];      // frações exibidas no momento
    let total = 0;
    let cancelar = () => {};

    function mostrarTotal() {
      elValor.textContent = fmtInteiro.format(total);
      elRotulo.textContent = 'sessões';
    }

    function destacar(indice) {
      fatias.forEach((f, i) => {
        f.classList.toggle('ativa', i === indice);
        f.classList.toggle('esmaecida', indice !== null && i !== indice);
      });
      botoes.forEach((b, i) => b.classList.toggle('ativa', i === indice));
      if (indice === null) { mostrarTotal(); return; }
      elValor.textContent = fmtDecimal.format((dados[indice].valor / total) * 100) + '%';
      elRotulo.textContent = dados[indice].nome;
    }

    function construir(quantidade) {
      if (fatias.length === quantidade) return;
      fatias.forEach((f) => f.remove());
      legenda.textContent = '';
      fatias = Array.from({ length: quantidade }, (_, i) => {
        const fatia = criarSvg('circle', { class: 'donut__fatia', cx: 60, cy: 60, r: RAIO, style: `stroke: var(--donut-${(i % 3) + 1})`, 'pointer-events': 'stroke' }, g);
        fatia.addEventListener('pointerenter', () => destacar(i));
        fatia.addEventListener('pointerleave', () => destacar(null));
        return fatia;
      });
      botoes = Array.from({ length: quantidade }, (_, i) => {
        const li = document.createElement('li');
        li.innerHTML =
          `<button class="legenda-donut__item" type="button" style="--cor: var(--donut-${(i % 3) + 1})">` +
          `<span class="legenda-donut__marca" aria-hidden="true"></span><span class="legenda-donut__nome"></span>` +
          `<span class="legenda-donut__pct num"></span><span class="legenda-donut__valor num"></span></button>`;
        const botao = $('button', li);
        botao.addEventListener('pointerenter', () => destacar(i));
        botao.addEventListener('pointerleave', () => destacar(null));
        botao.addEventListener('focus', () => destacar(i));
        botao.addEventListener('blur', () => destacar(null));
        legenda.appendChild(li);
        return botao;
      });
      fracoes = new Array(quantidade).fill(0);
    }

    function desenhar(fracoesAtuais, varredura = 1) {
      let inicio = 0;
      fracoesAtuais.forEach((fr, i) => {
        const comprimento = fr * CIRCUNFERENCIA * varredura;
        const visivel = Math.max(0, comprimento - (fracoesAtuais.length > 1 ? VAO : 0));
        fatias[i].setAttribute('stroke-dasharray', `${visivel.toFixed(2)} ${CIRCUNFERENCIA.toFixed(2)}`);
        fatias[i].setAttribute('stroke-dashoffset', (-inicio).toFixed(2));
        inicio += comprimento;
      });
    }

    return {
      atualizar(dispositivos, { duracao, primeiraVez }) {
        cancelar();
        construir(dispositivos.length);
        dados = dispositivos;
        total = dispositivos.reduce((s, d) => s + d.valor, 0) || 1;
        const novas = dispositivos.map((d) => d.valor / total);
        const antigas = fracoes.slice();
        botoes.forEach((b, i) => {
          $('.legenda-donut__nome', b).textContent = dispositivos[i].nome;
          $('.legenda-donut__pct', b).textContent = fmtDecimal.format(novas[i] * 100) + '%';
          $('.legenda-donut__valor', b).textContent = fmtInteiro.format(dispositivos[i].valor);
          b.setAttribute('aria-label', `${dispositivos[i].nome}: ${fmtDecimal.format(novas[i] * 100)}%, ${fmtInteiro.format(dispositivos[i].valor)} sessões`);
        });
        mostrarTotal();
        cancelar = animar(duracao, (t) => {
          if (primeiraVez) desenhar(novas, t); // varredura no sentido horário
          else desenhar(novas.map((f, i) => misturar(antigas[i], f, t)));
          // Guarda o que está na tela: se o período mudar no meio, a próxima transição parte daqui.
          fracoes = primeiraVez ? novas.map((f) => f * t) : novas.map((f, i) => misturar(antigas[i], f, t));
        });
      },
    };
  }

  /* 4.5 Tabela de páginas — ordenação por coluna, filtro e barras ----------- */
  function criarTabela(tabela) {
    const corpo = tabela.tBodies[0];
    const linhas = new Map(); // caminho → { tr, celulas }
    let dados = [];
    let filtro = '';
    const ordem = { coluna: 'visualizacoes', direcao: 'desc' };

    const linhaVazia = document.createElement('tr');
    linhaVazia.className = 'tabela__vazia';
    linhaVazia.hidden = true;
    linhaVazia.innerHTML = '<td colspan="5">Nenhuma página encontrada.</td>';

    function obterLinha(caminho) {
      if (linhas.has(caminho)) return linhas.get(caminho);
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<th scope="row"></th>` +
        `<td><div class="celula-barra"><span></span><span class="barra-mini" aria-hidden="true"><span></span></span></div></td>` +
        `<td class="direita"></td><td class="direita"></td><td class="direita"><span></span></td>`;
      const celulas = {
        caminho: tr.cells[0],
        visualizacoes: $('.celula-barra > span', tr),
        barra: $('.barra-mini > span', tr),
        visitantes: tr.cells[2],
        tempoMedio: tr.cells[3],
        rejeicao: $('span', tr.cells[4]),
      };
      celulas.caminho.textContent = caminho;
      celulas.caminho.title = caminho;
      const linha = { tr, celulas };
      linhas.set(caminho, linha);
      return linha;
    }

    function comparar(a, b) {
      const va = a[ordem.coluna];
      const vb = b[ordem.coluna];
      const r = typeof va === 'string' ? va.localeCompare(vb, 'pt-BR') : va - vb;
      return ordem.direcao === 'asc' ? r : -r;
    }

    /** Reordena as linhas; com animar=true usa a técnica FLIP para deslizar. */
    function reordenar(animarLinhas) {
      const ordenadas = dados.slice().sort(comparar);
      const animar = animarLinhas && !movimentoReduzido.matches;
      const antes = new Map();
      if (animar) linhas.forEach((l, k) => antes.set(k, l.tr.getBoundingClientRect().top));
      ordenadas.forEach((p) => corpo.appendChild(linhas.get(p.caminho).tr));
      corpo.appendChild(linhaVazia);
      if (!animar) return;
      const movidas = [];
      linhas.forEach((l, k) => {
        const delta = antes.get(k) - l.tr.getBoundingClientRect().top;
        if (delta) { l.tr.style.transition = 'none'; l.tr.style.transform = `translateY(${delta}px)`; movidas.push(l.tr); }
      });
      corpo.getBoundingClientRect(); // aplica a posição inicial
      movidas.forEach((tr) => {
        tr.style.transition = 'transform .45s cubic-bezier(.22,1,.36,1)';
        tr.style.transform = '';
      });
    }

    function aplicarFiltro() {
      let visiveis = 0;
      linhas.forEach((l, caminho) => {
        const mostra = caminho.toLowerCase().includes(filtro);
        l.tr.hidden = !mostra;
        if (mostra) visiveis++;
      });
      linhaVazia.hidden = visiveis > 0;
    }

    function atualizarCabecalho() {
      $$('th[data-coluna]', tabela).forEach((th) => {
        if (th.dataset.coluna === ordem.coluna) th.setAttribute('aria-sort', ordem.direcao === 'asc' ? 'ascending' : 'descending');
        else th.removeAttribute('aria-sort');
      });
    }

    $$('th[data-coluna] button', tabela).forEach((botao) => {
      botao.addEventListener('click', () => {
        const coluna = botao.closest('th').dataset.coluna;
        if (ordem.coluna === coluna) ordem.direcao = ordem.direcao === 'asc' ? 'desc' : 'asc';
        else { ordem.coluna = coluna; ordem.direcao = coluna === 'caminho' ? 'asc' : 'desc'; }
        atualizarCabecalho();
        reordenar(true);
      });
    });

    return {
      atualizar(paginas) {
        dados = paginas.slice();
        const maior = Math.max(...paginas.map((p) => p.visualizacoes)) || 1;
        paginas.forEach((p) => {
          const { celulas } = obterLinha(p.caminho);
          celulas.visualizacoes.textContent = fmtInteiro.format(p.visualizacoes);
          celulas.visitantes.textContent = fmtInteiro.format(p.visitantes);
          celulas.tempoMedio.textContent = formatarDuracao(p.tempoMedio);
          celulas.rejeicao.textContent = fmtDecimal.format(p.rejeicao) + '%';
          celulas.rejeicao.className = p.rejeicao >= 50 ? 'rejeicao--alta' : '';
        });
        // Remove páginas que não vieram nos dados novos
        linhas.forEach((l, caminho) => {
          if (!paginas.some((p) => p.caminho === caminho)) { l.tr.remove(); linhas.delete(caminho); }
        });
        reordenar(false);
        aplicarFiltro();
        // Barras de progresso: registra o estado atual e só então aplica o novo (anima).
        void corpo.offsetWidth;
        paginas.forEach((p) => linhas.get(p.caminho).celulas.barra.style.setProperty('--progresso', (p.visualizacoes / maior).toFixed(4)));
      },
      filtrar(texto) {
        filtro = texto.trim().toLowerCase();
        aplicarFiltro();
      },
    };
  }

  /* 4.6 Feed ao vivo — eventos entrando no topo (máx. 6) -------------------- */
  const escaparHtml = (texto) => String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const TIPOS_EVENTO = {
    assinatura:   { tom: 'sinal',  texto: (e) => `<strong></strong> assinou o plano ${escaparHtml(e.plano)}`,  valor: (e) => '+' + formatar(e.valor, 'moeda') },
    teste:        { tom: 'neutro', texto: () => `<strong></strong> iniciou um teste grátis`,                   valor: () => '14 dias' },
    upgrade:      { tom: 'sinal',  texto: (e) => `<strong></strong> fez upgrade para ${escaparHtml(e.plano)}`, valor: (e) => '+' + formatar(e.valor, 'moeda') },
    cancelamento: { tom: 'alerta', texto: (e) => `<strong></strong> cancelou o plano ${escaparHtml(e.plano)}`, valor: (e) => '−' + formatar(e.valor, 'moeda') },
    falha:        { tom: 'alerta', texto: () => `Pagamento recusado · <strong></strong>`,             valor: (e) => formatar(e.valor, 'moeda') },
  };

  function criarFeed(lista, elOnline) {
    const itens = []; // { evento, li, elTempo }
    let online = Number(elOnline.textContent) || 200;

    function montarItem(evento) {
      const tipo = TIPOS_EVENTO[evento.tipo] || TIPOS_EVENTO.assinatura;
      const li = document.createElement('li');
      li.className = `feed__item feed__item--${tipo.tom}`;
      li.innerHTML =
        `<span class="feed__icone" aria-hidden="true">${ICONES[evento.tipo] || ICONES.assinatura}</span>` +
        `<div class="feed__texto"><p class="feed__titulo">${tipo.texto(evento)}</p><p class="feed__meta"><span></span> · <time></time></p></div>` +
        `<span class="feed__valor num"></span>`;
      // Textos vindos de dados entram via textContent (seguro contra HTML injetado)
      $('strong', li).textContent = evento.cliente;
      $('.feed__meta span', li).textContent = evento.cidade || '';
      $('.feed__valor', li).textContent = tipo.valor(evento);
      const elTempo = $('time', li);
      elTempo.dateTime = new Date(evento.quando).toISOString();
      elTempo.textContent = tempoRelativo(evento.quando);
      return { li, elTempo };
    }

    function adicionar(evento, { animado = true } = {}) {
      const ev = Object.assign({ quando: Date.now() }, evento);
      ev.quando = +new Date(ev.quando);
      const { li, elTempo } = montarItem(ev);
      if (animado && !movimentoReduzido.matches) {
        li.classList.add('feed__item--entrando');
        li.addEventListener('animationend', (e) => { if (e.target === li) li.classList.remove('feed__item--entrando'); });
      }
      lista.prepend(li);
      itens.unshift({ evento: ev, li, elTempo });
      // Remove o excedente depois da animação (fica escondido pelo overflow).
      while (itens.length > CONFIG.feed.maxItens) {
        const velho = itens.pop();
        setTimeout(() => velho.li.remove(), animado ? 600 : 0);
      }
      if (animado) {
        online = limitar(online + Math.round((aleatorioFeed() - 0.45) * 8), 160, 290);
        elOnline.textContent = fmtInteiro.format(online);
      }
    }

    function atualizarTempos() {
      itens.forEach(({ evento, elTempo }) => { elTempo.textContent = tempoRelativo(evento.quando); });
    }

    return { adicionar, atualizarTempos };
  }


  /* ========================================================================
     5. INTERFACE
     ======================================================================== */

  /* Tema claro/escuro (salvo no localStorage) */
  function iniciarTema() {
    const botao = $('#botao-tema');
    const raiz = document.documentElement;
    const sincronizar = () => {
      const claro = raiz.getAttribute('data-tema') === 'claro';
      botao.setAttribute('aria-label', claro ? 'Ativar tema escuro' : 'Ativar tema claro');
    };
    botao.addEventListener('click', () => {
      const novo = raiz.getAttribute('data-tema') === 'claro' ? 'escuro' : 'claro';
      raiz.setAttribute('data-tema', novo);
      try { localStorage.setItem(CONFIG.chaveTema, novo); } catch (e) { /* sem persistência */ }
      sincronizar();
    });
    sincronizar();
  }

  /* Menu gaveta (abaixo de 900px) */
  function iniciarGaveta() {
    const botaoAbrir = $('#botao-menu');
    const botaoFechar = $('#fechar-menu');
    const lateral = $('#menu-lateral');
    const fundo = $('#fundo-gaveta');
    const telaLarga = window.matchMedia('(min-width: 900px)');
    const focaveis = () => $$('a[href], button:not([disabled])', lateral).filter((el) => el.offsetParent !== null);

    function abrir() {
      document.body.classList.add('gaveta-aberta');
      botaoAbrir.setAttribute('aria-expanded', 'true');
      lateral.setAttribute('role', 'dialog');
      lateral.setAttribute('aria-modal', 'true');
      setTimeout(() => (focaveis()[0] || lateral).focus(), 60);
    }
    function fechar(devolverFoco = true) {
      if (!document.body.classList.contains('gaveta-aberta')) return;
      document.body.classList.remove('gaveta-aberta');
      botaoAbrir.setAttribute('aria-expanded', 'false');
      lateral.removeAttribute('role');
      lateral.removeAttribute('aria-modal');
      if (devolverFoco) botaoAbrir.focus();
    }

    botaoAbrir.addEventListener('click', abrir);
    botaoFechar.addEventListener('click', () => fechar());
    fundo.addEventListener('click', () => fechar());
    document.addEventListener('keydown', (e) => {
      if (!document.body.classList.contains('gaveta-aberta')) return;
      if (e.key === 'Escape') { e.preventDefault(); fechar(); return; }
      if (e.key !== 'Tab') return;
      // Mantém o foco dentro da gaveta enquanto ela está aberta
      const lista = focaveis();
      if (!lista.length) return;
      const primeiro = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    });
    telaLarga.addEventListener('change', (e) => { if (e.matches) fechar(false); });

    // Navegação de demonstração: marca o item clicado como ativo
    $$('.nav__link', lateral).forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        $$('.nav__link', lateral).forEach((l) => l.removeAttribute('aria-current'));
        link.setAttribute('aria-current', 'page');
        fechar(false);
      });
    });
  }

  /* Busca: filtra a tabela de páginas. Atalho "/" foca o campo. */
  function iniciarBusca(tabela) {
    const campo = $('#campo-busca');
    campo.addEventListener('input', () => tabela.filtrar(campo.value));
    campo.addEventListener('keydown', (e) => { if (e.key === 'Escape') { campo.value = ''; tabela.filtrar(''); } });
    document.addEventListener('keydown', (e) => {
      const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      if (e.key === '/' && !digitando && !e.metaKey && !e.ctrlKey) { e.preventDefault(); campo.focus(); }
    });
  }


  /* ========================================================================
     6. INICIALIZAÇÃO
     ======================================================================== */
  function iniciar() {
    const componentes = {
      kpis: new Map($$('[data-kpi]').map((cartao) => [cartao.dataset.kpi, criarKpi(cartao)])),
      receita: criarGraficoReceita($('#grafico-receita'), $('#grafico-anuncio')),
      canais: criarCanais($('#canais'), $('#total-cadastros')),
      donut: criarDonut($('#donut-dispositivos')),
      tabela: criarTabela($('#tabela-paginas')),
      feed: criarFeed($('#feed'), $('#usuarios-online')),
    };
    const elSubtitulo = $('#subtitulo-periodo');
    const elTotalReceita = $('#total-receita');
    const elVariacaoReceita = $('#variacao-receita');
    const painel = $('#conteudo');
    const segmentado = $('.segmentado');
    let totalReceitaExibido = 0;
    let cancelarTotal = () => {};
    let pedidoAtual = 0;
    let periodoAtual = null;

    /** Aplica um objeto DadosPainel em todos os componentes. */
    function aplicarDados(dados, periodo, primeiraVez) {
      const duracao = primeiraVez ? CONFIG.duracoes.entrada : CONFIG.duracoes.troca;
      const opcoes = { periodo, duracao, primeiraVez };

      dados.kpis.forEach((kpi) => componentes.kpis.get(kpi.id)?.atualizar(kpi, opcoes));
      componentes.receita.atualizar(dados.receita, opcoes);
      componentes.canais.atualizar(dados.canais, opcoes);
      componentes.donut.atualizar(dados.dispositivos, opcoes);
      componentes.tabela.atualizar(dados.paginas, opcoes);

      // Resumo do gráfico principal
      const soma = (lista) => lista.reduce((s, v) => s + v, 0);
      const total = soma(dados.receita.atual);
      preencherVariacao(elVariacaoReceita, variacaoPct(total, soma(dados.receita.anterior)));
      cancelarTotal();
      const de = totalReceitaExibido;
      cancelarTotal = animar(duracao, (t) => { elTotalReceita.textContent = formatar(misturar(de, total, t), 'moeda'); });
      totalReceitaExibido = total;

      // Subtítulo: "Últimos 30 dias · 30 set – 29 out 2026"
      const datas = dados.receita.datas;
      if (datas.length) {
        const fim = datas[datas.length - 1];
        elSubtitulo.textContent = `${PERIODOS[periodo].nome} · ${dataCurta(datas[0])} – ${dataCurta(fim)} ${fim.getFullYear()}`;
      }
    }

    /** Troca o período ('7d' | '30d' | '90d') e anima todos os gráficos. */
    async function definirPeriodo(periodo, primeiraVez = false) {
      if (!PERIODOS[periodo] || (periodo === periodoAtual && !primeiraVez)) return;
      periodoAtual = periodo;
      const botoes = $$('button[data-periodo]', segmentado);
      botoes.forEach((b, i) => {
        const ativo = b.dataset.periodo === periodo;
        b.setAttribute('aria-pressed', String(ativo));
        if (ativo) segmentado.style.setProperty('--indice', i);
      });
      const pedido = ++pedidoAtual;
      painel.setAttribute('aria-busy', 'true');
      try {
        const dados = await obterDados(periodo);
        if (pedido !== pedidoAtual) return; // chegou uma resposta mais nova
        aplicarDados(dados, periodo, primeiraVez);
      } catch (erro) {
        console.warn('[Painel Órbita] Não foi possível carregar os dados:', erro);
      } finally {
        if (pedido === pedidoAtual) painel.removeAttribute('aria-busy');
      }
    }

    $$('button[data-periodo]', segmentado).forEach((b) => b.addEventListener('click', () => definirPeriodo(b.dataset.periodo)));

    iniciarTema();
    iniciarGaveta();
    iniciarBusca(componentes.tabela);
    definirPeriodo(CONFIG.periodoInicial, true);

    /* Feed ao vivo: alguns eventos iniciais + um novo a cada ~3 s */
    let pausado = false;
    const botaoPausa = $('#pausar-feed');
    botaoPausa.addEventListener('click', () => {
      pausado = !pausado;
      botaoPausa.setAttribute('aria-pressed', String(pausado));
      $('span', botaoPausa).textContent = pausado ? 'Retomar' : 'Pausar';
    });
    if (CONFIG.feed.simular) {
      const agora = Date.now();
      [176, 134, 71, 38, 17, 6].forEach((segundos) => componentes.feed.adicionar(gerarEventoDemo(agora - segundos * 1000), { animado: false }));
      setInterval(() => {
        if (!pausado && !document.hidden) componentes.feed.adicionar(gerarEventoDemo());
      }, CONFIG.feed.intervaloMs);
    }
    setInterval(componentes.feed.atualizarTempos, 1000);

    /* API pública — para integrar com seu backend/WebSocket:
         PainelOrbita.adicionarEvento({ tipo: 'assinatura', cliente: 'ACME', plano: 'Pro', valor: 249, cidade: 'Recife' })
         PainelOrbita.definirPeriodo('90d')
         PainelOrbita.recarregar()          // busca obterDados() de novo no período atual */
    window.PainelOrbita = {
      adicionarEvento: (evento) => componentes.feed.adicionar(evento),
      definirPeriodo: (periodo) => definirPeriodo(periodo),
      recarregar: async () => {
        const dados = await obterDados(periodoAtual);
        aplicarDados(dados, periodoAtual, false);
      },
      formatar,
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
