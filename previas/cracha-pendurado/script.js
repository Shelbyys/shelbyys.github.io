/* =========================================================================
   Crachá Pendurado — física de corda (Verlet) feita à mão
   -------------------------------------------------------------------------
   • A fita é uma corrente de pontos ligados por restrições de distância.
   • O crachá é um corpo rígido modelado como um TRIÂNGULO de 3 pontos
     (furo + cantos de baixo) com restrições rígidas: a rotação surge sozinha.
   • O ponto do furo é compartilhado entre a fita e o crachá.
   • Passo fixo de 1/120 s, com acumulador (mesma física em 60 ou 144 Hz).
   Sem dependências. Ajuste os parâmetros no objeto FISICA abaixo.
   ========================================================================= */
(() => {
  'use strict';

  /* ---------- Parâmetros da física (documentados no LEIAME.md) ---------- */
  const FISICA = {
    gravidade: 3000,          // px/s² — maior = cai e balança mais rápido
    amortecimento: 0.9935,    // fração da velocidade mantida a cada passo (1 = sem atrito)
    amortecimentoQueda: 0.984,// atrito extra só durante a queda inicial (assenta antes de ~1,5 s)
    duracaoQueda: 1.5,        // s em que vale o amortecimentoQueda
    segmentos: 14,            // nº de segmentos da fita
    iteracoes: 14,            // passes de restrição por passo (mais = fita menos elástica)
    rigidezFita: 0.85,        // 0–1: quanto cada passe corrige o estiramento da fita
    forcaArraste: 0.22,       // 0–1: “mola” entre o ponteiro e o ponto agarrado
    alcanceExtra: 1.3,        // até quanto além do comprimento da fita o ponteiro puxa
    desequilibrio: 5,         // graus: inclinação natural em repouso (centro de massa deslocado)
    massaFita: 1,             // massa inversa dos pontos da fita (maior = mais leve)
    massaCracha: 0.22,        // massa inversa dos pontos do crachá (menor = mais pesado)
    empurrao: 9,              // px/passo de velocidade dada pelas setas do teclado
    passo: 1 / 120,           // s — passo fixo da simulação
    furoY: 0.07,              // posição do furo: fração da largura do crachá a partir do topo (igual ao CSS: 7cqw)
  };

  /* ---------- Estampa e aparência da fita ---------- */
  const FITA = {
    texto: 'SUMMIT BRASA 26  ✦  ',
    cor: '#ff5a1f',
    borda: '#b9390c',
    tinta: '#fff4ea',
    larguraRel: 0.078,        // largura da fita em fração da largura do crachá
  };

  /* ---------- Conteúdo por tipo de ingresso ---------- */
  const TIPOS = {
    vip:          { rotulo: 'VIP',          extra: 'acesso total',   sigla: 'VIP', acesso: 'Palcos A·B · Lounge · Backstage', assento: 'Fila A · 12' },
    palestrante:  { rotulo: 'Palestrante',  extra: 'palco & camarim', sigla: 'SPK', acesso: 'Palcos A·B · Camarim · Lounge',  assento: 'Reservado' },
    participante: { rotulo: 'Participante', extra: '2 dias',          sigla: 'PRT', acesso: 'Palcos A·B · Expo · Pátio',      assento: 'Livre' },
  };

  /* ---------- Elementos ---------- */
  const $ = (s) => document.querySelector(s);
  const palco = $('#cr-palco');
  const canvas = $('#cr-fita');
  const ctx = canvas.getContext('2d');
  const cracha = $('#cr-cracha');
  const botao = $('#cr-botao-cracha');
  const botaoRotulo = $('#cr-botao-rotulo');
  const foco = $('#cr-foco');
  const aviso = $('#cr-aviso');

  const movReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Estado ---------- */
  let L = 0, A = 0;                 // largura/altura do palco
  let cw = 0, ch = 0, furo = 0;     // largura/altura do crachá e distância do furo ao topo
  let dpr = 1;
  let pontos = [];                  // {x,y,px,py,inv}
  let restricoes = [];              // {a,b,dist,k,folga}
  let iFuro = 0, iEsq = 0, iDir = 0;// índices dos pontos do crachá
  let ancora = { x: 0, y: 0 };
  let compFita = 0;
  let local = { esq: { x: 0, y: 0 }, dir: { x: 0, y: 0 } }; // cantos do triângulo no referencial do crachá
  let arraste = null;               // { id, pesos:[h,e,d], alvo:{x,y}, inicio:{x,y}, moveu }
  let tempoSim = 0;                 // s desde a última “soltura” (para a queda)
  let acumulador = 0, ultimoT = 0;
  let rafId = 0, quadrosParado = 0;
  let virado = false;

  /* =====================================================================
     MONTAGEM DO SISTEMA
     ===================================================================== */

  /** Mede palco e crachá e (re)cria pontos e restrições. */
  function montar(soltando) {
    const r = palco.getBoundingClientRect();
    L = r.width; A = r.height;
    cw = cracha.offsetWidth; ch = cracha.offsetHeight;
    furo = cw * FISICA.furoY;

    // canvas nítido em telas retina
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(L * dpr);
    canvas.height = Math.round(A * dpr);

    // Âncora acima da tela; fita longa o suficiente para o crachá ficar centralizado
    ancora = { x: L / 2, y: -40 };
    const centroDesejado = A * 0.5 + Math.min(24, A * 0.02);
    const furoRepouso = centroDesejado - ch / 2 + furo;
    compFita = Math.max(90, furoRepouso - ancora.y);

    // Triângulo do crachá: furo (0,0) e cantos de baixo; o deslocamento “e”
    // tira o centro de massa do eixo e gera a inclinação natural em repouso.
    const hh = ch - furo;
    const graus = movReduzido.matches ? 0 : FISICA.desequilibrio;
    const e = Math.tan(graus * Math.PI / 180) * hh;
    local = { esq: { x: -cw / 2 + e, y: hh }, dir: { x: cw / 2 + e, y: hh } };

    pontos = []; restricoes = [];
    const n = FISICA.segmentos;
    const seg = compFita / n;

    // Ângulo de repouso (centro de massa exatamente abaixo do furo)
    const anguloRepouso = Math.atan2(e, hh);

    // Posição inicial do furo
    let fx = ancora.x, fy = ancora.y + compFita, ang = anguloRepouso;
    const queda = soltando && !movReduzido.matches;
    if (queda) {
      fx = ancora.x + Math.min(26, L * 0.03);
      fy = furoRepouso - Math.min(360, A * 0.42);
      ang = anguloRepouso - 0.12;
    }

    // Pontos da fita (0 = âncora fixa)
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = ancora.x + (fx - ancora.x) * t;
      const y = ancora.y + (fy - ancora.y) * t;
      pontos.push({ x, y, px: x, py: y, inv: i === 0 ? 0 : FISICA.massaFita });
      if (i > 0) restricoes.push({ a: i - 1, b: i, dist: seg, k: FISICA.rigidezFita, folga: true });
    }
    iFuro = n;
    pontos[iFuro].inv = FISICA.massaCracha;

    // Cantos do crachá
    const pe = girar(local.esq, ang), pd = girar(local.dir, ang);
    iEsq = pontos.push({ x: fx + pe.x, y: fy + pe.y, px: fx + pe.x, py: fy + pe.y, inv: FISICA.massaCracha }) - 1;
    iDir = pontos.push({ x: fx + pd.x, y: fy + pd.y, px: fx + pd.x, py: fy + pd.y, inv: FISICA.massaCracha }) - 1;
    const d = (a, b) => Math.hypot(pontos[a].x - pontos[b].x, pontos[a].y - pontos[b].y);
    restricoes.push({ a: iFuro, b: iEsq, dist: d(iFuro, iEsq), k: 1, folga: false });
    restricoes.push({ a: iFuro, b: iDir, dist: d(iFuro, iDir), k: 1, folga: false });
    restricoes.push({ a: iEsq, b: iDir, dist: d(iEsq, iDir), k: 1, folga: false });

    tempoSim = queda ? 0 : 99;
    arraste = null;
    cracha.classList.remove('cr-arrastando');
    acumulador = 0;
    desenhar();
    cracha.classList.add('cr-pronto');
    acordar();
  }

  function girar(p, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
  }

  /* =====================================================================
     PASSO DA SIMULAÇÃO
     ===================================================================== */
  function passo(dt) {
    tempoSim += dt;
    const reduz = movReduzido.matches;
    // No modo de movimento reduzido o atrito é altíssimo: nada balança.
    const atrito = reduz ? 0.82 : (tempoSim < FISICA.duracaoQueda ? FISICA.amortecimentoQueda : FISICA.amortecimento);
    const g = FISICA.gravidade * dt * dt;

    // 1) Integração de Verlet: posição nova = posição + (posição − anterior) × atrito + gravidade
    for (const p of pontos) {
      if (p.inv === 0) continue;
      let vx = (p.x - p.px) * atrito;
      let vy = (p.y - p.py) * atrito;
      const v = Math.hypot(vx, vy);
      if (v > 70) { vx *= 70 / v; vy *= 70 / v; } // limite de segurança
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + g;
    }

    // 2) Mola do arraste: puxa o ponto agarrado em direção ao ponteiro.
    //    O deslocamento é distribuído pelos 3 pontos do crachá conforme as
    //    coordenadas baricêntricas — agarrar pela lateral faz o crachá girar.
    if (arraste) {
      const [wh, we, wd] = arraste.pesos;
      const ph = pontos[iFuro], pe = pontos[iEsq], pd = pontos[iDir];
      const gx = wh * ph.x + we * pe.x + wd * pd.x;
      const gy = wh * ph.y + we * pe.y + wd * pd.y;
      // limita o alvo ao alcance da fita (ela estica um pouco e “segura”)
      let tx = arraste.alvo.x, ty = arraste.alvo.y;
      const max = compFita * FISICA.alcanceExtra + Math.hypot(gx - ph.x, gy - ph.y);
      const dx0 = tx - ancora.x, dy0 = ty - ancora.y, dist0 = Math.hypot(dx0, dy0);
      if (dist0 > max) { tx = ancora.x + dx0 / dist0 * max; ty = ancora.y + dy0 / dist0 * max; }
      const k = reduz ? 0.5 : FISICA.forcaArraste;
      const dx = (tx - gx) * k, dy = (ty - gy) * k;
      const soma = wh * wh + we * we + wd * wd;
      ph.x += dx * wh / soma; ph.y += dy * wh / soma;
      pe.x += dx * we / soma; pe.y += dy * we / soma;
      pd.x += dx * wd / soma; pd.y += dy * wd / soma;
    }

    // 3) Restrições de distância (várias passadas)
    for (let it = 0; it < FISICA.iteracoes; it++) {
      for (const r of restricoes) {
        const a = pontos[r.a], b = pontos[r.b];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.0001;
        if (r.folga && d <= r.dist) continue;   // fita frouxa: não empurra, só segura
        const w = a.inv + b.inv;
        if (!w) continue;
        const dif = (d - r.dist) / d * r.k;
        a.x += dx * dif * (a.inv / w); a.y += dy * dif * (a.inv / w);
        b.x -= dx * dif * (b.inv / w); b.y -= dy * dif * (b.inv / w);
      }
    }

    // 4) Limites do palco (o crachá não sai pelas laterais nem pelo chão)
    for (let i = 1; i < pontos.length; i++) {
      const p = pontos[i];
      if (p.x < 8) p.x = 8; else if (p.x > L - 8) p.x = L - 8;
      if (p.y > A - 6) p.y = A - 6;
    }
  }

  /* =====================================================================
     DESENHO
     ===================================================================== */

  /** Ângulo atual do crachá (radianos), a partir da aresta de baixo do triângulo. */
  const anguloAtual = () => {
    const e = pontos[iEsq], d = pontos[iDir];
    return Math.atan2(d.y - e.y, d.x - e.x);
  };

  /** Curva suave (Catmull-Rom) pelos pontos da fita → polilinha densa com comprimentos. */
  function amostrarFita() {
    const pts = pontos.slice(0, iFuro + 1);
    const saida = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      for (let s = 0; s < 6; s++) {
        const t = s / 6, t2 = t * t, t3 = t2 * t;
        saida.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
        });
      }
    }
    saida.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
    let acc = 0;
    saida[0].s = 0;
    for (let i = 1; i < saida.length; i++) {
      acc += Math.hypot(saida[i].x - saida[i - 1].x, saida[i].y - saida[i - 1].y);
      saida[i].s = acc;
    }
    return saida;
  }

  /** Posição e ângulo na polilinha para um comprimento de arco “s”. */
  function noArco(poli, s, dica) {
    let i = dica || 1;
    while (i < poli.length - 1 && poli[i].s < s) i++;
    const a = poli[i - 1], b = poli[i];
    const t = (s - a.s) / ((b.s - a.s) || 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ang: Math.atan2(b.y - a.y, b.x - a.x), i };
  }

  function desenhar() {
    const lf = Math.max(14, cw * FITA.larguraRel);
    const poli = amostrarFita();
    const total = poli[poli.length - 1].s;
    const raioArgola = furo * 0.72 + 4;           // a argola passa por cima da borda e pelo furo
    const fimFita = Math.max(0, total - raioArgola * 2 - lf * 0.55);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, L, A);

    // ----- tira de tecido -----
    let fim = noArco(poli, fimFita);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(poli[0].x, poli[0].y);
    for (let i = 1; i < fim.i; i++) ctx.lineTo(poli[i].x, poli[i].y);
    ctx.lineTo(fim.x, fim.y);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.strokeStyle = FITA.borda;
    ctx.lineWidth = lf;
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = FITA.cor;
    ctx.lineWidth = lf - 3;
    ctx.stroke();

    // ----- trama do tecido: a fita é poliéster tecido, não uma tira lisa -----
    // Traços curtos ao longo do caminho, com a largura inteira da fita, viram as
    // "carreiras" da trama; o traço fino no meio é o brilho de quem tem volume.
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.setLineDash([1.6, 2.4]);
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = lf - 3;
    ctx.stroke();
    ctx.setLineDash([2.4, 1.6]);
    ctx.lineDashOffset = 1.6;
    ctx.strokeStyle = 'rgba(0,0,0,.12)';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    ctx.lineWidth = Math.max(2, (lf - 3) * 0.4);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.16)';
    ctx.lineWidth = Math.max(1, (lf - 3) * 0.1);
    ctx.stroke();
    ctx.restore();

    // ----- estampa repetida ao longo da fita -----
    ctx.fillStyle = FITA.tinta;
    ctx.font = `700 ${Math.round(lf * 0.46)}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const passoLetra = lf * 0.46 * 0.72;
    let s = 6, k = 0, dica = 1;
    const txt = FITA.texto;
    while (s < fimFita - passoLetra) {
      const letra = txt[k % txt.length];
      if (letra !== ' ') {
        const p = noArco(poli, s, dica);
        dica = p.i;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.ang);
        ctx.fillText(letra, 0, 0);
        ctx.restore();
      } else {
        dica = noArco(poli, s, dica).i;
      }
      s += passoLetra; k++;
    }

    // ----- presilha metálica + argola -----
    const pFim = noArco(poli, fimFita);
    const furoP = pontos[iFuro];
    const angF = Math.atan2(furoP.y - pFim.y, furoP.x - pFim.x);
    ctx.save();
    ctx.translate(pFim.x, pFim.y);
    ctx.rotate(angF);
    const metal = ctx.createLinearGradient(0, -lf / 2, 0, lf / 2);
    metal.addColorStop(0, '#6f757e'); metal.addColorStop(0.45, '#eef1f4'); metal.addColorStop(1, '#7c828b');
    ctx.fillStyle = metal;
    arredondado(-lf * 0.15, -lf * 0.58, lf * 0.75, lf * 1.16, 3);
    ctx.fill();
    ctx.restore();

    // argola: centro entre a presilha e o furo, raio que alcança o furo
    const cx = furoP.x - Math.cos(angF) * (raioArgola - 1);
    const cy = furoP.y - Math.sin(angF) * (raioArgola - 1);
    ctx.lineWidth = Math.max(2.5, cw * 0.011);
    ctx.strokeStyle = '#d9dde2';
    ctx.beginPath(); ctx.arc(cx, cy, raioArgola, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(70,74,82,.9)';
    ctx.beginPath(); ctx.arc(cx, cy, raioArgola + ctx.lineWidth + 0.8, Math.PI * 0.9, Math.PI * 1.6); ctx.stroke();

    // ----- crachá (HTML) -----
    const ang = anguloAtual();
    cracha.style.transformOrigin = `${cw / 2}px ${furo}px`;
    cracha.style.transform = `translate3d(${(furoP.x - cw / 2).toFixed(2)}px, ${(furoP.y - furo).toFixed(2)}px, 0) rotate(${ang.toFixed(4)}rad)`;
    cracha.style.setProperty('--cr-brilho', (ang * 180 / Math.PI).toFixed(2));

    // foco de luz acompanha o centro do crachá
    const c = girar({ x: 0, y: ch / 2 - furo }, ang);
    foco.style.translate = `${(furoP.x + c.x).toFixed(1)}px ${(furoP.y + c.y).toFixed(1)}px`;
  }

  function arredondado(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* =====================================================================
     LAÇO DE ANIMAÇÃO (dorme quando tudo para)
     ===================================================================== */
  function quadro(t) {
    rafId = 0;
    const dt = Math.min(0.05, (t - ultimoT) / 1000 || 0);
    ultimoT = t;
    acumulador += dt;
    let n = 0;
    while (acumulador >= FISICA.passo && n < 10) { passo(FISICA.passo); acumulador -= FISICA.passo; n++; }
    if (n === 10) acumulador = 0;
    desenhar();

    // Energia: se quase nada se move por ~1 s, para o laço (economiza bateria)
    let mov = 0;
    for (let i = 1; i < pontos.length; i++) mov += Math.abs(pontos[i].x - pontos[i].px) + Math.abs(pontos[i].y - pontos[i].py);
    quadrosParado = (mov < 0.02 && !arraste) ? quadrosParado + 1 : 0;
    if (quadrosParado < 60) rafId = requestAnimationFrame(quadro);
  }

  function acordar() {
    quadrosParado = 0;
    if (!rafId) {
      ultimoT = performance.now();
      rafId = requestAnimationFrame(quadro);
    }
  }

  /* =====================================================================
     INTERAÇÃO: arrastar, clicar/tocar para virar, teclado
     ===================================================================== */
  function pontoNoPalco(e) {
    const r = palco.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  cracha.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const p = pontoNoPalco(e);
    // Converte o ponto para o referencial do crachá (origem no furo)
    const f = pontos[iFuro];
    const q = girar({ x: p.x - f.x, y: p.y - f.y }, -anguloAtual());
    // Coordenadas baricêntricas no triângulo furo/esq/dir
    const hh = local.esq.y;
    const t = q.y / hh;
    const wd = (q.x - t * local.esq.x) / (local.dir.x - local.esq.x);
    const we = t - wd;
    arraste = { id: e.pointerId, pesos: [1 - t, we, wd], alvo: p, inicio: p, moveu: false, tipo: e.pointerType };
    cracha.setPointerCapture(e.pointerId);
    cracha.classList.add('cr-arrastando');
    tempoSim = 99;
    acordar();
  });

  cracha.addEventListener('pointermove', (e) => {
    if (!arraste || e.pointerId !== arraste.id) return;
    const p = pontoNoPalco(e);
    arraste.alvo = p;
    if (Math.hypot(p.x - arraste.inicio.x, p.y - arraste.inicio.y) > 6) arraste.moveu = true;
    acordar();
  });

  let ignorarClique = false;
  let ultimoToque = 0;
  function terminarArraste(e) {
    if (!arraste || e.pointerId !== arraste.id) return;
    ignorarClique = arraste.moveu;
    // Toque: virar com duplo toque (toque simples fica livre para brincar)
    if (!arraste.moveu && arraste.tipo === 'touch') {
      const agora = performance.now();
      if (agora - ultimoToque < 350) { virar(); ultimoToque = 0; } else ultimoToque = agora;
      ignorarClique = true;
    }
    arraste = null;
    cracha.classList.remove('cr-arrastando');
    acordar();
  }
  cracha.addEventListener('pointerup', terminarArraste);
  cracha.addEventListener('pointercancel', terminarArraste);

  // Clique do mouse ou Enter/Espaço no botão real
  botao.addEventListener('click', () => {
    if (ignorarClique) { ignorarClique = false; return; }
    virar();
  });

  // Setas: um empurrão no crachá
  botao.addEventListener('keydown', (e) => {
    const mapa = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1.4], ArrowDown: [0, 0.8] };
    const v = mapa[e.key];
    if (!v) return;
    e.preventDefault();
    empurrar(v[0] * FISICA.empurrao, v[1] * FISICA.empurrao);
  });

  /** Aplica velocidade aos pontos do crachá (Verlet: mexe na posição anterior). */
  function empurrar(vx, vy) {
    const f = movReduzido.matches ? 0.25 : 1;
    for (const i of [iFuro, iEsq, iDir]) { pontos[i].px -= vx * f; pontos[i].py -= vy * f; }
    tempoSim = 99;
    acordar();
  }

  function virar() {
    virado = !virado;
    cracha.classList.toggle('cr-virado', virado);
    cracha.classList.remove('cr-virando');
    void cracha.offsetWidth;          // reinicia a animação da sombra
    cracha.classList.add('cr-virando');
    botaoRotulo.textContent = virado ? 'Virar crachá para ver a frente' : 'Virar crachá para ver o verso';
    aviso.textContent = virado ? 'Verso: programação do dia.' : 'Frente: dados do participante.';
    if (!movReduzido.matches) empurrar(2.5 * (virado ? 1 : -1), -1.5); // um tranquinho ao girar
  }
  cracha.addEventListener('animationend', () => cracha.classList.remove('cr-virando'));

  /* =====================================================================
     PAINEL: atualiza o crachá ao vivo
     ===================================================================== */
  const inNome = $('#cr-in-nome'), inCargo = $('#cr-in-cargo');
  const elNome = $('#cr-nome'), elCargo = $('#cr-cargo');

  function atualizarNome() {
    const nome = inNome.value.trim() || 'Seu Nome';
    elNome.textContent = nome;
    elNome.dataset.tam = nome.length > 22 ? 'p' : nome.length > 15 ? 'm' : '';
    atualizarQR();
  }
  function atualizarCargo() {
    elCargo.textContent = inCargo.value.trim() || 'Cargo · Empresa';
  }
  function atualizarTipo(tipo) {
    const t = TIPOS[tipo] || TIPOS.vip;
    cracha.dataset.tipo = tipo;
    $('#cr-tipo-txt').textContent = t.rotulo;
    $('#cr-tipo-extra').textContent = t.extra;
    $('#cr-acesso').textContent = t.acesso;
    $('#cr-assento').textContent = t.assento;
    $('#cr-codigo').textContent = `SB26-${t.sigla}-${$('#cr-numero').textContent}`;
    atualizarQR();
  }

  inNome.addEventListener('input', atualizarNome);
  inCargo.addEventListener('input', atualizarCargo);
  document.querySelectorAll('input[name="tipo"]').forEach((r) => r.addEventListener('change', () => {
    atualizarTipo(r.value);
    if (!movReduzido.matches) empurrar(0, -3); // pulinho de feedback
  }));
  $('#cr-form').addEventListener('submit', (e) => e.preventDefault());
  $('#cr-btn-virar').addEventListener('click', virar);
  $('#cr-btn-soltar').addEventListener('click', () => {
    montar(true);
    aviso.textContent = 'O crachá foi solto de novo.';
  });

  /* ---------- QR decorativo: padrão determinístico a partir do nome ---------- */
  function atualizarQR() {
    const semente = `${inNome.value}|${cracha.dataset.tipo}`;
    let h = 2166136261;
    for (let i = 0; i < semente.length; i++) { h ^= semente.charCodeAt(i); h = Math.imul(h, 16777619); }
    const rnd = () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const N = 25;
    const naMarca = (x, y) => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
    let d = '';
    // três marcadores de canto
    for (const [ox, oy] of [[0, 0], [N - 7, 0], [0, N - 7]]) {
      d += `M${ox} ${oy}h7v7h-7zM${ox + 1} ${oy + 1}v5h5v-5z`;
      d += `M${ox + 2} ${oy + 2}h3v3h-3z`;
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (naMarca(x, y)) continue;
      if (rnd() > 0.52) d += `M${x} ${y}h1v1h-1z`;
    }
    const path = $('#cr-qr-path');
    path.setAttribute('d', d);
    path.setAttribute('fill-rule', 'evenodd');
  }

  /* =====================================================================
     INÍCIO, REDIMENSIONAMENTO E PREFERÊNCIAS
     ===================================================================== */
  atualizarNome();
  atualizarCargo();
  atualizarTipo('vip');
  montar(true);

  // Redimensionar: remonta já pendurado (sem nova queda)
  let ultimaMedida = `${Math.round(L)}x${Math.round(A)}`;
  let timerResize = 0;
  new ResizeObserver(() => {
    clearTimeout(timerResize);
    timerResize = setTimeout(() => {
      const r = palco.getBoundingClientRect();
      const medida = `${Math.round(r.width)}x${Math.round(r.height)}`;
      if (medida === ultimaMedida && cracha.offsetWidth === cw) return;
      ultimaMedida = medida;
      montar(false);
    }, 120);
  }).observe(palco);

  movReduzido.addEventListener('change', () => montar(false));

  // A estampa usa JetBrains Mono: redesenha quando a fonte chegar
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { desenhar(); acordar(); });
})();
