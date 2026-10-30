/* =====================================================================
   BUSCA INSTANTÂNEA — paleta de comandos / busca global (⌘K)
   ---------------------------------------------------------------------
   1. Configuração
   2. Ícones (SVG)
   3. Dados de exemplo (páginas, pessoas, ações)
   4. buscarRemoto(termo)  ← TROQUE AQUI pela sua API
   5. Busca difusa (fuzzy) com pontuação e destaque, ignorando acentos
   6. Estado + cálculo dos resultados
   7. Desenho da lista (listbox / option)
   8. Teclado, abrir/fechar, foco preso
   9. Execução das ações (tema, cor, barra lateral, navegação…)
  10. Atalhos globais e demonstração inicial
   HTML, CSS e JavaScript puros. Sem dependências.
   ===================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     1. CONFIGURAÇÃO
     ------------------------------------------------------------------ */
  const CONFIG = {
    // DEMONSTRAÇÃO: abre a paleta ao carregar e digita o termo abaixo, para a
    // vitrine mostrar o produto. No seu projeto, mude para false.
    // (Também dá para desligar só pela URL: index.html?demo=0)
    abrirAoCarregar: true,
    termoDemo: 'rel',

    limitePorGrupo: 4,        // itens por grupo no filtro "Tudo" (o resto vira "Mostrar mais")
    maxRecentes: 5,           // buscas recentes guardadas
    chaveRecentes: 'bi-recentes',
    chaveTema: 'bi-tema',
    chaveDestaque: 'bi-destaque',
    esperaRemoto: 120         // ms sem digitar antes de chamar buscarRemoto()
  };

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
  const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const reduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ehMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

  /** localStorage com proteção (modo privado, file:// bloqueado etc.). */
  const guardar = {
    ler(chave, padrao) { try { const v = localStorage.getItem(chave); return v === null ? padrao : JSON.parse(v); } catch (e) { return padrao; } },
    salvar(chave, valor) { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* sem armazenamento */ } }
  };

  /* ------------------------------------------------------------------
     2. ÍCONES (traços 24×24, herdam a cor do texto)
     ------------------------------------------------------------------ */
  const ICONES = {
    casa: '<path d="M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5H15v-6H9v6H4.5a.5.5 0 0 1-.5-.5Z"/>',
    grafico: '<path d="M4 20V11M10 20V5M16 20v-7M3 20h18"/>',
    pasta: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z"/>',
    calendario: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    usuarios: '<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6M15.5 6.2a3 3 0 0 1 0 5.6M17.5 14.8c1.5.6 2.6 2 3 4.2"/>',
    relatorio: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5Z"/><path d="M14 3.5V8h4M9.5 17v-3M12.5 17v-5M15.5 17v-2"/>',
    fatura: '<path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8Z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
    engrenagem: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
    ajuda: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4M12 16.8v.2"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    lua: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10Z"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    monitor: '<rect x="3.5" y="4.5" width="17" height="11.5" rx="2"/><path d="M9 20h6M12 16v4"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    lateral: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15"/>',
    sair: '<path d="M14 4.5h4.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H14M10 8l-4 4 4 4M6 12h10"/>',
    convite: '<circle cx="10" cy="8.5" r="3.5"/><path d="M3.5 19.5c.7-3.2 3.3-5 6.5-5 1.5 0 2.9.4 4 1.1M18 13.5v6M15 16.5h6"/>',
    paleta: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.7 0-.9.7-1.6 1.6-1.6H17a3.5 3.5 0 0 0 3.5-3.5c0-4.2-3.8-7.5-8.5-7.5Z"/><circle cx="7.8" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="7.8" r="1"/>',
    relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    lupa: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    arquivo: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5Z"/><path d="M14 3.5V8h4"/>',
    planilha: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5Z"/><path d="M14 3.5V8h4M9 12.5h6M9 16h6M12 12.5V19"/>',
    texto: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5Z"/><path d="M14 3.5V8h4M9 12.5h6M9 16h4"/>',
    video: '<rect x="3.5" y="6" width="12.5" height="12" rx="2"/><path d="m16 10.5 4.5-2.5v8l-4.5-2.5"/>',
    imagem: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-5 4 4 2.5-2.5L20 19"/>',
    setas: '<path d="M8 9l4-4 4 4M8 15l4 4 4-4"/>',
    lixeira: '<path d="M5 7h14M10 4h4M7 7l1 12.5h8L17 7"/>',
    alerta: '<path d="M12 4 3 19.5h18Z"/><path d="M12 10v4M12 16.8v.2"/>'
  };
  const svg = (nome) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome] || ICONES.arquivo}</svg>`;

  /* ------------------------------------------------------------------
     3. DADOS DE EXEMPLO
     Cada item: { id, titulo, sub, icone | cor, palavras, atalho, acao | filhos }
     "palavras" são sinônimos buscáveis que não aparecem na tela.
     ------------------------------------------------------------------ */
  const GRUPOS = [
    { id: 'paginas', nome: 'Páginas', verbo: 'Ir para' },
    { id: 'pessoas', nome: 'Pessoas', verbo: 'Ver perfil' },
    { id: 'arquivos', nome: 'Arquivos', verbo: 'Abrir', remoto: true },
    { id: 'acoes', nome: 'Ações', verbo: 'Executar' }
  ];
  const FILTROS = ['tudo', 'paginas', 'pessoas', 'arquivos', 'acoes'];

  const PAGINAS = [
    { id: 'p-inicio', titulo: 'Início', sub: 'Visão geral do espaço', icone: 'casa', palavras: 'home dashboard', atalho: ['G', 'I'] },
    { id: 'p-vendas', titulo: 'Painel de vendas', sub: 'Painéis › Comercial', icone: 'grafico', palavras: 'receita metas crm', atalho: ['G', 'V'] },
    { id: 'p-relatorios', titulo: 'Relatórios', sub: 'Análises e exportações', icone: 'relatorio', palavras: 'report dados exportar', atalho: ['G', 'R'] },
    { id: 'p-projetos', titulo: 'Projetos', sub: '12 projetos ativos', icone: 'pasta', palavras: 'kanban tarefas', atalho: ['G', 'P'] },
    { id: 'p-calendario', titulo: 'Calendário', sub: 'Reuniões e prazos', icone: 'calendario', palavras: 'agenda eventos', atalho: ['G', 'C'] },
    { id: 'p-clientes', titulo: 'Clientes', sub: '248 contas', icone: 'usuarios', palavras: 'crm contatos empresas' },
    { id: 'p-faturas', titulo: 'Faturas', sub: 'Financeiro › Cobranças', icone: 'fatura', palavras: 'boleto pix pagamento nota fiscal' },
    { id: 'p-config', titulo: 'Configurações', sub: 'Conta, equipe e preferências', icone: 'engrenagem', palavras: 'ajustes settings' },
    { id: 'p-integracoes', titulo: 'Integrações', sub: 'Configurações › Integrações', icone: 'link', palavras: 'api webhooks slack' },
    { id: 'p-ajuda', titulo: 'Central de ajuda', sub: 'Guias e perguntas frequentes', icone: 'ajuda', palavras: 'suporte faq documentação' }
  ];

  /* Pessoas: "cor" é o fundo do disco e "avatar" escolhe o retrato ilustrado
     (#retrato-<avatar>, no bloco RETRATOS do index.html). Sem "avatar", aparecem
     as iniciais do nome. Para foto real, use "foto: 'img/raquel.jpg'". */
  const PESSOAS = [
    { id: 'u-raquel', titulo: 'Raquel Lima', sub: 'Design · raquel@orbita.app', cor: '#f4a3c0', palavras: 'designer ux', avatar: 'ana' },
    { id: 'u-aurelio', titulo: 'Aurélio Souza', sub: 'Financeiro · aurelio@orbita.app', cor: '#ffd27a', palavras: 'contas pagamentos', avatar: 'otavio' },
    { id: 'u-marcelo', titulo: 'Marcelo Dias', sub: 'Engenharia · marcelo@orbita.app', cor: '#9ad0ff', palavras: 'dev backend', avatar: 'davi' },
    { id: 'u-bruno', titulo: 'Bruno Teles', sub: 'Engenharia · bruno@orbita.app', cor: '#a7b6ff', palavras: 'dev frontend', avatar: 'theo' },
    { id: 'u-camila', titulo: 'Camila Rocha', sub: 'Vendas · camila@orbita.app', cor: '#b9f5c8', palavras: 'comercial', avatar: 'nina' },
    { id: 'u-helena', titulo: 'Helena Prates', sub: 'Produto · helena@orbita.app', cor: '#ffb38a', palavras: 'pm roadmap', avatar: 'bia' },
    { id: 'u-davi', titulo: 'Davi Moreira', sub: 'Suporte · davi@orbita.app', cor: '#c9b8ff', palavras: 'atendimento', avatar: 'caio' }
  ];

  const ACOES = [
    { id: 'a-projeto', titulo: 'Criar novo projeto', sub: 'Projetos', icone: 'mais', palavras: 'novo adicionar', atalho: ['N'], acao: () => avisar('Projeto “Sem título” criado (simulação)') },
    { id: 'a-relatorio', titulo: 'Criar relatório', sub: 'Relatórios', icone: 'relatorio', palavras: 'novo exportar', atalho: ['⇧', 'R'], acao: () => avisar('Novo relatório em rascunho (simulação)') },
    { id: 'a-convidar', titulo: 'Convidar pessoa', sub: 'Equipe', icone: 'convite', palavras: 'membro adicionar usuário', atalho: ['I'], acao: () => avisar('Convite copiado para enviar (simulação)') },
    {
      id: 'a-tema', titulo: 'Mudar tema', sub: 'Claro, escuro ou sistema', icone: 'lua', palavras: 'aparência modo dark light escuro claro', atalho: ['T'],
      filhos: [
        { id: 't-claro', titulo: 'Claro', sub: 'Fundo branco', icone: 'sol', valor: 'claro' },
        { id: 't-escuro', titulo: 'Escuro', sub: 'Fundo grafite', icone: 'lua', valor: 'escuro' },
        { id: 't-sistema', titulo: 'Sistema', sub: 'Segue o sistema operacional', icone: 'monitor', valor: 'sistema' }
      ].map((f) => Object.assign(f, { acao: () => definirTema(f.valor), marcado: () => temaAtual() === f.valor }))
    },
    {
      id: 'a-destaque', titulo: 'Cor de destaque', sub: 'Limão, ciano, laranja ou rosa', icone: 'paleta', palavras: 'cor acento accent',
      filhos: [
        { id: 'c-limao', titulo: 'Limão', sub: '#c6f432', cor: '#c6f432', valor: '' },
        { id: 'c-ciano', titulo: 'Ciano', sub: '#3ee6e0', cor: '#3ee6e0', valor: 'ciano' },
        { id: 'c-laranja', titulo: 'Laranja', sub: '#ff9f43', cor: '#ff9f43', valor: 'laranja' },
        { id: 'c-rosa', titulo: 'Rosa', sub: '#ff7eb6', cor: '#ff7eb6', valor: 'rosa' }
      ].map((f) => Object.assign(f, { tipoIcone: 'cor', acao: () => definirDestaque(f.valor, f.titulo), marcado: () => destaqueAtual() === f.valor }))
    },
    { id: 'a-lateral', titulo: 'Mostrar ou ocultar barra lateral', sub: 'Layout', icone: 'lateral', palavras: 'menu sidebar', atalho: ['['], acao: () => alternarLateral() },
    { id: 'a-link', titulo: 'Copiar link desta página', sub: 'Compartilhar', icone: 'link', palavras: 'url compartilhar', atalho: ['L'], acao: () => copiarLink() },
    { id: 'a-sair', titulo: 'Sair da conta', sub: 'Lia Campos', icone: 'sair', palavras: 'logout desconectar', acao: () => avisar('Você sairia da conta agora (simulação)') }
  ];

  const LOCAIS = { paginas: PAGINAS, pessoas: PESSOAS, acoes: ACOES };
  PAGINAS.forEach((i) => { i.grupo = 'paginas'; i.acao = () => navegarPara(i); });
  PESSOAS.forEach((i) => { i.grupo = 'pessoas'; i.acao = () => avisar(`Abrindo o perfil de ${i.titulo}`); });
  ACOES.forEach((i) => { i.grupo = 'acoes'; (i.filhos || []).forEach((f) => { f.grupo = 'acoes'; f.pai = i; }); });

  /** Sugestões exibidas com o campo vazio. */
  const SUGESTOES = ['p-relatorios', 'a-projeto', 'a-tema', 'u-raquel', 'a-convidar'];

  /* ------------------------------------------------------------------
     4. BUSCA REMOTA — TROQUE ESTA FUNÇÃO PELA SUA API
     ------------------------------------------------------------------
     Recebe o termo digitado ('' = arquivos recentes) e { signal } de um
     AbortController (a paleta cancela a busca anterior quando a pessoa
     continua digitando). Deve devolver uma Promise com uma lista de:
       { id, nome, pasta, tamanho, quando }
     Exemplo com fetch:
       async function buscarRemoto(termo, { signal }) {
         const r = await fetch('/api/arquivos?q=' + encodeURIComponent(termo), { signal });
         if (!r.ok) throw new Error('Falha na busca');
         return r.json();
       }
     ------------------------------------------------------------------ */
  const CATALOGO_ARQUIVOS = [
    { id: 'f1', nome: 'Relatório de vendas — Q3.pdf', pasta: 'Comercial', tamanho: '2,4 MB', quando: 'há 2 h' },
    { id: 'f2', nome: 'Relatório financeiro 2026.pdf', pasta: 'Financeiro', tamanho: '5,1 MB', quando: 'ontem' },
    { id: 'f3', nome: 'Notas de release v2.4.md', pasta: 'Engenharia', tamanho: '12 KB', quando: 'há 3 dias' },
    { id: 'f4', nome: 'Planilha de horas — Raquel.xlsx', pasta: 'Pessoas', tamanho: '88 KB', quando: 'segunda' },
    { id: 'f5', nome: 'Planejamento 2027.xlsx', pasta: 'Diretoria', tamanho: '340 KB', quando: 'há 1 semana' },
    { id: 'f6', nome: 'Reunião de kickoff.mp4', pasta: 'Gravações', tamanho: '184 MB', quando: 'há 2 semanas' },
    { id: 'f7', nome: 'Contrato Padaria Flor.docx', pasta: 'Jurídico', tamanho: '96 KB', quando: 'há 3 semanas' },
    { id: 'f8', nome: 'Logo Órbita.svg', pasta: 'Marca', tamanho: '8 KB', quando: 'em agosto' },
    { id: 'f9', nome: 'Roadmap do produto.fig', pasta: 'Produto', tamanho: '22 MB', quando: 'em julho' },
    { id: 'f10', nome: 'Briefing campanha de verão.docx', pasta: 'Marketing', tamanho: '64 KB', quando: 'em julho' },
    { id: 'f11', nome: 'Pesquisa com clientes.pdf', pasta: 'Produto', tamanho: '1,8 MB', quando: 'em junho' },
    { id: 'f12', nome: 'Manual da marca.pdf', pasta: 'Marca', tamanho: '9,6 MB', quando: 'em maio' }
  ];

  async function buscarRemoto(termo, { signal } = {}) {
    // Simulação de rede: 300–550 ms de espera, respeitando o cancelamento.
    await new Promise((ok, falha) => {
      const t = setTimeout(ok, 300 + Math.random() * 250);
      if (signal) signal.addEventListener('abort', () => { clearTimeout(t); falha(new DOMException('cancelado', 'AbortError')); });
    });
    if (!termo) return CATALOGO_ARQUIVOS.slice(0, 5);
    const q = normalizarConsulta(termo);
    return CATALOGO_ARQUIVOS
      .map((f) => ({ f, r: pontuar(q, preparar(f.nome)) }))
      .filter((x) => x.r)
      .sort((a, b) => b.r.pontos - a.r.pontos)
      .slice(0, 8)
      .map((x) => x.f);
  }

  /** Converte o que a API devolve em item da paleta (ícone e cor pela extensão). */
  const TIPOS_ARQUIVO = {
    pdf: ['relatorio', '#ff8a7a'], xlsx: ['planilha', '#57d68d'], csv: ['planilha', '#57d68d'], docx: ['texto', '#7ab4ff'],
    md: ['texto', '#a6abb7'], mp4: ['video', '#c99bff'], svg: ['imagem', '#ffc857'], fig: ['imagem', '#ff9fd0'], png: ['imagem', '#ffc857']
  };
  function itemDeArquivo(f) {
    const ext = (f.nome.split('.').pop() || '').toLowerCase();
    const [icone, cor] = TIPOS_ARQUIVO[ext] || ['arquivo', '#a6abb7'];
    return {
      id: 'arq-' + f.id, grupo: 'arquivos', titulo: f.nome, sub: `${f.pasta} · ${f.tamanho} · ${f.quando}`,
      icone, corArquivo: cor, acao: () => avisar(`Abrindo “${f.nome}”`)
    };
  }

  /* ------------------------------------------------------------------
     5. BUSCA DIFUSA (fuzzy)
     - ignora acentos e maiúsculas ("aurelio" acha "Aurélio");
     - as letras precisam aparecer na ordem, mas não juntas ("rlt" acha "Relatório");
     - pontua mais: início de palavra, letras seguidas, começo do texto, textos curtos;
     - devolve as posições ORIGINAIS das letras para destacar.
     ------------------------------------------------------------------ */
  const SEPARADORES = new Set([' ', '-', '_', '.', '/', '›', '—', '(', '·', '@']);

  /** Normaliza um caractere: sem acento e minúsculo. */
  const semAcento = (c) => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const normalizarConsulta = (t) => semAcento(t).replace(/\s+/g, '');

  /** Prepara um texto: versão normalizada + mapa para os índices originais. */
  function preparar(texto) {
    const norm = [];
    const mapa = [];
    for (let i = 0; i < texto.length; i++) {
      const n = semAcento(texto[i]);
      for (const c of n) { norm.push(c); mapa.push(i); }
    }
    return { texto, norm: norm.join(''), mapa };
  }

  /** Pontua a consulta (já normalizada) num texto preparado. null = não casa. */
  function pontuar(q, alvo) {
    if (!q) return { pontos: 0, indices: [] };
    const s = alvo.norm;
    if (q.length > s.length) return null;
    let melhor = null;
    // tenta começar em cada ocorrência da 1ª letra e fica com a melhor sequência
    for (let inicio = s.indexOf(q[0]); inicio !== -1; inicio = s.indexOf(q[0], inicio + 1)) {
      const pos = [inicio];
      let j = inicio;
      let ok = true;
      for (let k = 1; k < q.length; k++) {
        j = s.indexOf(q[k], j + 1);
        if (j === -1) { ok = false; break; }
        pos.push(j);
      }
      if (!ok) break; // se não casa a partir daqui, não casa depois também
      let pontos = 0;
      pos.forEach((p, k) => {
        pontos += 1;
        if (p === 0 || SEPARADORES.has(s[p - 1])) pontos += 8;        // início de palavra
        if (k > 0 && p === pos[k - 1] + 1) pontos += 5;                  // letras seguidas
        if (k > 0) pontos -= Math.min(4, (p - pos[k - 1] - 1) * 0.2);    // buracos custam
      });
      if (inicio === 0) pontos += 6;                                     // começo do texto
      if (pontos > (melhor ? melhor.pontos : -Infinity)) melhor = { pontos, pos };
    }
    // letras muito espalhadas e fora de início de palavra viram ruído: descarta
    if (!melhor || melhor.pontos < q.length * 2.4) return null;
    melhor.pontos -= s.length * 0.02; // empate: o texto mais curto ganha
    return { pontos: melhor.pontos, indices: melhor.pos.map((p) => alvo.mapa[p]) };
  }

  /** Casa um item: título > subtítulo > palavras-chave (sem destaque). */
  function casar(item, q) {
    if (!item._t) { item._t = preparar(item.titulo); item._s = preparar(item.sub || ''); item._p = semAcento(item.palavras || ''); }
    const t = pontuar(q, item._t);
    if (t) return { pontos: t.pontos + 20, titulo: t.indices, sub: [] };
    const s = pontuar(q, item._s);
    if (s) return { pontos: s.pontos * 0.55, titulo: [], sub: s.indices };
    if (q.length >= 2 && item._p.split(' ').some((w) => w.startsWith(q))) return { pontos: 4, titulo: [], sub: [] };
    return null;
  }

  /** Semelhança (bigramas) para sugerir "Você quis dizer…" quando nada casa. */
  function parecido(a, b) {
    const pares = (t) => { const r = []; for (let i = 0; i < t.length - 1; i++) r.push(t.slice(i, i + 2)); return r; };
    const pa = pares(a), pb = pares(b);
    if (!pa.length || !pb.length) return 0;
    let comuns = 0;
    const resto = pb.slice();
    pa.forEach((p) => { const i = resto.indexOf(p); if (i > -1) { comuns++; resto.splice(i, 1); } });
    return (2 * comuns) / (pa.length + pb.length);
  }
  function sugerirTermo(q) {
    let melhor = null;
    Object.values(LOCAIS).flat().forEach((item) => {
      semAcento(item.titulo).split(/\s+/).forEach((palavra) => {
        const nota = parecido(q, palavra);
        if (nota > 0.34 && (!melhor || nota > melhor.nota)) melhor = { nota, palavra: item.titulo };
      });
    });
    return melhor && melhor.palavra;
  }

  /* ------------------------------------------------------------------
     6. ESTADO + RESULTADOS
     ------------------------------------------------------------------ */
  const estado = {
    aberto: false,
    termo: '',
    filtro: 'tudo',
    nivel: null,        // item pai quando dentro de um subnível (ex.: "Mudar tema")
    termoAntes: '',     // termo da raiz, restaurado ao sair do subnível
    opcoes: [],         // lista plana do que dá para navegar
    ativo: 0,
    chaveAtiva: null
  };
  const remoto = { termo: null, itens: [], carregando: false, erro: false, controle: null, timer: 0, cache: new Map() };

  /** Pede arquivos à API (com espera, cancelamento e cache por termo). */
  function pedirRemoto(termo) {
    if (remoto.termo === termo && (remoto.carregando || !remoto.erro)) return;
    clearTimeout(remoto.timer);
    if (remoto.controle) remoto.controle.abort();
    remoto.termo = termo;
    remoto.erro = false;
    if (remoto.cache.has(termo)) { remoto.itens = remoto.cache.get(termo); remoto.carregando = false; return; }
    remoto.carregando = true;
    remoto.itens = [];
    const controle = new AbortController();
    remoto.controle = controle;
    remoto.timer = setTimeout(async () => {
      try {
        const lista = await buscarRemoto(termo, { signal: controle.signal });
        if (controle.signal.aborted) return;
        remoto.itens = lista.map(itemDeArquivo);
        remoto.cache.set(termo, remoto.itens);
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        remoto.erro = true;
        remoto.itens = [];
      }
      remoto.carregando = false;
      if (estado.aberto) desenhar();
    }, CONFIG.esperaRemoto);
  }

  /** Recentes guardados: [{ id, grupo, titulo, sub, termo }]. */
  const lerRecentes = () => guardar.ler(CONFIG.chaveRecentes, []);
  function salvarRecente(item, termo) {
    const lista = lerRecentes().filter((r) => r.id !== item.id);
    lista.unshift({ id: item.id, grupo: item.grupo, titulo: item.titulo, sub: item.sub, termo, icone: item.icone, cor: item.cor, corArquivo: item.corArquivo });
    guardar.salvar(CONFIG.chaveRecentes, lista.slice(0, CONFIG.maxRecentes));
  }
  /** Reconstrói um recente: item local atual, ou o retrato salvo (arquivos). */
  function itemDoRecente(r) {
    const local = (LOCAIS[r.grupo] || []).find((i) => i.id === r.id);
    if (local) return local;
    return { id: r.id, grupo: r.grupo, titulo: r.titulo, sub: r.sub, icone: r.icone, cor: r.cor, corArquivo: r.corArquivo, acao: () => avisar(`Abrindo “${r.titulo}”`) };
  }

  /**
   * Calcula os grupos a exibir.
   * Devolve { grupos: [{ id, nome, total, itens:[{item, casou, tipo}], carregando, erro }], vazio, sugestao }
   */
  function calcular() {
    const q = normalizarConsulta(estado.termo);

    // Subnível: só os filhos do item escolhido
    if (estado.nivel) {
      const itens = estado.nivel.filhos
        .map((item) => ({ item, casou: q ? casar(item, q) : { titulo: [], sub: [] } }))
        .filter((x) => x.casou);
      return { grupos: [{ id: 'nivel', nome: estado.nivel.titulo, total: itens.length, itens }], vazio: !itens.length };
    }

    // Campo vazio: recentes + sugestões (ou tudo do grupo filtrado)
    if (!q) {
      if (estado.filtro === 'tudo') {
        const grupos = [];
        const recentes = lerRecentes();
        if (recentes.length) {
          const itens = recentes.map((r) => ({ item: itemDoRecente(r), casou: { titulo: [], sub: [] }, recente: r }));
          itens.push({ tipo: 'limpar', item: { id: 'limpar', titulo: 'Limpar buscas recentes', icone: 'lixeira' } });
          grupos.push({ id: 'recentes', nome: 'Recentes', total: recentes.length, itens });
        }
        const todos = Object.values(LOCAIS).flat();
        const sug = SUGESTOES.map((id) => todos.find((i) => i.id === id)).filter((i) => i && !recentes.some((r) => r.id === i.id));
        grupos.push({ id: 'sugestoes', nome: 'Sugestões', total: sug.length, itens: sug.map((item) => ({ item, casou: { titulo: [], sub: [] } })) });
        return { grupos, vazio: false };
      }
      if (estado.filtro === 'arquivos') {
        pedirRemoto('');
        return { grupos: [grupoRemoto('', 'Arquivos recentes')], vazio: false };
      }
      const lista = LOCAIS[estado.filtro];
      const nome = GRUPOS.find((g) => g.id === estado.filtro).nome;
      return { grupos: [{ id: estado.filtro, nome, total: lista.length, itens: lista.map((item) => ({ item, casou: { titulo: [], sub: [] } })) }], vazio: false };
    }

    // Com termo: cada grupo pontua e ordena; Arquivos vem da API
    const grupos = [];
    GRUPOS.forEach((g) => {
      if (estado.filtro !== 'tudo' && estado.filtro !== g.id) return;
      if (g.remoto) {
        pedirRemoto(estado.termo.trim());
        const gr = grupoRemoto(q, g.nome);
        if (gr.carregando || gr.erro || gr.total) grupos.push(gr);
        return;
      }
      const itens = LOCAIS[g.id]
        .map((item) => ({ item, casou: casar(item, q) }))
        .filter((x) => x.casou)
        .sort((a, b) => b.casou.pontos - a.casou.pontos);
      if (itens.length) grupos.push({ id: g.id, nome: g.nome, total: itens.length, itens });
    });

    // O grupo com o melhor resultado vem primeiro (Enter no 1º item = melhor aposta).
    // Um grupo ainda carregando fica por último, para não empurrar os demais.
    const nota = (g) => (g.carregando ? -Infinity : g.itens.reduce((m, x) => Math.max(m, x.casou ? x.casou.pontos : -Infinity), -Infinity));
    grupos.sort((a, b) => { const na = nota(a), nb = nota(b); return na === nb ? 0 : nb > na ? 1 : -1; });

    // Limite por grupo no "Tudo" + opção "Mostrar mais"
    if (estado.filtro === 'tudo') {
      grupos.forEach((g) => {
        if (g.itens.length > CONFIG.limitePorGrupo) {
          const resto = g.itens.length - CONFIG.limitePorGrupo;
          g.itens = g.itens.slice(0, CONFIG.limitePorGrupo);
          g.itens.push({ tipo: 'mais', grupoAlvo: g.id, item: { id: 'mais-' + g.id, titulo: `Mostrar mais ${resto} em ${g.nome}` } });
        }
      });
    }
    const vazio = !grupos.length;
    return { grupos, vazio, sugestao: vazio ? sugerirTermo(q) : null };
  }

  /** Grupo de arquivos a partir do estado da busca remota. */
  function grupoRemoto(q, nome) {
    const itens = remoto.carregando ? [] : remoto.itens.map((item) => ({ item, casou: q ? (casar(item, q) || { titulo: [], sub: [] }) : { titulo: [], sub: [] } }));
    if (remoto.erro) itens.push({ tipo: 'repetir', item: { id: 'repetir', titulo: 'Não foi possível buscar arquivos — tentar de novo', icone: 'alerta' } });
    return { id: 'arquivos', nome, total: remoto.carregando ? 0 : remoto.itens.length, itens, carregando: remoto.carregando, erro: remoto.erro };
  }

  /* ------------------------------------------------------------------
     7. DESENHO DA LISTA
     ------------------------------------------------------------------ */
  const camada = $('#bi-camada');
  const modal = $('#bi-modal');
  const entrada = $('#bi-entrada');
  const lista = $('#bi-lista');
  const caixaResultados = $('#bi-resultados');
  const vazioEl = $('#bi-vazio');
  const filtrosEl = $('#bi-filtros');
  const trilha = $('#bi-trilha');
  const totalEl = $('#bi-total');
  const anuncio = $('#bi-anuncio');
  const app = $('#bi-app');
  const PLACEHOLDER = entrada.getAttribute('placeholder');

  /** Escreve um texto com <mark> nas posições encontradas (sem innerHTML). */
  function textoDestacado(el, texto, indices) {
    el.textContent = '';
    if (!indices || !indices.length) { el.textContent = texto; return; }
    const marcar = new Set(indices);
    let i = 0;
    while (i < texto.length) {
      const dentro = marcar.has(i);
      let j = i;
      while (j < texto.length && marcar.has(j) === dentro) j++;
      const pedaco = texto.slice(i, j);
      if (dentro) { const m = document.createElement('mark'); m.textContent = pedaco; el.appendChild(m); } else el.appendChild(document.createTextNode(pedaco));
      i = j;
    }
  }

  function kbds(teclas) {
    const span = document.createElement('span');
    span.className = 'bi-item__atalho';
    teclas.forEach((t) => {
      const k = document.createElement('kbd');
      k.className = 'bi-kbd';
      k.textContent = t;
      span.appendChild(k);
    });
    return span;
  }

  /** Cria o elemento role="option" de uma entrada. */
  function criarOpcao(entradaLista, indice, grupoId) {
    const { item, casou, tipo } = entradaLista;
    const el = document.createElement('div');
    el.className = 'bi-item' + (tipo === 'mais' || tipo === 'limpar' || tipo === 'repetir' ? ' bi-item--mais' : '');
    el.id = 'bi-op-' + indice;
    el.setAttribute('role', 'option');
    el.setAttribute('aria-selected', 'false');
    el.dataset.indice = indice;

    // Ícone / avatar
    const ico = document.createElement('span');
    ico.setAttribute('aria-hidden', 'true');
    if (item.cor && item.grupo === 'pessoas') {
      ico.className = 'bi-item__ico bi-item__ico--pessoa';
      ico.style.setProperty('--c', item.cor);
      if (item.foto) {
        // Foto real da pessoa (opcional)
        const img = document.createElement('img');
        img.src = item.foto; img.alt = ''; img.width = 32; img.height = 32;
        ico.appendChild(img);
      } else if (item.avatar) {
        // Retrato ilustrado do sprite RETRATOS (decorativo: o nome está no texto ao lado)
        ico.innerHTML = `<svg viewBox="0 0 120 120" focusable="false"><use href="#retrato-${item.avatar}"/></svg>`;
      } else {
        // Reserva: iniciais do nome
        ico.textContent = item.titulo.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
      }
    } else if (item.tipoIcone === 'cor') {
      ico.className = 'bi-item__ico bi-item__ico--cor';
      ico.style.setProperty('--c', item.cor);
    } else {
      ico.className = 'bi-item__ico' + (item.corArquivo ? ' bi-item__ico--arquivo' : '');
      if (item.corArquivo) ico.style.setProperty('--c', item.corArquivo);
      ico.innerHTML = svg(tipo === 'mais' ? 'setas' : !tipo && grupoId === 'recentes' ? 'relogio' : item.icone);
    }
    el.appendChild(ico);

    // Título + subtítulo
    const texto = document.createElement('span');
    texto.className = 'bi-item__texto';
    const titulo = document.createElement('span');
    titulo.className = 'bi-item__titulo';
    textoDestacado(titulo, item.titulo, casou && casou.titulo);
    texto.appendChild(titulo);
    const subTexto = entradaLista.recente && entradaLista.recente.termo ? `Você buscou “${entradaLista.recente.termo}” · ${item.sub || ''}` : item.sub;
    if (subTexto) {
      const sub = document.createElement('span');
      sub.className = 'bi-item__sub';
      textoDestacado(sub, subTexto, entradaLista.recente ? [] : casou && casou.sub);
      texto.appendChild(sub);
    }
    el.appendChild(texto);

    // Lado direito: atalho, marcação, "Abrir ↵"
    const fim = document.createElement('span');
    fim.className = 'bi-item__fim';
    fim.setAttribute('aria-hidden', 'true');
    if (item.marcado && item.marcado()) {
      const m = document.createElement('span');
      m.className = 'bi-item__marcado';
      m.textContent = '✓ atual';
      fim.appendChild(m);
      el.setAttribute('aria-current', 'true');
    }
    if (item.atalho && !tipo) fim.appendChild(kbds(item.atalho));
    const entrar = document.createElement('span');
    entrar.className = 'bi-item__entrar';
    const grupoInfo = GRUPOS.find((g) => g.id === item.grupo);
    const verbo = tipo === 'mais' ? 'Ver' : tipo === 'limpar' ? 'Limpar' : tipo === 'repetir' ? 'Tentar' : item.filhos ? 'Escolher' : grupoInfo ? grupoInfo.verbo : 'Abrir';
    entrar.append(verbo + ' ');
    const kEnter = document.createElement('kbd');
    kEnter.className = 'bi-kbd';
    kEnter.textContent = '↵';
    entrar.appendChild(kEnter);
    fim.appendChild(entrar);
    if (item.filhos) {
      const seta = document.createElement('span');
      seta.className = 'bi-item__seta';
      seta.textContent = '›';
      fim.appendChild(seta);
    }
    el.appendChild(fim);
    return el;
  }

  function criarEsqueleto() {
    const frag = document.createDocumentFragment();
    ['68%', '52%', '74%'].forEach((l) => {
      const s = document.createElement('div');
      s.className = 'bi-esqueleto';
      s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--l', l);
      s.innerHTML = '<span class="bi-esqueleto__ico"></span><span class="bi-esqueleto__linhas"><span></span><span></span></span>';
      frag.appendChild(s);
    });
    return frag;
  }

  /** Chave estável de uma opção, para manter o item ativo entre redesenhos. */
  const chaveDe = (o) => (o.tipo || 'item') + ':' + o.item.id;

  /** Redesenha tudo a partir do estado. */
  function desenhar(manterAtivo = true) {
    const { grupos, vazio, sugestao } = calcular();
    lista.textContent = '';
    estado.opcoes = [];

    if (vazio) {
      // Nada encontrado: mensagem + sugestão navegável
      vazioEl.hidden = false;
      vazioEl.innerHTML = `<span class="bi-vazio__ico">${svg('lupa')}</span><p class="bi-vazio__titulo"></p><p class="bi-vazio__texto"></p>`;
      $('.bi-vazio__titulo', vazioEl).textContent = `Nada encontrado para “${estado.termo.trim()}”`;
      $('.bi-vazio__texto', vazioEl).textContent = estado.nivel
        ? 'Apague o texto para ver todas as opções, ou ⌫ para voltar.'
        : estado.filtro !== 'tudo' ? 'Aperte Tab para buscar em todos os grupos, ou tente outra palavra.' : 'Confira a grafia ou tente uma palavra mais curta.';
      if (sugestao) {
        grupos.push({ id: 'sugestao', nome: 'Você quis dizer', total: 1, itens: [{ tipo: 'sugestao', termoSugerido: sugestao, item: { id: 'sug', titulo: `Buscar por “${sugestao}”`, icone: 'lupa' } }] });
      }
    } else {
      vazioEl.hidden = true;
      vazioEl.textContent = '';
    }

    grupos.forEach((g) => {
      const bloco = document.createElement('div');
      bloco.className = 'bi-grupo';
      bloco.setAttribute('role', 'group');
      const n = g.carregando ? 'buscando' : g.total === 1 ? '1 resultado' : `${g.total} resultados`;
      bloco.setAttribute('aria-label', `${g.nome}, ${n}`);
      if (g.carregando) bloco.setAttribute('aria-busy', 'true');
      const cab = document.createElement('div');
      cab.className = 'bi-grupo__titulo';
      cab.setAttribute('aria-hidden', 'true');
      cab.textContent = g.nome;
      if (g.carregando) {
        const giro = document.createElement('span');
        giro.className = 'bi-grupo__giro';
        cab.appendChild(giro);
      } else if (g.id !== 'sugestao' && g.id !== 'nivel') {
        const cont = document.createElement('span');
        cont.className = 'bi-grupo__n';
        cont.textContent = g.total;
        cab.appendChild(cont);
      }
      bloco.appendChild(cab);
      if (g.carregando) bloco.appendChild(criarEsqueleto());
      g.itens.forEach((o) => {
        const indice = estado.opcoes.length;
        estado.opcoes.push(o);
        bloco.appendChild(criarOpcao(o, indice, g.id));
      });
      lista.appendChild(bloco);
    });

    // Contagem nos filtros (só com termo, fora de subnível)
    const q = normalizarConsulta(estado.termo);
    $$('button', filtrosEl).forEach((b) => {
      const f = b.dataset.filtro;
      b.setAttribute('aria-pressed', String(f === estado.filtro));
      const n = $('.bi-filtros__n', b);
      if (!n) return;
      if (!q) { n.textContent = ''; return; }
      if (f === 'arquivos') n.textContent = remoto.carregando ? '…' : remoto.termo === estado.termo.trim() ? remoto.itens.length || '' : '';
      else n.textContent = LOCAIS[f].filter((i) => casar(i, q)).length || '';
    });

    // Item ativo: mantém o mesmo se ainda existir; senão o primeiro
    let novo = 0;
    if (manterAtivo && estado.chaveAtiva) {
      const i = estado.opcoes.findIndex((o) => chaveDe(o) === estado.chaveAtiva);
      if (i > -1) novo = i;
    }
    ativar(novo, false);

    const total = estado.opcoes.filter((o) => !o.tipo).length;
    totalEl.textContent = total ? `${total} ${total === 1 ? 'resultado' : 'resultados'}` : '';
    anunciar(vazio ? `Nada encontrado para ${estado.termo.trim()}` : `${total} ${total === 1 ? 'resultado' : 'resultados'}`);
  }

  /** Marca a opção ativa (aria-activedescendant) e rola até ela. */
  function ativar(indice, rolar = true) {
    const n = estado.opcoes.length;
    $$('.bi-item.is-ativo', lista).forEach((el) => { el.classList.remove('is-ativo'); el.setAttribute('aria-selected', 'false'); });
    if (!n) { estado.ativo = -1; estado.chaveAtiva = null; entrada.removeAttribute('aria-activedescendant'); return; }
    estado.ativo = (indice + n) % n;
    estado.chaveAtiva = chaveDe(estado.opcoes[estado.ativo]);
    const el = $('#bi-op-' + estado.ativo);
    el.classList.add('is-ativo');
    el.setAttribute('aria-selected', 'true');
    entrada.setAttribute('aria-activedescendant', el.id);
    if (rolar) {
      // primeiro item de um grupo: rola até o título do grupo também
      const grupo = el.parentElement;
      if (grupo.querySelector('.bi-item') === el && grupo.firstElementChild) grupo.firstElementChild.scrollIntoView({ block: 'nearest' });
      el.scrollIntoView({ block: 'nearest' });
    }
  }

  let anuncioTimer = 0;
  function anunciar(texto) {
    clearTimeout(anuncioTimer);
    anuncioTimer = setTimeout(() => { anuncio.textContent = texto; }, 450);
  }

  /** Atualiza a trilha (subnível), placeholder, filtros e dicas do rodapé. */
  function atualizarCabecalho() {
    const sub = !!estado.nivel;
    trilha.hidden = !sub;
    trilha.textContent = sub ? estado.nivel.titulo : '';
    filtrosEl.hidden = sub;
    entrada.setAttribute('placeholder', sub ? `Escolha: ${estado.nivel.filhos.map((f) => f.titulo.toLowerCase()).join(', ')}…` : PLACEHOLDER);
    $('.bi-rodape__dica--voltar').hidden = !sub;
    $('.bi-rodape__dica--tab').hidden = sub;
  }

  /* ------------------------------------------------------------------
     8. TECLADO, ABRIR/FECHAR, FOCO PRESO
     ------------------------------------------------------------------ */
  let focoAnterior = null;

  function abrir({ filtro = 'tudo', nivel = null } = {}) {
    if (estado.aberto) { entrada.focus(); return; }
    focoAnterior = document.activeElement;
    estado.aberto = true;
    estado.termo = '';
    estado.filtro = filtro;
    estado.nivel = nivel;
    estado.chaveAtiva = null;
    entrada.value = '';
    camada.hidden = false;
    camada.classList.remove('is-saindo');
    document.body.classList.add('is-busca-aberta', 'bi-trava');
    if (app) app.inert = true; // nada atrás do modal recebe foco ou clique
    atualizarCabecalho();
    desenhar(false);
    caixaResultados.scrollTop = 0;
    entrada.focus({ preventScroll: true });
  }

  async function fechar() {
    if (!estado.aberto) return;
    estado.aberto = false;
    clearTimeout(remoto.timer);
    if (remoto.controle && remoto.carregando) { remoto.controle.abort(); remoto.termo = null; remoto.carregando = false; }
    document.body.classList.remove('is-busca-aberta', 'bi-trava');
    if (app) app.inert = false;
    camada.classList.add('is-saindo');
    await esperar(reduzido() ? 0 : 160);
    if (estado.aberto) return; // reabriu durante a saída
    camada.hidden = true;
    camada.classList.remove('is-saindo');
    const volta = focoAnterior && document.contains(focoAnterior) && focoAnterior !== document.body ? focoAnterior : $('#bi-gatilho');
    if (volta) volta.focus({ preventScroll: true });
  }

  function pulso() {
    modal.classList.remove('is-pulso');
    void modal.offsetWidth;
    modal.classList.add('is-pulso');
  }

  function entrarNivel(item) {
    estado.termoAntes = estado.termo;
    estado.nivel = item;
    estado.termo = '';
    estado.chaveAtiva = null;
    entrada.value = '';
    // começa com a opção atual selecionada
    const atual = item.filhos.findIndex((f) => f.marcado && f.marcado());
    atualizarCabecalho();
    desenhar(false);
    if (atual > -1) ativar(atual);
    pulso();
  }

  function sairNivel() {
    estado.nivel = null;
    estado.termo = estado.termoAntes;
    entrada.value = estado.termo;
    estado.chaveAtiva = null;
    atualizarCabecalho();
    desenhar(false);
    pulso();
  }

  function mudarFiltro(passo) {
    if (estado.nivel) return;
    const i = FILTROS.indexOf(estado.filtro);
    estado.filtro = FILTROS[(i + passo + FILTROS.length) % FILTROS.length];
    estado.chaveAtiva = null;
    desenhar(false);
    caixaResultados.scrollTop = 0;
  }

  /** Executa a opção na posição indicada. */
  function executar(indice) {
    const o = estado.opcoes[indice];
    if (!o) return;
    if (o.tipo === 'mais') { estado.filtro = o.grupoAlvo; estado.chaveAtiva = null; desenhar(false); caixaResultados.scrollTop = 0; return; }
    if (o.tipo === 'sugestao') { entrada.value = o.termoSugerido; aoDigitar(); return; }
    if (o.tipo === 'limpar') { guardar.salvar(CONFIG.chaveRecentes, []); desenhar(false); avisar('Buscas recentes apagadas'); return; }
    if (o.tipo === 'repetir') { remoto.termo = null; desenhar(); return; }
    const item = o.item;
    if (item.filhos) { entrarNivel(item); return; }
    if (!item.pai) salvarRecente(item, estado.termo.trim());
    fechar();
    if (item.acao) item.acao();
  }

  function aoDigitar() {
    estado.termo = entrada.value;
    estado.chaveAtiva = null;
    desenhar(false);
    caixaResultados.scrollTop = 0;
  }
  entrada.addEventListener('input', aoDigitar);

  // Teclado dentro da paleta
  modal.addEventListener('keydown', (ev) => {
    const n = estado.opcoes.length;
    switch (ev.key) {
      case 'ArrowDown':
        ev.preventDefault();
        if (n) ativar(estado.ativo + 1);
        break;
      case 'ArrowUp':
        ev.preventDefault();
        if (n) ativar(estado.ativo - 1);
        break;
      case 'PageDown':
        ev.preventDefault();
        if (n) ativar(Math.min(n - 1, estado.ativo + 5));
        break;
      case 'PageUp':
        ev.preventDefault();
        if (n) ativar(Math.max(0, estado.ativo - 5));
        break;
      case 'Enter':
        if (ev.isComposing) return;
        ev.preventDefault();
        executar(estado.ativo);
        break;
      case 'Tab':
        // Tab troca o filtro e mantém o foco no campo (foco preso no diálogo)
        ev.preventDefault();
        mudarFiltro(ev.shiftKey ? -1 : 1);
        entrada.focus();
        break;
      case 'Escape':
        ev.preventDefault();
        ev.stopPropagation();
        fechar();
        break;
      case 'Backspace':
        if (estado.nivel && entrada.value === '' && ev.target === entrada) { ev.preventDefault(); sairNivel(); }
        break;
      default:
    }
  });

  // Mouse: passar por cima ativa, clicar executa. mousedown não rouba o foco do campo.
  lista.addEventListener('mousedown', (ev) => ev.preventDefault());
  filtrosEl.addEventListener('mousedown', (ev) => ev.preventDefault());
  lista.addEventListener('mousemove', (ev) => {
    const el = ev.target.closest('.bi-item');
    if (el && Number(el.dataset.indice) !== estado.ativo) ativar(Number(el.dataset.indice), false);
  });
  lista.addEventListener('click', (ev) => {
    const el = ev.target.closest('.bi-item');
    if (el) executar(Number(el.dataset.indice));
  });
  filtrosEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    estado.filtro = b.dataset.filtro;
    estado.chaveAtiva = null;
    desenhar(false);
    entrada.focus();
  });
  trilha.addEventListener('click', () => { sairNivel(); entrada.focus(); });
  $('#bi-fechar').addEventListener('click', fechar);
  camada.addEventListener('mousedown', (ev) => { if (ev.target === camada) fechar(); });

  // Foco preso: se algo fora do modal ganhar foco, volta para o campo
  document.addEventListener('focusin', (ev) => {
    if (estado.aberto && !modal.contains(ev.target)) entrada.focus({ preventScroll: true });
  });

  /* ------------------------------------------------------------------
     9. EXECUÇÃO DAS AÇÕES (efeitos reais na página de demonstração)
     ------------------------------------------------------------------ */
  const aviso = $('#bi-aviso');
  let avisoTimer = 0;
  function avisar(texto) {
    aviso.textContent = texto;
    aviso.classList.add('is-visivel');
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => aviso.classList.remove('is-visivel'), 2400);
  }

  const raiz = document.documentElement;
  const midiaClaro = window.matchMedia('(prefers-color-scheme: light)');
  const temaAtual = () => guardar.ler(CONFIG.chaveTema, 'escuro');
  const destaqueAtual = () => guardar.ler(CONFIG.chaveDestaque, '');

  function aplicarTema() {
    const pref = temaAtual();
    const efetivo = pref === 'sistema' ? (midiaClaro.matches ? 'claro' : 'escuro') : pref;
    raiz.setAttribute('data-tema', efetivo);
  }
  function definirTema(valor) {
    guardar.salvar(CONFIG.chaveTema, valor);
    aplicarTema();
    avisar(valor === 'sistema' ? 'Tema: segue o sistema' : `Tema ${valor} ativado`);
  }
  midiaClaro.addEventListener('change', () => { if (temaAtual() === 'sistema') aplicarTema(); });

  function definirDestaque(valor, nome) {
    guardar.salvar(CONFIG.chaveDestaque, valor);
    if (valor) raiz.setAttribute('data-destaque', valor); else raiz.removeAttribute('data-destaque');
    avisar(`Cor de destaque: ${nome}`);
  }

  function alternarLateral() {
    const oculta = document.body.classList.toggle('is-sem-lateral');
    avisar(oculta ? 'Barra lateral oculta' : 'Barra lateral visível');
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      avisar('Link copiado');
    } catch (e) {
      avisar('Não foi possível copiar o link');
    }
  }

  /** "Navega" no app fictício: troca o título e o item ativo da lateral. */
  function navegarPara(pagina) {
    // No seu projeto: location.href = pagina.url (ou o roteador do seu framework)
    const titulo = $('#bi-pagina-titulo');
    const sobre = $('#bi-pagina-sobre');
    if (titulo) titulo.textContent = pagina.id === 'p-inicio' ? 'Bom dia, Lia' : pagina.titulo;
    if (sobre) sobre.textContent = pagina.id === 'p-inicio' ? 'Quinta-feira, 29 de outubro' : pagina.sub;
    $$('#bi-lateral-lista a').forEach((a) => a.classList.toggle('is-ativo', a.dataset.pagina === pagina.id));
    avisar(`Você está em ${pagina.titulo}`);
  }

  /* ------------------------------------------------------------------
     10. ATALHOS GLOBAIS E DEMONSTRAÇÃO INICIAL
     ------------------------------------------------------------------ */
  // Mostra Ctrl em vez de ⌘ fora do Mac
  if (!ehMac) $$('[data-mod]').forEach((k) => { k.textContent = 'Ctrl'; });

  const editavel = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  let esperandoG = false;
  let gTimer = 0;

  document.addEventListener('keydown', (ev) => {
    // ⌘K / Ctrl+K abre e fecha de qualquer lugar
    if ((ev.metaKey || ev.ctrlKey) && !ev.altKey && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      if (estado.aberto) fechar(); else abrir();
      return;
    }
    if (estado.aberto || ev.metaKey || ev.ctrlKey || ev.altKey || editavel(ev.target)) return;

    // "/" abre a busca
    if (ev.key === '/') { ev.preventDefault(); abrir(); return; }

    // Sequências "G + letra" levam às páginas
    const tecla = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
    if (esperandoG) {
      esperandoG = false;
      clearTimeout(gTimer);
      const pagina = PAGINAS.find((p) => p.atalho && p.atalho[1] === tecla);
      if (pagina) { ev.preventDefault(); navegarPara(pagina); }
      return;
    }
    if (tecla === 'G' && !ev.shiftKey) {
      esperandoG = true;
      gTimer = setTimeout(() => { esperandoG = false; }, 900);
      return;
    }

    // Atalhos de uma tecla das ações (os mesmos exibidos na paleta)
    const acao = ACOES.find((a) => {
      if (!a.atalho) return false;
      const comShift = a.atalho[0] === '⇧';
      const letra = a.atalho[a.atalho.length - 1];
      return comShift === ev.shiftKey && letra === tecla;
    });
    if (!acao) return;
    ev.preventDefault();
    if (acao.filhos) abrir({ nivel: acao }); else acao.acao();
  });

  // Gatilhos (os que não existirem na sua página são ignorados)
  const gatilho = $('#bi-gatilho');
  const botaoComandos = $('#bi-abrir-2');
  if (gatilho) gatilho.addEventListener('click', () => abrir());
  if (botaoComandos) botaoComandos.addEventListener('click', () => abrir({ filtro: 'acoes' }));
  $$('#bi-lateral-lista a').forEach((a) => a.addEventListener('click', (ev) => {
    ev.preventDefault();
    const pagina = PAGINAS.find((p) => p.id === a.dataset.pagina);
    if (pagina) navegarPara(pagina);
  }));
  $$('.bi-topo__nav a, .bi-logo').forEach((a) => a.addEventListener('click', (ev) => ev.preventDefault()));

  aplicarTema();

  // DEMONSTRAÇÃO: abre a paleta e "digita" o termo de exemplo (para a capa da loja).
  if (CONFIG.abrirAoCarregar && !/[?&]demo=0\b/.test(location.search)) {
    setTimeout(async () => {
      abrir();
      if (reduzido()) { entrada.value = CONFIG.termoDemo; aoDigitar(); return; }
      for (const letra of CONFIG.termoDemo) {
        await esperar(95);
        if (!estado.aberto) return;
        entrada.value += letra;
        aoDigitar();
      }
    }, 160);
  }
})();
