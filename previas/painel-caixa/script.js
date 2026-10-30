/* =============================================================
   PAINEL CAIXA — script.js
   JavaScript puro, sem dependências. Funciona abrindo o
   index.html direto no navegador (file://).

   Sumário
   1. DADOS ................ ← plugue seus dados reais aqui
   2. Histórico de demonstração (pode apagar)
   3. Formatação pt-BR
   4. Cálculos (funções puras sobre DADOS)
   5. Motor de animação (count-up e interpolação)
   6. Cabeçalho e seletor de mês
   7. 01 Saldo e indicadores
   8. 02 Cartão (flip + limite)
   9. 03 Gráfico de fluxo de caixa (SVG feito à mão)
   10. 04 Orçamento (anéis)
   11. 05 Transações (filtros + busca)
   12. 06 Metas e Nota do mês
   13. Modal "Nova transação"
   14. Inicialização
   ============================================================= */
(function () {
  'use strict';

  /* ===========================================================
     1. DADOS
     Tudo o que aparece na tela sai deste objeto. Para usar dados
     reais, substitua os valores abaixo (ou preencha DADOS com o
     retorno da sua API antes de chamar iniciar(), no fim do arquivo).
     =========================================================== */
  const DADOS = {
    /** Data de referência ("hoje"), formato AAAA-MM-DD.
     *  Em produção, use: new Date().toISOString().slice(0, 10) */
    hoje: '2026-10-29',

    /** Quem está usando o painel (cabeçalho) */
    usuario: { nome: 'Marina', negocio: 'Ateliê Marina Couto' },

    /** Saldo em caixa no início do histórico. O saldo de cada mês é
     *  calculado somando entradas e subtraindo saídas a partir daqui. */
    saldoInicial: { data: '2026-04-01', valor: 29640.25 },

    /** Quantos meses aparecem no seletor e no gráfico (terminando em "hoje") */
    mesesVisiveis: 6,

    /** Cartão desenhado no bloco 02. "usado" = soma das saídas do mês
     *  com meio "cartao". */
    cartao: {
      titular: 'MARINA COUTO',
      final: '4821',
      validade: '08/29',
      limite: 9000,
      diaFechamento: 5,
      diaVencimento: 12,
    },

    /** Categorias. tipo: 'entrada' | 'saida'.
     *  orcamento (opcional, só saídas): teto mensal → vira um anel no bloco 04.
     *  icone: id de um <symbol> do sprite no index.html (sem o "i-"). */
    categorias: {
      vendas:      { nome: 'Vendas',      tipo: 'entrada', icone: 'sacola' },
      servicos:    { nome: 'Serviços',    tipo: 'entrada', icone: 'vaso' },
      rendimentos: { nome: 'Rendimentos', tipo: 'entrada', icone: 'rendimento' },
      moradia:     { nome: 'Moradia',     tipo: 'saida', icone: 'casa',     orcamento: 3200 },
      insumos:     { nome: 'Insumos',     tipo: 'saida', icone: 'caixa',    orcamento: 4200 },
      mercado:     { nome: 'Mercado',     tipo: 'saida', icone: 'carrinho', orcamento: 1500 },
      transporte:  { nome: 'Transporte',  tipo: 'saida', icone: 'carro',    orcamento: 800 },
      lazer:       { nome: 'Lazer',       tipo: 'saida', icone: 'taca',     orcamento: 600 },
      contas:      { nome: 'Contas',      tipo: 'saida', icone: 'raio',     orcamento: 2600 },
      reserva:     { nome: 'Reserva',     tipo: 'saida', icone: 'cofre' },
    },

    /** Meios de pagamento (id → rótulo) */
    meios: { pix: 'Pix', cartao: 'Cartão', boleto: 'Boleto', debito: 'Débito' },

    /** Percentual do orçamento a partir do qual o anel fica em alerta */
    alertaOrcamento: 90,

    /** Metas. prazo no formato AAAA-MM.
     *  - Meta com "categoria": o valor guardado = guardadoInicial + soma das
     *    transações daquela categoria até o mês selecionado (ex.: aportes).
     *  - Meta sem "categoria": usa o valor fixo "guardado".
     *  A meta com id 'reserva' também alimenta o indicador "Reserva". */
    metas: [
      { id: 'reserva', nome: 'Reserva de emergência', descricao: 'Seis meses de custo fixo do ateliê', alvo: 30000, guardadoInicial: 16900, categoria: 'reserva', prazo: '2027-06' },
      { id: 'lisboa',  nome: 'Viagem a Lisboa',       descricao: 'Passagens e hospedagem para duas pessoas', alvo: 12000, guardado: 7250, prazo: '2027-03' },
      { id: 'forno',   nome: 'Forno cerâmico novo',   descricao: 'Forno elétrico de 120 litros', alvo: 9500, guardado: 4100, prazo: '2026-12' },
    ],

    /** Transações. Campos:
     *  data 'AAAA-MM-DD' · descricao · categoria (id acima)
     *  tipo 'entrada' | 'saida' · valor (número positivo) · meio (id acima)
     *  Abaixo, o mês de outubro escrito à mão; os meses anteriores são
     *  gerados na seção 2 apenas para a demonstração. */
    transacoes: [
      { data: '2026-10-02', descricao: 'Vendas na loja online',          categoria: 'vendas',      tipo: 'entrada', valor: 3284.50, meio: 'pix' },
      { data: '2026-10-07', descricao: 'Projeto de identidade — Café Barro', categoria: 'servicos', tipo: 'entrada', valor: 3600.00, meio: 'pix' },
      { data: '2026-10-12', descricao: 'Vendas na loja online',          categoria: 'vendas',      tipo: 'entrada', valor: 3912.30, meio: 'pix' },
      { data: '2026-10-16', descricao: 'Oficina de cerâmica (turma 12)', categoria: 'servicos',    tipo: 'entrada', valor: 2160.00, meio: 'pix' },
      { data: '2026-10-22', descricao: 'Vendas na loja online',          categoria: 'vendas',      tipo: 'entrada', valor: 2947.80, meio: 'pix' },
      { data: '2026-10-28', descricao: 'Rendimento CDB',                 categoria: 'rendimentos', tipo: 'entrada', valor: 152.37,  meio: 'pix' },

      { data: '2026-10-03', descricao: 'Argila e esmaltes',              categoria: 'insumos',    tipo: 'saida', valor: 1286.40, meio: 'cartao' },
      { data: '2026-10-04', descricao: 'Supermercado',                   categoria: 'mercado',    tipo: 'saida', valor: 486.72,  meio: 'cartao' },
      { data: '2026-10-05', descricao: 'Aluguel do ateliê',              categoria: 'moradia',    tipo: 'saida', valor: 2450.00, meio: 'boleto' },
      { data: '2026-10-05', descricao: 'Condomínio',                     categoria: 'moradia',    tipo: 'saida', valor: 318.00,  meio: 'boleto' },
      { data: '2026-10-06', descricao: 'Plano de saúde',                 categoria: 'contas',     tipo: 'saida', valor: 428.60,  meio: 'boleto' },
      { data: '2026-10-08', descricao: 'Energia elétrica',               categoria: 'contas',     tipo: 'saida', valor: 386.15,  meio: 'boleto' },
      { data: '2026-10-08', descricao: 'Internet fibra',                 categoria: 'contas',     tipo: 'saida', valor: 129.90,  meio: 'debito' },
      { data: '2026-10-09', descricao: 'Combustível',                    categoria: 'transporte', tipo: 'saida', valor: 238.40,  meio: 'cartao' },
      { data: '2026-10-10', descricao: 'Jantar no Bistrô Ana',           categoria: 'lazer',      tipo: 'saida', valor: 214.00,  meio: 'cartao' },
      { data: '2026-10-11', descricao: 'Feira orgânica',                 categoria: 'mercado',    tipo: 'saida', valor: 132.50,  meio: 'pix' },
      { data: '2026-10-14', descricao: 'Embalagens e etiquetas',         categoria: 'insumos',    tipo: 'saida', valor: 438.90,  meio: 'pix' },
      { data: '2026-10-15', descricao: 'Assinaturas de software',        categoria: 'contas',     tipo: 'saida', valor: 236.40,  meio: 'cartao' },
      { data: '2026-10-17', descricao: 'Cinema',                         categoria: 'lazer',      tipo: 'saida', valor: 96.00,   meio: 'cartao' },
      { data: '2026-10-18', descricao: 'Supermercado',                   categoria: 'mercado',    tipo: 'saida', valor: 541.18,  meio: 'cartao' },
      { data: '2026-10-20', descricao: 'Gás do forno',                   categoria: 'insumos',    tipo: 'saida', valor: 690.00,  meio: 'boleto' },
      { data: '2026-10-20', descricao: 'DAS — Simples Nacional',         categoria: 'contas',     tipo: 'saida', valor: 1034.82, meio: 'boleto' },
      { data: '2026-10-21', descricao: 'App de transporte',              categoria: 'transporte', tipo: 'saida', valor: 64.90,   meio: 'cartao' },
      { data: '2026-10-24', descricao: 'Show no Circo Voador',           categoria: 'lazer',      tipo: 'saida', valor: 338.00,  meio: 'cartao' },
      { data: '2026-10-25', descricao: 'Hortifrúti',                     categoria: 'mercado',    tipo: 'saida', valor: 248.60,  meio: 'cartao' },
      { data: '2026-10-27', descricao: 'Combustível',                    categoria: 'transporte', tipo: 'saida', valor: 221.10,  meio: 'cartao' },
      { data: '2026-10-28', descricao: 'Aporte na reserva',              categoria: 'reserva',    tipo: 'saida', valor: 800.00,  meio: 'pix' },
    ],
  };

  /* ===========================================================
     2. HISTÓRICO DE DEMONSTRAÇÃO
     Gera, de forma determinística, os meses entre saldoInicial e
     o mês anterior a "hoje", para o gráfico ter o que mostrar.
     ➜ Com dados reais, APAGUE esta seção e a chamada em iniciar().
     =========================================================== */
  function gerarHistoricoDemo() {
    // [dia, descrição, categoria, meio, valor base, variação ±]
    const MODELO = [
      [2,  'Vendas na loja online',   'vendas',      'pix',    3050, 0.18],
      [12, 'Vendas na loja online',   'vendas',      'pix',    3250, 0.18],
      [22, 'Vendas na loja online',   'vendas',      'pix',    2800, 0.20],
      [8,  'Projeto de identidade',   'servicos',    'pix',    2900, 0.30],
      [17, 'Oficina de cerâmica',     'servicos',    'pix',    1900, 0.15],
      [28, 'Rendimento CDB',          'rendimentos', 'pix',    138,  0.08],
      [5,  'Aluguel do ateliê',       'moradia',     'boleto', 2450, 0],
      [5,  'Condomínio',              'moradia',     'boleto', 318,  0],
      [3,  'Argila e esmaltes',       'insumos',     'cartao', 1500, 0.25],
      [14, 'Embalagens e etiquetas',  'insumos',     'pix',    460,  0.20],
      [20, 'Gás do forno',            'insumos',     'boleto', 660,  0.15],
      [4,  'Supermercado',            'mercado',     'cartao', 540,  0.15],
      [11, 'Feira orgânica',          'mercado',     'pix',    130,  0.20],
      [19, 'Supermercado',            'mercado',     'cartao', 500,  0.20],
      [9,  'Combustível',             'transporte',  'cartao', 240,  0.12],
      [24, 'App de transporte',       'transporte',  'cartao', 95,   0.40],
      [13, 'Restaurante',             'lazer',       'cartao', 210,  0.35],
      [26, 'Cinema',                  'lazer',       'cartao', 92,   0.30],
      [6,  'Plano de saúde',          'contas',      'boleto', 428.6, 0],
      [8,  'Energia elétrica',        'contas',      'boleto', 370,  0.15],
      [8,  'Internet fibra',          'contas',      'debito', 129.9, 0],
      [15, 'Assinaturas de software', 'contas',      'cartao', 236.4, 0],
      [20, 'DAS — Simples Nacional',  'contas',      'boleto', 980,  0.12],
      [28, 'Aporte na reserva',       'reserva',     'pix',    800,  0],
    ];
    // Sazonalidade: [fator das entradas, fator das saídas variáveis]
    const SAZONAL = [[0.92, 1.0], [1.18, 1.04], [0.8, 1.08], [0.88, 1.12], [1.02, 0.98], [1.06, 1.0]];
    // Gastos pontuais: [nº do mês no histórico (0 = primeiro), dia, descrição, categoria, meio, valor]
    const PONTUAIS = [
      [1, 10, 'Dia das Mães — estoque extra', 'insumos', 'cartao', 1840],
      [3, 16, 'Conserto do forno', 'insumos', 'pix', 3650],
      [3, 21, 'Férias em Paraty', 'lazer', 'cartao', 1980],
      [4, 7, 'IPVA (última parcela)', 'transporte', 'boleto', 612.4],
    ];

    // Pseudoaleatório com semente (mulberry32): mesmos números a cada carregamento
    let semente = 20261029;
    const aleatorio = () => {
      semente |= 0; semente = (semente + 0x6D2B79F5) | 0;
      let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    const saida = [];
    let mes = chaveMes(DADOS.saldoInicial.data);
    const ultimo = somarMeses(chaveMes(DADOS.hoje), -1);
    let i = 0;
    while (mes <= ultimo) {
      const [fe, fs] = SAZONAL[i % SAZONAL.length];
      MODELO.forEach(([dia, descricao, categoria, meio, base, variacao]) => {
        const tipo = DADOS.categorias[categoria].tipo;
        const fator = variacao ? (tipo === 'entrada' ? fe : fs) : 1;
        const valor = arredondar(base * fator * (1 + (aleatorio() - 0.5) * 2 * variacao));
        saida.push({ data: `${mes}-${String(dia).padStart(2, '0')}`, descricao, categoria, tipo, valor, meio });
      });
      PONTUAIS.filter((p) => p[0] === i).forEach(([, dia, descricao, categoria, meio, valor]) => {
        saida.push({ data: `${mes}-${String(dia).padStart(2, '0')}`, descricao, categoria, tipo: 'saida', valor, meio });
      });
      mes = somarMeses(mes, 1);
      i++;
    }
    return saida;
  }

  /* ===========================================================
     3. FORMATAÇÃO pt-BR
     =========================================================== */
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

  const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtMoedaInteira = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, minimumFractionDigits: 0 });
  const fmtDecimal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtUmaCasa = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmtCompacto = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

  const arredondar = (v) => Math.round(v * 100) / 100;

  /** R$ 12.480,90 (negativos com sinal de menos tipográfico) */
  function brl(v) {
    const s = fmtMoeda.format(Math.abs(v));
    return v < -0.004 ? '−' + s : s;
  }
  /** R$ 12.481 (sem centavos) */
  const brlInteiro = (v) => fmtMoedaInteira.format(Math.round(v));
  /** + R$ 1.200,00 / − R$ 80,00 */
  const brlComSinal = (v) => (v >= 0 ? '+\u00a0' : '−\u00a0') + fmtMoeda.format(Math.abs(v)); // espaço não separável
  /** 12,5 mil — usado nos eixos do gráfico */
  const compacto = (v) => (Math.abs(v) >= 1000 ? fmtCompacto.format(v / 1000) + ' mil' : fmtCompacto.format(v));
  const porcento = (v) => Math.round(v) + '%';

  /** 'AAAA-MM-DD' → { ano, mes, dia } (sem fuso horário) */
  function lerData(iso) {
    const [ano, mes, dia] = iso.split('-').map(Number);
    return { ano, mes, dia };
  }
  /** '2026-10-04' → '04 out' */
  function dataCurta(iso) {
    const { mes, dia } = lerData(iso);
    return String(dia).padStart(2, '0') + ' ' + MESES_CURTOS[mes - 1];
  }

  /* Chaves de mês no formato 'AAAA-MM' (comparáveis como texto) */
  const chaveMes = (iso) => iso.slice(0, 7);
  function somarMeses(chave, n) {
    const [a, m] = chave.split('-').map(Number);
    const total = a * 12 + (m - 1) + n;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
  }
  function diferencaMeses(de, ate) {
    const [a1, m1] = de.split('-').map(Number);
    const [a2, m2] = ate.split('-').map(Number);
    return (a2 - a1) * 12 + (m2 - m1);
  }
  const nomeMes = (chave) => MESES[Number(chave.slice(5, 7)) - 1];
  const nomeMesCurto = (chave) => MESES_CURTOS[Number(chave.slice(5, 7)) - 1];
  const nomeMesAno = (chave) => `${nomeMes(chave)} de ${chave.slice(0, 4)}`;
  const ultimoDiaDoMes = (chave) => new Date(Number(chave.slice(0, 4)), Number(chave.slice(5, 7)), 0).getDate();

  /** Remove acentos e caixa para a busca */
  const normalizar = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  /* ===========================================================
     4. CÁLCULOS — funções puras que leem DADOS
     =========================================================== */
  const transacoesDoMes = (chave) => DADOS.transacoes.filter((t) => chaveMes(t.data) === chave);

  function totaisDoMes(chave) {
    const r = { entradas: 0, saidas: 0, qtdEntradas: 0, qtdSaidas: 0 };
    transacoesDoMes(chave).forEach((t) => {
      if (t.tipo === 'entrada') { r.entradas += t.valor; r.qtdEntradas++; }
      else { r.saidas += t.valor; r.qtdSaidas++; }
    });
    return r;
  }

  /** Saldo em caixa ao fim do mês (saldo inicial + entradas − saídas) */
  function saldoAoFimDe(chave) {
    let saldo = DADOS.saldoInicial.valor;
    DADOS.transacoes.forEach((t) => {
      if (t.data >= DADOS.saldoInicial.data && chaveMes(t.data) <= chave) {
        saldo += t.tipo === 'entrada' ? t.valor : -t.valor;
      }
    });
    return saldo;
  }

  function gastosPorCategoria(chave) {
    const mapa = {};
    transacoesDoMes(chave).forEach((t) => {
      if (t.tipo === 'saida') mapa[t.categoria] = (mapa[t.categoria] || 0) + t.valor;
    });
    return mapa;
  }

  const usoDoCartao = (chave) => transacoesDoMes(chave)
    .filter((t) => t.tipo === 'saida' && t.meio === 'cartao')
    .reduce((soma, t) => soma + t.valor, 0);

  /** Valor guardado numa meta até o fim do mês informado */
  function guardadoNaMeta(meta, chave) {
    if (!meta.categoria) return meta.guardado || 0;
    return DADOS.transacoes.reduce((soma, t) => (
      t.categoria === meta.categoria && chaveMes(t.data) <= chave ? soma + t.valor : soma
    ), meta.guardadoInicial || 0);
  }

  /** Meses do seletor/gráfico, do mais antigo ao mais recente */
  function mesesVisiveis() {
    const fim = chaveMes(DADOS.hoje);
    const lista = [];
    for (let i = DADOS.mesesVisiveis - 1; i >= 0; i--) lista.push(somarMeses(fim, -i));
    return lista;
  }

  /* ===========================================================
     5. MOTOR DE ANIMAÇÃO
     animar(chave, duração, aCadaQuadro(p), aoTerminar, atraso)
     p vai de 0 a 1 com suavização. Respeita prefers-reduced-motion.
     =========================================================== */
  const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const semMovimento = () => movimentoReduzido.matches;
  const suavizar = (p) => 1 - Math.pow(1 - p, 3); // easeOutCubic
  const animacoesAtivas = new Map();

  function animar(chave, duracao, aCadaQuadro, aoTerminar, atraso = 0) {
    const anterior = animacoesAtivas.get(chave);
    if (anterior) cancelAnimationFrame(anterior.raf);
    if (semMovimento() || duracao <= 0) {
      animacoesAtivas.delete(chave);
      aCadaQuadro(1);
      if (aoTerminar) aoTerminar();
      return;
    }
    const registro = { raf: 0 };
    const inicio = performance.now() + atraso;
    const passo = (agora) => {
      const p = Math.max(0, Math.min(1, (agora - inicio) / duracao));
      aCadaQuadro(suavizar(p));
      if (p < 1) registro.raf = requestAnimationFrame(passo);
      else { animacoesAtivas.delete(chave); if (aoTerminar) aoTerminar(); }
    };
    registro.raf = requestAnimationFrame(passo);
    animacoesAtivas.set(chave, registro);
  }

  /** Count-up: anima o texto de um elemento do valor atual até "alvo" */
  function animarNumero(el, alvo, { duracao = 900, atraso = 0, formato = brl } = {}) {
    const de = Number(el.dataset.valor || 0);
    el.dataset.valor = alvo;
    animar(el, duracao, (p) => { el.textContent = formato(de + (alvo - de) * p); }, null, atraso);
  }

  /** Reinicia uma animação CSS de "troca" num elemento */
  function pulsar(el, classe = 'troca') {
    el.classList.remove(classe);
    void el.offsetWidth; // força o navegador a reiniciar a animação
    el.classList.add(classe);
  }

  /* ===========================================================
     ESTADO DA INTERFACE
     =========================================================== */
  const LIMITE_LISTA = 7; // transações exibidas antes de "Mostrar todas"
  const estado = {
    mes: chaveMes(DADOS.hoje),
    filtro: 'todas',      // 'todas' | 'entrada' | 'saida'
    busca: '',
    mostrarTodas: false,
    primeiraVez: true,    // controla os atrasos da animação de entrada
    destaque: null,       // transação recém-criada (realce na lista)
  };

  const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
  const $$ = (seletor, raiz = document) => Array.from(raiz.querySelectorAll(seletor));
  const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ===========================================================
     6. CABEÇALHO E SELETOR DE MÊS
     =========================================================== */
  function montarCabecalho() {
    const hora = new Date().getHours();
    $('#saudacao').textContent = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    $('#nome-usuario').textContent = DADOS.usuario.nome;
    $('#negocio').textContent = DADOS.usuario.negocio;
    const { ano, mes, dia } = lerData(DADOS.hoje);
    const semana = DIAS_SEMANA[new Date(ano, mes - 1, dia).getDay()];
    $('#data-hoje').textContent = `${semana}, ${dia} de ${MESES[mes - 1]}`;

    $('#mes-anterior').addEventListener('click', () => trocarMes(-1));
    $('#mes-proximo').addEventListener('click', () => trocarMes(1));
  }

  function trocarMes(direcao) {
    const meses = mesesVisiveis();
    const i = meses.indexOf(estado.mes) + direcao;
    if (i >= 0 && i < meses.length) selecionarMes(meses[i]);
  }

  function selecionarMes(chave) {
    if (chave === estado.mes) return;
    const direcao = chave > estado.mes ? 'vai-dir' : 'vai-esq';
    estado.mes = chave;
    estado.mostrarTodas = false;
    atualizarTudo({ direcao });
  }

  function renderSeletor(direcao) {
    const meses = mesesVisiveis();
    const i = meses.indexOf(estado.mes);
    $('#mes-anterior').disabled = i <= 0;
    $('#mes-proximo').disabled = i >= meses.length - 1;
    const rotulo = $('#mes-rotulo');
    rotulo.textContent = nomeMesAno(estado.mes);
    if (direcao) { rotulo.classList.remove('vai-esq', 'vai-dir'); pulsar(rotulo, direcao); }
  }

  /* ===========================================================
     7. 01 SALDO E INDICADORES
     =========================================================== */
  /** Escreve o saldo grande em três partes: R$ | 48.312 | ,40 */
  function pintarSaldo(v) {
    const [inteiro, centavos] = fmtDecimal.format(Math.abs(v)).split(',');
    $('.saldo-moeda').textContent = (v < -0.004 ? '−' : '') + 'R$';
    $('.saldo-inteiro').textContent = inteiro;
    $('.saldo-centavos').textContent = ',' + centavos;
  }

  function renderSaldo(atraso) {
    const mes = estado.mes;
    const anterior = somarMeses(mes, -1);
    const saldo = saldoAoFimDe(mes);
    const saldoAnterior = saldoAoFimDe(anterior);
    const totais = totaisDoMes(mes);

    // Saldo grande com count-up
    const el = $('#saldo-valor');
    const de = Number(el.dataset.valor || 0);
    el.dataset.valor = saldo;
    el.setAttribute('aria-label', brl(saldo));
    animar('saldo', 1100, (p) => pintarSaldo(de + (saldo - de) * p), null, atraso);

    // Nota: atualizado hoje ou fechamento do mês
    $('#saldo-nota').textContent = mes === chaveMes(DADOS.hoje)
      ? `atualizado em ${dataCurta(DADOS.hoje)}`
      : `fechamento em ${ultimoDiaDoMes(mes)} ${nomeMesCurto(mes)}`;

    // Variação contra o mês anterior
    const diferenca = saldo - saldoAnterior;
    const pct = saldoAnterior ? (diferenca / Math.abs(saldoAnterior)) * 100 : 0;
    const variacao = $('#saldo-variacao');
    variacao.className = 'variacao ' + (diferenca >= 0 ? 'variacao--sobe' : 'variacao--desce');
    $('use', variacao).setAttribute('href', diferenca >= 0 ? '#i-sobe' : '#i-desce');
    $('.variacao-texto', variacao).innerHTML =
      `<strong>${brlComSinal(diferenca)} (${diferenca >= 0 ? '+' : '−'}${fmtUmaCasa.format(Math.abs(pct))}%)</strong> em relação a ${nomeMes(anterior)}`;

    // Mini indicadores
    const reserva = DADOS.metas.find((m) => m.id === 'reserva');
    const reservaAgora = reserva ? guardadoNaMeta(reserva, mes) : 0;
    const reservaAntes = reserva ? guardadoNaMeta(reserva, anterior) : 0;
    animarNumero($('#ind-entradas'), totais.entradas, { atraso, duracao: 1000 });
    animarNumero($('#ind-saidas'), totais.saidas, { atraso, duracao: 1000 });
    animarNumero($('#ind-reserva'), reservaAgora, { atraso, duracao: 1000 });
    $('#ind-entradas-sub').textContent = `${totais.qtdEntradas} ${totais.qtdEntradas === 1 ? 'lançamento' : 'lançamentos'}`;
    $('#ind-saidas-sub').textContent = `${totais.qtdSaidas} ${totais.qtdSaidas === 1 ? 'lançamento' : 'lançamentos'}`;
    $('#ind-reserva-sub').textContent = `${brlComSinal(reservaAgora - reservaAntes)} no mês`;
  }

  /* ===========================================================
     8. 02 CARTÃO
     =========================================================== */
  function montarCartao() {
    const c = DADOS.cartao;
    $('#cartao-final').textContent = c.final;
    $('#cartao-titular').textContent = c.titular;
    $('#cartao-validade').textContent = c.validade;
    $('#limite-total').textContent = brl(c.limite);
    $('#limite-fecha').textContent = `· fecha dia ${c.diaFechamento}`;

    const botao = $('#cartao');
    botao.addEventListener('click', () => {
      const virado = botao.classList.toggle('virado');
      botao.setAttribute('aria-pressed', String(virado));
      botao.setAttribute('aria-label', `Cartão final ${c.final}. ${virado ? 'Mostrar a frente' : 'Mostrar o verso'}.`);
    });
  }

  function renderCartao(atraso) {
    const c = DADOS.cartao;
    const usado = usoDoCartao(estado.mes);
    const pct = Math.min(100, (usado / c.limite) * 100);

    animarNumero($('#limite-usado'), usado, { atraso, duracao: 1000 });
    animarNumero($('#limite-pct'), (usado / c.limite) * 100, { atraso, duracao: 1000, formato: porcento });

    const barra = $('#limite-barra');
    barra.setAttribute('aria-valuenow', String(Math.round(pct)));
    barra.classList.toggle('alerta', pct >= DADOS.alertaOrcamento);
    const preenchida = $('.barra-preenchida', barra);
    const aplicar = () => { preenchida.style.transform = `scaleX(${pct / 100})`; };
    if (atraso) setTimeout(aplicar, atraso); else aplicar(); // atraso na 1ª carga = transição visível

    // Verso: fatura do mês, limite disponível e vencimento (mês seguinte)
    $('#verso-fatura').textContent = brl(usado);
    $('#verso-disponivel').textContent = brl(Math.max(0, c.limite - usado));
    $('#verso-vencimento').textContent = `${String(c.diaVencimento).padStart(2, '0')} ${nomeMesCurto(somarMeses(estado.mes, 1))}`;
  }

  /* ===========================================================
     9. 03 GRÁFICO DE FLUXO DE CAIXA — SVG feito à mão
     Barras agrupadas (entradas × saídas) + linha do saldo acumulado
     com eixo próprio à direita. Os valores são interpolados quadro a
     quadro, então qualquer mudança nos dados vira animação.
     =========================================================== */
  const grafico = {
    area: null, dica: null,
    largura: 0, altura: 0, margem: null,
    meses: [],
    atual: null,   // dados desenhados neste instante
    alvo: null,    // dados para onde estamos animando
    el: null,      // referências aos elementos SVG
    indiceDica: -1,
  };

  /** Passo "bonito" (1, 2, 2,5, 5 × 10ⁿ) maior ou igual a x */
  function passoBonito(x) {
    const ordem = Math.pow(10, Math.floor(Math.log10(Math.max(x, 1e-9))));
    const n = x / ordem;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * ordem;
  }

  function dadosDoGrafico() {
    const meses = mesesVisiveis();
    const entradas = [], saidas = [], saldos = [];
    meses.forEach((m) => {
      const t = totaisDoMes(m);
      entradas.push(t.entradas); saidas.push(t.saidas); saldos.push(saldoAoFimDe(m));
    });
    // Escala das barras (eixo esquerdo): 4 divisões
    const passoFluxo = passoBonito(Math.max(...entradas, ...saidas, 1) / 4);
    const topo = passoFluxo * 4;
    // Escala do saldo (eixo direito): 4 divisões que contêm min e max
    const min = Math.min(...saldos), max = Math.max(...saldos);
    let passo = passoBonito(Math.max((max - min) / 3, 100));
    let piso = Math.floor(min / passo) * passo;
    while (piso + passo * 4 < max) { passo = passoBonito(passo * 1.01); piso = Math.floor(min / passo) * passo; }
    return { meses, entradas, saidas, saldos, topo, piso, teto: piso + passo * 4 };
  }

  /** Cria o esqueleto do SVG (chamado no início e quando a largura muda) */
  function montarGrafico() {
    const largura = Math.round(grafico.area.clientWidth);
    if (!largura) return false;
    const estreito = largura < 560;
    const altura = estreito ? 236 : 286;
    const m = { t: 12, d: estreito ? 44 : 58, b: 32, e: estreito ? 42 : 54 };
    Object.assign(grafico, { largura, altura, margem: m });
    const n = DADOS.mesesVisiveis;

    let svg = `<svg class="grafico-svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" role="group" aria-label="Entradas, saídas e saldo acumulado dos últimos ${n} meses">`;
    svg += '<rect class="g-destaque" rx="3"/>';
    svg += '<g class="g-grade" aria-hidden="true">';
    for (let i = 0; i <= 4; i++) {
      svg += `<line class="${i === 4 ? 'base' : ''}"/><text class="g-eixo" text-anchor="end"></text><text class="g-eixo g-eixo--saldo" text-anchor="start"></text>`;
    }
    svg += '</g><g aria-hidden="true">';
    for (let i = 0; i < n; i++) svg += '<rect class="g-entrada" rx="1.5"/><rect class="g-saida" rx="1.5"/><text class="g-mes"></text>';
    svg += '<path class="g-linha-halo"/><path class="g-linha"/>';
    for (let i = 0; i < n; i++) svg += '<circle class="g-ponto" r="4"/>';
    svg += '</g>';
    for (let i = 0; i < n; i++) svg += `<rect class="g-alvo" data-i="${i}" tabindex="0" role="button"/>`;
    svg += '</svg>';
    grafico.area.innerHTML = svg;

    const raiz = grafico.area;
    grafico.el = {
      destaque: $('.g-destaque', raiz),
      linhasGrade: $$('.g-grade line', raiz),
      eixoFluxo: $$('.g-eixo:not(.g-eixo--saldo)', raiz),
      eixoSaldo: $$('.g-eixo--saldo', raiz),
      entradas: $$('.g-entrada', raiz),
      saidas: $$('.g-saida', raiz),
      meses: $$('.g-mes', raiz),
      halo: $('.g-linha-halo', raiz),
      linha: $('.g-linha', raiz),
      pontos: $$('.g-ponto', raiz),
      alvos: $$('.g-alvo', raiz),
    };

    // Geometria fixa: linhas de grade, posições dos meses e áreas de toque
    const L = largura - m.e - m.d, A = altura - m.t - m.b, passoX = L / n;
    grafico.el.linhasGrade.forEach((linha, i) => {
      const y = Math.round(m.t + (A * i) / 4) + 0.5;
      linha.setAttribute('x1', m.e); linha.setAttribute('x2', largura - m.d);
      linha.setAttribute('y1', y); linha.setAttribute('y2', y);
      grafico.el.eixoFluxo[i].setAttribute('x', m.e - 10); grafico.el.eixoFluxo[i].setAttribute('y', y + 4);
      grafico.el.eixoSaldo[i].setAttribute('x', largura - m.d + 10); grafico.el.eixoSaldo[i].setAttribute('y', y + 4);
    });
    grafico.el.meses.forEach((t, i) => { t.setAttribute('x', m.e + passoX * (i + 0.5)); t.setAttribute('y', altura - 8); });
    grafico.el.alvos.forEach((r, i) => {
      r.setAttribute('x', m.e + passoX * i); r.setAttribute('y', m.t);
      r.setAttribute('width', passoX); r.setAttribute('height', A);
    });
    ligarEventosGrafico();
    return true;
  }

  /** Desenha um estado (pode ser intermediário de uma animação) */
  function pintarGrafico(d) {
    const { largura, altura, margem: m, el } = grafico;
    const n = d.entradas.length;
    const L = largura - m.e - m.d, A = altura - m.t - m.b, passoX = L / n;
    const barra = Math.min(24, passoX * 0.24);
    const vao = Math.max(2, barra * 0.2);
    const base = m.t + A;
    const pontos = [];

    for (let i = 0; i < n; i++) {
      const cx = m.e + passoX * (i + 0.5);
      const hE = Math.max(0, (d.entradas[i] / d.topo) * A);
      const hS = Math.max(0, (d.saidas[i] / d.topo) * A);
      definir(el.entradas[i], { x: cx - vao / 2 - barra, y: base - hE, width: barra, height: hE });
      definir(el.saidas[i], { x: cx + vao / 2, y: base - hS, width: barra, height: hS });
      const y = base - ((d.saldos[i] - d.piso) / (d.teto - d.piso)) * A;
      pontos.push([cx, y]);
      definir(el.pontos[i], { cx, cy: y });
    }
    const caminho = pontos.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    el.linha.setAttribute('d', caminho);
    el.halo.setAttribute('d', caminho);

    // Faixa de destaque do mês selecionado (posição também interpolada)
    definir(el.destaque, { x: m.e + passoX * d.ativo + 4, y: m.t - 4, width: passoX - 8, height: A + 4 });
  }

  function definir(no, attrs) { for (const k in attrs) no.setAttribute(k, attrs[k]); }

  /** Rótulos dos eixos, meses e descrições acessíveis (valores finais) */
  function rotularGrafico(d) {
    const { el } = grafico;
    for (let i = 0; i <= 4; i++) {
      el.eixoFluxo[i].textContent = compacto((d.topo * (4 - i)) / 4);
      el.eixoSaldo[i].textContent = compacto(d.piso + ((d.teto - d.piso) * (4 - i)) / 4);
    }
    d.meses.forEach((chave, i) => {
      const ativo = chave === estado.mes;
      el.meses[i].textContent = nomeMesCurto(chave);
      el.meses[i].classList.toggle('ativo', ativo);
      el.pontos[i].classList.toggle('ativo', ativo);
      el.alvos[i].setAttribute('aria-label',
        `${nomeMesAno(chave)}: entradas ${brl(d.entradas[i])}, saídas ${brl(d.saidas[i])}, saldo ${brl(d.saldos[i])}. Selecionar mês.`);
      el.alvos[i].setAttribute('aria-pressed', String(ativo));
    });
  }

  function renderGrafico(atraso) {
    const alvo = dadosDoGrafico();
    alvo.ativo = alvo.meses.indexOf(estado.mes);
    grafico.alvo = alvo;
    grafico.meses = alvo.meses;

    // Primeira vez: barras crescem do zero e a linha sobe da base
    const de = grafico.atual || {
      entradas: alvo.entradas.map(() => 0),
      saidas: alvo.saidas.map(() => 0),
      saldos: alvo.saldos.map(() => alvo.piso),
      topo: alvo.topo, piso: alvo.piso, teto: alvo.teto, ativo: alvo.ativo,
    };
    rotularGrafico(alvo);
    const misturar = (a, b, p) => a + (b - a) * p;
    animar('grafico', 1000, (p) => {
      const quadro = {
        entradas: alvo.entradas.map((v, i) => misturar(de.entradas[i], v, p)),
        saidas: alvo.saidas.map((v, i) => misturar(de.saidas[i], v, p)),
        saldos: alvo.saldos.map((v, i) => misturar(de.saldos[i], v, p)),
        topo: misturar(de.topo, alvo.topo, p),
        piso: misturar(de.piso, alvo.piso, p),
        teto: misturar(de.teto, alvo.teto, p),
        ativo: misturar(de.ativo, alvo.ativo, p),
      };
      grafico.atual = quadro;
      pintarGrafico(quadro);
    }, null, atraso);
    if (grafico.indiceDica >= 0) mostrarDica(grafico.indiceDica);
  }

  /* Dica (tooltip): hover, foco por teclado e toque */
  function mostrarDica(i) {
    const d = grafico.alvo;
    if (!d) return;
    grafico.indiceDica = i;
    const { largura, margem: m } = grafico;
    const passoX = (largura - m.e - m.d) / d.meses.length;
    const cx = m.e + passoX * (i + 0.5);
    const dica = grafico.dica;
    dica.innerHTML = `
      <p class="dica-titulo">${nomeMesAno(d.meses[i])}</p>
      <p class="dica-linha"><span><i style="background:var(--entrada)"></i>Entradas</span><b>${brl(d.entradas[i])}</b></p>
      <p class="dica-linha"><span><i style="background:var(--saida)"></i>Saídas</span><b>${brl(d.saidas[i])}</b></p>
      <p class="dica-linha"><span><i style="background:var(--apoio);border-radius:50%"></i>Saldo</span><b>${brl(d.saldos[i])}</b></p>`;
    dica.hidden = false;
    // Posiciona ao lado da coluna, sem sair da área do gráfico
    const larguraDica = dica.offsetWidth;
    let x = cx > largura / 2 ? cx - passoX / 2 - larguraDica - 4 : cx + passoX / 2 + 4;
    x = Math.max(0, Math.min(largura - larguraDica, x));
    dica.style.left = x + 'px';
  }
  function esconderDica() { grafico.indiceDica = -1; grafico.dica.hidden = true; }

  function ligarEventosGrafico() {
    grafico.el.alvos.forEach((alvo) => {
      const i = Number(alvo.dataset.i);
      alvo.addEventListener('pointerenter', () => mostrarDica(i));
      alvo.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') esconderDica(); });
      alvo.addEventListener('focus', () => mostrarDica(i));
      alvo.addEventListener('blur', esconderDica);
      alvo.addEventListener('click', () => { mostrarDica(i); selecionarMes(grafico.meses[i]); });
      alvo.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selecionarMes(grafico.meses[i]); }
      });
    });
  }

  function iniciarGrafico() {
    grafico.area = $('#grafico-area');
    grafico.dica = $('#dica');
    montarGrafico();
    // Redesenha quando a largura muda (responsivo de verdade, sem distorcer o texto)
    let larguraAnterior = grafico.largura;
    const observador = new ResizeObserver(() => {
      const largura = Math.round(grafico.area.clientWidth);
      if (!largura || largura === larguraAnterior) return;
      larguraAnterior = largura;
      montarGrafico();
      if (grafico.alvo) { rotularGrafico(grafico.alvo); pintarGrafico(grafico.atual || grafico.alvo); }
      esconderDica();
    });
    observador.observe(grafico.area);
    // Toque fora do gráfico fecha a dica
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#grafico')) esconderDica(); });
  }

  /* ===========================================================
     10. 04 ORÇAMENTO POR CATEGORIA (anéis)
     =========================================================== */
  const categoriasComOrcamento = () => Object.entries(DADOS.categorias).filter(([, c]) => c.orcamento);

  function montarOrcamento() {
    $('#aneis').innerHTML = categoriasComOrcamento().map(([id, c]) => `
      <li class="anel" data-categoria="${id}">
        <div class="anel-grafico">
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <circle class="anel-trilho" cx="40" cy="40" r="34"/>
            <circle class="anel-progresso" cx="40" cy="40" r="34" pathLength="100"/>
          </svg>
          <span class="anel-pct">0%</span>
        </div>
        <p class="anel-nome"><svg class="icone" aria-hidden="true"><use href="#i-${c.icone}"/></svg>${escapar(c.nome)}</p>
        <p class="anel-valores"><span class="anel-gasto">R$ 0</span> / ${fmtCompacto.format(c.orcamento)}<span class="sr"> de orçamento</span></p>
        <p class="anel-status"></p>
      </li>`).join('');
  }

  function renderOrcamento(atraso) {
    const gastos = gastosPorCategoria(estado.mes);
    let alertas = 0;
    categoriasComOrcamento().forEach(([id, c]) => {
      const li = $(`.anel[data-categoria="${id}"]`);
      const gasto = gastos[id] || 0;
      const pct = (gasto / c.orcamento) * 100;
      const alerta = pct >= DADOS.alertaOrcamento;
      if (alerta) alertas++;
      li.classList.toggle('alerta', alerta);

      // O anel anima via transição CSS de stroke-dashoffset
      const progresso = $('.anel-progresso', li);
      const aplicar = () => { progresso.style.strokeDashoffset = String(100 - Math.min(100, pct)); };
      if (atraso) setTimeout(aplicar, atraso); else requestAnimationFrame(aplicar);

      animarNumero($('.anel-pct', li), pct, { atraso, duracao: 1000, formato: porcento });
      animarNumero($('.anel-gasto', li), gasto, { atraso, duracao: 1000, formato: brlInteiro });

      const resto = c.orcamento - gasto;
      $('.anel-status', li).innerHTML = resto < 0
        ? `<svg class="icone" aria-hidden="true"><use href="#i-alerta"/></svg>passou ${brlInteiro(-resto)}`
        : alerta
          ? `<svg class="icone" aria-hidden="true"><use href="#i-alerta"/></svg>restam ${brlInteiro(resto)}`
          : `sobram ${brlInteiro(resto)}`;
    });
    $('#orcamento-nota').textContent = alertas
      ? `${alertas} ${alertas === 1 ? 'categoria' : 'categorias'} acima de ${DADOS.alertaOrcamento}%`
      : 'tudo dentro do previsto';
  }

  /* ===========================================================
     11. 05 TRANSAÇÕES — filtros, busca e "mostrar todas"
     =========================================================== */
  function transacoesFiltradas() {
    const termo = normalizar(estado.busca.trim());
    return transacoesDoMes(estado.mes)
      .filter((t) => estado.filtro === 'todas' || t.tipo === estado.filtro)
      .filter((t) => !termo || normalizar(`${t.descricao} ${DADOS.categorias[t.categoria].nome} ${DADOS.meios[t.meio] || ''}`).includes(termo))
      // mais recentes primeiro; no mesmo dia, a última cadastrada primeiro
      .sort((a, b) => (a.data === b.data ? DADOS.transacoes.indexOf(b) - DADOS.transacoes.indexOf(a) : a.data < b.data ? 1 : -1));
  }

  function renderTransacoes() {
    const lista = transacoesFiltradas();
    // Garante que a transação recém-criada fique visível
    if (estado.destaque) {
      const pos = lista.indexOf(estado.destaque);
      if (pos >= LIMITE_LISTA) estado.mostrarTodas = true;
    }
    const visiveis = estado.mostrarTodas ? lista : lista.slice(0, LIMITE_LISTA);

    $('#tx-lista').innerHTML = visiveis.map((t, i) => {
      const cat = DADOS.categorias[t.categoria];
      const classe = t === estado.destaque ? 'nova' : 'entra-lista';
      return `
        <li class="tx ${classe}" style="--i:${i}">
          <span class="tx-icone tx-icone--${t.tipo}" aria-hidden="true"><svg class="icone"><use href="#i-${cat.icone}"/></svg></span>
          <span class="tx-info">
            <span class="tx-desc">${escapar(t.descricao)}</span>
            <span class="tx-meta">${escapar(cat.nome)} · ${escapar(DADOS.meios[t.meio] || t.meio)}<span class="sr">, ${dataCurta(t.data)}</span></span>
          </span>
          <time class="tx-data" datetime="${t.data}" aria-hidden="true">${dataCurta(t.data)}</time>
          <span class="tx-valor tx-valor--${t.tipo}"><span class="sr">${t.tipo === 'entrada' ? 'Entrada de' : 'Saída de'} </span>${t.tipo === 'entrada' ? '+' : '−'} ${fmtMoeda.format(t.valor)}</span>
        </li>`;
    }).join('');

    const vazio = $('#tx-vazio');
    vazio.hidden = lista.length > 0;
    if (!lista.length) {
      vazio.textContent = estado.busca
        ? `Nenhuma transação encontrada para “${estado.busca}” em ${nomeMes(estado.mes)}.`
        : `Nenhuma transação neste filtro em ${nomeMes(estado.mes)}.`;
    }

    const mais = $('#tx-mais');
    mais.hidden = lista.length <= LIMITE_LISTA;
    mais.textContent = estado.mostrarTodas ? 'Mostrar menos' : `Mostrar todas (${lista.length})`;
    mais.setAttribute('aria-expanded', String(estado.mostrarTodas));

    $('#tx-status').textContent = lista.length
      ? `${visiveis.length} de ${lista.length} em ${nomeMes(estado.mes)}`
      : `0 em ${nomeMes(estado.mes)}`;
  }

  function ligarTransacoes() {
    $$('.filtro').forEach((botao) => botao.addEventListener('click', () => {
      estado.filtro = botao.dataset.filtro;
      estado.mostrarTodas = false;
      $$('.filtro').forEach((b) => b.setAttribute('aria-pressed', String(b === botao)));
      renderTransacoes();
    }));
    $('#tx-busca').addEventListener('input', (e) => {
      estado.busca = e.target.value;
      renderTransacoes();
    });
    $('#tx-mais').addEventListener('click', () => {
      estado.mostrarTodas = !estado.mostrarTodas;
      renderTransacoes();
    });
  }

  /* ===========================================================
     12. 06 METAS
     =========================================================== */
  function montarMetas() {
    $('#metas').innerHTML = DADOS.metas.map((meta) => `
      <li class="meta" data-meta="${meta.id}">
        <div class="meta-topo">
          <h3 class="meta-nome">${escapar(meta.nome)}</h3>
          <span class="meta-pct">0%</span>
        </div>
        <p class="meta-desc">${escapar(meta.descricao || '')}</p>
        <div class="barra" role="progressbar" aria-label="Progresso da meta ${escapar(meta.nome)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <span class="barra-preenchida"></span>
        </div>
        <p class="meta-rodape"><span><strong class="meta-guardado">R$ 0,00</strong> de ${brl(meta.alvo)}</span><span class="meta-prazo"></span></p>
      </li>`).join('');
  }

  function renderMetas(atraso) {
    DADOS.metas.forEach((meta) => {
      const li = $(`.meta[data-meta="${meta.id}"]`);
      const guardado = guardadoNaMeta(meta, estado.mes);
      const pct = Math.min(100, (guardado / meta.alvo) * 100);
      animarNumero($('.meta-pct', li), pct, { atraso, formato: porcento });
      animarNumero($('.meta-guardado', li), guardado, { atraso });
      const barra = $('.barra', li);
      barra.setAttribute('aria-valuenow', String(Math.round(pct)));
      const preenchida = $('.barra-preenchida', li);
      const aplicar = () => { preenchida.style.transform = `scaleX(${pct / 100})`; };
      if (atraso) setTimeout(aplicar, atraso); else requestAnimationFrame(aplicar);

      // Prazo e quanto guardar por mês para chegar lá
      const [ano, mes] = meta.prazo.split('-').map(Number);
      const faltam = Math.max(0, meta.alvo - guardado);
      const meses = Math.max(1, diferencaMeses(chaveMes(DADOS.hoje), meta.prazo));
      $('.meta-prazo', li).textContent = faltam <= 0
        ? 'meta atingida'
        : `até ${MESES_CURTOS[mes - 1]} ${ano} · ${brlInteiro(faltam / meses)}/mês`;
    });
  }

  /** Nota do mês: três frases geradas a partir dos números */
  function renderNota() {
    const mes = estado.mes;
    const resultado = saldoAoFimDe(mes) - saldoAoFimDe(somarMeses(mes, -1));
    const sinal = (v) => `<strong class="${v >= 0 ? 'positivo' : 'negativo'}">${brlComSinal(v)}</strong>`;
    const frases = [];

    frases.push(`Em ${nomeMes(mes)}, o caixa ${resultado >= 0 ? 'cresceu' : 'encolheu'} <strong class="${resultado >= 0 ? 'positivo' : 'negativo'}">${brl(Math.abs(resultado))}</strong>.`);

    const gastos = gastosPorCategoria(mes);
    const estouradas = categoriasComOrcamento()
      .filter(([id, c]) => ((gastos[id] || 0) / c.orcamento) * 100 >= DADOS.alertaOrcamento)
      .map(([, c]) => c.nome.toLowerCase());
    if (estouradas.length) {
      const lista = estouradas.join(' e ').replace(/ e (?=.* e )/g, ', '); // "a, b e c"
      frases.push(`${lista.charAt(0).toUpperCase() + lista.slice(1)} ${estouradas.length === 1 ? 'passou' : 'passaram'} de ${DADOS.alertaOrcamento}% do orçamento.`);
    } else {
      frases.push('Todas as categorias ficaram dentro do orçamento.');
    }

    // Projeção simples: média do resultado dos últimos 3 meses
    let soma = 0;
    for (let i = 0; i < 3; i++) soma += saldoAoFimDe(somarMeses(mes, -i)) - saldoAoFimDe(somarMeses(mes, -i - 1));
    const media = soma / 3;
    const destino = somarMeses(mes, 3);
    frases.push(`No ritmo dos últimos três meses (${sinal(media)}/mês), o saldo chega a <strong>${brlInteiro(saldoAoFimDe(mes) + media * 3)}</strong> em ${nomeMes(destino)}.`);

    $('#nota-texto').innerHTML = frases.join(' ');
  }

  /* ===========================================================
     13. MODAL "NOVA TRANSAÇÃO"
     <dialog> nativo + foco preso manualmente + Esc com animação.
     =========================================================== */
  const modal = { el: null, form: null, origem: null };

  function preencherCategorias(tipo) {
    const select = $('#f-categoria');
    select.innerHTML = Object.entries(DADOS.categorias)
      .filter(([, c]) => c.tipo === tipo)
      .map(([id, c]) => `<option value="${id}">${escapar(c.nome)}</option>`).join('');
  }

  function abrirModal() {
    const { form } = modal;
    form.reset();
    $$('.entrada-texto', form).forEach((c) => c.removeAttribute('aria-invalid'));
    $$('.campo-erro', form).forEach((e) => { e.textContent = ''; });
    preencherCategorias('saida');
    // Datas permitidas: dentro dos meses visíveis, até hoje
    const data = $('#f-data');
    data.min = mesesVisiveis()[0] + '-01';
    data.max = DADOS.hoje;
    data.value = estado.mes === chaveMes(DADOS.hoje)
      ? DADOS.hoje
      : `${estado.mes}-${String(ultimoDiaDoMes(estado.mes)).padStart(2, '0')}`;

    modal.origem = document.activeElement;
    modal.el.classList.remove('fechando');
    modal.el.showModal();
    $('#f-descricao').focus();
  }

  function fecharModal() {
    const el = modal.el;
    if (!el.open || el.classList.contains('fechando')) return;
    if (semMovimento()) { el.close(); return; }
    el.classList.add('fechando');
    const terminar = (e) => {
      if (e && e.target !== el) return;
      el.removeEventListener('animationend', terminar);
      el.classList.remove('fechando');
      el.close();
    };
    el.addEventListener('animationend', terminar);
    setTimeout(() => { if (el.open) terminar(); }, 400); // segurança
  }

  /** Converte "1.234,56", "1234,56" ou "1234.56" em número */
  function lerValor(texto) {
    let s = String(texto).replace(/[R$\s]/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const v = Number(s);
    return Number.isFinite(v) ? arredondar(v) : NaN;
  }

  function validar(form) {
    const erros = [];
    const marcar = (campo, msg) => {
      campo.setAttribute('aria-invalid', msg ? 'true' : 'false');
      $('#erro-' + campo.name).textContent = msg || '';
      if (msg) erros.push(campo);
    };
    const descricao = form.descricao.value.trim();
    marcar(form.descricao, descricao.length < 2 ? 'Escreva uma descrição curta.' : '');
    const valor = lerValor(form.valor.value);
    marcar(form.valor, !(valor > 0) ? 'Informe um valor maior que zero.' : valor > 10000000 ? 'Valor alto demais para um lançamento.' : '');
    const data = form.data.value;
    marcar(form.data, !data || data < form.data.min || data > form.data.max
      ? `Escolha uma data entre ${dataCurta(form.data.min)} e ${dataCurta(form.data.max)}.` : '');
    return { erros, descricao, valor, data };
  }

  function salvarTransacao(e) {
    e.preventDefault();
    const form = modal.form;
    const { erros, descricao, valor, data } = validar(form);
    if (erros.length) { erros[0].focus(); return; }

    const tipo = form.tipo.value;
    const nova = { data, descricao, categoria: form.categoria.value, tipo, valor, meio: form.meio.value };
    DADOS.transacoes.push(nova);

    // Mostra a lista "limpa" para a nova transação aparecer
    estado.filtro = 'todas';
    estado.busca = '';
    $('#tx-busca').value = '';
    $$('.filtro').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filtro === 'todas')));
    estado.destaque = nova;

    const mesNovo = chaveMes(data);
    const direcao = mesNovo === estado.mes ? null : mesNovo > estado.mes ? 'vai-dir' : 'vai-esq';
    estado.mes = mesNovo;

    fecharModal();
    atualizarTudo({ direcao });
    estado.destaque = null;
    avisar(`${tipo === 'entrada' ? 'Entrada' : 'Saída'} de ${brl(valor)} lançada em ${dataCurta(data)}.`);
  }

  function iniciarModal() {
    modal.el = $('#modal');
    modal.form = $('#form-tx');
    $('#f-meio').innerHTML = Object.entries(DADOS.meios).map(([id, n]) => `<option value="${id}">${escapar(n)}</option>`).join('');

    $('#abrir-modal').addEventListener('click', abrirModal);
    $('#fechar-modal').addEventListener('click', fecharModal);
    $('#cancelar-modal').addEventListener('click', fecharModal);
    modal.form.addEventListener('submit', salvarTransacao);
    $$('input[name="tipo"]', modal.form).forEach((r) => r.addEventListener('change', () => preencherCategorias(r.value)));

    // Formata o valor ao sair do campo: 1234,5 → 1.234,50
    $('#f-valor').addEventListener('blur', (e) => {
      const v = lerValor(e.target.value);
      if (v > 0) e.target.value = fmtDecimal.format(v);
    });

    // Esc: fecha com animação (em vez do fechamento seco do navegador)
    modal.el.addEventListener('cancel', (e) => { e.preventDefault(); fecharModal(); });
    // Clique no fundo escurecido fecha
    modal.el.addEventListener('click', (e) => { if (e.target === modal.el) fecharModal(); });
    // Devolve o foco para quem abriu
    modal.el.addEventListener('close', () => { if (modal.origem && modal.origem.focus) modal.origem.focus(); });
    // Foco preso: Tab circula só dentro do modal
    modal.el.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focaveis = $$('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])', modal.el)
        .filter((n) => !n.disabled && n.offsetParent !== null && !(n.type === 'radio' && !n.checked));
      if (!focaveis.length) return;
      const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    });
  }

  /* Aviso rápido (toast) */
  let temporizadorAviso = 0;
  function avisar(texto) {
    const aviso = $('#aviso');
    aviso.textContent = texto;
    aviso.classList.add('visivel');
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => aviso.classList.remove('visivel'), 3200);
  }

  /* ===========================================================
     14. INICIALIZAÇÃO
     =========================================================== */
  /** Recalcula e redesenha tudo (com animação) a partir de DADOS e estado */
  function atualizarTudo({ direcao = null } = {}) {
    // Na primeira carga, os números começam junto com a entrada dos blocos
    const atraso = estado.primeiraVez ? 220 : 0;
    renderSeletor(direcao);
    renderSaldo(atraso);
    renderCartao(atraso);
    renderGrafico(estado.primeiraVez ? 300 : 0);
    renderOrcamento(estado.primeiraVez ? 360 : 0);
    renderTransacoes();
    renderMetas(atraso);
    renderNota();
    if (!estado.primeiraVez && direcao) {
      ['.bloco--saldo .variacao', '.indicadores', '.limite', '.aneis', '.metas', '.nota-texto'].forEach((s) => pulsar($(s)));
    }
    estado.primeiraVez = false;
  }

  function iniciar() {
    // ➜ Dados reais: remova a linha abaixo (gera o histórico fictício).
    DADOS.transacoes.unshift(...gerarHistoricoDemo());

    montarCabecalho();
    montarCartao();
    montarOrcamento();
    montarMetas();
    iniciarGrafico();
    ligarTransacoes();
    iniciarModal();
    atualizarTudo();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
