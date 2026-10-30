/* =====================================================================
   PAINEL VIDRO — script.js
   ---------------------------------------------------------------------
   JavaScript puro, sem dependências. Organização:
   1. DADOS ............ tudo o que o painel mostra (troque pela sua API)
   2. Utilitários ...... seletores, formatação pt-BR, animação, cores
   3. Ícones ........... SVGs dos cômodos, dispositivos, cenas e clima
   4. Céu e horário .... manhã / tarde / noite (automático ou forçado)
   5. Topo ............. saudação, data, clima
   6. Cômodos .......... barra lateral / inferior e troca animada
   7. Energia .......... gráfico de área 24 h com dica (tooltip)
   8. Termostato ....... anel arrastável (ponteiro + teclado)
   9. Dispositivos ..... toggles, contador e "desligar tudo"
   10. Iluminação ...... brilho e cor da lâmpada ilustrada
   11. Câmera .......... cena ilustrada, ruído, hora ao vivo, REC
   12. Medidores ....... água e solar com contagem animada
   13. Cenas ........... várias mudanças de uma vez, em sequência
   14. Início
   ===================================================================== */
(() => {
  'use strict';

  /* ===================================================================
     1. DADOS
     -------------------------------------------------------------------
     Tudo é determinístico (o mesmo a cada carregamento). Para plugar
     dados reais, substitua os valores abaixo pelo retorno da sua API e
     chame window.PainelVidro.recarregar() (veja o fim do arquivo).

     comodos.<id>:
       nome / curto ........ nome completo e rótulo curto (barra do celular)
       icone ............... chave de ICONES.comodos
       cor ................. acento do cômodo no resumo "Casa hoje"
                             ('ambar' | 'ciano' | 'coral' | 'verde' | 'azul')
       energia.hoje/ontem .. 24 números = kWh consumidos em cada hora (0h–23h)
       termostato .......... alvo e atual em °C, umidade em %, modo
                             ('frio' | 'auto' | 'calor') e programacao =
                             lista [hora, °C] dos ajustes automáticos do dia
       dispositivos ........ lista fixa de 5 tipos: luz, tv, ar, robo, camera
                             (ar = controla o termostato; luz = controla a
                             iluminação; camera = controla o feed)
       iluminacao .......... brilho 0–100 e cor (hex) da luminária principal
       camera .............. código, local e cena ilustrada
                             ('sala' | 'quarto' | 'escritorio' | 'cozinha' | 'externa')
       agua ................ litros usados hoje e meta diária
     =================================================================== */
  const DADOS = {
    usuario: { nome: 'Marina', sobrenome: 'Alves', casa: 'Casa da Marina' },
    tarifaKwh: 0.92, // R$ por kWh

    // Clima por período do dia (o botão de clima alterna a condição na demo)
    clima: {
      manha: { temperatura: 21, condicao: 'sol', umidade: 64 },
      tarde: { temperatura: 27, condicao: 'nuvem', umidade: 52 },
      noite: { temperatura: 19, condicao: 'sol', umidade: 71 } // 'sol' à noite = céu limpo com lua
    },

    // Energia solar é da casa toda (não muda por cômodo)
    solar: { geradoKwh: 14.6, capacidadeKwh: 18 },

    // Paleta de cores da luminária
    coresLuz: [
      { nome: 'Âmbar', hex: '#ffc46b' },
      { nome: 'Branco quente', hex: '#ffe2b3' },
      { nome: 'Branco neutro', hex: '#fff5e6' },
      { nome: 'Ciano', hex: '#6fe3ff' },
      { nome: 'Verde-água', hex: '#7fe7c4' },
      { nome: 'Coral', hex: '#ff9a7a' }
    ],

    comodos: {
      sala: {
        nome: 'Sala', curto: 'Sala', icone: 'sala', cor: 'ambar',
        energia: {
          hoje: [0.07, 0.09, 0.08, 0.08, 0.1, 0.16, 0.28, 0.46, 0.51, 0.42, 0.41, 0.47, 0.59, 0.55, 0.54, 0.52, 0.49, 0.51, 0.85, 1.07, 1.31, 1.13, 0.68, 0.44],
          ontem: [0.1, 0.09, 0.09, 0.09, 0.11, 0.18, 0.3, 0.45, 0.56, 0.43, 0.39, 0.47, 0.58, 0.6, 0.66, 0.54, 0.54, 0.68, 0.79, 1.1, 1.3, 1.14, 0.79, 0.44]
        },
        termostato: { alvo: 22, atual: 23.5, umidade: 48, modo: 'auto', programacao: [[6, 21], [9, 23], [18, 22], [23, 20]] },
        dispositivos: [
          { id: 'luz', tipo: 'luz', nome: 'Luzes', lampadas: 4, ligado: true },
          { id: 'tv', tipo: 'tv', nome: 'TV', ligado: true, textoLigado: 'Streaming', textoDesligado: 'Desligada' },
          { id: 'ar', tipo: 'ar', nome: 'Ar', ligado: true },
          { id: 'robo', tipo: 'robo', nome: 'Robô aspirador', ligado: false, textoLigado: 'Limpando · 40%', textoDesligado: 'Na base · 100%' },
          { id: 'camera', tipo: 'camera', nome: 'Câmera', ligado: true }
        ],
        iluminacao: { brilho: 72, cor: '#ffc46b', nome: 'Pendente da sala' },
        camera: { codigo: 'CAM 01', local: 'Sala de estar', cena: 'sala' },
        agua: { litros: 18, meta: 30 }
      },
      cozinha: {
        nome: 'Cozinha', curto: 'Cozinha', icone: 'cozinha', cor: 'coral',
        energia: {
          hoje: [0.13, 0.11, 0.12, 0.12, 0.17, 0.34, 0.64, 0.92, 1.02, 0.75, 0.58, 0.58, 0.65, 0.73, 0.7, 0.55, 0.57, 0.54, 0.75, 0.89, 0.96, 0.83, 0.61, 0.4],
          ontem: [0.14, 0.13, 0.14, 0.13, 0.18, 0.32, 0.66, 1.05, 1.21, 0.93, 0.58, 0.69, 0.66, 0.76, 0.68, 0.57, 0.63, 0.55, 0.76, 0.85, 1, 0.92, 0.6, 0.45]
        },
        termostato: { alvo: 23, atual: 25, umidade: 55, modo: 'frio', programacao: [[6, 22], [11, 24], [19, 23], [23, 22]] },
        dispositivos: [
          { id: 'luz', tipo: 'luz', nome: 'Luzes', lampadas: 3, ligado: true },
          { id: 'tv', tipo: 'tv', nome: 'Smart display', ligado: false, textoLigado: 'Receitas', textoDesligado: 'Em espera' },
          { id: 'ar', tipo: 'ar', nome: 'Ar', ligado: true },
          { id: 'robo', tipo: 'robo', nome: 'Robô aspirador', ligado: true, textoLigado: 'Limpando · 65%', textoDesligado: 'Na base · 100%' },
          { id: 'camera', tipo: 'camera', nome: 'Câmera', ligado: true }
        ],
        iluminacao: { brilho: 90, cor: '#fff5e6', nome: 'Trilho da bancada' },
        camera: { codigo: 'CAM 02', local: 'Cozinha', cena: 'cozinha' },
        agua: { litros: 142, meta: 200 }
      },
      quarto: {
        nome: 'Quarto', curto: 'Quarto', icone: 'quarto', cor: 'azul',
        energia: {
          hoje: [0.2, 0.2, 0.2, 0.2, 0.2, 0.22, 0.19, 0.31, 0.35, 0.35, 0.46, 0.54, 0.75, 0.76, 0.74, 0.55, 0.49, 0.34, 0.36, 0.45, 0.39, 0.37, 0.24, 0.19],
          ontem: [0.2, 0.21, 0.17, 0.22, 0.19, 0.28, 0.24, 0.38, 0.4, 0.4, 0.45, 0.64, 0.68, 0.87, 0.8, 0.66, 0.48, 0.35, 0.36, 0.49, 0.42, 0.42, 0.32, 0.17]
        },
        termostato: { alvo: 20.5, atual: 22, umidade: 52, modo: 'auto', programacao: [[6, 21], [8, 22], [21, 20.5], [23, 19]] },
        dispositivos: [
          { id: 'luz', tipo: 'luz', nome: 'Luzes', lampadas: 2, ligado: false },
          { id: 'tv', tipo: 'tv', nome: 'TV do quarto', ligado: false, textoLigado: 'Série', textoDesligado: 'Desligada' },
          { id: 'ar', tipo: 'ar', nome: 'Ar', ligado: true },
          { id: 'robo', tipo: 'robo', nome: 'Robô aspirador', ligado: false, textoLigado: 'Limpando · 20%', textoDesligado: 'Na base · 88%' },
          { id: 'camera', tipo: 'camera', nome: 'Câmera', ligado: false }
        ],
        iluminacao: { brilho: 35, cor: '#ffe2b3', nome: 'Abajur da cabeceira' },
        camera: { codigo: 'CAM 03', local: 'Quarto', cena: 'quarto' },
        agua: { litros: 96, meta: 150 }
      },
      escritorio: {
        nome: 'Escritório', curto: 'Escritório', icone: 'escritorio', cor: 'ciano',
        energia: {
          hoje: [0.04, 0.04, 0.04, 0.05, 0.05, 0.07, 0.13, 0.23, 0.3, 0.31, 0.39, 0.54, 0.75, 0.75, 0.67, 0.59, 0.49, 0.41, 0.53, 0.6, 0.61, 0.55, 0.45, 0.26],
          ontem: [0.04, 0.05, 0.05, 0.04, 0.05, 0.07, 0.15, 0.24, 0.32, 0.38, 0.44, 0.55, 0.73, 0.74, 0.78, 0.62, 0.51, 0.46, 0.57, 0.64, 0.75, 0.55, 0.42, 0.26]
        },
        termostato: { alvo: 21.5, atual: 22.5, umidade: 45, modo: 'frio', programacao: [[8, 22], [12, 21.5], [18, 22], [23, 21]] },
        dispositivos: [
          { id: 'luz', tipo: 'luz', nome: 'Luzes', lampadas: 2, ligado: true },
          { id: 'tv', tipo: 'tv', nome: 'Monitor', ligado: true, textoLigado: 'Em uso', textoDesligado: 'Suspenso' },
          { id: 'ar', tipo: 'ar', nome: 'Ar', ligado: false },
          { id: 'robo', tipo: 'robo', nome: 'Robô aspirador', ligado: false, textoLigado: 'Limpando · 10%', textoDesligado: 'Na base · 100%' },
          { id: 'camera', tipo: 'camera', nome: 'Câmera', ligado: true }
        ],
        iluminacao: { brilho: 64, cor: '#6fe3ff', nome: 'Luminária da mesa' },
        camera: { codigo: 'CAM 04', local: 'Escritório', cena: 'escritorio' },
        agua: { litros: 6, meta: 15 }
      },
      externa: {
        nome: 'Área externa', curto: 'Externa', icone: 'externa', cor: 'verde',
        energia: {
          hoje: [0.05, 0.05, 0.05, 0.05, 0.06, 0.42, 0.48, 0.26, 0.28, 0.22, 0.18, 0.18, 0.21, 0.18, 0.21, 0.18, 0.19, 0.24, 0.28, 0.38, 0.41, 0.37, 0.26, 0.16],
          ontem: [0.06, 0.06, 0.05, 0.05, 0.06, 0.1, 0.17, 0.26, 0.31, 0.22, 0.18, 0.19, 0.2, 0.21, 0.19, 0.18, 0.21, 0.27, 0.31, 0.49, 0.49, 0.4, 0.29, 0.2]
        },
        termostato: { alvo: 24, atual: 26.5, umidade: 68, modo: 'auto', programacao: [[6, 26], [12, 24], [18, 25], [23, 24]] },
        dispositivos: [
          { id: 'luz', tipo: 'luz', nome: 'Luzes do jardim', lampadas: 6, ligado: true },
          { id: 'tv', tipo: 'tv', nome: 'Som externo', ligado: false, textoLigado: 'Tocando', textoDesligado: 'Desligado' },
          { id: 'ar', tipo: 'ar', nome: 'Ventilador', ligado: false },
          { id: 'robo', tipo: 'robo', nome: 'Cortador robô', ligado: false, textoLigado: 'Cortando · 30%', textoDesligado: 'Na garagem' },
          { id: 'camera', tipo: 'camera', nome: 'Câmera do portão', ligado: true }
        ],
        iluminacao: { brilho: 55, cor: '#ffc46b', nome: 'Postes do jardim' },
        camera: { codigo: 'CAM 05', local: 'Portão', cena: 'externa' },
        agua: { litros: 210, meta: 300 }
      }
    },

    // Cenas rápidas: aplicadas ao cômodo atual
    cenas: [
      {
        id: 'chegar', nome: 'Chegar em casa', icone: 'chegar', cor: 'ambar',
        descricao: 'Luzes 80% · 23 °C · robô pausa',
        ajustes: { dispositivos: { luz: true, tv: false, ar: true, robo: false, camera: false }, brilho: 80, cor: '#ffe2b3', temperatura: 23, modo: 'auto' }
      },
      {
        id: 'cinema', nome: 'Cinema', icone: 'cinema', cor: 'ciano',
        descricao: 'Luz baixa 18% · TV ligada · 22 °C',
        ajustes: { dispositivos: { luz: true, tv: true, ar: true, robo: false, camera: false }, brilho: 18, cor: '#ffc46b', temperatura: 22, modo: 'frio' }
      },
      {
        id: 'dormir', nome: 'Dormir', icone: 'dormir', cor: 'azul',
        descricao: 'Tudo apagado · 20 °C · câmera ativa',
        ajustes: { dispositivos: { luz: false, tv: false, ar: true, robo: false, camera: true }, brilho: 0, cor: '#ffe2b3', temperatura: 20, modo: 'auto' }
      }
    ]
  };

  /* ===================================================================
     2. UTILITÁRIOS
     =================================================================== */
  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));
  const movReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
  const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const suave = (t) => 1 - Math.pow(1 - t, 3);            // ease-out cúbico
  const suaveIO = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const fmt1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmt2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtAte2 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const fmt0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const fmtReais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtTemp = (v) => (Math.round(v * 2) / 2) % 1 === 0 ? fmt0.format(Math.round(v)) : fmt1.format(Math.round(v * 2) / 2);
  const soma = (lista) => lista.reduce((a, b) => a + b, 0);

  /** Anima de 0 a 1 em `dur` ms chamando `cada(p)`; respeita movimento reduzido. Retorna função de cancelar. */
  function animar(dur, cada, fim, curva = suave) {
    if (movReduzido.matches || dur <= 0) { cada(1); if (fim) fim(); return () => {}; }
    const t0 = performance.now();
    let id = 0;
    const passo = (agora) => {
      const p = limitar((agora - t0) / dur, 0, 1);
      cada(curva(p));
      if (p < 1) id = requestAnimationFrame(passo); else if (fim) fim();
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }

  /** "#ffc46b" → "255 196 107" (formato usado nas variáveis CSS rgb(var(--x) / a)) */
  function hexParaRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgbTexto = (hex) => hexParaRgb(hex).join(' ');

  /** Interpola uma lista de paradas [{v, cor}] e devolve "rgb(r, g, b)" */
  function corEmEscala(paradas, v) {
    if (v <= paradas[0].v) return paradas[0].cor;
    for (let i = 1; i < paradas.length; i++) {
      if (v <= paradas[i].v) {
        const a = paradas[i - 1], b = paradas[i];
        const t = (v - a.v) / (b.v - a.v);
        const ca = hexParaRgb(a.cor), cb = hexParaRgb(b.cor);
        return `rgb(${ca.map((c, k) => Math.round(lerp(c, cb[k], t))).join(', ')})`;
      }
    }
    return paradas[paradas.length - 1].cor;
  }

  /** Curva suave (Catmull-Rom → Bézier) passando por todos os pontos */
  function curvaSuave(pts) {
    if (!pts.length) return '';
    let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    return d;
  }

  /** Gerador pseudoaleatório com semente (estrelas sempre no mesmo lugar) */
  function aleatorio(semente) {
    let s = semente % 2147483647;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  /** Aviso flutuante (também lido por leitores de tela via role="status") */
  let avisoTimer = 0;
  function avisar(texto) {
    const el = $('#pv-aviso');
    el.textContent = texto;
    el.classList.add('is-visivel');
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => el.classList.remove('is-visivel'), 2600);
  }

  /* ===================================================================
     3. ÍCONES (SVG inline, traço = currentColor)
     =================================================================== */
  const svg24 = (conteudo) => `<svg viewBox="0 0 24 24" aria-hidden="true">${conteudo}</svg>`;
  const ICONES = {
    comodos: {
      sala: svg24('<path d="M4.5 11V8.5A2.5 2.5 0 0 1 7 6h10a2.5 2.5 0 0 1 2.5 2.5V11"/><path d="M3 18v-5.5a1.5 1.5 0 0 1 3 0V14h12v-1.5a1.5 1.5 0 0 1 3 0V18Z"/><path d="M5 18v2M19 18v2"/>'),
      cozinha: svg24('<path d="M4 10h16v5.5a4.5 4.5 0 0 1-4.5 4.5h-7A4.5 4.5 0 0 1 4 15.5Z"/><path d="M2 10h2M20 10h2M9 6.8c0-1.1 1-1.3 1-2.4M14 6.8c0-1.1 1-1.3 1-2.4"/>'),
      quarto: svg24('<path d="M3 19V6M3 14h18v5M21 14v-2.5A2.5 2.5 0 0 0 18.5 9H11v5"/><circle cx="7" cy="11" r="1.8"/>'),
      escritorio: svg24('<path d="M5 6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5V15H5Z"/><path d="M2.5 18h19l-1 1.5h-17Z"/>'),
      externa: svg24('<path d="M12 21v-6M9.5 17.5 12 19l2.5-2"/><path d="M12 3c3 0 5 2.3 5 5 1.5.6 2.5 2 2.5 3.6 0 2.1-1.8 3.4-3.8 3.4H8.3c-2 0-3.8-1.3-3.8-3.4 0-1.6 1-3 2.5-3.6 0-2.7 2-5 5-5Z"/>')
    },
    dispositivos: {
      luz: svg24('<g class="pv-ic-raios"><path d="M12 .8v1.6M3.6 3.9l1.1 1.1M20.4 3.9l-1.1 1.1M1.2 10.8h1.6M21.2 10.8h1.6"/></g><path class="pv-ic-bulbo" d="M12 4.2a5.6 5.6 0 0 0-3.4 10c.6.5 1 1.2 1 2v.4h4.8v-.4c0-.8.4-1.5 1-2A5.6 5.6 0 0 0 12 4.2Z"/><path d="M9.8 19.2h4.4M10.6 21.6h2.8"/>'),
      tv: svg24('<rect x="2.5" y="4.5" width="19" height="12.5" rx="2"/><rect class="pv-ic-tela" x="4.6" y="6.6" width="14.8" height="8.3" rx=".8" stroke="none"/><path d="M8.5 20.5h7M12 17v3.5"/>'),
      ar: svg24('<rect x="2.5" y="4" width="19" height="8" rx="2"/><path d="M5.5 9.3h13"/><path class="pv-ic-vento" d="M7.5 14.5c-1 1.6 1 2.4 0 4.5M12 14.5c-1 1.6 1 2.4 0 4.5M16.5 14.5c-1 1.6 1 2.4 0 4.5"/>'),
      robo: svg24('<g class="pv-ic-robo"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3"/><path d="M7.2 7.6h9.6"/><circle class="pv-ic-robo-luz" cx="16.2" cy="10.2" r="1"/></g>'),
      camera: svg24('<path d="M4 7h11a1.5 1.5 0 0 1 1.5 1.5v1.4l4-2.4v9l-4-2.4v1.4A1.5 1.5 0 0 1 15 17H4a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 4 7Z"/><circle class="pv-ic-lente" cx="8.8" cy="12" r="2.4"/><circle class="pv-ic-rec" cx="13.6" cy="9.6" r="1"/>')
    },
    cenas: {
      chegar: svg24('<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>'),
      cinema: svg24('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m10.2 9.3 4.6 2.7-4.6 2.7Z"/>'),
      dormir: svg24('<path d="M19.5 14.5A7.8 7.8 0 1 1 9.5 4.5a6.2 6.2 0 0 0 10 10Z"/><path d="M16 4.5h3l-3 3.5h3"/>')
    }
  };

  // Ícones de clima (viewBox 48, coloridos e animados via CSS)
  const NUVEM = 'M14 36h20a7 7 0 0 0 0-14 10 10 0 0 0-19-1A7.5 7.5 0 0 0 14 36Z';
  const LUA = '<path d="M31 31.5A12.5 12.5 0 0 1 17.5 11 13.5 13.5 0 1 0 31 31.5Z" fill="#f5eedc"/>';
  const ICONES_CLIMA = {
    sol: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="15" fill="#ffc46b" opacity=".18"/><g class="pv-clima-sol__raios" stroke="#ffc46b" stroke-width="2.6" stroke-linecap="round"><path d="M24 5v4.5M24 38.5V43M5 24h4.5M38.5 24H43M10.6 10.6l3.2 3.2M34.2 34.2l3.2 3.2M10.6 37.4l3.2-3.2M34.2 13.8l3.2-3.2"/></g><circle cx="24" cy="24" r="8.5" fill="#ffc46b"/></svg>',
    lua: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" fill="#9fdcff" opacity=".12"/><g class="pv-clima-lua">${LUA}</g><circle cx="35" cy="13" r="1.3" fill="#f5eedc"/><circle cx="39" cy="22" r=".9" fill="#f5eedc" opacity=".7"/></svg>`,
    nuvem: (noite) => `<svg viewBox="0 0 48 48">${noite ? '<g transform="translate(6 -4) scale(.7)">' + LUA + '</g>' : '<circle cx="31" cy="17" r="7.5" fill="#ffc46b"/>'}<g class="pv-clima-nuvem"><path d="${NUVEM}" fill="#eef3f8" fill-opacity=".94"/></g></svg>`,
    chuva: '<svg viewBox="0 0 48 48"><g class="pv-clima-nuvem"><path d="M14 32h20a7 7 0 0 0 0-14 10 10 0 0 0-19-1A7.5 7.5 0 0 0 14 32Z" fill="#cfd9e4"/></g><g stroke="#6fe3ff" stroke-width="2.4" stroke-linecap="round"><path class="pv-clima-gota" d="M17 36l-1.4 4"/><path class="pv-clima-gota" d="M24 36l-1.4 4"/><path class="pv-clima-gota" d="M31 36l-1.4 4"/></g></svg>'
  };
  const DESC_CLIMA = { sol: 'Céu limpo', nuvem: 'Parcialmente nublado', chuva: 'Chuva fraca' };

  /* ===================================================================
     ESTADO (cópia mutável dos dados; o painel desenha a partir dele)
     =================================================================== */
  const estado = {
    comodos: JSON.parse(JSON.stringify(DADOS.comodos)),
    atual: 'sala',
    periodoEscolhido: 'auto',     // 'auto' | 'manha' | 'tarde' | 'noite'
    periodo: 'noite',
    climaCondicao: null,          // null = usa DADOS.clima[periodo].condicao
    cenaAtiva: {},                // { comodo: idDaCena }
    aplicandoCena: false
  };
  const comodo = () => estado.comodos[estado.atual];
  const disp = (id, c = comodo()) => c.dispositivos.find((d) => d.id === id);

  /* ===================================================================
     4. CÉU E HORÁRIO
     =================================================================== */
  function periodoPelaHora(h) {
    if (h >= 5 && h < 12) return 'manha';
    if (h >= 12 && h < 18) return 'tarde';
    return 'noite';
  }

  function gerarEstrelas() {
    const r = aleatorio(20261029);
    let html = '';
    for (let i = 0; i < 160; i++) {
      const x = (r() * 1440).toFixed(1);
      const y = (Math.pow(r(), 1.7) * 640).toFixed(1);   // mais estrelas no alto
      const raio = (0.4 + r() * 1.1).toFixed(2);
      const op = (0.3 + r() * 0.7).toFixed(2);
      const brilha = r() < 0.28;
      html += `<circle cx="${x}" cy="${y}" r="${raio}" opacity="${op}"${brilha ? ` class="pv-brilha" style="animation-delay:-${(r() * 3.6).toFixed(2)}s"` : ''}/>`;
    }
    $('#pv-estrelas').innerHTML = html;
  }

  function aplicarPeriodo() {
    const p = estado.periodoEscolhido === 'auto' ? periodoPelaHora(new Date().getHours()) : estado.periodoEscolhido;
    const mudou = p !== estado.periodo;
    estado.periodo = p;
    document.documentElement.dataset.periodo = p;
    $$('#pv-periodos button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.periodo === estado.periodoEscolhido)));
    const cores = { manha: '#5f95cc', tarde: '#2a3560', noite: '#0b1426' };
    $('meta[name="theme-color"]').setAttribute('content', cores[p]);
    atualizarTopo();
    atualizarTermostato();
    if (mudou || !$('#pv-feed-cena').firstChild) desenharCamera();
  }

  function iniciarCeu() {
    gerarEstrelas();
    $('#pv-periodos').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-periodo]');
      if (!b) return;
      estado.periodoEscolhido = b.dataset.periodo;
      estado.climaCondicao = null;
      aplicarPeriodo();
    });
    // No modo automático, confere o horário a cada minuto
    setInterval(() => { if (estado.periodoEscolhido === 'auto') aplicarPeriodo(); else atualizarTopo(); }, 60000);
  }

  /* ===================================================================
     5. TOPO
     =================================================================== */
  function atualizarTopo() {
    const saud = { manha: 'Bom dia', tarde: 'Boa tarde', noite: 'Boa noite' };
    $('#pv-saudacao').textContent = saud[estado.periodo];
    $('#pv-nome').textContent = DADOS.usuario.nome;
    $('#pv-iniciais').textContent = (DADOS.usuario.nome[0] + DADOS.usuario.sobrenome[0]).toUpperCase();
    const data = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    $('#pv-data').textContent = data.charAt(0).toUpperCase() + data.slice(1);
    atualizarResumoCasa();

    // Clima
    const c = DADOS.clima[estado.periodo];
    const cond = estado.climaCondicao || c.condicao;
    const noite = estado.periodo === 'noite';
    const temp = c.temperatura - (cond === 'chuva' ? 3 : cond === 'nuvem' ? 1 : 0);
    const icone = cond === 'sol' ? (noite ? ICONES_CLIMA.lua : ICONES_CLIMA.sol) : cond === 'nuvem' ? ICONES_CLIMA.nuvem(noite) : ICONES_CLIMA.chuva;
    $('#pv-clima-icone').innerHTML = icone;
    $('#pv-clima-temp').textContent = `${temp}°`;
    $('#pv-clima-desc').textContent = `${DESC_CLIMA[cond]} · Umid. ${c.umidade}%`;
    $('#pv-clima').setAttribute('aria-label', `Clima agora: ${temp} graus, ${DESC_CLIMA[cond].toLowerCase()}. Toque para alternar a condição na demonstração.`);
  }

  /** Barra empilhada "Casa hoje" (consumo de cada cômodo) na barra lateral */
  function montarCasaHoje() {
    const itens = Object.values(estado.comodos).map((c) => ({ nome: c.nome, cor: c.cor || 'ambar', kwh: soma(c.energia.hoje) }));
    const total = soma(itens.map((i) => i.kwh));
    $('#pv-casa-barra').innerHTML = itens.map((i) => `<span style="flex-grow:${i.kwh.toFixed(3)};--pv-seg:rgb(var(--pv-${i.cor}-rgb))"></span>`).join('');
    $('#pv-casa-legenda').innerHTML = itens.map((i) => `<li style="--pv-seg:rgb(var(--pv-${i.cor}-rgb))"><span>${i.nome}</span><span class="pv-num">${fmt1.format(i.kwh)}</span></li>`).join('');
    animar(1100, (p) => { $('#pv-casa-kwh').textContent = fmt1.format(total * p); });
  }

  function atualizarResumoCasa() {
    const total = Object.values(estado.comodos).reduce((n, c) => n + c.dispositivos.filter((d) => d.ligado).length, 0);
    $('#pv-resumo-casa').textContent = `${total} dispositivos ativos na casa`;
  }

  function iniciarTopo() {
    const ordem = ['sol', 'nuvem', 'chuva'];
    $('#pv-clima').addEventListener('click', () => {
      const atual = estado.climaCondicao || DADOS.clima[estado.periodo].condicao;
      estado.climaCondicao = ordem[(ordem.indexOf(atual) + 1) % ordem.length];
      atualizarTopo();
    });
    $('.pv-avatar').addEventListener('click', () => avisar(`Perfil de ${DADOS.usuario.nome} ${DADOS.usuario.sobrenome} · demonstração`));
    const alarme = $('#pv-alarme');
    alarme.addEventListener('click', () => {
      const armado = alarme.getAttribute('aria-pressed') !== 'true';
      alarme.setAttribute('aria-pressed', String(armado));
      $('strong', alarme).textContent = armado ? 'Casa protegida' : 'Alarme desarmado';
      $('small', alarme).textContent = armado ? 'Alarme armado · 4 portas' : 'Toque para armar';
      avisar(armado ? 'Alarme armado' : 'Alarme desarmado');
    });
  }

  /* ===================================================================
     6. CÔMODOS (barra lateral) + TROCA ANIMADA
     =================================================================== */
  function montarComodos() {
    montarComodosLista();
    $('#pv-comodos').addEventListener('click', (e) => {
      const b = e.target.closest('[data-comodo]');
      if (b) trocarComodo(b.dataset.comodo);
    });
  }

  function montarComodosLista() {
    $('#pv-comodos').innerHTML = Object.entries(estado.comodos).map(([id, c]) => `
      <li>
        <button class="pv-comodo" type="button" data-comodo="${id}" aria-current="${id === estado.atual}">
          <span class="pv-comodo__icone">${ICONES.comodos[c.icone] || ICONES.comodos.sala}</span>
          <span class="pv-comodo__nome">${c.nome}</span>
          <span class="pv-comodo__curto" aria-hidden="true">${c.curto || c.nome}</span>
          <span class="pv-comodo__qtd" data-qtd></span>
        </button>
      </li>`).join('');
    atualizarContagensComodos();
  }

  function atualizarContagensComodos() {
    $$('#pv-comodos [data-comodo]').forEach((b) => {
      const c = estado.comodos[b.dataset.comodo];
      const n = c.dispositivos.filter((d) => d.ligado).length;
      $('[data-qtd]', b).textContent = n;
      b.setAttribute('aria-label', `${c.nome}, ${n} ${n === 1 ? 'dispositivo ativo' : 'dispositivos ativos'}`);
    });
    atualizarResumoCasa();
  }

  let trocando = false;
  async function trocarComodo(id) {
    if (id === estado.atual || trocando || !estado.comodos[id]) return;
    trocando = true;
    estado.atual = id;
    $$('#pv-comodos [data-comodo]').forEach((b) => b.setAttribute('aria-current', String(b.dataset.comodo === id)));
    const blocos = $$('.pv-troca');
    if (!movReduzido.matches && blocos[0].animate) {
      const saida = blocos.map((el, i) => el.animate(
        [{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'translateY(6px) scale(.99)', filter: 'blur(6px)' }],
        { duration: 170, delay: i * 18, easing: 'ease-in', fill: 'forwards' }));
      await Promise.all(saida.map((a) => a.finished.catch(() => {})));
      renderizarComodo(true);
      blocos.forEach((el, i) => el.animate(
        [{ opacity: 0, transform: 'translateY(-6px) scale(.99)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
        { duration: 360, delay: i * 30, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
      saida.forEach((a) => a.cancel());
    } else {
      renderizarComodo(true);
    }
    trocando = false;
  }

  /** Desenha todos os cartões a partir do cômodo atual */
  function renderizarComodo(animado) {
    const c = comodo();
    $$('[data-comodo-nome]').forEach((el) => { el.textContent = c.nome; });
    atualizarEnergia(animado);
    definirTemperatura(c.termostato.alvo, { animado, origem: 'troca' });
    atualizarTermostato();
    montarDispositivos();
    atualizarIluminacao();
    desenharCamera();
    atualizarMedidores(animado);
    atualizarCenas();
  }

  /* ===================================================================
     7. ENERGIA — gráfico de área SVG feito à mão
     =================================================================== */
  const graf = { hoje: new Array(24).fill(0), ontem: new Array(24).fill(0), max: 1, indice: -1, cancelar: () => {} };
  const valores = { total: 0, custo: 0 };

  /** Teto "redondo" do eixo Y (a metade também fica redonda: 0,6 → 0,3; 1,5 → 0,75) */
  function maxBonito(v) {
    const alvo = v * 1.12;
    const passo = alvo > 2 ? 1 : alvo > 1 ? 0.5 : 0.2;
    return Math.max(0.4, Math.ceil(alvo / passo) * passo);
  }

  function desenharGrafico() {
    const W = 600, H = 200;
    const pt = (lista) => lista.map((v, i) => [(i / 23) * W, H - (v / graf.max) * H]);
    const linha = curvaSuave(pt(graf.hoje));
    $('#pv-grafico-linha').setAttribute('d', linha);
    $('#pv-grafico-area').setAttribute('d', `${linha} L${W} ${H} L0 ${H} Z`);
    $('#pv-grafico-ontem').setAttribute('d', curvaSuave(pt(graf.ontem)));
  }

  function desenharEixoY() {
    const niveis = [1, .5, 0];
    $('#pv-grafico-grade').innerHTML = [1, .75, .5, .25, 0].map((n) => `<line x1="0" x2="600" y1="${200 - n * 200}" y2="${200 - n * 200}"/>`).join('');
    $('#pv-grafico-y').innerHTML = niveis.map((n) => `<span style="top:${(1 - n) * 100}%">${fmtAte2.format(graf.max * n)}</span>`).join('');
  }

  function atualizarEnergia(animado) {
    const c = comodo();
    const hoje = c.energia.hoje, ontem = c.energia.ontem;
    const totalHoje = soma(hoje), totalOntem = soma(ontem);
    const de = { hoje: graf.hoje.slice(), ontem: graf.ontem.slice(), max: graf.max };
    const alvoMax = maxBonito(Math.max(...hoje, ...ontem));
    const deTotal = valores.total, deCusto = valores.custo;
    graf.max = alvoMax;
    desenharEixoY();
    graf.cancelar();
    graf.cancelar = animar(animado ? 750 : 1100, (p) => {
      graf.hoje = hoje.map((v, i) => lerp(de.hoje[i], v, p));
      graf.ontem = ontem.map((v, i) => lerp(de.ontem[i], v, p));
      graf.max = animado ? lerp(de.max, alvoMax, p) : alvoMax;
      desenharGrafico();
      valores.total = lerp(deTotal, totalHoje, p);
      valores.custo = lerp(deCusto, totalHoje * DADOS.tarifaKwh, p);
      $('#pv-energia-total').textContent = fmt1.format(valores.total);
      $('#pv-energia-custo').textContent = fmtReais.format(valores.custo);
      if (graf.indice >= 0) posicionarDica(graf.indice);
    }, () => { graf.max = alvoMax; }, animado ? suaveIO : suave);

    // Comparação com ontem
    const dif = ((totalHoje - totalOntem) / totalOntem) * 100;
    const chip = $('#pv-energia-comp');
    const menos = dif <= 0;
    chip.className = 'pv-chip' + (menos ? '' : ' pv-chip--alta');
    chip.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${menos ? 'M12 5v14M6 13l6 6 6-6' : 'M12 19V5M6 11l6-6 6 6'}"/></svg>${fmt0.format(Math.abs(dif))}% ${menos ? 'abaixo' : 'acima'} de ontem`;

    const iPico = hoje.indexOf(Math.max(...hoje));
    $('#pv-energia-pico').textContent = `${iPico}h · ${fmt2.format(hoje[iPico])}`;
    $('#pv-energia-tarifa').textContent = `${fmtReais.format(DADOS.tarifaKwh)}`;
    $('#pv-grafico').setAttribute('aria-label',
      `Consumo de energia de ${c.nome} nas últimas 24 horas: total ${fmt1.format(totalHoje)} quilowatts-hora, custo ${fmtReais.format(totalHoje * DADOS.tarifaKwh)}, pico às ${iPico} horas. Use as setas esquerda e direita para percorrer as horas.`);
  }

  function posicionarDica(i) {
    const el = $('#pv-grafico');
    const plot = $('#pv-grafico-plot');
    const w = plot.clientWidth, h = plot.clientHeight;
    const v = graf.hoje[i], o = graf.ontem[i];
    const x = (i / 23) * w;
    const y = (1 - v / graf.max) * h;
    $('.pv-grafico__mira', el).style.transform = `translateX(${x}px)`;
    const ponto = $('.pv-grafico__ponto', el);
    ponto.style.transform = `translate(${x}px, ${y}px)`;
    const dica = $('#pv-grafico-dica');
    const real = comodo().energia;
    dica.innerHTML = `<strong>${fmt2.format(real.hoje[i])} kWh</strong><span>${i}h–${(i + 1) % 24}h · </span><em>ontem ${fmt2.format(real.ontem[i])}</em>`;
    const dw = dica.offsetWidth, dh = dica.offsetHeight;
    const dx = limitar(x - dw / 2, -30, w - dw);
    const dy = y - dh - 14 < 0 ? y + 16 : y - dh - 14;
    dica.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function iniciarGrafico() {
    const el = $('#pv-grafico');
    const plot = $('#pv-grafico-plot');
    const mostrar = (i) => {
      graf.indice = limitar(i, 0, 23);
      el.classList.add('is-ativo');
      posicionarDica(graf.indice);
    };
    const esconder = () => { graf.indice = -1; el.classList.remove('is-ativo'); };
    el.addEventListener('pointermove', (e) => {
      const r = plot.getBoundingClientRect();
      mostrar(Math.round(((e.clientX - r.left) / r.width) * 23));
    });
    el.addEventListener('pointerdown', (e) => {
      const r = plot.getBoundingClientRect();
      mostrar(Math.round(((e.clientX - r.left) / r.width) * 23));
    });
    el.addEventListener('pointerleave', () => { if (document.activeElement !== el) esconder(); });
    el.addEventListener('focus', () => mostrar(graf.indice >= 0 ? graf.indice : new Date().getHours()));
    el.addEventListener('blur', esconder);
    el.addEventListener('keydown', (e) => {
      const mapa = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
      let i = graf.indice < 0 ? new Date().getHours() : graf.indice;
      if (e.key in mapa) i += mapa[e.key];
      else if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = 23;
      else return;
      e.preventDefault();
      mostrar(i);
      const real = comodo().energia;
      $('#pv-grafico-anuncio').textContent = `${graf.indice} horas: ${fmt2.format(real.hoje[graf.indice])} quilowatts-hora hoje, ${fmt2.format(real.ontem[graf.indice])} ontem.`;
    });
    window.addEventListener('resize', () => { if (graf.indice >= 0) posicionarDica(graf.indice); });
  }

  /* ===================================================================
     8. TERMOSTATO — anel arrastável de 16 a 30 °C
     =================================================================== */
  const TERMO = { min: 16, max: 30, passo: 0.5, inicio: -135, fim: 135, cx: 120, cy: 120, r: 94 };
  // Escala de cor: frio (ciano) → conforto (creme/âmbar) → quente (coral)
  const ESCALA_TEMP = [
    { v: 16, cor: '#58c8ff' }, { v: 19.5, cor: '#6fe3ff' }, { v: 22, cor: '#cdeee0' },
    { v: 24, cor: '#ffd58c' }, { v: 26.5, cor: '#ffc46b' }, { v: 30, cor: '#ff7d5c' }
  ];
  const termo = { exibido: 22, cancelar: () => {} };

  const anguloDe = (t) => TERMO.inicio + ((t - TERMO.min) / (TERMO.max - TERMO.min)) * (TERMO.fim - TERMO.inicio);
  function pontoNoAnel(ang, r = TERMO.r) {
    const rad = (ang * Math.PI) / 180;
    return [TERMO.cx + r * Math.sin(rad), TERMO.cy - r * Math.cos(rad)];
  }

  function montarTermostato() {
    const [x1, y1] = pontoNoAnel(TERMO.inicio), [x2, y2] = pontoNoAnel(TERMO.fim);
    const arco = `M${x1.toFixed(2)} ${y1.toFixed(2)} A${TERMO.r} ${TERMO.r} 0 1 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
    $('#pv-termo-trilho').setAttribute('d', arco);
    $('#pv-termo-valor').setAttribute('d', arco);
    let marcas = '';
    for (let t = TERMO.min; t <= TERMO.max; t += TERMO.passo) {
      const maior = t % 2 === 0;
      const [a, b] = pontoNoAnel(anguloDe(t), maior ? 104 : 107);
      const [c, d] = pontoNoAnel(anguloDe(t), 114);
      marcas += `<line data-t="${t}" class="${maior ? 'is-maior' : ''}" x1="${a.toFixed(2)}" y1="${b.toFixed(2)}" x2="${c.toFixed(2)}" y2="${d.toFixed(2)}"/>`;
    }
    $('#pv-termo-marcas').innerHTML = marcas;
  }

  /** Desenha o anel para uma temperatura (pode ser fracionária durante a animação) */
  function desenharTermostato(t) {
    const p = ((t - TERMO.min) / (TERMO.max - TERMO.min)) * 100;
    $('#pv-termo-valor').setAttribute('stroke-dasharray', `${p.toFixed(2)} 100`);
    const [x, y] = pontoNoAnel(anguloDe(t));
    const botao = $('#pv-termo-botao');
    botao.setAttribute('cx', x.toFixed(2));
    botao.setAttribute('cy', y.toFixed(2));
    const cor = corEmEscala(ESCALA_TEMP, t);
    document.documentElement.style.setProperty('--pv-termo-cor', cor);
    $$('#pv-termo-marcas line').forEach((l) => l.classList.toggle('is-ativa', Number(l.dataset.t) <= t + 0.01));
    $('#pv-termo-alvo').textContent = fmtTemp(t);
  }

  /** Muda a temperatura-alvo do cômodo atual */
  function definirTemperatura(v, { animado = false, origem = 'usuario', dur = 600 } = {}) {
    const c = comodo();
    const alvo = limitar(Math.round(v / TERMO.passo) * TERMO.passo, TERMO.min, TERMO.max);
    c.termostato.alvo = alvo;
    const el = $('#pv-termo');
    el.setAttribute('aria-valuenow', String(alvo));
    el.setAttribute('aria-valuetext', `${fmtTemp(alvo)} graus Celsius`);
    const de = termo.exibido;
    termo.cancelar();
    if (animado && Math.abs(de - alvo) > 0.01) {
      termo.cancelar = animar(dur, (p) => { termo.exibido = lerp(de, alvo, p); desenharTermostato(termo.exibido); }, null, suaveIO);
    } else {
      termo.exibido = alvo;
      desenharTermostato(alvo);
    }
    if (origem === 'usuario') {
      const ar = disp('ar');
      if (!ar.ligado) { ar.ligado = true; atualizarDispositivos(); }
      limparCena();
    }
    atualizarTermostato();
  }

  function atualizarTermostato() {
    const c = comodo(), t = c.termostato, ar = disp('ar');
    $('#pv-termo-atual').textContent = `${fmtTemp(t.atual)}°`;
    $('#pv-termo-umidade').textContent = `${t.umidade}%`;
    $('#pv-termo-fora').textContent = `${DADOS.clima[estado.periodo].temperatura}°`;
    // Programação: destaca o ajuste em vigor no horário atual
    const h = new Date().getHours();
    let vigente = t.programacao.length - 1;
    t.programacao.forEach(([hora], i) => { if (h >= hora) vigente = i; });
    if (h < t.programacao[0][0]) vigente = t.programacao.length - 1;
    $('#pv-prog').innerHTML = t.programacao.map(([hora, graus], i) => `
      <li class="pv-prog__item${i === vigente ? ' is-agora' : ''}" style="--pv-prog-cor:${corEmEscala(ESCALA_TEMP, graus)}"${i === vigente ? ' aria-current="time"' : ''}>
        <span class="pv-prog__hora pv-num">${String(hora).padStart(2, '0')}h</span>
        <span class="pv-prog__temp pv-num">${fmtTemp(graus)}°</span>
      </li>`).join('');
    $$('#pv-termo-modos button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === t.modo)));
    let status;
    if (!ar.ligado) status = 'Desligado';
    else if ((t.modo === 'frio' || t.modo === 'auto') && t.atual > t.alvo + 0.25) status = `Resfriando → ${fmtTemp(t.alvo)}°`;
    else if ((t.modo === 'calor' || t.modo === 'auto') && t.atual < t.alvo - 0.25) status = `Aquecendo → ${fmtTemp(t.alvo)}°`;
    else status = 'Mantendo';
    $('#pv-termo-status').textContent = status;
    $('#pv-termo').style.opacity = ar.ligado ? '' : '.55';
  }

  function iniciarTermostato() {
    montarTermostato();
    const el = $('#pv-termo');
    const svg = $('svg', el);
    const deEvento = (e) => {
      const r = svg.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      let ang = (Math.atan2(dx, -dy) * 180) / Math.PI;           // 0° = topo, sentido horário
      if (ang > TERMO.fim || ang < TERMO.inicio) ang = ang > 0 ? TERMO.fim : TERMO.inicio; // vão inferior
      return TERMO.min + ((ang - TERMO.inicio) / (TERMO.fim - TERMO.inicio)) * (TERMO.max - TERMO.min);
    };
    let arrastando = false;
    el.addEventListener('pointerdown', (e) => {
      const r = svg.getBoundingClientRect();
      const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      if (dist < r.width * 0.28) return;                         // toque no miolo não move
      arrastando = true;
      el.setPointerCapture(e.pointerId);
      el.classList.add('is-arrastando');
      el.focus({ preventScroll: true });
      definirTemperatura(deEvento(e), { animado: true, dur: 220 });
    });
    el.addEventListener('pointermove', (e) => { if (arrastando) definirTemperatura(deEvento(e)); });
    const soltar = () => { arrastando = false; el.classList.remove('is-arrastando'); };
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
    el.addEventListener('keydown', (e) => {
      const t = comodo().termostato.alvo;
      const mapa = { ArrowUp: .5, ArrowRight: .5, ArrowDown: -.5, ArrowLeft: -.5, PageUp: 2, PageDown: -2 };
      let novo;
      if (e.key in mapa) novo = t + mapa[e.key];
      else if (e.key === 'Home') novo = TERMO.min;
      else if (e.key === 'End') novo = TERMO.max;
      else return;
      e.preventDefault();
      definirTemperatura(novo, { animado: true, dur: 200 });
    });
    $('#pv-termo-mais').addEventListener('click', () => definirTemperatura(comodo().termostato.alvo + .5, { animado: true, dur: 240 }));
    $('#pv-termo-menos').addEventListener('click', () => definirTemperatura(comodo().termostato.alvo - .5, { animado: true, dur: 240 }));
    $('#pv-termo-modos').addEventListener('click', (e) => {
      const b = e.target.closest('[data-modo]');
      if (!b) return;
      comodo().termostato.modo = b.dataset.modo;
      limparCena();
      atualizarTermostato();
      atualizarDispositivos();
    });
  }

  /* ===================================================================
     9. DISPOSITIVOS
     =================================================================== */
  const COR_DISP = { luz: 'ambar', tv: 'ciano', ar: 'ciano', robo: 'verde', camera: 'coral' };
  const NOME_MODO = { frio: 'Frio', auto: 'Auto', calor: 'Calor' };

  function detalheDisp(d) {
    const c = comodo();
    switch (d.tipo) {
      case 'luz': return d.ligado ? `${d.lampadas} lâmpadas · ${c.iluminacao.brilho}%` : 'Desligadas';
      case 'ar': return d.ligado ? `${fmtTemp(c.termostato.alvo)}° · ${NOME_MODO[c.termostato.modo]}` : 'Desligado';
      case 'camera': return d.ligado ? 'Gravando' : 'Privacidade';
      default: return d.ligado ? d.textoLigado : d.textoDesligado;
    }
  }

  function montarDispositivos() {
    $('#pv-disps').innerHTML = comodo().dispositivos.map((d) => `
      <button class="pv-disp" type="button" data-disp="${d.id}" aria-pressed="${d.ligado}" style="--pv-cor-rgb: var(--pv-${COR_DISP[d.tipo]}-rgb)">
        <span class="pv-disp__icone">${ICONES.dispositivos[d.tipo]}</span>
        <span class="pv-disp__nome">${d.nome}</span>
        <span class="pv-disp__detalhe" data-detalhe></span>
        <span class="pv-disp__chave" aria-hidden="true"></span>
      </button>`).join('');
    atualizarDispositivos();
  }

  /** Sincroniza tiles, contador, câmera, luz e termostato com o estado */
  let contAtivos = { v: 0, cancelar: () => {} };
  function atualizarDispositivos() {
    const c = comodo();
    c.dispositivos.forEach((d) => {
      const b = $(`[data-disp="${d.id}"]`);
      if (!b) return;
      b.setAttribute('aria-pressed', String(d.ligado));
      $('[data-detalhe]', b).textContent = detalheDisp(d);
      b.setAttribute('aria-label', `${d.nome}: ${d.ligado ? 'ligado' : 'desligado'}, ${detalheDisp(d)}`);
    });
    const ativos = c.dispositivos.filter((d) => d.ligado).length;
    const de = contAtivos.v;
    contAtivos.cancelar();
    contAtivos.cancelar = animar(400, (p) => {
      contAtivos.v = lerp(de, ativos, p);
      $('#pv-disp-ativos').textContent = Math.round(contAtivos.v);
    });
    $('#pv-disp-total').textContent = c.dispositivos.length;
    $('#pv-desligar-tudo').disabled = ativos === 0;
    atualizarContagensComodos();
    atualizarIluminacao();
    atualizarEstadoCamera();
    atualizarTermostato();
  }

  function alternarDisp(id, ligado) {
    const d = disp(id);
    d.ligado = typeof ligado === 'boolean' ? ligado : !d.ligado;
    atualizarDispositivos();
  }

  function iniciarDispositivos() {
    $('#pv-disps').addEventListener('click', (e) => {
      const b = e.target.closest('[data-disp]');
      if (!b) return;
      alternarDisp(b.dataset.disp);
      limparCena();
    });
    $('#pv-desligar-tudo').addEventListener('click', () => {
      const ligados = comodo().dispositivos.filter((d) => d.ligado);
      const nomeComodo = comodo().nome;
      const id = estado.atual;
      ligados.forEach((d, i) => setTimeout(() => {
        d.ligado = false;
        if (estado.atual === id) atualizarDispositivos(); else atualizarContagensComodos();
      }, movReduzido.matches ? 0 : i * 110));
      limparCena();
      avisar(`${ligados.length} ${ligados.length === 1 ? 'dispositivo desligado' : 'dispositivos desligados'} em ${nomeComodo}`);
    });
  }

  /* ===================================================================
     10. ILUMINAÇÃO
     =================================================================== */
  function montarCores() {
    $('#pv-cores').innerHTML = DADOS.coresLuz.map((c, i) => `
      <label class="pv-cor" style="--pv-cor:${c.hex}">
        <input type="radio" name="pv-cor" value="${c.hex}" ${i === 0 ? 'checked' : ''}>
        <span class="pv-cor__amostra" aria-hidden="true"></span>
        <span class="pv-sr">${c.nome}</span>
      </label>`).join('');
  }

  function atualizarIluminacao() {
    const c = comodo(), il = c.iluminacao, luz = disp('luz');
    const raiz = document.documentElement.style;
    raiz.setProperty('--pv-luz-rgb', rgbTexto(il.cor));
    raiz.setProperty('--pv-luz-b', String(il.brilho / 100));
    const faixa = $('#pv-brilho');
    if (Number(faixa.value) !== il.brilho) faixa.value = il.brilho;
    faixa.style.setProperty('--pv-faixa-p', `${il.brilho}%`);
    faixa.setAttribute('aria-valuetext', luz.ligado ? `${il.brilho}%` : `Desligada (${il.brilho}%)`);
    $$('#pv-cores input').forEach((r) => { r.checked = r.value.toLowerCase() === il.cor.toLowerCase(); });
    $('#pv-luz').classList.toggle('is-off', !luz.ligado || il.brilho === 0);
    $('#pv-luz-pct').textContent = luz.ligado ? il.brilho : 'Off';
    $('#pv-luz-pct').nextElementSibling.hidden = !luz.ligado;
    const nomeCor = (DADOS.coresLuz.find((k) => k.hex.toLowerCase() === il.cor.toLowerCase()) || { nome: 'Personalizada' }).nome;
    $('#pv-luz-sub').textContent = `${il.nome} · ${nomeCor}`;
  }

  function iniciarIluminacao() {
    montarCores();
    $('#pv-brilho').addEventListener('input', (e) => {
      const c = comodo(), luz = disp('luz');
      c.iluminacao.brilho = Number(e.target.value);
      const deveLigar = c.iluminacao.brilho > 0;
      limparCena();
      if (luz.ligado !== deveLigar) { luz.ligado = deveLigar; atualizarDispositivos(); }
      else { atualizarIluminacao(); atualizarDispositivos(); }
    });
    $('#pv-cores').addEventListener('change', (e) => {
      if (e.target.name !== 'pv-cor') return;
      comodo().iluminacao.cor = e.target.value;
      if (!disp('luz').ligado) { disp('luz').ligado = true; if (comodo().iluminacao.brilho === 0) comodo().iluminacao.brilho = 60; }
      limparCena();
      atualizarDispositivos();
    });
  }

  /* ===================================================================
     11. CÂMERA — cena ilustrada em SVG
     =================================================================== */
  const CEU_JANELA = {
    manha: ['#7fb3df', '#f4e1c6', '#fff3da'],
    tarde: ['#344a7a', '#ffbf73', '#ffe0a6'],
    noite: ['#081630', '#1a4a5e', '#f5eedc']
  };

  function cenaInterior(tipo, p) {
    const [c1, c2, astro] = CEU_JANELA[p];
    const noite = p === 'noite';
    const parede = { sala: ['#3a4a63', '#2a3549'], quarto: ['#4a4658', '#2f2e3e'], escritorio: ['#33475a', '#243241'] }[tipo];
    const movel = {
      sala: `<rect x="140" y="98" width="128" height="34" rx="10" fill="#5f7896"/><rect x="128" y="112" width="18" height="40" rx="8" fill="#536a87"/><rect x="262" y="112" width="18" height="40" rx="8" fill="#536a87"/>
             <rect x="140" y="124" width="128" height="24" rx="7" fill="#6f88a6"/><rect x="152" y="104" width="34" height="24" rx="6" fill="#ffc46b" opacity=".9"/><rect x="222" y="104" width="34" height="24" rx="6" fill="#6fe3ff" opacity=".7"/>
             <path d="M140 152v6M268 152v6" stroke="#1b2130" stroke-width="3"/>`,
      quarto: `<rect x="150" y="80" width="134" height="54" rx="9" fill="#5a5f7a"/><rect x="140" y="122" width="154" height="28" rx="7" fill="#e9e3d8"/>
               <rect x="162" y="108" width="40" height="18" rx="7" fill="#f6f2ea"/><rect x="228" y="108" width="40" height="18" rx="7" fill="#f6f2ea"/>
               <path d="M196 124h98v26h-98Z" fill="#6f88a6"/><path d="M196 124h98" stroke="#8aa1bd" stroke-width="2"/>`,
      escritorio: `<rect x="146" y="114" width="138" height="8" rx="2" fill="#8a6a50"/><path d="M154 122v32M276 122v32" stroke="#5e4835" stroke-width="5"/>
                   <rect x="184" y="72" width="62" height="38" rx="3" fill="#121826" stroke="#5a667a" stroke-width="2"/><rect class="pv-cam-luz" x="188" y="76" width="54" height="30" fill="#6fe3ff" opacity=".45"/>
                   <path d="M215 110v4" stroke="#5a667a" stroke-width="3"/><rect x="200" y="126" width="34" height="8" rx="4" fill="#2b3446"/><path d="M217 134v18M207 156h20" stroke="#2b3446" stroke-width="4" stroke-linecap="round"/>`
    }[tipo];
    return `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="pvc-parede" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${parede[0]}"/><stop offset="1" stop-color="${parede[1]}"/></linearGradient>
        <linearGradient id="pvc-janela" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
        <radialGradient id="pvc-abajur"><stop offset="0" stop-color="#ffd59a" stop-opacity="${noite ? '.6' : '.35'}"/><stop offset="1" stop-color="#ffd59a" stop-opacity="0"/></radialGradient>
        <clipPath id="pvc-vidro"><rect x="34" y="34" width="86" height="76" rx="2"/></clipPath>
      </defs>
      <rect width="320" height="200" fill="url(#pvc-parede)"/>
      <rect y="150" width="320" height="50" fill="#272220"/>
      <path d="M0 150h320" stroke="#000" stroke-opacity=".35" stroke-width="2"/>
      <g clip-path="url(#pvc-vidro)">
        <rect x="34" y="34" width="86" height="76" fill="url(#pvc-janela)"/>
        <circle cx="${p === 'manha' ? 54 : 100}" cy="${p === 'tarde' ? 86 : 52}" r="${noite ? 6 : 9}" fill="${astro}"/>
        <path d="M34 100 L52 84 L66 94 L84 78 L104 92 L120 84 V110 H34Z" fill="#000" fill-opacity=".35"/>
      </g>
      <rect x="34" y="34" width="86" height="76" rx="2" fill="none" stroke="#c9d3df" stroke-width="3"/>
      <path d="M77 34v76M34 72h86" stroke="#c9d3df" stroke-width="2"/>
      <path class="pv-cam-cortina" d="M24 26h16v92c-6 3-11 3-16 0Z" fill="#c4916f"/>
      <path class="pv-cam-cortina" d="M114 26h16v92c-6 3-11 3-16 0Z" fill="#c4916f"/>
      <path d="M20 26h114" stroke="#9aa6b6" stroke-width="3" stroke-linecap="round"/>
      <rect x="168" y="38" width="54" height="34" rx="2" fill="#2d3a50" stroke="#93a0b2" stroke-width="2"/>
      <path d="M172 68l14-14 10 8 10-12 12 18Z" fill="#ffc46b" opacity=".7"/>
      <ellipse cx="208" cy="176" rx="112" ry="13" fill="#3d4a5e" opacity=".75"/>
      ${movel}
      <circle class="pv-cam-luz" cx="298" cy="94" r="64" fill="url(#pvc-abajur)"/>
      <path d="M298 100v52" stroke="#1d2230" stroke-width="3"/><ellipse cx="298" cy="153" rx="10" ry="3" fill="#1d2230"/>
      <path d="M285 100h26l-6-19h-14Z" fill="#ecdcbd"/>
      <path d="M14 152l4-22h22l4 22Z" fill="#b9714f"/>
      <g class="pv-cam-folha" fill="#4f9a78">
        <path d="M29 130c-9-14-12-30-5-40 4 12 8 25 5 40Z"/><path d="M29 130c4-18 12-29 22-31-2 14-10 25-22 31Z"/><path d="M29 130c-8-8-19-12-25-8 6 6 14 10 25 8Z"/>
      </g>
    </svg>`;
  }

  function cenaCozinha(p) {
    const [c1, c2, astro] = CEU_JANELA[p];
    const lampadas = [130, 175, 220].map((x) => `
      <path d="M${x} 0v34" stroke="#9aa6b6" stroke-width="1.5"/>
      <path d="M${x - 11} 46a11 11 0 0 1 22 0Z" fill="#2b3446" stroke="#5a667a"/>
      <circle class="pv-cam-luz" cx="${x}" cy="52" r="26" fill="url(#pvc-pendente)"/>`).join('');
    return `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="pvc-janela" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
        <radialGradient id="pvc-pendente"><stop offset="0" stop-color="#ffe0a6" stop-opacity=".7"/><stop offset="1" stop-color="#ffe0a6" stop-opacity="0"/></radialGradient>
        <pattern id="pvc-azulejo" width="14" height="10" patternUnits="userSpaceOnUse"><rect width="14" height="10" fill="#3c5568"/><path d="M0 .5h14M.5 0v10" stroke="#2b3f50" stroke-width="1"/></pattern>
      </defs>
      <rect width="320" height="200" fill="#2e3b4f"/>
      <rect x="0" y="80" width="252" height="44" fill="url(#pvc-azulejo)"/>
      <rect x="0" y="10" width="102" height="58" fill="#46586f"/><path d="M51 10v58M44 40h-4M58 40h4" stroke="#2b3446" stroke-width="2"/>
      <rect x="112" y="64" width="70" height="0" fill="none"/>
      <rect x="114" y="84" width="64" height="34" fill="url(#pvc-janela)"/>
      <circle cx="160" cy="96" r="5" fill="${astro}"/>
      <rect x="114" y="84" width="64" height="34" fill="none" stroke="#c9d3df" stroke-width="2.5"/>
      ${lampadas}
      <rect x="0" y="122" width="252" height="10" fill="#d9d2c4"/>
      <rect x="0" y="132" width="252" height="44" fill="#3d4c63"/>
      <path d="M63 132v44M126 132v44M189 132v44M24 142h16M87 142h16M150 142h16M213 142h16" stroke="#2a3447" stroke-width="2"/>
      <rect x="30" y="104" width="20" height="18" rx="3" fill="#ffc46b" opacity=".85"/><path d="M196 122v-14h18v14" fill="#6fe3ff" opacity=".6"/>
      <rect x="260" y="30" width="54" height="146" rx="5" fill="#c3ccd8"/><path d="M260 88h54M268 50v24M268 98v30" stroke="#8d98a8" stroke-width="2.5"/>
      <rect y="176" width="320" height="24" fill="#262120"/>
    </svg>`;
  }

  function cenaExterna(p) {
    const [c1, c2, astro] = CEU_JANELA[p];
    const noite = p === 'noite';
    return `<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="pvc-ceu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
        <radialGradient id="pvc-poste"><stop offset="0" stop-color="#ffd59a" stop-opacity="${noite ? '.7' : '.25'}"/><stop offset="1" stop-color="#ffd59a" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="320" height="200" fill="url(#pvc-ceu)"/>
      <circle cx="${p === 'manha' ? 60 : 250}" cy="${p === 'tarde' ? 90 : 36}" r="${noite ? 9 : 14}" fill="${astro}"/>
      <path d="M0 120 L40 96 L80 110 L130 84 L180 106 L230 90 L280 108 L320 96 V200 H0Z" fill="#000" fill-opacity=".3"/>
      <rect y="140" width="320" height="60" fill="${noite ? '#1d3328' : '#3f6b4c'}"/>
      <path d="M120 200 L150 140 H176 L214 200Z" fill="#8c8478" opacity=".8"/>
      <path d="M30 76 L96 42 L162 76Z" fill="#2d3442"/>
      <rect x="38" y="74" width="116" height="70" fill="#4a5265"/>
      <rect x="84" y="100" width="24" height="44" fill="#1d2230"/><rect class="pv-cam-luz" x="87" y="103" width="18" height="38" fill="#ffd59a" opacity="${noite ? '.85' : '.25'}"/>
      <rect x="50" y="90" width="22" height="18" fill="${noite ? '#ffd59a' : '#9fc3df'}" opacity=".85"/><rect x="120" y="90" width="22" height="18" fill="${noite ? '#ffd59a' : '#9fc3df'}" opacity=".7"/>
      <path d="M0 150h320M0 136h320" stroke="#c9c1b3" stroke-width="2" opacity=".6"/>
      ${Array.from({ length: 23 }, (_, i) => `<path d="M${i * 14 + 4} 132v24" stroke="#c9c1b3" stroke-width="3" opacity=".6"/>`).join('')}
      <circle class="pv-cam-luz" cx="196" cy="98" r="40" fill="url(#pvc-poste)"/>
      <path d="M196 100v52" stroke="#1d2230" stroke-width="3"/><rect x="190" y="92" width="12" height="9" rx="2" fill="#ffe0a6"/>
      <path d="M268 152v-46" stroke="#3b2b22" stroke-width="7"/>
      <g class="pv-cam-folha" fill="${noite ? '#244a3a' : '#4f9a78'}">
        <circle cx="268" cy="86" r="28"/><circle cx="246" cy="100" r="20"/><circle cx="292" cy="102" r="19"/>
      </g>
    </svg>`;
  }

  function desenharCamera() {
    const c = comodo().camera, p = estado.periodo;
    const html = c.cena === 'cozinha' ? cenaCozinha(p) : c.cena === 'externa' ? cenaExterna(p) : cenaInterior(c.cena, p);
    $('#pv-feed-cena').innerHTML = html;
    $('#pv-feed-cena').setAttribute('aria-label', `Imagem ao vivo da câmera ${c.codigo}, ${c.local}`);
    $('#pv-camera-nome').textContent = `${c.codigo} · ${c.local}`;
    $('#pv-feed').dataset.ir = p === 'noite' ? '1' : '0';
    atualizarEstadoCamera();
  }

  function atualizarEstadoCamera() {
    const ligada = disp('camera').ligado;
    $('#pv-feed').classList.toggle('is-off', !ligada);
    const rec = $('#pv-rec');
    rec.classList.toggle('is-off', !ligada);
    rec.lastChild.textContent = ligada ? 'REC' : 'PAUSA';
  }

  function iniciarCamera() {
    const hora = $('#pv-feed-hora');
    const doisDig = (n) => String(n).padStart(2, '0');
    const relogio = () => {
      const d = new Date();
      hora.textContent = `${doisDig(d.getDate())}/${doisDig(d.getMonth() + 1)}/${d.getFullYear()} ${doisDig(d.getHours())}:${doisDig(d.getMinutes())}:${doisDig(d.getSeconds())}`;
      hora.setAttribute('datetime', d.toISOString());
    };
    relogio();
    setInterval(relogio, 1000);

    // Ruído de sensor (canvas pequeno, ampliado com image-rendering: pixelated)
    const canvas = $('#pv-feed-ruido');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(canvas.width, canvas.height);
    const r = aleatorio(7);
    const ruido = () => {
      const px = img.data;
      for (let i = 0; i < px.length; i += 4) {
        const v = (r() * 255) | 0;
        px[i] = px[i + 1] = px[i + 2] = v;
        px[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };
    ruido();
    if (!movReduzido.matches) {
      setInterval(() => { if (!document.hidden && disp('camera').ligado) ruido(); }, 90);
    }
  }

  /* ===================================================================
     12. MEDIDORES — água (por cômodo) e solar (casa toda)
     =================================================================== */
  const med = { agua: 0, solar: 0, cancelar: () => {} };
  const consumoCasa = () => Object.values(estado.comodos).reduce((n, c) => n + soma(c.energia.hoje), 0);

  function atualizarMedidores(animado) {
    const a = comodo().agua, s = DADOS.solar;
    $('#pv-agua-meta').textContent = `de ${fmt0.format(a.meta)} L`;
    $('#pv-solar-meta').textContent = `de ${fmt1.format(s.capacidadeKwh)} kWh`;
    const cobertura = Math.round((s.geradoKwh / consumoCasa()) * 100);
    $('#pv-med-sub').textContent = `Solar cobre ${cobertura}% da casa hoje`;
    const de = { agua: med.agua, solar: med.solar };
    med.cancelar();
    med.cancelar = animar(animado ? 800 : 1100, (p) => {
      med.agua = lerp(de.agua, a.litros, p);
      med.solar = lerp(de.solar, s.geradoKwh, p);
      $('#pv-agua-valor').textContent = fmt0.format(med.agua);
      $('#pv-solar-valor').textContent = fmt1.format(med.solar);
      $('#pv-agua-arco').setAttribute('stroke-dasharray', `${limitar((med.agua / a.meta) * 100, 0, 100).toFixed(2)} 100`);
      $('#pv-solar-arco').setAttribute('stroke-dasharray', `${limitar((med.solar / s.capacidadeKwh) * 100, 0, 100).toFixed(2)} 100`);
    });
  }

  /* ===================================================================
     13. CENAS RÁPIDAS
     =================================================================== */
  function montarCenas() {
    $('#pv-cenas').innerHTML = DADOS.cenas.map((c) => `
      <button class="pv-cena" type="button" data-cena="${c.id}" aria-pressed="false" style="--pv-cor-rgb: var(--pv-${c.cor}-rgb)">
        <span class="pv-cena__icone">${ICONES.cenas[c.icone]}</span>
        <span class="pv-cena__texto">
          <span class="pv-cena__nome">${c.nome}</span>
          <span class="pv-cena__desc">${c.descricao}</span>
          <span class="pv-cena__estado" data-estado>Toque para ativar</span>
        </span>
      </button>`).join('');
    $('#pv-cenas').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cena]');
      if (b) aplicarCena(b.dataset.cena, b);
    });
  }

  function atualizarCenas() {
    const ativa = estado.cenaAtiva[estado.atual];
    $$('#pv-cenas [data-cena]').forEach((b) => {
      const sim = b.dataset.cena === ativa;
      b.setAttribute('aria-pressed', String(sim));
      $('[data-estado]', b).textContent = sim ? 'Ativa agora' : 'Toque para ativar';
    });
  }

  function limparCena() {
    if (estado.aplicandoCena || !estado.cenaAtiva[estado.atual]) return;
    delete estado.cenaAtiva[estado.atual];
    atualizarCenas();
  }

  function aplicarCena(id, botao) {
    const cena = DADOS.cenas.find((c) => c.id === id);
    const alvoComodo = estado.atual;
    const c = comodo();
    const aj = cena.ajustes;
    estado.aplicandoCena = true;
    estado.cenaAtiva[alvoComodo] = id;
    atualizarCenas();
    botao.classList.remove('is-aplicando');
    void botao.offsetWidth; // reinicia a animação de varredura
    botao.classList.add('is-aplicando');
    setTimeout(() => botao.classList.remove('is-aplicando'), 900);

    // Termostato e iluminação (animados)
    c.termostato.modo = aj.modo;
    definirTemperatura(aj.temperatura, { animado: true, origem: 'cena', dur: 900 });
    c.iluminacao.cor = aj.cor;
    const deBrilho = c.iluminacao.brilho;
    const alvoBrilho = aj.brilho > 0 ? aj.brilho : deBrilho; // "Dormir" apaga, mas lembra o brilho
    animar(700, (p) => {
      if (estado.atual !== alvoComodo) return;
      c.iluminacao.brilho = Math.round(lerp(deBrilho, alvoBrilho, p));
      atualizarIluminacao();
      atualizarDispositivos();
    }, null, suaveIO);

    // Dispositivos mudam um após o outro
    const mudancas = Object.entries(aj.dispositivos).filter(([k, v]) => disp(k, c) && disp(k, c).ligado !== v);
    mudancas.forEach(([k, v], i) => setTimeout(() => {
      disp(k, c).ligado = v;
      if (estado.atual === alvoComodo) atualizarDispositivos(); else atualizarContagensComodos();
    }, movReduzido.matches ? 0 : 120 + i * 130));
    setTimeout(() => { estado.aplicandoCena = false; }, movReduzido.matches ? 0 : 160 + mudancas.length * 130 + 700);
    avisar(`Cena “${cena.nome}” ativada em ${c.nome}`);
  }

  /* ===================================================================
     14. INÍCIO
     =================================================================== */
  function iniciar() {
    // Céu fixo opcional: index.html?ceu=manha | tarde | noite, ou <html data-ceu="tarde">
    const ceuFixo = new URLSearchParams(window.location.search).get('ceu') || document.documentElement.dataset.ceu;
    if (['manha', 'tarde', 'noite'].includes(ceuFixo)) estado.periodoEscolhido = ceuFixo;
    iniciarCeu();
    iniciarTopo();
    montarComodos();
    iniciarGrafico();
    iniciarTermostato();
    iniciarDispositivos();
    iniciarIluminacao();
    iniciarCamera();
    montarCenas();
    montarCasaHoje();
    aplicarPeriodo();

    // Primeira pintura: termostato varre do mínimo até o alvo; números contam do zero.
    renderizarComodo(false);
    termo.cancelar();
    termo.exibido = TERMO.min;
    desenharTermostato(TERMO.min);
    const alvo = comodo().termostato.alvo;
    setTimeout(() => {
      termo.cancelar = animar(900, (p) => { termo.exibido = lerp(TERMO.min, alvo, p); desenharTermostato(termo.exibido); }, null, suaveIO);
    }, movReduzido.matches ? 0 : 250);
  }

  // API mínima para integrar dados reais sem mexer no resto do código
  window.PainelVidro = {
    DADOS,
    /** Depois de alterar DADOS (ex.: fetch na sua API), chame para redesenhar. */
    recarregar() {
      estado.comodos = JSON.parse(JSON.stringify(DADOS.comodos));
      if (!estado.comodos[estado.atual]) estado.atual = Object.keys(estado.comodos)[0];
      montarComodosLista();
      montarCasaHoje();
      renderizarComodo(true);
    },
    trocarComodo,
    definirPeriodo(p) { estado.periodoEscolhido = p; aplicarPeriodo(); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
