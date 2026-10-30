/* =====================================================================
   LOGIN LUMINÁRIA — script.js
   1) Liga/desliga a luz (clique, arraste da cabeça, botão do painel)
   2) Mira a cabeça da luminária no cartão e desenha o feixe em SVG
   3) Troca o tom da luz
   4) Formulário: mostrar senha, validação acessível, carregando → sucesso
   5) Estados de validação: aprovado (a sala acende), erro (mau contato)
      e bloqueado (a luz se apaga e um cadeado tranca o cartão)
   Sem dependências. Funciona abrindo o arquivo direto (file://).
   ===================================================================== */
(function () {
  'use strict';

  /* =================================================================
     INTEGRAÇÃO E SEGURANÇA (troque aqui pelo seu backend)
     ================================================================= */
  var TENTATIVAS_MAX = 3;       // erros seguidos até travar o formulário
  var BLOQUEIO_SEGUNDOS = 30;   // duração da trava, em segundos

  // Conta de demonstração (aparece na dica do cartão). Remova ao publicar.
  var DEMO = { email: 'ana@atelie.com', senha: 'abajur' };

  /**
   * autenticar(dados) → Promise com UM dos três estados:
   *   { estado: 'aprovado' }                    credenciais certas
   *   { estado: 'erro', restantes: n }          senha errada (restantes é opcional)
   *   { estado: 'bloqueado', segundos: n }      conta travada por um tempo
   * Rejeitar a Promise mostra uma falha genérica (rede caiu etc.).
   *
   * Para ligar ao seu backend, troque o corpo por algo assim:
   *
   *   return fetch('/api/login', {
   *     method: 'POST',
   *     headers: { 'Content-Type': 'application/json' },
   *     body: JSON.stringify(dados)                       // { email, senha, lembrar }
   *   }).then(function (r) {
   *     if (r.status === 200) return { estado: 'aprovado' };                // 200 → aprovado
   *     if (r.status === 401) return r.json().catch(function () { return {}; })
   *       .then(function (c) { return { estado: 'erro', restantes: c.tentativasRestantes }; }); // 401 → erro
   *     if (r.status === 423 || r.status === 429)                          // 423/429 → bloqueado
   *       return { estado: 'bloqueado', segundos: lerRetryAfter(r.headers.get('Retry-After')) };
   *     throw new Error('Falha no servidor');
   *   });
   */
  function autenticar(dados) {
    return new Promise(function (ok) {
      window.setTimeout(function () {
        var certo = dados.email.toLowerCase() === DEMO.email && dados.senha === DEMO.senha;
        ok(certo ? { estado: 'aprovado' } : { estado: 'erro' });
      }, reduzido ? 600 : 1400);
    });
  }

  // Converte o cabeçalho Retry-After (segundos ou data HTTP) em segundos
  function lerRetryAfter(valor) {
    var n = Number(valor);
    if (isFinite(n) && n > 0) return Math.ceil(n);
    var data = Date.parse(valor);
    if (!isNaN(data)) return Math.max(1, Math.ceil((data - Date.now()) / 1000));
    return BLOQUEIO_SEGUNDOS;
  }

  /* ---------- Referências ---------- */
  var cena = document.getElementById('ll-cena');
  var palco = document.getElementById('ll-palco');
  var cartao = document.getElementById('ll-cartao');
  var luminaria = document.getElementById('ll-luminaria');
  var lampSvg = luminaria.querySelector('svg');
  var cabeca = document.getElementById('ll-cabeca');
  var junta = document.getElementById('ll-junta');
  var feixe = document.getElementById('ll-feixe');
  var cone = document.getElementById('ll-cone');
  var nucleo = document.getElementById('ll-nucleo');
  var poca = document.getElementById('ll-poca');
  var halo = document.getElementById('ll-halo');
  var gradFeixe = document.getElementById('ll-grad-feixe');
  var gradMascara = document.getElementById('ll-grad-mascara');
  var interruptor = document.getElementById('ll-interruptor');
  var textoInterruptor = interruptor.querySelector('.ll-interruptor-texto');
  var anuncio = document.getElementById('ll-anuncio');

  var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Constantes de desenho ---------- */
  var VIEWBOX_W = 420;         // largura do viewBox da luminária
  var JUNTA_X = 330, JUNTA_Y = 62;
  var DIST_BOCA = 60;          // distância da articulação até a boca da cúpula (unid. SVG)
  var RAIO_BOCA = 27;          // meia-abertura da boca (unid. SVG)
  var ABERTURA = 26 * Math.PI / 180; // meia-abertura do cone de luz

  /* ---------- Estado ---------- */
  var acesa = false;
  var anguloBase = 45;         // ângulo de repouso (mirando o cartão)
  var desvio = 0;              // desvio extra causado pelo arraste (graus)
  var velocidade = 0;          // velocidade da mola
  var animandoMola = false;
  var aberturaExtra = 0;       // 0 = cone normal; > 0 abre o cone (comemoração)
  var travado = false;         // true durante o bloqueio por tentativas

  /* =================================================================
     LUZ: acender / apagar
     ================================================================= */
  function definirLuz(ligar, silencioso) {
    acesa = !!ligar;
    cena.setAttribute('data-luz', acesa ? 'acesa' : 'apagada');
    textoInterruptor.textContent = acesa ? 'Apagar a luz' : 'Acender a luz';
    // No escuro o formulário fica fora do alcance do teclado e do leitor de tela
    if (acesa) cartao.removeAttribute('inert');
    else cartao.setAttribute('inert', '');
    if (!silencioso) anunciar(acesa ? 'Luz acesa. Formulário de login disponível.' : 'Luz apagada.');
  }
  function alternarLuz() { if (!travado) definirLuz(!acesa); }

  function anunciar(msg) {
    anuncio.textContent = '';
    // pequeno atraso garante que leitores de tela leiam a mudança
    window.setTimeout(function () { anuncio.textContent = msg; }, 40);
  }

  interruptor.addEventListener('click', alternarLuz);

  /* =================================================================
     GEOMETRIA: mira a cabeça e desenha o feixe
     ================================================================= */
  function centro(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function aplicarCabeca() {
    var ang = anguloBase + desvio;
    cabeca.setAttribute('transform', 'translate(' + JUNTA_X + ' ' + JUNTA_Y + ') rotate(' + ang.toFixed(2) + ')');
    return ang;
  }

  // Calcula o ângulo de repouso para a luz cair no meio do cartão
  function mirar() {
    var rc = cena.getBoundingClientRect();
    var j = centro(junta);
    var rk = cartao.getBoundingClientRect();
    var alvoX = rk.left + rk.width * 0.5;
    var alvoY = rk.top + rk.height * 0.48;
    var ang = Math.atan2(alvoY - j.y, alvoX - j.x) * 180 / Math.PI;
    anguloBase = Math.max(10, Math.min(88, ang));
    // Centro e raio do "buraco" na escuridão (máscara radial)
    cena.style.setProperty('--ll-fx', (alvoX - rc.left).toFixed(1) + 'px');
    cena.style.setProperty('--ll-fy', (alvoY - rc.top).toFixed(1) + 'px');
    cena.style.setProperty('--ll-raio-luz', Math.round(Math.max(rk.width, rk.height) * 1.25) + 'px');
  }

  // Desenha o cone de luz a partir da boca da cúpula
  function desenharFeixe() {
    var rc = cena.getBoundingClientRect();
    var W = rc.width, H = rc.height;
    feixe.setAttribute('viewBox', '0 0 ' + W.toFixed(0) + ' ' + H.toFixed(0));

    var ang = aplicarCabeca() * Math.PI / 180;
    var escala = lampSvg.getBoundingClientRect().width / VIEWBOX_W;
    var j = centro(junta);
    var jx = j.x - rc.left, jy = j.y - rc.top;
    var dx = Math.cos(ang), dy = Math.sin(ang);   // direção do eixo
    var nx = -dy, ny = dx;                         // normal

    // Boca da cúpula (origem do feixe)
    var ex = jx + dx * DIST_BOCA * escala;
    var ey = jy + dy * DIST_BOCA * escala;
    var meia = RAIO_BOCA * escala;

    // Comprimento: passa do cartão e chega ao tampo da mesa
    var rk = cartao.getBoundingClientRect();
    var ck = { x: rk.left + rk.width / 2 - rc.left, y: rk.top + rk.height / 2 - rc.top };
    var dist = Math.hypot(ck.x - ex, ck.y - ey);
    var L = Math.max(dist * 1.9, rk.height * 1.4) * (1 + aberturaExtra * 0.25);
    var abre = L * Math.tan(ABERTURA * (1 + aberturaExtra)) + meia;

    function caminho(fator) {
      var a = abre * fator, m = meia * fator;
      var p1x = ex + nx * m, p1y = ey + ny * m;
      var p2x = ex - nx * m, p2y = ey - ny * m;
      var q1x = ex + dx * L + nx * a, q1y = ey + dy * L + ny * a;
      var q2x = ex + dx * L - nx * a, q2y = ey + dy * L - ny * a;
      var cx = ex + dx * L * 1.12, cy = ey + dy * L * 1.12; // ponta arredondada
      return 'M' + p1x.toFixed(1) + ' ' + p1y.toFixed(1) +
        'L' + q1x.toFixed(1) + ' ' + q1y.toFixed(1) +
        'Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + q2x.toFixed(1) + ' ' + q2y.toFixed(1) +
        'L' + p2x.toFixed(1) + ' ' + p2y.toFixed(1) + 'Z';
    }
    cone.setAttribute('d', caminho(1));
    nucleo.setAttribute('d', caminho(0.55));

    // Gradiente radial nasce na boca; máscara linear apaga a ponta do cone
    gradFeixe.setAttribute('cx', ex.toFixed(1));
    gradFeixe.setAttribute('cy', ey.toFixed(1));
    gradFeixe.setAttribute('r', L.toFixed(1));
    gradMascara.setAttribute('x1', ex.toFixed(1));
    gradMascara.setAttribute('y1', ey.toFixed(1));
    gradMascara.setAttribute('x2', (ex + dx * L * 1.1).toFixed(1));
    gradMascara.setAttribute('y2', (ey + dy * L * 1.1).toFixed(1));

    // Brilho junto à lâmpada
    halo.setAttribute('cx', ex.toFixed(1));
    halo.setAttribute('cy', ey.toFixed(1));
    halo.setAttribute('r', (70 * Math.max(escala, 0.6)).toFixed(1));

    // Poça de luz no tampo da mesa, logo abaixo do cartão
    var tampo = palco.getBoundingClientRect().bottom - rc.top;
    poca.setAttribute('cx', ck.x.toFixed(1));
    poca.setAttribute('cy', (tampo + 4).toFixed(1));
    poca.setAttribute('rx', (rk.width * 0.85).toFixed(1));
    poca.setAttribute('ry', '26');
  }

  function atualizarTudo() {
    mirar();
    desenharFeixe();
  }

  /* =================================================================
     ARRASTE DA CABEÇA (mouse e toque) com volta em mola
     ================================================================= */
  var LIMITE = 30;      // inclinação máxima (graus)
  var GATILHO = 14;     // a partir daqui, soltar alterna a luz
  var inicioY = 0, arrastou = false, segurando = false;

  function aoPressionar(e) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    segurando = true;
    arrastou = false;
    inicioY = e.clientY;
    animandoMola = false;
    velocidade = 0;
    luminaria.classList.add('ll-arrastando');
    window.addEventListener('pointermove', aoMover);
    window.addEventListener('pointerup', aoSoltar);
    window.addEventListener('pointercancel', aoSoltar);
  }

  function aoMover(e) {
    if (!segurando) return;
    var dy = e.clientY - inicioY;
    if (Math.abs(dy) > 4) arrastou = true;
    if (!arrastou) return;
    // Só puxa para baixo; resistência cresce perto do limite
    var bruto = Math.max(-4, dy * 0.32);
    desvio = bruto > 0 ? LIMITE * (1 - Math.exp(-bruto / LIMITE)) : bruto;
    desenharFeixe();
  }

  function aoSoltar() {
    if (!segurando) return;
    segurando = false;
    luminaria.classList.remove('ll-arrastando');
    window.removeEventListener('pointermove', aoMover);
    window.removeEventListener('pointerup', aoSoltar);
    window.removeEventListener('pointercancel', aoSoltar);
    // Clique simples OU puxão além do gatilho alternam a luz
    if (!arrastou || desvio >= GATILHO) alternarLuz();
    voltarComMola();
  }

  function voltarComMola() {
    if (reduzido) { desvio = 0; velocidade = 0; desenharFeixe(); return; }
    if (animandoMola) return;
    animandoMola = true;
    var anterior = performance.now();
    function passo(agora) {
      if (!animandoMola) return;
      var dt = Math.min(0.032, (agora - anterior) / 1000);
      anterior = agora;
      // Mola amortecida: aceleração = -k·x - c·v
      var acel = -260 * desvio - 11 * velocidade;
      velocidade += acel * dt;
      desvio += velocidade * dt;
      if (Math.abs(desvio) < 0.05 && Math.abs(velocidade) < 0.05) {
        desvio = 0; velocidade = 0; animandoMola = false;
      }
      desenharFeixe();
      if (animandoMola) window.requestAnimationFrame(passo);
    }
    window.requestAnimationFrame(passo);
  }

  luminaria.addEventListener('pointerdown', aoPressionar);

  /* =================================================================
     TOM DA LUZ (bolinhas)
     ================================================================= */
  var nomesTom = { quente: 'quente', neutra: 'neutra', fria: 'fria' };
  Array.prototype.forEach.call(document.querySelectorAll('.ll-tom'), function (botao) {
    botao.addEventListener('click', function () {
      var tom = botao.getAttribute('data-tom');
      cena.setAttribute('data-tom', tom);
      Array.prototype.forEach.call(document.querySelectorAll('.ll-tom'), function (b) {
        b.setAttribute('aria-pressed', b === botao ? 'true' : 'false');
      });
      if (!acesa) definirLuz(true, true);
      anunciar('Luz ' + nomesTom[tom] + ' selecionada.');
    });
  });

  /* =================================================================
     FORMULÁRIO
     ================================================================= */
  var form = document.getElementById('ll-form');
  var email = document.getElementById('ll-email');
  var senha = document.getElementById('ll-senha');
  var erroEmail = document.getElementById('ll-erro-email');
  var erroSenha = document.getElementById('ll-erro-senha');
  var olho = document.getElementById('ll-olho');
  var entrar = document.getElementById('ll-entrar');
  var conteudoForm = document.getElementById('ll-conteudo-form');
  var sucesso = document.getElementById('ll-sucesso');
  var sucessoTitulo = document.getElementById('ll-sucesso-titulo');
  var sucessoEmail = document.getElementById('ll-sucesso-email');
  var sair = document.getElementById('ll-sair');
  var nota = document.getElementById('ll-nota');
  var ocupado = false;

  // Mostrar / ocultar senha
  olho.addEventListener('click', function () {
    var mostrar = senha.type === 'password';
    senha.type = mostrar ? 'text' : 'password';
    olho.setAttribute('aria-pressed', String(mostrar));
    olho.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
  });

  // Regras de validação (retornam a mensagem de erro ou '')
  function validarEmail() {
    var v = email.value.trim();
    if (!v) return 'Informe seu e-mail.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Esse e-mail parece incompleto. Ex.: nome@dominio.com';
    return '';
  }
  function validarSenha() {
    var v = senha.value;
    if (!v) return 'Digite sua senha.';
    if (v.length < 6) return 'A senha tem pelo menos 6 caracteres.';
    return '';
  }
  function mostrarErro(campo, caixa, msg) {
    caixa.textContent = msg;
    if (msg) campo.setAttribute('aria-invalid', 'true');
    else campo.removeAttribute('aria-invalid');
  }

  // Valida ao sair do campo e corrige ao digitar (só depois do primeiro erro)
  [[email, erroEmail, validarEmail], [senha, erroSenha, validarSenha]].forEach(function (par) {
    par[0].addEventListener('blur', function () {
      if (par[0].value) mostrarErro(par[0], par[1], par[2]());
    });
    par[0].addEventListener('input', function () {
      if (par[0].getAttribute('aria-invalid') === 'true') mostrarErro(par[0], par[1], par[2]());
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (ocupado || travado) return;
    var me = validarEmail(), ms = validarSenha();
    mostrarErro(email, erroEmail, me);
    mostrarErro(senha, erroSenha, ms);
    if (me || ms) {
      (me ? email : senha).focus();
      anunciar('Revise o formulário: ' + (me || ms));
      return;
    }
    // Carregando…
    ocupado = true;
    entrar.classList.add('ll-carregando');
    entrar.setAttribute('aria-busy', 'true');
    entrar.querySelector('.ll-entrar-texto').textContent = 'Entrando…';
    anunciar('Entrando…');

    var dados = { email: email.value.trim(), senha: senha.value, lembrar: form.elements.lembrar.checked };
    autenticar(dados).then(function (r) {
      entrar.classList.remove('ll-carregando');
      entrar.removeAttribute('aria-busy');
      if (r && r.estado === 'aprovado') return aprovado();
      voltarBotao();
      if (r && r.estado === 'bloqueado') return bloquear(r.segundos);
      errou(r && r.restantes);
    }).catch(function () {
      entrar.classList.remove('ll-carregando');
      entrar.removeAttribute('aria-busy');
      voltarBotao();
      mostrarErro(senha, erroSenha, 'Não foi possível entrar agora. Tente de novo.');
      anunciar('Não foi possível entrar agora. Tente de novo.');
    });
  });

  function voltarBotao() {
    ocupado = false;
    entrar.classList.remove('ll-feito', 'll-carregando');
    entrar.querySelector('.ll-entrar-texto').textContent = 'Entrar';
  }

  /* =================================================================
     ESTADOS DE VALIDAÇÃO
     aprovado  → a luz pisca 2x, o cone se abre e a sala inteira acende
     erro      → mau contato: o feixe falha, a cabeça dá um tranco e a
                 sala escurece um pouco mais a cada erro
     bloqueado → a luz se apaga, sobra o contorno e um cadeado tranca o
                 cartão com contagem regressiva; no fim a lâmpada reacende
     ================================================================= */
  var falhas = 0;
  var fimBloqueio = 0, totalBloqueio = 0, idContagem = 0, idFalha = 0;
  var bloqueio = document.getElementById('ll-bloqueio');
  var bloqueioTitulo = document.getElementById('ll-bloqueio-titulo');
  var bloqueioTempo = document.getElementById('ll-bloqueio-tempo');
  var tons = document.querySelectorAll('.ll-tom');

  function aprovado() {
    falhas = 0; // acertar a senha zera o contador
    cena.style.removeProperty('--ll-penumbra');
    entrar.classList.add('ll-feito');
    comemorar();
    window.setTimeout(function () {
      sucessoEmail.textContent = email.value.trim();
      conteudoForm.hidden = true;
      sucesso.hidden = false;
      sucessoTitulo.focus();
      anunciar('Login realizado. Bem-vindo de volta.');
    }, reduzido ? 300 : 1000);
  }

  // A luz pisca 2 vezes em comemoração; depois o cone se abre e a sala acende
  function comemorar() {
    if (!acesa) definirLuz(true, true);
    if (reduzido) return;
    cena.classList.remove('ll-comemora', 'll-sala-acesa');
    void cena.offsetWidth; // reinicia a animação
    cena.classList.add('ll-comemora', 'll-sala-acesa');
    window.setTimeout(function () { cena.classList.remove('ll-comemora'); }, 1000);
    window.setTimeout(function () { cena.classList.remove('ll-sala-acesa'); }, 1500);
    // O cone se abre logo depois da segunda piscada
    window.setTimeout(function () { animarCone(1000); }, 400);
  }

  // Abre o cone (aberturaExtra 0 → 0,55 → 0) redesenhando o feixe a cada quadro
  function animarCone(duracao) {
    var inicio = performance.now();
    function passo(agora) {
      var t = Math.min(1, (agora - inicio) / duracao);
      // sobe rápido e desce devagar
      aberturaExtra = 0.55 * Math.sin(Math.PI * Math.pow(t, 0.6));
      desenharFeixe();
      if (t < 1) window.requestAnimationFrame(passo);
      else { aberturaExtra = 0; desenharFeixe(); }
    }
    window.requestAnimationFrame(passo);
  }

  function errou(restantesDoServidor) {
    falhas++;
    var restantes = isFinite(restantesDoServidor) && restantesDoServidor !== null ? Number(restantesDoServidor) : TENTATIVAS_MAX - falhas;
    if (restantes <= 0) return bloquear(BLOQUEIO_SEGUNDOS);
    var texto = 'E-mail ou senha incorretos. Você tem ' + restantes + (restantes === 1 ? ' tentativa.' : ' tentativas.');
    mostrarErro(senha, erroSenha, texto);
    anunciar(texto);
    // A sala escurece um pouco mais a cada erro (0,8 → 0,86 → 0,9)
    cena.style.setProperty('--ll-penumbra', String(Math.min(0.9, 0.8 + falhas * 0.05)));
    if (!reduzido) {
      window.clearTimeout(idFalha);
      cena.classList.remove('ll-falha');
      void cena.offsetWidth;
      cena.classList.add('ll-falha');
      idFalha = window.setTimeout(function () { cena.classList.remove('ll-falha'); }, 1300);
      // Tranco na cabeça da luminária: a mola faz o resto
      velocidade = 150;
      voltarComMola();
    }
    senha.focus();
    senha.select(); // senha selecionada: é só digitar de novo
  }

  function relogio(s) { return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }

  function travar(sim) {
    travado = sim;
    Array.prototype.forEach.call(form.querySelectorAll('input, button'), function (el) { el.disabled = sim; });
    // inert tira também os links do formulário do alcance do teclado
    if (sim) form.setAttribute('inert', ''); else form.removeAttribute('inert');
    document.getElementById('ll-preencher').disabled = sim;
    interruptor.disabled = sim;
    textoInterruptor.textContent = sim ? 'Luz em pausa' : (acesa ? 'Apagar a luz' : 'Acender a luz');
    Array.prototype.forEach.call(tons, function (b) { b.disabled = sim; });
  }

  function bloquear(segundos) {
    totalBloqueio = Math.max(1, Math.round(segundos || BLOQUEIO_SEGUNDOS));
    fimBloqueio = Date.now() + totalBloqueio * 1000;
    falhas = 0;
    window.clearTimeout(idFalha);
    cena.classList.remove('ll-falha');
    mostrarErro(email, erroEmail, '');
    mostrarErro(senha, erroSenha, '');
    if (!acesa) definirLuz(true, true);
    travar(true);
    cena.setAttribute('data-acesso', 'bloqueado');
    bloqueioTempo.textContent = relogio(totalBloqueio);
    bloqueio.style.setProperty('--ll-resta', '1');
    bloqueio.hidden = false;
    bloqueioTitulo.focus({ preventScroll: true });
    anunciar('Muitas tentativas sem sucesso. Por segurança, o acesso foi pausado. Tente de novo em ' + totalBloqueio + ' segundos.');
    window.clearInterval(idContagem);
    idContagem = window.setInterval(contar, 250);
  }

  function contar() {
    var resta = Math.max(0, Math.ceil((fimBloqueio - Date.now()) / 1000));
    var texto = relogio(resta);
    if (bloqueioTempo.textContent !== texto) bloqueioTempo.textContent = texto;
    bloqueio.style.setProperty('--ll-resta', String(resta / totalBloqueio));
    if (resta <= 0) liberar();
  }

  function liberar() {
    window.clearInterval(idContagem);
    cena.setAttribute('data-acesso', 'liberando');   // o cadeado abre
    window.setTimeout(function () {
      cena.removeAttribute('data-acesso');            // a lâmpada reacende (filamento)
      cena.style.removeProperty('--ll-penumbra');
      bloqueio.hidden = true;
      travar(false);
      senha.value = '';
      mostrarErro(senha, erroSenha, '');
      mostrarErro(email, erroEmail, '');
      (email.value ? senha : email).focus();
      anunciar('A luz voltou. Você já pode tentar de novo.');
    }, reduzido ? 0 : 700);
  }

  // Link de suporte: só visual na demonstração
  document.getElementById('ll-suporte').addEventListener('click', function (e) {
    e.preventDefault();
    anunciar('Demonstração: ligue este link ao seu canal de suporte.');
  });

  // Dica da conta demo
  document.getElementById('ll-preencher').addEventListener('click', function () {
    email.value = DEMO.email;
    senha.value = DEMO.senha;
    mostrarErro(email, erroEmail, '');
    mostrarErro(senha, erroSenha, '');
    entrar.focus();
  });

  // Sair: volta ao formulário limpo
  sair.addEventListener('click', function () {
    form.reset();
    ocupado = false;
    entrar.classList.remove('ll-feito', 'll-carregando');
    entrar.querySelector('.ll-entrar-texto').textContent = 'Entrar';
    senha.type = 'password';
    olho.setAttribute('aria-pressed', 'false');
    olho.setAttribute('aria-label', 'Mostrar senha');
    sucesso.hidden = true;
    conteudoForm.hidden = false;
    email.focus();
    anunciar('Você saiu.');
  });

  // Links de demonstração (esqueci a senha / criar conta)
  Array.prototype.forEach.call(document.querySelectorAll('[data-aviso]'), function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      nota.textContent = link.getAttribute('data-aviso');
    });
  });

  /* =================================================================
     INÍCIO
     ================================================================= */
  atualizarTudo();

  // Recalcula a mira quando a tela muda de tamanho ou as fontes carregam
  if ('ResizeObserver' in window) {
    var observador = new ResizeObserver(function () { atualizarTudo(); });
    observador.observe(cena);
    observador.observe(cartao);
  } else {
    window.addEventListener('resize', atualizarTudo);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(atualizarTudo).catch(function () {});
  }

  // A luminária acende sozinha (~1,2 s de animação). Movimento reduzido: já acesa.
  if (reduzido) {
    definirLuz(true, true);
  } else {
    window.setTimeout(function () { definirLuz(true, true); }, 120);
  }
})();
