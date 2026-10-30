/* =========================================================
   CARRINHO ANIMADO — script.js
   Microinterações de compra em JavaScript puro:
   produto voando até o carrinho, contadores que rolam,
   gaveta acessível, frete grátis, favoritos e desfazer.
   ========================================================= */
(() => {
  'use strict';

  /* ---------- Configuração ---------- */
  const CHAVE = 'ca-carrinho-demo-v1';   // chave no localStorage
  const FRETE_GRATIS = 29900;            // valores sempre em centavos (evita erro de arredondamento)
  const FRETE = 1990;
  const TEMPO_TOAST = 5000;              // ms que o "Desfazer" fica disponível
  const TEMPO_ADICIONADO = 1000;         // ms mostrando "✓ Adicionado" antes do controle − 1 +
  // Estado de quem abre a loja pela primeira vez (deixa a demo já "viva")
  const ESTADO_INICIAL = { itens: [{ id: 'garrafa', qtd: 1 }], favoritos: ['fone'], cupom: null };

  // Estados de validação do cupom
  const TENTATIVAS_CUPOM = 3;            // códigos inválidos seguidos até trancar o campo
  const BLOQUEIO_SEGUNDOS = 30;          // tempo trancado (o servidor pode mandar outro em Retry-After)
  /* Cupons da DEMONSTRAÇÃO. Em produção quem valida é o servidor (veja validarCupomNoServidor). */
  const CUPONS = {
    BEMVINDO10: { tipo: 'percentual', valor: 10, rotulo: '10% off nos produtos' },
    FRETEGRATIS: { tipo: 'frete', rotulo: 'Frete grátis para todo o Brasil' },
    VERAO25: { tipo: 'percentual', valor: 25, rotulo: '25% off de verão', validoAte: '2026-03-31' }, // expirado
  };

  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatar = (centavos) => moeda.format(centavos / 100);
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  const consultaMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
  const semMovimento = () => consultaMovimento.matches;
  const MOLA = 'cubic-bezier(.34, 1.56, .64, 1)';
  const SUAVE = 'cubic-bezier(.22, 1, .36, 1)';

  /* ---------- Catálogo: lido dos próprios cartões ---------- */
  const cartoes = [...document.querySelectorAll('.ca-produto')];
  const catalogo = new Map();
  cartoes.forEach((cartao) => {
    catalogo.set(cartao.dataset.id, {
      id: cartao.dataset.id,
      nome: cartao.dataset.nome,
      preco: Number(cartao.dataset.preco) || 0,
      cor: cartao.style.getPropertyValue('--ca-cor').trim(),
      // data-estoque é opcional; sem ele o limite é 99 unidades
      estoque: Math.min(99, parseInt(cartao.dataset.estoque, 10) || 99),
      arte: cartao.querySelector('.ca-produto__arte'),
      cartao,
    });
  });

  /* ---------- Elementos ---------- */
  const $ = (seletor) => document.querySelector(seletor);
  const el = {
    carrinhoBtn: $('.ca-carrinho-btn'),
    carrinhoIcone: $('.ca-carrinho-btn__icone'),
    badge: $('.ca-carrinho-btn .ca-badge'),
    favTopo: $('.ca-fav-topo'),
    favBadge: $('.ca-fav-topo .ca-badge'),
    grade: $('.ca-grade'),
    gradeVazio: $('.ca-grade__vazio'),
    filtros: [...document.querySelectorAll('.ca-chip')],
    gaveta: $('#ca-gaveta'),
    fundo: $('.ca-fundo'),
    fechar: $('.ca-gaveta__fechar'),
    lista: $('.ca-gaveta__lista'),
    vazio: $('.ca-gaveta__vazio'),
    qtdTitulo: $('.ca-gaveta__qtd'),
    frete: $('.ca-frete'),
    freteTexto: $('.ca-frete__texto'),
    freteBarra: $('.ca-frete__barra'),
    freteCaminhao: $('.ca-frete__caminhao'),
    subtotal: $('.ca-subtotal'),
    freteValor: $('.ca-frete-valor'),
    total: $('.ca-total'),
    finalizar: $('.ca-finalizar'),
    finalizarTexto: $('.ca-finalizar__texto'),
    toast: $('.ca-toast'),
    toastTexto: $('.ca-toast__texto'),
    toastDesfazer: $('.ca-toast__desfazer'),
    anuncio: $('#ca-anuncio'),
    linhaDesconto: $('.ca-resumo__desconto'),
    desconto: $('.ca-desconto'),
    descontoCupom: $('.ca-resumo__cupom'),
  };

  /* ---------- Estado + localStorage (nunca quebra se o navegador bloquear) ---------- */
  function carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE));
      if (salvo && Array.isArray(salvo.itens)) {
        return {
          itens: salvo.itens
            .filter((i) => i && catalogo.has(i.id))
            .map((i) => ({ id: i.id, qtd: Math.min(catalogo.get(i.id).estoque, Math.max(1, parseInt(i.qtd, 10) || 1)) })),
          favoritos: Array.isArray(salvo.favoritos) ? salvo.favoritos.filter((id) => catalogo.has(id)) : [],
          cupom: cupomValido(salvo.cupom) ? salvo.cupom : null,
        };
      }
    } catch (erro) { /* sem acesso ao localStorage: segue com o estado inicial */ }
    return JSON.parse(JSON.stringify(ESTADO_INICIAL));
  }
  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (erro) { /* modo privado etc. */ }
  }

  /** Cupom existe e não venceu? (só para a demo; em produção, pergunte ao servidor) */
  function cupomValido(codigo) {
    const c = CUPONS[codigo];
    if (!c) return false;
    return !c.validoAte || new Date(c.validoAte + 'T23:59:59') >= new Date();
  }
  const dataBR = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');

  let estado = carregar();
  const itemDe = (id) => estado.itens.find((i) => i.id === id);
  const qtdDe = (id) => (itemDe(id) || { qtd: 0 }).qtd;
  const totalItens = () => estado.itens.reduce((soma, i) => soma + i.qtd, 0);
  const subtotal = () => estado.itens.reduce((soma, i) => soma + i.qtd * catalogo.get(i.id).preco, 0);

  /** Fala com leitores de tela pela região aria-live. */
  function anunciar(texto) {
    el.anuncio.textContent = '';
    setTimeout(() => { el.anuncio.textContent = texto; }, 60);
  }

  /* =========================================================
     ANIMAÇÕES REUTILIZÁVEIS
     ========================================================= */

  /** Número que rola: o antigo sai e o novo entra na direção da mudança. */
  function rolar(caixa, valor) {
    const atual = caixa.querySelector('.ca-rolo__n:not(.is-saindo)');
    const anterior = atual ? Number(atual.dataset.v) : null;
    if (anterior === valor) return;
    const novo = document.createElement('span');
    novo.className = 'ca-rolo__n';
    novo.dataset.v = String(valor);
    novo.textContent = String(valor);
    caixa.appendChild(novo);
    if (!atual) return;
    if (semMovimento() || !novo.animate) { atual.remove(); return; }
    const direcao = valor > anterior ? 1 : -1;
    atual.classList.add('is-saindo');
    atual.setAttribute('aria-hidden', 'true');
    const tempo = { duration: 380, easing: SUAVE };
    atual.animate(
      [{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-direcao * 100}%)`, opacity: 0 }],
      { ...tempo, fill: 'forwards' }
    ).onfinish = () => atual.remove();
    novo.animate([{ transform: `translateY(${direcao * 100}%)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], tempo);
  }

  /** Contagem animada de valores em reais (subtotal, total, linha). */
  const contagens = new WeakMap();
  function contar(alvo, para) {
    const de = alvo.dataset.valor === undefined ? para : Number(alvo.dataset.valor);
    alvo.dataset.valor = String(para);
    cancelAnimationFrame(contagens.get(alvo) || 0);
    if (de === para || semMovimento()) { alvo.textContent = formatar(para); return; }
    const inicio = performance.now();
    const duracao = 700;
    const passo = (agora) => {
      const t = Math.min(1, (agora - inicio) / duracao);
      const suave = 1 - Math.pow(1 - t, 3);
      alvo.textContent = formatar(Math.round(de + (para - de) * suave));
      if (t < 1) contagens.set(alvo, requestAnimationFrame(passo));
    };
    contagens.set(alvo, requestAnimationFrame(passo));
  }

  /** Atualiza um badge (mostra/esconde, rola o número e, se pedir, dá um pulo). */
  function atualizarBadge(badge, valor, pular) {
    badge.classList.toggle('is-visivel', valor > 0);
    rolar(badge.querySelector('.ca-rolo'), valor);
    if (pular && valor > 0 && !semMovimento() && badge.animate) {
      badge.animate(
        [{ transform: 'scale(1)' }, { transform: 'translateY(-4px) scale(1.45)', offset: 0.4 }, { transform: 'scale(1)' }],
        { duration: 520, easing: MOLA }
      );
    }
  }

  /** O ícone do carrinho balança quando algo chega. */
  function balancarCarrinho() {
    if (semMovimento() || !el.carrinhoIcone.animate) return;
    el.carrinhoIcone.animate(
      [{ transform: 'rotate(0)' }, { transform: 'rotate(-18deg)' }, { transform: 'rotate(13deg)' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(0)' }],
      { duration: 650, easing: 'ease-out' }
    );
  }

  /**
   * Faz uma cópia da ilustração voar em arco até o carrinho.
   * O caminho é uma curva de Bézier quadrática amostrada em quadros-chave
   * da Web Animations API. Resolve a Promise quando o voo termina.
   */
  function voar(arte) {
    return new Promise((resolver) => {
      if (semMovimento() || !document.body.animate) { resolver(); return; }
      const r1 = el.carrinhoIcone.getBoundingClientRect();
      let r0 = arte.getBoundingClientRect();
      if (!r0.width || !r1.width) { resolver(); return; }

      // Uma foto cobre a caixa inteira do cartão: a cópia que voa parte de uma
      // caixa menor e quadrada, centrada no produto (uma ilustração parte do tamanho real).
      if (arte.tagName === 'IMG') {
        const lado = Math.min(r0.width, r0.height) * 0.46;
        r0 = { left: r0.left + (r0.width - lado) / 2, top: r0.top + (r0.height - lado) / 2, width: lado, height: lado };
      }

      const voo = document.createElement('div');
      voo.className = 'ca-voo';
      voo.setAttribute('aria-hidden', 'true');
      const copia = arte.cloneNode(true);
      copia.removeAttribute('class');
      voo.appendChild(copia);
      Object.assign(voo.style, { left: r0.left + 'px', top: r0.top + 'px', width: r0.width + 'px', height: r0.height + 'px' });
      document.body.appendChild(voo);

      // Início, fim e ponto de controle (acima do carrinho → o arco "mergulha" nele)
      const x0 = r0.left + r0.width / 2;
      const y0 = r0.top + r0.height / 2;
      const x1 = r1.left + r1.width / 2;
      const y1 = r1.top + r1.height / 2;
      const cx = x0 + (x1 - x0) * 0.25;
      const cy = Math.min(y0, y1) - 80;
      const escalaFinal = Math.max(0.06, 24 / r0.width);

      const quadros = [];
      const PASSOS = 32;
      for (let i = 0; i <= PASSOS; i++) {
        const t = i / PASSOS;
        const u = 1 - t;
        const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
        const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
        const escala = t < 0.12 ? 1 + t * 0.8 : 1.1 + (escalaFinal - 1.1) * ((t - 0.12) / 0.88);
        quadros.push({
          offset: t,
          opacity: t > 0.9 ? Math.max(0, (1 - t) / 0.1) : 1,
          transform: `translate(${(x - x0).toFixed(1)}px, ${(y - y0).toFixed(1)}px) scale(${escala.toFixed(3)}) rotate(${(-25 * t).toFixed(1)}deg)`,
        });
      }
      const animacao = voo.animate(quadros, { duration: 900, easing: 'cubic-bezier(.5, 0, .3, 1)', fill: 'forwards' });
      const terminar = () => { voo.remove(); resolver(); };
      animacao.onfinish = terminar;
      animacao.oncancel = terminar;
    });
  }

  /** Coração que explode em partículas. */
  const CORES_PARTICULAS = ['#ff5c28', '#ffb020', '#ff3d6e', '#1fa36b', '#7b5ce0'];
  function explodir(botao) {
    if (semMovimento() || !botao.animate) return;
    botao.querySelector('svg').animate(
      [{ transform: 'scale(.3)' }, { transform: 'scale(1.35)', offset: 0.5 }, { transform: 'scale(1)' }],
      { duration: 560, easing: MOLA }
    );
    // Anel que se expande
    const anel = document.createElement('span');
    anel.className = 'ca-particula';
    anel.style.cssText = 'width:40px;height:40px;margin:-20px 0 0 -20px;border:2px solid #ff5c28;';
    botao.appendChild(anel);
    anel.animate([{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 520, easing: 'ease-out' }).onfinish = () => anel.remove();
    // Partículas em círculo, com tamanho e distância variados
    const TOTAL = 14;
    for (let i = 0; i < TOTAL; i++) {
      const p = document.createElement('span');
      const tamanho = 4 + Math.random() * 5;
      const angulo = (i / TOTAL) * Math.PI * 2 + Math.random() * 0.35;
      const distancia = 26 + Math.random() * 22;
      p.className = 'ca-particula';
      p.style.cssText = `width:${tamanho}px;height:${tamanho}px;margin:${-tamanho / 2}px 0 0 ${-tamanho / 2}px;background:${CORES_PARTICULAS[i % CORES_PARTICULAS.length]};${i % 3 === 0 ? 'border-radius:2px;' : ''}`;
      botao.appendChild(p);
      p.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${(Math.cos(angulo) * distancia).toFixed(1)}px, ${(Math.sin(angulo) * distancia).toFixed(1)}px) scale(0)`, opacity: 0.8 },
        ],
        { duration: 560 + Math.random() * 260, easing: 'cubic-bezier(.15, .85, .3, 1)' }
      ).onfinish = () => p.remove();
    }
  }

  /* =========================================================
     CARTÕES DE PRODUTO
     ========================================================= */
  const temporizadores = new Map();

  /** Troca o estado visual da ação do cartão e cuida do foco do teclado. */
  function definirEstadoCartao(id, novo) {
    const acao = catalogo.get(id).cartao.querySelector('.ca-acao');
    const tinhaFoco = acao.contains(document.activeElement);
    acao.dataset.estado = novo;
    if (!tinhaFoco) return;
    const alvo = novo === 'qtd' ? acao.querySelector('[data-acao="mais"]') : novo === 'vazio' ? acao.querySelector('.ca-add') : null;
    if (alvo) alvo.focus({ preventScroll: true });
  }

  /** No limite do estoque, o "+" fica com aria-disabled (continua clicável para explicar o porquê). */
  function marcarLimite(caixa, id) {
    const mais = caixa && caixa.querySelector('[data-acao="mais"]');
    if (!mais) return;
    const noLimite = qtdDe(id) >= catalogo.get(id).estoque;
    mais.setAttribute('aria-disabled', String(noLimite));
    mais.setAttribute('aria-label', noLimite ? 'Aumentar quantidade (limite do estoque)' : 'Aumentar quantidade');
  }

  /** ERRO (sem estoque): o controle bate na "parede" e um balão mostra o limite. */
  function avisarSemEstoque(id, botao) {
    const produto = catalogo.get(id);
    const texto = produto.estoque === 1 ? 'Só temos 1 unidade' : `Só temos ${produto.estoque} unidades`;
    const caixa = botao && botao.closest('.ca-qtd');
    if (caixa) {
      caixa.classList.remove('is-limite');
      void caixa.offsetWidth;
      caixa.classList.add('is-limite');
      clearTimeout(caixa.limiteTempo);
      caixa.limiteTempo = setTimeout(() => caixa.classList.remove('is-limite'), 650);
      caixa.querySelectorAll('.ca-estoque').forEach((b) => b.remove());
      const balao = document.createElement('span');
      balao.className = 'ca-estoque';
      balao.setAttribute('aria-hidden', 'true');
      balao.textContent = texto + ' em estoque';
      caixa.appendChild(balao);
      setTimeout(() => balao.remove(), 2700);
    }
    anunciar(`Sem estoque: ${produto.nome}. ${texto} e todas já estão no seu carrinho.`);
  }

  function atualizarCartao(id) {
    const acao = catalogo.get(id).cartao.querySelector('.ca-acao');
    marcarLimite(acao, id);
    const q = qtdDe(id);
    if (q > 0) {
      rolar(acao.querySelector('.ca-qtd__n'), q);
      if (acao.dataset.estado === 'vazio') definirEstadoCartao(id, 'qtd');
    } else if (acao.dataset.estado !== 'vazio') {
      clearTimeout(temporizadores.get(id));
      definirEstadoCartao(id, 'vazio');
    }
  }

  /* =========================================================
     GAVETA: linhas, resumo e frete grátis
     ========================================================= */
  const ICONE_MENOS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>';
  const ICONE_MAIS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>';
  const ICONE_LIXO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 11v5M13.5 11v5"/></svg>';

  function linhaDe(id) {
    return [...el.lista.querySelectorAll('.ca-linha:not(.is-saindo)')].find((li) => li.dataset.linha === id) || null;
  }

  function criarLinha(id) {
    const produto = catalogo.get(id);
    const li = document.createElement('li');
    li.className = 'ca-linha';
    li.dataset.linha = id;
    li.innerHTML = `
      <div class="ca-linha__dentro">
        <div class="ca-linha__arte"></div>
        <div class="ca-linha__info">
          <p class="ca-linha__nome"></p>
          <p class="ca-linha__unit">${formatar(produto.preco)} / un.</p>
          <div class="ca-qtd ca-qtd--mini" role="group">
            <button class="ca-qtd__btn" type="button" data-acao="menos" aria-label="Diminuir quantidade">${ICONE_MENOS}</button>
            <output class="ca-qtd__n ca-rolo" aria-live="polite"></output>
            <button class="ca-qtd__btn" type="button" data-acao="mais" aria-label="Aumentar quantidade">${ICONE_MAIS}</button>
          </div>
        </div>
        <div class="ca-linha__lado">
          <strong class="ca-linha__total"></strong>
          <button class="ca-remover" type="button" data-acao="remover">${ICONE_LIXO}Remover</button>
        </div>
      </div>`;
    li.querySelector('.ca-linha__nome').textContent = produto.nome;
    li.querySelector('.ca-qtd').setAttribute('aria-label', `Quantidade de ${produto.nome}`);
    li.querySelector('.ca-remover').setAttribute('aria-label', `Remover ${produto.nome} do carrinho`);
    const arte = li.querySelector('.ca-linha__arte');
    arte.style.setProperty('--ca-cor', produto.cor);
    const copia = produto.arte.cloneNode(true);
    copia.removeAttribute('class');
    arte.appendChild(copia);
    return li;
  }

  /** Mostra o "carrinho vazio" só quando não sobrou nenhuma linha (nem saindo). */
  function atualizarVazio() {
    const saindo = !!el.lista.querySelector('.is-saindo');
    const vazio = estado.itens.length === 0 && !saindo;
    const mudou = el.vazio.hidden === vazio;
    el.vazio.hidden = !vazio;
    el.lista.hidden = vazio;
    if (vazio && mudou && !semMovimento() && el.vazio.animate) {
      el.vazio.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: SUAVE });
    }
  }

  /** Deixa as linhas da gaveta iguais ao estado (cria, atualiza e ordena). */
  function sincronizarLista(animar) {
    estado.itens.forEach((item, i) => {
      let li = linhaDe(item.id);
      if (!li) {
        li = criarLinha(item.id);
        const proxima = estado.itens.slice(i + 1).map((x) => linhaDe(x.id)).find(Boolean) || null;
        el.lista.insertBefore(li, proxima);
        if (animar && !semMovimento() && li.animate) {
          const altura = li.offsetHeight;
          li.animate([{ height: '0px', opacity: 0 }, { height: altura + 'px', opacity: 1 }], { duration: 450, easing: SUAVE });
        }
      }
      rolar(li.querySelector('.ca-qtd__n'), item.qtd);
      marcarLimite(li, item.id);
      contar(li.querySelector('.ca-linha__total'), item.qtd * catalogo.get(item.id).preco);
    });
    // Linhas sem item correspondente (ex.: outra aba mudou o carrinho)
    el.lista.querySelectorAll('.ca-linha:not(.is-saindo)').forEach((li) => {
      if (!itemDe(li.dataset.linha)) li.remove();
    });
    atualizarVazio();
  }

  /** Recolhe a linha removida: desliza para o lado e a altura vai a zero. */
  function recolher(li) {
    li.classList.add('is-saindo');
    li.setAttribute('inert', '');
    if (semMovimento() || !li.animate) { li.remove(); atualizarVazio(); return; }
    const altura = li.offsetHeight;
    li.animate(
      [
        { height: altura + 'px', opacity: 1, transform: 'translateX(0)' },
        { height: altura + 'px', opacity: 0, transform: 'translateX(48px)', offset: 0.45 },
        { height: '0px', opacity: 0, transform: 'translateX(48px)' },
      ],
      { duration: 560, easing: SUAVE, fill: 'forwards' }
    ).onfinish = () => { li.remove(); atualizarVazio(); };
  }

  let pintado = false; // depois da primeira pintura, mudanças ganham animação
  let tempoBrilho = 0;
  /** APROVADO (frete): um brilho corre pela barra cheia e o caminhão dá um pulinho. */
  function brilharFrete() {
    clearTimeout(tempoBrilho);
    el.frete.classList.remove('is-brilho');
    void el.frete.offsetWidth;
    el.frete.classList.add('is-brilho');
    tempoBrilho = setTimeout(() => el.frete.classList.remove('is-brilho'), 1700);
  }

  function atualizarResumo() {
    const sub = subtotal();
    const n = totalItens();
    const cupom = estado.cupom ? CUPONS[estado.cupom] : null;
    const cupomFrete = !!cupom && cupom.tipo === 'frete';
    const desconto = cupom && cupom.tipo === 'percentual' ? Math.round(sub * cupom.valor / 100) : 0;
    const falta = cupomFrete ? 0 : Math.max(0, FRETE_GRATIS - sub);
    const frete = sub === 0 || falta === 0 ? 0 : FRETE;

    contar(el.subtotal, sub);
    contar(el.total, sub - desconto + frete);
    el.freteValor.textContent = sub === 0 ? '—' : frete === 0 ? 'Grátis' : formatar(frete);
    el.freteValor.classList.toggle('is-gratis', sub > 0 && frete === 0);
    // Linha de desconto do cupom percentual
    const mostraDesconto = desconto > 0;
    if (mostraDesconto && el.linhaDesconto.hidden && pintado) {
      el.linhaDesconto.classList.remove('is-novo');
      void el.linhaDesconto.offsetWidth;
      el.linhaDesconto.classList.add('is-novo');
    }
    el.linhaDesconto.hidden = !mostraDesconto;
    if (mostraDesconto) {
      el.descontoCupom.textContent = estado.cupom;
      el.desconto.textContent = '− ' + formatar(desconto);
    }

    // Barra de frete grátis (o caminhãozinho anda junto)
    const progresso = cupomFrete ? 1 : Math.min(1, sub / FRETE_GRATIS);
    el.freteBarra.style.transform = `scaleX(${progresso.toFixed(4)})`;
    // calc mantém o caminhão (28 px) sempre dentro do trilho
    el.freteCaminhao.style.left = `calc(${progresso.toFixed(4)} * (100% - 28px) + 14px)`;
    const gratis = sub > 0 && falta === 0;
    const eraGratis = el.frete.classList.contains('is-gratis');
    el.frete.classList.toggle('is-gratis', gratis);
    if (gratis && !eraGratis && pintado) brilharFrete();
    el.freteTexto.innerHTML = sub === 0
      ? `Frete grátis em compras acima de <strong>${formatar(FRETE_GRATIS)}</strong>`
      : cupomFrete
        ? 'Cupom aplicado: <strong>frete grátis</strong> garantido'
        : falta > 0
          ? `Faltam <strong>${formatar(falta)}</strong> para frete grátis`
          : 'Oba! Você ganhou <strong>frete grátis</strong>';

    el.qtdTitulo.textContent = n ? `(${plural(n, 'item', 'itens')})` : '';
    el.finalizar.setAttribute('aria-disabled', String(n === 0));
    el.carrinhoBtn.setAttribute('aria-label', n ? `Abrir carrinho, ${plural(n, 'item', 'itens')}` : 'Abrir carrinho, vazio');
  }

  /* =========================================================
     ATUALIZAÇÃO GERAL
     ========================================================= */
  let voosPendentes = 0;
  function atualizarTudo({ animarLista = true, adiarBadge = false, pular = false } = {}) {
    salvar();
    catalogo.forEach((_, id) => atualizarCartao(id));
    sincronizarLista(animarLista);
    atualizarResumo();
    // Se algo está voando, o badge só muda quando o produto "chega"
    if (!adiarBadge && voosPendentes === 0) atualizarBadge(el.badge, totalItens(), pular);
  }

  /* =========================================================
     AÇÕES DO CARRINHO
     ========================================================= */
  function adicionar(id, comVoo, botao) {
    // INTEGRAÇÃO: confirme o estoque no servidor; 409/422 = sem estoque → avisarSemEstoque().
    if (qtdDe(id) >= catalogo.get(id).estoque) { avisarSemEstoque(id, botao); return; }
    const item = itemDe(id);
    if (item) item.qtd = Math.min(catalogo.get(id).estoque, item.qtd + 1);
    else estado.itens.push({ id, qtd: 1 });
    const produto = catalogo.get(id);
    anunciar(`${produto.nome} adicionado. ${plural(totalItens(), 'item', 'itens')} no carrinho.`);

    if (!comVoo || semMovimento()) {
      atualizarTudo({ pular: true });
      if (comVoo) balancarCarrinho();
      return;
    }
    voosPendentes++;
    atualizarTudo({ adiarBadge: true });
    voar(produto.arte).then(() => {
      voosPendentes = Math.max(0, voosPendentes - 1);
      balancarCarrinho();
      atualizarBadge(el.badge, totalItens(), true);
    });
  }

  /** Clique em "Adicionar": vira "✓ Adicionado" e depois o controle − 1 +. */
  function clicarAdicionar(id) {
    const acao = catalogo.get(id).cartao.querySelector('.ca-acao');
    clearTimeout(temporizadores.get(id));
    acao.dataset.estado = 'adicionado';
    adicionar(id, true);
    temporizadores.set(id, setTimeout(() => {
      if (qtdDe(id) > 0) definirEstadoCartao(id, 'qtd');
    }, semMovimento() ? 400 : TEMPO_ADICIONADO));
  }

  function diminuir(id) {
    const item = itemDe(id);
    if (!item) return;
    if (item.qtd <= 1) { remover(id); return; }
    item.qtd -= 1;
    atualizarTudo();
    anunciar(`${catalogo.get(id).nome}: ${plural(item.qtd, 'unidade', 'unidades')}.`);
  }

  let desfazerDados = null;
  function remover(id) {
    const indice = estado.itens.findIndex((i) => i.id === id);
    if (indice < 0) return;
    const [item] = estado.itens.splice(indice, 1);
    desfazerDados = { item, indice };

    const li = linhaDe(id);
    if (li) {
      // Se o foco estava na linha, passa para a vizinha (ou para o botão fechar)
      if (li.contains(document.activeElement)) {
        const linhas = [...el.lista.querySelectorAll('.ca-linha:not(.is-saindo)')];
        const pos = linhas.indexOf(li);
        const vizinha = linhas[pos + 1] || linhas[pos - 1];
        (vizinha ? vizinha.querySelector('.ca-remover') : el.fechar).focus({ preventScroll: true });
      }
      recolher(li);
    }
    atualizarTudo();
    const nome = catalogo.get(id).nome;
    mostrarToast(`${nome} removido`);
    anunciar(`${nome} removido do carrinho. Botão Desfazer disponível.`);
  }

  function desfazer() {
    if (!desfazerDados) return;
    const { item, indice } = desfazerDados;
    desfazerDados = null;
    const existente = itemDe(item.id);
    if (existente) existente.qtd = Math.min(catalogo.get(item.id).estoque, existente.qtd + item.qtd);
    else estado.itens.splice(Math.min(indice, estado.itens.length), 0, item);
    const tinhaFoco = el.toast.contains(document.activeElement);
    esconderToast();
    atualizarTudo({ pular: true });
    anunciar(`${catalogo.get(item.id).nome} voltou para o carrinho.`);
    // Devolve o foco para algo útil (o botão do toast vai sumir)
    if (tinhaFoco) {
      const li = linhaDe(item.id);
      const alvo = gavetaAberta && li ? li.querySelector('.ca-remover') : catalogo.get(item.id).cartao.querySelector('[data-acao="mais"]');
      if (alvo) alvo.focus({ preventScroll: true });
    }
  }

  /* ---------- Toast "Desfazer" (pausa com mouse em cima ou foco) ---------- */
  let tempoToast = 0;
  let restanteToast = 0;
  let inicioToast = 0;

  /** No celular, com a gaveta aberta, o toast fica logo acima do rodapé (não cobre o Finalizar). */
  const rodapeGaveta = $('.ca-gaveta__rodape');
  function posicionarToast() {
    const sobreGaveta = gavetaAberta && window.innerWidth <= 640;
    el.toast.style.bottom = sobreGaveta ? (rodapeGaveta.offsetHeight + 12) + 'px' : '';
  }

  function mostrarToast(texto) {
    posicionarToast();
    el.toastTexto.textContent = texto;
    el.toast.style.setProperty('--ca-tempo-toast', TEMPO_TOAST + 'ms');
    el.toast.classList.remove('is-visivel', 'is-pausado');
    void el.toast.offsetWidth; // reinicia a barrinha de tempo
    el.toast.classList.add('is-visivel');
    restanteToast = TEMPO_TOAST;
    inicioToast = performance.now();
    clearTimeout(tempoToast);
    tempoToast = setTimeout(esconderToast, restanteToast);
  }
  function esconderToast() {
    clearTimeout(tempoToast);
    if (el.toast.contains(document.activeElement)) (gavetaAberta ? el.fechar : el.carrinhoBtn).focus({ preventScroll: true });
    el.toast.classList.remove('is-visivel', 'is-pausado');
    desfazerDados = null;
  }
  function pausarToast() {
    if (!el.toast.classList.contains('is-visivel') || el.toast.classList.contains('is-pausado')) return;
    clearTimeout(tempoToast);
    restanteToast -= performance.now() - inicioToast;
    el.toast.classList.add('is-pausado');
  }
  function retomarToast() {
    if (!el.toast.classList.contains('is-pausado')) return;
    if (el.toast.matches(':hover') || el.toast.contains(document.activeElement)) return;
    el.toast.classList.remove('is-pausado');
    inicioToast = performance.now();
    tempoToast = setTimeout(esconderToast, Math.max(800, restanteToast));
  }
  el.toastDesfazer.addEventListener('click', desfazer);
  el.toast.addEventListener('mouseenter', pausarToast);
  el.toast.addEventListener('focusin', pausarToast);
  el.toast.addEventListener('mouseleave', retomarToast);
  el.toast.addEventListener('focusout', () => setTimeout(retomarToast, 0));

  /* ---------- Favoritos ---------- */
  function atualizarFavoritos(pular) {
    const n = estado.favoritos.length;
    atualizarBadge(el.favBadge, n, pular);
    el.favTopo.setAttribute('aria-label', n ? `Ver favoritos (${n})` : 'Ver favoritos');
    cartoes.forEach((cartao) => {
      cartao.querySelector('.ca-fav').setAttribute('aria-pressed', String(estado.favoritos.includes(cartao.dataset.id)));
    });
  }

  function alternarFavorito(id, botao) {
    const indice = estado.favoritos.indexOf(id);
    const favoritou = indice < 0;
    if (favoritou) estado.favoritos.push(id);
    else estado.favoritos.splice(indice, 1);
    salvar();
    atualizarFavoritos(favoritou);
    if (favoritou) explodir(botao);
    const nome = catalogo.get(id).nome;
    anunciar(favoritou ? `${nome} salvo nos favoritos.` : `${nome} removido dos favoritos.`);
    // Na vista "Favoritos", o cartão desfavoritado sai da grade
    if (!favoritou && filtroAtual === 'favoritos') {
      aplicarFiltro('favoritos', false);
      const chip = el.filtros.find((c) => c.dataset.filtro === 'favoritos');
      if (chip) chip.focus({ preventScroll: true });
    }
  }

  /* ---------- Filtros ---------- */
  let filtroAtual = 'todos';
  function aplicarFiltro(filtro, animar) {
    filtroAtual = filtro;
    el.filtros.forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.filtro === filtro)));
    let visiveis = 0;
    cartoes.forEach((cartao) => {
      const mostra = filtro === 'todos'
        || (filtro === 'favoritos' ? estado.favoritos.includes(cartao.dataset.id) : cartao.dataset.categoria === filtro);
      cartao.hidden = !mostra;
      if (!mostra) return;
      visiveis++;
      if (animar && !semMovimento() && cartao.animate) {
        cartao.animate(
          [{ opacity: 0, transform: 'translateY(14px) scale(.98)' }, { opacity: 1, transform: 'none' }],
          { duration: 480, delay: visiveis * 45, easing: SUAVE, fill: 'backwards' }
        );
      }
    });
    el.gradeVazio.hidden = visiveis > 0;
  }

  /* =========================================================
     GAVETA: abrir, fechar, foco preso e Esc
     ========================================================= */
  let gavetaAberta = false;
  let focoAntes = null;

  function abrirGaveta() {
    if (gavetaAberta) return;
    gavetaAberta = true;
    focoAntes = document.activeElement;
    el.gaveta.removeAttribute('inert');
    el.gaveta.classList.add('is-aberta');
    el.fundo.classList.add('is-aberta');
    document.documentElement.classList.add('ca-travado');
    el.carrinhoBtn.setAttribute('aria-expanded', 'true');
    posicionarToast();
    requestAnimationFrame(() => el.fechar.focus({ preventScroll: true }));
  }

  function fecharGaveta() {
    if (!gavetaAberta) return;
    gavetaAberta = false;
    el.gaveta.classList.remove('is-aberta');
    el.fundo.classList.remove('is-aberta');
    el.gaveta.setAttribute('inert', '');
    document.documentElement.classList.remove('ca-travado');
    el.carrinhoBtn.setAttribute('aria-expanded', 'false');
    posicionarToast();
    const volta = focoAntes && document.contains(focoAntes) && focoAntes !== document.body ? focoAntes : el.carrinhoBtn;
    volta.focus({ preventScroll: true });
  }

  function focaveisDaGaveta() {
    const lista = [...el.gaveta.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')]
      .filter((n) => !n.disabled && n.offsetParent !== null && !n.closest('[inert]'));
    if (el.toast.classList.contains('is-visivel')) lista.push(el.toastDesfazer);
    return lista;
  }

  document.addEventListener('keydown', (e) => {
    if (!gavetaAberta) return;
    if (e.key === 'Escape') { e.preventDefault(); fecharGaveta(); return; }
    if (e.key !== 'Tab') return;
    const focaveis = focaveisDaGaveta();
    if (!focaveis.length) return;
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (!focaveis.includes(document.activeElement)) { e.preventDefault(); primeiro.focus(); return; }
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  });

  /* ---------- Finalizar com estado de carregamento ---------- */
  let finalizando = false;

  /** APROVADO (pedido): serpentinas coloridas sobem do botão e caem (≈ 1,3 s). */
  const CORES_SERPENTINA = ['#ff5c28', '#1fa36b', '#ffb020', '#ff3d6e', '#2b5fd9'];
  function soltarSerpentinas(origem) {
    if (semMovimento() || !document.body.animate) return;
    const r = origem.getBoundingClientRect();
    for (let i = 0; i < 26; i++) {
      const s = document.createElement('span');
      s.className = 'ca-serpentina';
      s.setAttribute('aria-hidden', 'true');
      s.style.background = CORES_SERPENTINA[i % CORES_SERPENTINA.length];
      s.style.left = (r.left + r.width * (0.12 + Math.random() * 0.76)) + 'px';
      s.style.top = (r.top + 4) + 'px';
      document.body.appendChild(s);
      const dx = (Math.random() - 0.5) * 240;
      const alto = 90 + Math.random() * 150;
      const giro = (Math.random() - 0.5) * 900;
      s.animate(
        [
          { transform: 'translate(0, 0) rotate(0deg) scaleY(.4)', opacity: 1 },
          { transform: `translate(${(dx * 0.7).toFixed(1)}px, ${(-alto).toFixed(1)}px) rotate(${(giro * 0.6).toFixed(0)}deg) scaleY(1)`, opacity: 1, offset: 0.45, easing: 'cubic-bezier(.3, 0, .7, 1)' },
          { transform: `translate(${dx.toFixed(1)}px, ${(-alto + 80).toFixed(1)}px) rotate(${giro.toFixed(0)}deg) scaleY(.7)`, opacity: 0 },
        ],
        { duration: 1100 + Math.random() * 300, delay: Math.random() * 120, easing: 'cubic-bezier(.15, .8, .3, 1)', fill: 'backwards' }
      ).onfinish = () => s.remove();
    }
  }

  /** Simula o envio do pedido. INTEGRAÇÃO: troque por fetch('/api/pedidos', …) e
      entregue { status } a tratarRespostaPedido() — 200 aprovado; 402/422 recusado
      (mostre o motivo); 409 sem estoque (chame avisarSemEstoque para o item). */
  function enviarPedido() {
    return new Promise((ok) => setTimeout(() => ok({ status: 200 }), 1800));
  }

  function tratarRespostaPedido(resposta) {
    el.finalizar.classList.remove('is-carregando');
    el.finalizar.removeAttribute('aria-busy');
    if (resposta.status !== 200) {
      el.finalizarTexto.textContent = 'Finalizar compra';
      finalizando = false;
      anunciar('Não foi possível finalizar o pedido. Tente de novo.');
      return;
    }
    el.finalizar.classList.add('is-sucesso');
    el.finalizarTexto.textContent = '✓ Pedido confirmado';
    anunciar('Pedido de demonstração confirmado.');
    soltarSerpentinas(el.finalizar);
    setTimeout(() => {
      el.finalizar.classList.remove('is-sucesso');
      el.finalizarTexto.textContent = 'Finalizar compra';
      finalizando = false;
    }, 2200);
  }

  el.finalizar.addEventListener('click', () => {
    if (finalizando || totalItens() === 0) return;
    finalizando = true;
    el.finalizar.classList.add('is-carregando');
    el.finalizar.setAttribute('aria-busy', 'true');
    el.finalizarTexto.textContent = 'Processando…';
    anunciar('Processando pedido…');
    enviarPedido().then(tratarRespostaPedido);
  });

  /* =========================================================
     CUPOM: aplicado · inválido · trancado
     ========================================================= */
  const cp = {
    form: $('.ca-cupom'),
    campo: $('.ca-cupom__campo'),
    entrada: $('#ca-cupom-codigo'),
    aplicar: $('.ca-cupom__aplicar'),
    linha: $('.ca-cupom__linha'),
    ticket: $('.ca-ticket'),
    msg: $('#ca-cupom-msg'),
    trava: $('.ca-cupom__trava'),
    travaTitulo: $('.ca-cupom__trava-titulo'),
    travaRotulo: $('.ca-cupom__trava-rotulo'),
    tempo: $('.ca-cupom__tempo'),
    exemplos: [...document.querySelectorAll('.ca-cupom__exemplo')],
    metades: [...document.querySelectorAll('.ca-etiqueta__metade')],
  };
  const travaCupom = { falhas: 0, trancado: false, ocupado: false, fim: 0, timer: 0 };

  function mensagemCupom(texto, tipo) {
    cp.msg.textContent = texto;
    cp.msg.className = 'ca-cupom__msg' + (tipo ? ' is-' + tipo : '');
  }

  /** Simula a validação do cupom no servidor e devolve { status, motivo, retryAfter }. */
  function validarCupomNoServidor(codigo) {
    return new Promise((ok) => setTimeout(() => {
      const c = CUPONS[codigo];
      if (!c) ok({ status: 422, motivo: `O cupom ${codigo} não existe.` });
      else if (!cupomValido(codigo)) ok({ status: 422, motivo: `O cupom ${codigo} expirou em ${dataBR(c.validoAte)}.` });
      else ok({ status: 200 });
    }, 650));
  }

  /** Traduz a resposta do cupom nos três estados da interface.
   *
   *  INTEGRAÇÃO — com o seu backend, troque validarCupomNoServidor() por:
   *
   *    const r = await fetch('/api/cupons/validar', {
   *      method: 'POST',
   *      headers: { 'Content-Type': 'application/json' },
   *      body: JSON.stringify({ codigo, itens: estado.itens }),
   *    });
   *    const corpo = await r.json().catch(() => ({}));
   *    tratarRespostaCupom({ status: r.status, motivo: corpo.mensagem,
   *                          retryAfter: Number(r.headers.get('Retry-After')) }, codigo);
   *
   *  200        → APROVADO: o campo vira um ticket carimbado (e o servidor devolve o desconto).
   *  422 / 404  → ERRO: cupom inválido ou expirado — a etiqueta se rasga; mostra tentativas restantes.
   *  429 / 423  → BLOQUEADO: muitas tentativas — corrente + cadeado pelo tempo de Retry-After (s).
   *  Quem decide o bloqueio é o servidor; o contador do navegador é só experiência.
   */
  function tratarRespostaCupom(resposta, codigo) {
    if (resposta.status === 200) { aplicarCupom(codigo); return; }
    if (resposta.status === 429 || resposta.status === 423) {
      trancarCupom(resposta.retryAfter || BLOQUEIO_SEGUNDOS, 0);
      return;
    }
    cupomRecusado(codigo, resposta.motivo || 'Cupom inválido.');
  }

  /** Mostra o ticket do cupom aplicado (animado ou não). */
  function mostrarTicket(animar) {
    const c = CUPONS[estado.cupom];
    cp.ticket.querySelector('.ca-ticket__codigo').textContent = estado.cupom;
    cp.ticket.querySelector('.ca-ticket__rotulo').textContent = c.rotulo;
    cp.ticket.querySelector('.ca-ticket__valor').textContent = c.tipo === 'percentual' ? `−${c.valor}%` : 'Grátis';
    cp.linha.hidden = true;
    cp.ticket.hidden = false;
    cp.ticket.classList.remove('is-novo', 'is-saindo');
    if (animar && !semMovimento()) { void cp.ticket.offsetWidth; cp.ticket.classList.add('is-novo'); }
  }

  /** APROVADO: ticket carimbado + desconto entrando + total recontado. */
  function aplicarCupom(codigo) {
    travaCupom.falhas = 0; // um acerto zera o contador
    estado.cupom = codigo;
    cp.entrada.value = '';
    cp.entrada.removeAttribute('aria-invalid');
    const tinhaFoco = cp.form.contains(document.activeElement);
    mostrarTicket(true);
    atualizarTudo();
    if (CUPONS[codigo].tipo === 'frete') brilharFrete();
    mensagemCupom(`Cupom aplicado: ${CUPONS[codigo].rotulo}.`, 'ok');
    if (tinhaFoco) cp.ticket.querySelector('.ca-ticket__remover').focus({ preventScroll: true });
  }

  function removerCupom() {
    if (!estado.cupom) return;
    estado.cupom = null;
    atualizarTudo();
    mensagemCupom('Cupom removido.', '');
    const voltar = () => {
      cp.ticket.hidden = true;
      cp.ticket.classList.remove('is-saindo', 'is-novo');
      cp.linha.hidden = false;
      cp.entrada.focus({ preventScroll: true });
    };
    if (semMovimento()) { voltar(); return; }
    cp.ticket.classList.add('is-saindo');
    setTimeout(voltar, 330);
  }

  /** ERRO: a etiqueta com o código se rasga e cai; mostra quantas tentativas restam. */
  function cupomRecusado(codigo, motivo) {
    travaCupom.falhas += 1;
    const restam = TENTATIVAS_CUPOM - travaCupom.falhas;
    cp.metades.forEach((m) => { m.textContent = codigo; });
    if (!semMovimento()) {
      cp.campo.classList.remove('is-rasgando');
      void cp.campo.offsetWidth;
      cp.campo.classList.add('is-rasgando');
      setTimeout(() => cp.campo.classList.remove('is-rasgando'), 950);
    }
    cp.entrada.setAttribute('aria-invalid', 'true');
    if (restam <= 0) { trancarCupom(BLOQUEIO_SEGUNDOS, semMovimento() ? 0 : 700); return; }
    mensagemCupom(`${motivo} Você tem ${restam === 1 ? '1 tentativa' : restam + ' tentativas'}.`, 'erro');
    cp.entrada.focus({ preventScroll: true });
    cp.entrada.select();
  }

  function controlesCupom(ligado) {
    [cp.entrada, cp.aplicar, ...cp.exemplos].forEach((c) => { c.disabled = !ligado; });
  }

  const contagem = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  /** BLOQUEADO: corrente atravessa o campo, o cadeado cai e a contagem começa. */
  function trancarCupom(segundos, atraso) {
    clearInterval(travaCupom.timer);
    travaCupom.trancado = true;
    travaCupom.total = Math.max(1, Math.round(segundos));
    travaCupom.fim = Date.now() + travaCupom.total * 1000 + atraso;
    const tinhaFoco = cp.form.contains(document.activeElement) || document.activeElement === document.body;
    controlesCupom(false); // inacessível na hora, mesmo antes da animação
    mensagemCupom('', '');
    cp.trava.classList.remove('is-liberado');
    cp.travaTitulo.textContent = 'Muitas tentativas de cupom';
    cp.travaRotulo.textContent = 'Tente de novo em';
    cp.tempo.textContent = contagem(travaCupom.total);
    setTimeout(() => {
      cp.campo.classList.remove('is-rasgando', 'is-liberando', 'is-liberado');
      cp.campo.classList.add('is-trancado');
      cp.trava.hidden = false;
      if (tinhaFoco) cp.trava.focus({ preventScroll: true });
      tiqueCupom();
      travaCupom.timer = setInterval(tiqueCupom, 1000);
    }, atraso);
    anunciar(`Muitas tentativas de cupom. O campo foi trancado por ${travaCupom.total} segundos.`);
  }

  function tiqueCupom() {
    const resta = Math.max(0, Math.ceil((travaCupom.fim - Date.now()) / 1000));
    cp.tempo.textContent = contagem(resta);
    if (resta === 0) liberarCupom();
  }

  /** LIBERAÇÃO: a alça abre, o cadeado cai, a corrente escorrega e o campo volta. */
  function liberarCupom() {
    clearInterval(travaCupom.timer);
    travaCupom.falhas = 0;
    cp.trava.classList.add('is-liberado');
    cp.travaTitulo.textContent = 'Cupom liberado';
    cp.travaRotulo.textContent = 'Pode tentar de novo';
    cp.tempo.textContent = '✓';
    const terminar = () => {
      const focoNaTrava = cp.trava.contains(document.activeElement) || document.activeElement === document.body;
      travaCupom.trancado = false;
      cp.campo.classList.remove('is-trancado', 'is-liberando');
      cp.trava.hidden = true;
      cp.entrada.value = '';
      cp.entrada.removeAttribute('aria-invalid');
      controlesCupom(true);
      mensagemCupom('Campo de cupom liberado. Pode tentar de novo.', '');
      anunciar('Campo de cupom liberado.');
      if (!semMovimento()) {
        cp.campo.classList.add('is-liberado');
        setTimeout(() => cp.campo.classList.remove('is-liberado'), 1000);
      }
      if (focoNaTrava && gavetaAberta) cp.entrada.focus({ preventScroll: true });
    };
    if (semMovimento()) { terminar(); return; }
    cp.campo.classList.add('is-liberando');
    setTimeout(terminar, 1000);
  }

  cp.form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (travaCupom.trancado || travaCupom.ocupado) return;
    const codigo = cp.entrada.value.trim().toUpperCase().replace(/\s+/g, '');
    if (!codigo) { mensagemCupom('Digite o código do cupom.', 'erro'); cp.entrada.focus(); return; }
    if (totalItens() === 0) { mensagemCupom('Adicione um produto antes de usar o cupom.', 'erro'); return; }
    travaCupom.ocupado = true;
    cp.aplicar.classList.add('is-carregando');
    cp.aplicar.setAttribute('aria-busy', 'true');
    validarCupomNoServidor(codigo).then((resposta) => {
      travaCupom.ocupado = false;
      cp.aplicar.classList.remove('is-carregando');
      cp.aplicar.removeAttribute('aria-busy');
      tratarRespostaCupom(resposta, codigo);
    });
  });
  cp.entrada.addEventListener('input', () => {
    if (cp.entrada.getAttribute('aria-invalid') === 'true') { cp.entrada.removeAttribute('aria-invalid'); mensagemCupom('', ''); }
  });
  cp.exemplos.forEach((b) => b.addEventListener('click', () => {
    if (travaCupom.trancado) return;
    if (estado.cupom) removerCupomSemAnimar();
    cp.entrada.value = b.dataset.cupom;
    cp.entrada.removeAttribute('aria-invalid');
    if (cp.form.requestSubmit) cp.form.requestSubmit();
    else cp.form.dispatchEvent(new Event('submit', { cancelable: true }));
  }));
  /** Troca de cupom pelos atalhos de teste: tira o atual sem animação. */
  function removerCupomSemAnimar() {
    estado.cupom = null;
    cp.ticket.hidden = true;
    cp.linha.hidden = false;
    atualizarTudo();
  }
  cp.ticket.querySelector('.ca-ticket__remover').addEventListener('click', removerCupom);
  document.querySelector('.ca-cupom__suporte').addEventListener('click', (e) => e.preventDefault());

  /** Deixa o cupom da interface igual ao estado (primeira pintura e outras abas). */
  function sincronizarCupom() {
    if (estado.cupom) mostrarTicket(false);
    else { cp.ticket.hidden = true; cp.linha.hidden = false; }
  }

  /* =========================================================
     EVENTOS
     ========================================================= */
  // Cartões (delegação: um único ouvinte para a grade toda)
  el.grade.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-acao]');
    const cartao = botao && botao.closest('.ca-produto');
    if (!cartao) return;
    const id = cartao.dataset.id;
    switch (botao.dataset.acao) {
      case 'adicionar': clicarAdicionar(id); break;
      case 'mais': adicionar(id, true, botao); break;
      case 'menos': diminuir(id); break;
      case 'favoritar': alternarFavorito(id, botao); break;
      default: break;
    }
  });

  // Linhas da gaveta
  el.lista.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-acao]');
    const li = botao && botao.closest('.ca-linha');
    if (!li || li.classList.contains('is-saindo')) return;
    const id = li.dataset.linha;
    if (botao.dataset.acao === 'mais') { adicionar(id, false, botao); }
    else if (botao.dataset.acao === 'menos') diminuir(id);
    else if (botao.dataset.acao === 'remover') remover(id);
  });

  el.carrinhoBtn.addEventListener('click', abrirGaveta);
  document.querySelectorAll('[data-fechar]').forEach((n) => n.addEventListener('click', fecharGaveta));

  el.filtros.forEach((chip) => chip.addEventListener('click', () => aplicarFiltro(chip.dataset.filtro, true)));
  el.favTopo.addEventListener('click', () => {
    aplicarFiltro('favoritos', true);
    el.grade.scrollIntoView({ behavior: semMovimento() ? 'auto' : 'smooth', block: 'center' });
  });

  // Mantém várias abas abertas em sincronia
  window.addEventListener('storage', (e) => {
    if (e.key !== CHAVE) return;
    estado = carregar();
    atualizarTudo({ animarLista: false });
    atualizarFavoritos(false);
    sincronizarCupom();
  });

  /* ---------- Primeira pintura (sem animação) ---------- */
  catalogo.forEach((produto, id) => {
    const acao = produto.cartao.querySelector('.ca-acao');
    const q = qtdDe(id);
    if (q > 0) acao.dataset.estado = 'qtd';
    rolar(acao.querySelector('.ca-qtd__n'), q || 1);
  });
  atualizarTudo({ animarLista: false });
  atualizarFavoritos(false);
  sincronizarCupom();
  pintado = true;
})();
