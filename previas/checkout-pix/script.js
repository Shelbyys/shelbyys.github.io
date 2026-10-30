/* ==========================================================================
   Checkout Pix — comportamento
   JavaScript puro, sem dependências. Tudo fica dentro desta IIFE para não
   poluir o escopo global. Os pontos de integração com o seu backend estão
   marcados com "INTEGRAÇÃO".
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     Configuração da demo — ajuste à sua loja
     ------------------------------------------------------------------ */
  const CONFIG = {
    recebedor: 'CASA BRISA LTDA',          // nome no payload Pix (máx. 25)
    cidadePix: 'SAO PAULO',                // cidade no payload Pix (máx. 15)
    chavePix: '7d9f0335-8dcc-4054-9bf9-0dbd61d36906', // chave aleatória fictícia
    minutosPix: 15,                        // validade do QR Code
    parcelasMax: 6,
    parcelasSemJuros: 3,
    jurosMes: 0.0199,                      // 1,99% a.m. acima do sem juros
    diasBoleto: 3,
    cupons: {
      BEMVINDO10: { tipo: 'percentual', valor: 10, rotulo: '10% off nos produtos' },
      FRETEGRATIS: { tipo: 'frete', rotulo: 'frete grátis' },
    },
    // Estados de validação do cartão: recusas seguidas até travar e duração da trava
    tentativasCartao: 3,                   // na 3ª recusa seguida o pagamento com cartão trava
    bloqueioSegundos: 30,                  // tempo da trava (o servidor pode mandar outro em Retry-After)
  };

  /* Cartões de teste da demo e a resposta que o "gateway" simulado devolve.
     Qualquer outro número válido no Luhn é aprovado. Apague em produção. */
  const CARTOES_RECUSADOS = {
    '4000000000000002': { status: 402, motivo: 'O banco emissor não autorizou esta compra (código 05). Nenhum valor foi cobrado.' },
    '4000000000009995': { status: 402, motivo: 'Limite insuficiente para este valor. Tente outro cartão ou parcele em menos vezes.' },
    '4000000000000069': { status: 422, motivo: 'O banco informou que este cartão está vencido ou foi substituído.' },
  };

  /* Tabela LOCAL de CEPs da demonstração (sem rede).
     INTEGRAÇÃO: troque buscarEndereco() por uma chamada à sua API de CEP. */
  const CEPS = {
    '01310100': { rua: 'Avenida Paulista', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP' },
    '04538133': { rua: 'Avenida Brigadeiro Faria Lima', bairro: 'Itaim Bibi', cidade: 'São Paulo', uf: 'SP' },
    '13015000': { rua: 'Rua Barão de Jaguara', bairro: 'Centro', cidade: 'Campinas', uf: 'SP' },
    '20040020': { rua: 'Rua da Assembleia', bairro: 'Centro', cidade: 'Rio de Janeiro', uf: 'RJ' },
    '22071000': { rua: 'Avenida Atlântica', bairro: 'Copacabana', cidade: 'Rio de Janeiro', uf: 'RJ' },
    '30130010': { rua: 'Avenida Afonso Pena', bairro: 'Centro', cidade: 'Belo Horizonte', uf: 'MG' },
    '40020000': { rua: 'Rua Chile', bairro: 'Centro Histórico', cidade: 'Salvador', uf: 'BA' },
    '50030230': { rua: 'Rua do Bom Jesus', bairro: 'Recife Antigo', cidade: 'Recife', uf: 'PE' },
    '60165121': { rua: 'Avenida Beira Mar', bairro: 'Meireles', cidade: 'Fortaleza', uf: 'CE' },
    '70040010': { rua: 'Setor Bancário Sul', bairro: 'Asa Sul', cidade: 'Brasília', uf: 'DF' },
    '80010000': { rua: 'Rua XV de Novembro', bairro: 'Centro', cidade: 'Curitiba', uf: 'PR' },
    '88010400': { rua: 'Rua Felipe Schmidt', bairro: 'Centro', cidade: 'Florianópolis', uf: 'SC' },
    '90010150': { rua: 'Rua dos Andradas', bairro: 'Centro Histórico', cidade: 'Porto Alegre', uf: 'RS' },
  };

  const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  const UFS_PERTO = ['SP', 'RJ', 'MG', 'ES', 'PR', 'SC', 'RS'];

  /* ------------------------------------------------------------------
     Utilidades
     ------------------------------------------------------------------ */
  const $ = (sel, raiz) => (raiz || document).querySelector(sel);
  const $$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));
  const digitos = (v) => String(v || '').replace(/\D/g, '');
  const centavos = (v) => Math.round(v * 100) / 100;
  const formatoMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const brl = (v) => formatoMoeda.format(v);
  const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Gerador pseudoaleatório determinístico (mesma semente = mesmo resultado). */
  function semente(texto) {
    let h = 2166136261;
    for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function aleatorio(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Reinicia uma animação CSS de classe (ex.: tremida de erro). */
  function animarClasse(el, classe) {
    if (!el) return;
    el.classList.remove(classe);
    void el.offsetWidth; // força reflow para a animação recomeçar
    el.classList.add(classe);
    el.addEventListener('animationend', () => el.classList.remove(classe), { once: true });
  }

  /* ------------------------------------------------------------------
     Estado do pedido
     ------------------------------------------------------------------ */
  const estado = {
    etapa: 1,
    metodo: 'pix',
    subtotal: 0,
    frete: 10,
    prazo: '3 a 5 dias úteis',
    cupom: null,
    totalExibido: 0,
    pedido: novoNumeroPedido(),
    endereco: null,
    bandeira: '',
  };

  function novoNumeroPedido() {
    return 'CB-' + String(Math.floor(100000 + Math.random() * 900000));
  }

  function calcular() {
    const c = estado.cupom ? CONFIG.cupons[estado.cupom] : null;
    let desconto = 0;
    if (c && c.tipo === 'percentual') desconto = centavos(estado.subtotal * c.valor / 100);
    if (c && c.tipo === 'frete') desconto = estado.frete;
    const total = centavos(estado.subtotal + estado.frete - desconto);
    return { desconto, total };
  }

  /* ------------------------------------------------------------------
     Máscaras
     ------------------------------------------------------------------ */
  const mascaras = {
    cpf(v) {
      const d = digitos(v).slice(0, 11);
      return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    },
    celular(v) {
      const d = digitos(v).slice(0, 11);
      if (!d) return '';
      if (d.length <= 2) return '(' + d;
      if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    },
    cep(v) {
      const d = digitos(v).slice(0, 8);
      return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
    },
    cartao(v) {
      const d = digitos(v).slice(0, estado.bandeira === 'amex' ? 15 : 16);
      const grupos = estado.bandeira === 'amex' ? [4, 6, 5] : [4, 4, 4, 4];
      const partes = [];
      let i = 0;
      for (const g of grupos) { if (i >= d.length) break; partes.push(d.slice(i, i + g)); i += g; }
      return partes.join(' ');
    },
    validade(v) {
      let d = digitos(v).slice(0, 4);
      if (d.length === 1 && d > '1') d = '0' + d;
      return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
    },
  };

  /** Aplica a máscara mantendo o cursor depois do mesmo número de dígitos. */
  function aplicarMascara(input, formatar) {
    const pos = input.selectionStart == null ? input.value.length : input.selectionStart;
    const antes = digitos(input.value.slice(0, pos)).length;
    const novo = formatar(input.value);
    if (novo === input.value) return;
    input.value = novo;
    let i = 0;
    let contados = 0;
    while (i < novo.length && contados < antes) { if (/\d/.test(novo[i])) contados++; i++; }
    if (document.activeElement === input) input.setSelectionRange(i, i);
  }

  /* ------------------------------------------------------------------
     Validações
     ------------------------------------------------------------------ */
  /** CPF: confere os dois dígitos verificadores (módulo 11). */
  function cpfValido(v) {
    const d = digitos(v);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    const dv = (n) => {
      let soma = 0;
      for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
      const resto = (soma * 10) % 11;
      return resto === 10 ? 0 : resto;
    };
    return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
  }

  /** Algoritmo de Luhn para números de cartão. */
  function luhnValido(v) {
    const d = digitos(v);
    if (d.length < 13) return false;
    let soma = 0;
    let dobrar = false;
    for (let i = d.length - 1; i >= 0; i--) {
      let n = Number(d[i]);
      if (dobrar) { n *= 2; if (n > 9) n -= 9; }
      soma += n;
      dobrar = !dobrar;
    }
    return soma % 10 === 0;
  }

  const obrigatorio = (msg) => (v) => v.trim().length > 0 || msg;

  const regras = {
    nome: (v) => v.trim().split(/\s+/).filter((p) => p.length >= 2).length >= 2 || 'Informe nome e sobrenome.',
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Digite um e-mail válido, como voce@email.com.',
    cpf: (v) => (digitos(v).length < 11 ? 'O CPF tem 11 dígitos.' : cpfValido(v) || 'CPF inválido — confira os números.'),
    celular: (v) => { const d = digitos(v); return (d.length === 11 && d[2] === '9') || 'Celular com DDD, ex.: (11) 98765-4321.'; },
    cep: (v) => digitos(v).length === 8 || 'O CEP tem 8 dígitos.',
    rua: obrigatorio('Informe a rua ou avenida.'),
    numero: obrigatorio('Informe o número (ou “s/n”).'),
    bairro: obrigatorio('Informe o bairro.'),
    cidade: obrigatorio('Informe a cidade.'),
    uf: obrigatorio('Escolha o estado.'),
    // Cartão
    numeroCartao: (v) => (digitos(v).length < 13 ? 'Digite o número completo do cartão.' : luhnValido(v) || 'Número inválido — confira os dígitos.'),
    titular: (v) => v.trim().length >= 4 || 'Digite o nome como está no cartão.',
    validade: (v) => {
      const d = digitos(v);
      if (d.length !== 4) return 'Use o formato MM/AA.';
      const mes = Number(d.slice(0, 2));
      const ano = 2000 + Number(d.slice(2));
      if (mes < 1 || mes > 12) return 'Mês inválido.';
      const hoje = new Date();
      const fimDoMes = new Date(ano, mes, 0, 23, 59, 59);
      if (fimDoMes < hoje) return 'Cartão vencido.';
      if (ano > hoje.getFullYear() + 20) return 'Ano inválido.';
      return true;
    },
    cvv: (v) => digitos(v).length === (estado.bandeira === 'amex' ? 4 : 3) || (estado.bandeira === 'amex' ? 'O CVV do Amex tem 4 dígitos.' : 'O CVV tem 3 dígitos.'),
  };

  /** Valida um campo, mostra/limpa a mensagem e devolve true/false. */
  function validarCampo(input, mostrar) {
    const chave = input.dataset.regra || input.name;
    const regra = regras[chave];
    if (!regra) return true;
    const r = regra(input.value);
    const ok = r === true;
    if (mostrar !== false) {
      input.setAttribute('aria-invalid', ok ? 'false' : 'true');
      const erro = document.getElementById(input.id + '-erro');
      if (erro) erro.textContent = ok ? '' : r;
    }
    if (input.name === 'cpf') input.classList.toggle('cp-valido', ok);
    if (input.id === 'cp-cc-num' && mostrar !== false) sinalizarNumeroCartao(input, ok);
    return ok;
  }

  /** Valida todos os campos de um formulário; foca e treme o primeiro com erro. */
  function validarFormulario(form) {
    let primeiro = null;
    $$('input[name], select[name]', form).forEach((el) => {
      if (!validarCampo(el) && !primeiro) primeiro = el;
    });
    if (primeiro) {
      primeiro.focus();
      animarClasse(primeiro.closest('.cp-campo'), 'cp-treme');
      return false;
    }
    return true;
  }

  /** Liga validação "amigável": no blur, e ao digitar depois que já errou. */
  function ligarValidacao(form) {
    $$('input[name], select[name]', form).forEach((el) => {
      el.addEventListener('blur', () => { if (el.value.trim() || el.getAttribute('aria-invalid') === 'true') validarCampo(el); });
      el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') validarCampo(el); });
      el.addEventListener('change', () => { if (el.tagName === 'SELECT') validarCampo(el); });
    });
  }

  /* ------------------------------------------------------------------
     Valores, total animado e parcelas
     ------------------------------------------------------------------ */
  const el = {
    subtotal: $('#cp-subtotal'),
    frete: $('#cp-frete'),
    freteNota: $('#cp-frete-nota'),
    linhaDesconto: $('#cp-linha-desconto'),
    desconto: $('#cp-desconto'),
    cupomNome: $('#cp-cupom-nome'),
    total: $('#cp-total'),
    totalParcelas: $('#cp-total-parcelas'),
    parcelas: $('#cp-parcelas'),
  };

  let quadroTotal = 0;
  /** Conta o total do valor exibido até o novo valor (easing suave). */
  function animarTotal(para) {
    cancelAnimationFrame(quadroTotal);
    const de = estado.totalExibido;
    if (semMovimento || Math.abs(para - de) < 0.005) {
      estado.totalExibido = para;
      el.total.textContent = brl(para);
      return;
    }
    const inicio = performance.now();
    const duracao = de === 0 ? 1000 : 700;
    const passo = (agora) => {
      const p = Math.min(1, (agora - inicio) / duracao);
      const suave = 1 - Math.pow(1 - p, 3);
      estado.totalExibido = de + (para - de) * suave;
      el.total.textContent = brl(estado.totalExibido);
      if (p < 1) quadroTotal = requestAnimationFrame(passo);
      else { estado.totalExibido = para; el.total.textContent = brl(para); }
    };
    quadroTotal = requestAnimationFrame(passo);
  }

  /** Lista de parcelas: sem juros até CONFIG.parcelasSemJuros, depois Tabela Price. */
  function calcularParcelas(total) {
    const lista = [];
    for (let n = 1; n <= CONFIG.parcelasMax; n++) {
      if (n <= CONFIG.parcelasSemJuros) {
        lista.push({ n, valor: centavos(total / n), juros: false });
      } else {
        const i = CONFIG.jurosMes;
        lista.push({ n, valor: centavos(total * i / (1 - Math.pow(1 + i, -n))), juros: true });
      }
    }
    return lista;
  }

  function textoParcela(p) {
    if (p.n === 1) return `1x de ${brl(p.valor)} à vista`;
    return p.juros
      ? `${p.n}x de ${brl(p.valor)} com juros (total ${brl(centavos(p.valor * p.n))})`
      : `${p.n}x de ${brl(p.valor)} sem juros`;
  }

  function atualizarValores() {
    const { desconto, total } = calcular();
    el.subtotal.textContent = brl(estado.subtotal);
    el.frete.textContent = estado.frete === 0 ? 'Grátis' : brl(estado.frete);
    el.freteNota.textContent = 'PAC · ' + estado.prazo;

    el.linhaDesconto.hidden = !estado.cupom;
    if (estado.cupom) {
      el.cupomNome.textContent = estado.cupom;
      el.desconto.textContent = '− ' + brl(desconto);
    }

    // Todos os lugares que mostram o total (botões, acordeão, Pix, boleto…)
    $$('[data-cp-total]').forEach((n) => { n.textContent = brl(total); });
    animarTotal(total);

    // Parcelas: mantém a escolha atual quando o total muda
    const escolhida = Number(el.parcelas.value) || CONFIG.parcelasSemJuros;
    const lista = calcularParcelas(total);
    el.parcelas.innerHTML = lista.map((p) => `<option value="${p.n}">${textoParcela(p)}</option>`).join('');
    el.parcelas.value = String(escolhida);
    const sj = lista[CONFIG.parcelasSemJuros - 1];
    el.totalParcelas.textContent = `ou ${sj.n}× de ${brl(sj.valor)} sem juros`;

    // Pix e boleto acompanham o valor
    if (pix.iniciado) gerarPix();
    if (boleto.gerado) gerarBoleto();
  }

  /* ------------------------------------------------------------------
     Etapas
     ------------------------------------------------------------------ */
  const nomesEtapas = ['Dados', 'Pagamento', 'Confirmação'];
  const progresso = $('.cp-progresso');

  function irPara(n) {
    estado.etapa = n;
    $$('.cp-painel').forEach((p) => {
      const ativo = Number(p.dataset.painel) === n;
      p.hidden = !ativo;
      p.classList.toggle('cp-painel--ativo', ativo);
    });
    $$('.cp-etapa').forEach((li) => {
      const e = Number(li.dataset.etapa);
      li.classList.toggle('cp-etapa--atual', e === n && n < 3);
      li.classList.toggle('cp-etapa--feita', e < n || n === 3);
      if (e === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    progresso.style.setProperty('--cp-progresso', String(n / 3));
    progresso.setAttribute('aria-valuenow', String(n));
    progresso.setAttribute('aria-valuetext', `Etapa ${n} de 3: ${nomesEtapas[n - 1]}`);

    if (n === 2) {
      posicionarIndicador();
      if (!pix.iniciado || pix.expirado) iniciarPix();
      const e = estado.endereco;
      $('#cp-entrega-resumo').textContent = e ? `Entrega: ${e.rua}, ${e.numero} · ${e.cidade}/${e.uf}` : '';
    }
    if (n !== 2) pararPix();

    // Leva o foco para o título da etapa (leitores de tela anunciam a mudança)
    const painel = $(`#cp-etapa-${n}`);
    const alvo = $('[tabindex="-1"]', painel);
    if (alvo) alvo.focus({ preventScroll: true });
    const topo = $('.cp-checkout').getBoundingClientRect().top;
    if (topo < 0) $('.cp-checkout').scrollIntoView({ behavior: semMovimento ? 'auto' : 'smooth', block: 'start' });
  }

  /* ------------------------------------------------------------------
     Etapa 1 · Dados (máscaras, CEP simulado, exemplo)
     ------------------------------------------------------------------ */
  const formDados = $('#cp-form-dados');
  const campo = (id) => document.getElementById(id);

  // Preenche o <select> de estados
  campo('cp-uf').insertAdjacentHTML('beforeend', UFS.map((uf) => `<option value="${uf}">${uf}</option>`).join(''));

  campo('cp-cpf').addEventListener('input', (e) => {
    aplicarMascara(e.target, mascaras.cpf);
    if (digitos(e.target.value).length === 11) validarCampo(e.target);
    else e.target.classList.remove('cp-valido');
  });
  campo('cp-celular').addEventListener('input', (e) => aplicarMascara(e.target, mascaras.celular));
  campo('cp-cep').addEventListener('input', (e) => {
    aplicarMascara(e.target, mascaras.cep);
    if (digitos(e.target.value).length === 8) buscarEndereco(digitos(e.target.value));
    else campo('cp-cep-info').textContent = '';
  });
  campo('cp-uf').addEventListener('change', (e) => atualizarFrete(e.target.value));

  let buscaCep = 0;
  /** Simula a consulta de CEP com um pequeno atraso.
      INTEGRAÇÃO: substitua por fetch('/api/cep/' + cep) ou pelo serviço que preferir. */
  function buscarEndereco(cep) {
    const caixa = campo('cp-cep').parentElement;
    const info = campo('cp-cep-info');
    const pedido = ++buscaCep;
    caixa.classList.add('cp-carregando');
    info.classList.remove('cp-info--aviso');
    info.textContent = 'Buscando endereço…';
    setTimeout(() => {
      if (pedido !== buscaCep) return; // o usuário digitou outro CEP no meio
      caixa.classList.remove('cp-carregando');
      const achado = CEPS[cep];
      if (!achado) {
        info.classList.add('cp-info--aviso');
        info.textContent = 'CEP fora da tabela da demo — preencha o endereço abaixo.';
        return;
      }
      campo('cp-rua').value = achado.rua;
      campo('cp-bairro').value = achado.bairro;
      campo('cp-cidade').value = achado.cidade;
      campo('cp-uf').value = achado.uf;
      ['cp-rua', 'cp-bairro', 'cp-cidade', 'cp-uf'].forEach((id) => {
        const c = campo(id);
        validarCampo(c);
        animarClasse(c, 'cp-mudou');
      });
      info.textContent = `✓ ${achado.cidade}/${achado.uf} — agora é só o número.`;
      atualizarFrete(achado.uf);
      if (document.activeElement === campo('cp-cep')) campo('cp-numero').focus();
    }, 650);
  }

  /** Frete por região (demo). INTEGRAÇÃO: calcule no backend/transportadora. */
  function atualizarFrete(uf) {
    if (!uf) return;
    const perto = UFS_PERTO.includes(uf);
    estado.frete = perto ? 10 : 14.9;
    estado.prazo = perto ? '3 a 5 dias úteis' : '6 a 9 dias úteis';
    atualizarValores();
  }

  ligarValidacao(formDados);

  formDados.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validarFormulario(formDados)) return;
    const dados = Object.fromEntries(new FormData(formDados));
    estado.endereco = dados;
    // INTEGRAÇÃO: aqui você pode criar o pedido no backend (POST /pedidos) com "dados".
    irPara(2);
  });

  $('#cp-preencher').addEventListener('click', () => {
    const exemplo = {
      'cp-nome': 'Marina Albuquerque',
      'cp-email': 'marina@exemplo.com.br',
      'cp-cpf': '529.982.247-25',
      'cp-celular': '(11) 98765-4321',
      'cp-cep': '01310-100',
      'cp-numero': '1578',
      'cp-complemento': 'Apto 42',
    };
    Object.entries(exemplo).forEach(([id, v]) => { campo(id).value = v; validarCampo(campo(id)); });
    buscarEndereco('01310100');
  });

  /* ------------------------------------------------------------------
     Etapa 2 · Abas de pagamento com indicador deslizante
     ------------------------------------------------------------------ */
  const abas = $$('.cp-aba');
  const listaAbas = $('.cp-abas');

  function posicionarIndicador() {
    const ativa = abas.find((a) => a.getAttribute('aria-selected') === 'true');
    if (!ativa || !ativa.offsetWidth) return;
    listaAbas.style.setProperty('--cp-ind-x', ativa.offsetLeft + 'px');
    listaAbas.style.setProperty('--cp-ind-largura', ativa.offsetWidth + 'px');
  }

  function selecionarAba(aba, focar) {
    abas.forEach((a) => {
      const sim = a === aba;
      a.setAttribute('aria-selected', String(sim));
      a.tabIndex = sim ? 0 : -1;
      document.getElementById(a.getAttribute('aria-controls')).hidden = !sim;
    });
    estado.metodo = aba.dataset.metodo;
    if (focar) aba.focus();
    posicionarIndicador();
    if (estado.metodo === 'boleto' && !boleto.gerado) gerarBoleto();
  }

  abas.forEach((aba, i) => {
    aba.addEventListener('click', () => selecionarAba(aba));
    aba.addEventListener('keydown', (e) => {
      let alvo = null;
      if (e.key === 'ArrowRight') alvo = abas[(i + 1) % abas.length];
      if (e.key === 'ArrowLeft') alvo = abas[(i - 1 + abas.length) % abas.length];
      if (e.key === 'Home') alvo = abas[0];
      if (e.key === 'End') alvo = abas[abas.length - 1];
      if (alvo) { e.preventDefault(); selecionarAba(alvo, true); }
    });
  });
  if ('ResizeObserver' in window) new ResizeObserver(posicionarIndicador).observe(listaAbas);
  else window.addEventListener('resize', posicionarIndicador);

  /* ------------------------------------------------------------------
     Pix · payload "copia e cola", QR Code em SVG e expiração
     ------------------------------------------------------------------ */
  const pix = { iniciado: false, expirado: false, fim: 0, timer: 0, codigo: '' };

  /** Campo TLV do padrão EMV usado pelo Pix: ID + tamanho (2 dígitos) + valor. */
  const tlv = (id, valor) => id + String(valor.length).padStart(2, '0') + valor;

  /** CRC16-CCITT (0xFFFF), o mesmo usado no final do payload Pix. */
  function crc16(texto) {
    let crc = 0xffff;
    for (let i = 0; i < texto.length; i++) {
      crc ^= texto.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  /** Monta um "Pix copia e cola" com o valor do pedido.
      INTEGRAÇÃO: em produção, peça o payload (e o QR) ao seu PSP/banco via backend. */
  function montarPayloadPix(valor) {
    const base =
      tlv('00', '01') +
      tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', CONFIG.chavePix)) +
      tlv('52', '0000') +
      tlv('53', '986') +
      tlv('54', valor.toFixed(2)) +
      tlv('58', 'BR') +
      tlv('59', CONFIG.recebedor.slice(0, 25)) +
      tlv('60', CONFIG.cidadePix.slice(0, 15)) +
      tlv('62', tlv('05', estado.pedido.replace(/\W/g, ''))) +
      '6304';
    return base + crc16(base);
  }

  /** Desenha um QR Code em SVG de forma determinística a partir de um texto.
      Visual de QR real (localizadores, alinhamento, temporização), mas não decodificável.
      INTEGRAÇÃO: troque pelo QR em base64 que o seu PSP devolve. */
  function desenharQR(texto) {
    const n = 29;
    const rnd = aleatorio(semente(texto));
    const mapa = [];
    const reservado = [];
    for (let r = 0; r < n; r++) { mapa.push(new Array(n).fill(0)); reservado.push(new Array(n).fill(false)); }
    const reservar = (r0, c0, tam) => {
      for (let r = r0; r < r0 + tam; r++) for (let c = c0; c < c0 + tam; c++) if (r >= 0 && c >= 0 && r < n && c < n) reservado[r][c] = true;
    };
    // Localizadores (3 cantos) + borda de respiro, alinhamento e área do logo
    reservar(0, 0, 8); reservar(0, n - 8, 8); reservar(n - 8, 0, 8);
    reservar(n - 9, n - 9, 5);
    reservar(10, 10, 9);
    // Linhas de temporização
    for (let i = 8; i < n - 8; i++) { mapa[6][i] = mapa[i][6] = i % 2 === 0 ? 1 : 0; reservado[6][i] = reservado[i][6] = true; }
    // Dados "aleatórios" (determinísticos)
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!reservado[r][c]) mapa[r][c] = rnd() < 0.5 ? 1 : 0;

    // Junta módulos vizinhos de cada linha em um único retângulo (SVG mais leve)
    let d = '';
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (mapa[r][c]) {
          let fim = c;
          while (fim + 1 < n && mapa[r][fim + 1]) fim++;
          d += `M${c} ${r}h${fim - c + 1}v1h-${fim - c + 1}z`;
          c = fim + 1;
        } else c++;
      }
    }
    const localizador = (x, y) =>
      `<rect class="cp-qr__modulo" x="${x}" y="${y}" width="7" height="7" rx="1.8"/>` +
      `<rect class="cp-qr__centro" x="${x + 1}" y="${y + 1}" width="5" height="5" rx="1.1"/>` +
      `<rect class="cp-qr__modulo" x="${x + 2}" y="${y + 2}" width="3" height="3" rx=".8"/>`;
    const a = n - 9;
    const alinhamento =
      `<rect class="cp-qr__modulo" x="${a}" y="${a}" width="5" height="5" rx="1.2"/>` +
      `<rect class="cp-qr__centro" x="${a + 1}" y="${a + 1}" width="3" height="3" rx=".6"/>` +
      `<rect class="cp-qr__modulo" x="${a + 2}" y="${a + 2}" width="1" height="1"/>`;
    const meio = n / 2;
    const logo =
      `<rect class="cp-qr__centro" x="10.4" y="10.4" width="8.2" height="8.2" rx="2.2"/>` +
      `<path class="cp-qr__logo" d="M${meio} ${meio - 3.1}L${meio + 3.1} ${meio}L${meio} ${meio + 3.1}L${meio - 3.1} ${meio}Z"/>` +
      `<path class="cp-qr__logo" style="fill:var(--cp-pix)" d="M${meio} ${meio - 1.2}L${meio + 1.2} ${meio}L${meio} ${meio + 1.2}L${meio - 1.2} ${meio}Z"/>`;

    return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" shape-rendering="geometricPrecision" aria-hidden="true">` +
      `<path class="cp-qr__modulo" d="${d}" shape-rendering="crispEdges"/>` +
      localizador(0, 0) + localizador(n - 7, 0) + localizador(0, n - 7) + alinhamento + logo + '</svg>';
  }

  function gerarPix() {
    const { total } = calcular();
    pix.codigo = montarPayloadPix(total);
    $('#cp-pix-codigo').value = pix.codigo;
    $('#cp-qr').innerHTML = desenharQR(pix.codigo);
  }

  function formatarTempo(ms) {
    const s = Math.ceil(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function iniciarPix() {
    pix.iniciado = true;
    pix.expirado = false;
    gerarPix();
    const status = $('#cp-pix-status');
    status.classList.remove('cp-pix__status--expirado', 'cp-pix__status--pago');
    $('.cp-pix__status-texto', status).textContent = 'Aguardando pagamento';
    $('.cp-qr').classList.remove('cp-qr--expirado', 'cp-qr--pago');
    $('#cp-novo-pix').hidden = true;
    $('#cp-simular-pix').hidden = false;
    $('#cp-copiar-pix').disabled = false;
    pix.fim = Date.now() + CONFIG.minutosPix * 60000;
    retomarPix();
  }

  function retomarPix() {
    clearInterval(pix.timer);
    tiquePix();
    pix.timer = setInterval(tiquePix, 1000);
  }

  function pararPix() { clearInterval(pix.timer); }

  function tiquePix() {
    const resta = Math.max(0, pix.fim - Date.now());
    $('#cp-expira-tempo').textContent = formatarTempo(resta);
    $('#cp-expira-barra').style.transform = `scaleX(${resta / (CONFIG.minutosPix * 60000)})`;
    if (resta === 0) expirarPix();
  }

  function expirarPix() {
    pararPix();
    pix.expirado = true;
    const status = $('#cp-pix-status');
    status.classList.add('cp-pix__status--expirado');
    $('.cp-pix__status-texto', status).textContent = 'Código expirado';
    $('.cp-qr').classList.add('cp-qr--expirado');
    $('#cp-novo-pix').hidden = false;
    $('#cp-simular-pix').hidden = true;
    $('#cp-copiar-pix').disabled = true;
  }

  $('#cp-novo-pix').addEventListener('click', iniciarPix);

  /* INTEGRAÇÃO: em produção, troque a simulação por polling (GET /pedidos/:id/status)
     ou por um WebSocket/SSE que avise quando o webhook do PSP confirmar o Pix.
     Quando o status vier "pago" (HTTP 200), chame pixAprovado(). */
  function pixAprovado() {
    const botao = $('#cp-simular-pix');
    botao.disabled = true;
    pararPix();
    const status = $('#cp-pix-status');
    status.classList.add('cp-pix__status--pago');
    $('.cp-pix__status-texto', status).textContent = 'Pagamento recebido!';
    // APROVADO: o QR esmaece e um selo "Pago" é carimbado por cima (≈ 1 s)
    $('.cp-qr').classList.add('cp-qr--pago');
    $('.cp-qr__legenda').textContent = 'Pix confirmado pelo banco';
    setTimeout(() => {
      botao.disabled = false;
      $('.cp-qr__legenda').textContent = 'Aponte a câmera do app do seu banco';
      confirmar('pix');
    }, semMovimento ? 600 : 1250);
  }
  $('#cp-simular-pix').addEventListener('click', pixAprovado);

  /* ------------------------------------------------------------------
     Copiar para a área de transferência + toast
     ------------------------------------------------------------------ */
  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (erro) {
      // Alternativa para navegadores/contextos sem a Clipboard API
      const area = document.createElement('textarea');
      area.value = texto;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      area.remove();
      return ok;
    }
  }

  let tempoToast = 0;
  function toast(mensagem) {
    const caixa = $('#cp-toast');
    caixa.innerHTML = '<svg class="cp-ico" aria-hidden="true"><use href="#cp-i-check"/></svg><span></span>';
    $('span', caixa).textContent = mensagem;
    caixa.classList.add('cp-toast--visivel');
    clearTimeout(tempoToast);
    tempoToast = setTimeout(() => caixa.classList.remove('cp-toast--visivel'), 2600);
  }

  function ligarCopia(botao, obterTexto, mensagem) {
    const rotulo = $('span', botao);
    const original = rotulo.textContent;
    botao.addEventListener('click', async () => {
      const ok = await copiar(obterTexto());
      toast(ok ? mensagem : 'Selecione o código e copie manualmente.');
      if (!ok) return;
      rotulo.textContent = 'Copiado!';
      $('use', botao).setAttribute('href', '#cp-i-check');
      animarClasse(botao, 'cp-botao--copiado');
      setTimeout(() => { rotulo.textContent = original; $('use', botao).setAttribute('href', '#cp-i-copiar'); }, 2000);
    });
  }
  ligarCopia($('#cp-copiar-pix'), () => pix.codigo, 'Código Pix copiado! Cole no app do seu banco.');
  ligarCopia($('#cp-copiar-boleto'), () => digitos($('#cp-boleto-linha').value), 'Linha digitável copiada!');

  /* ------------------------------------------------------------------
     Cartão · cartão 3D ao vivo, bandeira, Luhn e parcelas
     ------------------------------------------------------------------ */
  // Ordem importa: Elo e Hipercard têm faixas que começariam como Visa/Master.
  const BANDEIRAS = [
    { id: 'elo', nome: 'Elo', re: /^(4011(78|79)|43(1274|8935)|45(1416|7393|763[12])|50(4175|6699|67[0-7]\d|9\d{3})|627780|63(6297|6368)|650\d|6516|6550)/ },
    { id: 'hipercard', nome: 'Hipercard', re: /^(606282|3841[046]0)/ },
    { id: 'amex', nome: 'American Express', re: /^3[47]/ },
    { id: 'mastercard', nome: 'Mastercard', re: /^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/ },
    { id: 'visa', nome: 'Visa', re: /^4/ },
  ];

  /* Logos simplificados e originais (não são as marcas oficiais). */
  const LOGOS = {
    visa: '<svg viewBox="0 0 60 30" role="img" aria-label="Visa"><rect width="60" height="30" rx="5" fill="#fff"/><text x="30" y="20.5" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14.5" font-weight="900" font-style="italic" letter-spacing="1" fill="#1d3f94">VISA</text></svg>',
    mastercard: '<svg viewBox="0 0 60 30" role="img" aria-label="Mastercard"><rect width="60" height="30" rx="5" fill="#fff"/><circle cx="25" cy="15" r="9" fill="#e5352b"/><circle cx="35" cy="15" r="9" fill="#f6a11a"/><path d="M30 7.52A9 9 0 0 1 30 22.48 9 9 0 0 1 30 7.52z" fill="#f2661f"/></svg>',
    elo: '<svg viewBox="0 0 60 30" role="img" aria-label="Elo"><rect width="60" height="30" rx="5" fill="#fff"/><circle cx="14" cy="9.5" r="2.6" fill="#f5c400"/><circle cx="14" cy="15" r="2.6" fill="#1aa3dd"/><circle cx="14" cy="20.5" r="2.6" fill="#e3342f"/><text x="35" y="20" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#111">elo</text></svg>',
    amex: '<svg viewBox="0 0 60 30" role="img" aria-label="American Express"><rect width="60" height="30" rx="5" fill="#2f78bd"/><rect x="4" y="4" width="52" height="22" rx="3" fill="none" stroke="#fff" stroke-opacity=".5"/><text x="30" y="19.5" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="900" letter-spacing="1.2" fill="#fff">AMEX</text></svg>',
    hipercard: '<svg viewBox="0 0 60 30" role="img" aria-label="Hipercard"><rect width="60" height="30" rx="5" fill="#b8191f"/><text x="30" y="19.5" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12.5" font-weight="800" font-style="italic" fill="#fff">Hiper</text></svg>',
  };

  const cc = {
    raiz: $('#cp-cc'),
    numero: $('#cp-cc-numero'),
    nome: $('#cp-cc-nome'),
    validade: $('#cp-cc-validade'),
    cvv: $('#cp-cc-cvv'),
    bandeira: $('#cp-cc-bandeira'),
    entrada: {
      numero: $('#cp-cc-num'),
      titular: $('#cp-cc-titular'),
      validade: $('#cp-cc-val'),
      cvv: $('#cp-cc-cvv-in'),
    },
  };
  cc.entrada.numero.dataset.regra = 'numeroCartao';

  let numeroAnterior = '';
  /** Redesenha o número no cartão; o dígito recém-digitado entra animado. */
  function desenharNumero() {
    const d = digitos(cc.entrada.numero.value);
    const grupos = estado.bandeira === 'amex' ? [4, 6, 5] : [4, 4, 4, 4];
    const cresceu = d.length > numeroAnterior.length;
    let i = 0;
    cc.numero.innerHTML = grupos.map((tam) => {
      let g = '';
      for (let k = 0; k < tam; k++, i++) {
        const c = d[i];
        const novo = cresceu && i === d.length - 1;
        g += `<span class="cp-cc__dig${c ? '' : ' cp-cc__dig--vazio'}${novo ? ' cp-cc__dig--novo' : ''}">${c || '•'}</span>`;
      }
      return `<span class="cp-cc__grupo">${g}</span>`;
    }).join('');
    numeroAnterior = d;
  }

  function detectarBandeira(numero) {
    const d = digitos(numero);
    const achada = BANDEIRAS.find((b) => b.re.test(d));
    return achada ? achada.id : '';
  }

  function atualizarBandeira() {
    const nova = detectarBandeira(cc.entrada.numero.value);
    if (nova === estado.bandeira) return;
    estado.bandeira = nova;
    cc.raiz.dataset.bandeira = nova;
    cc.bandeira.innerHTML = nova ? LOGOS[nova] : '';
    $('#cp-cc-num-bandeira').innerHTML = nova ? LOGOS[nova] : '';
    // Amex: 15 dígitos (4-6-5) e CVV de 4
    const amex = nova === 'amex';
    cc.entrada.numero.maxLength = amex ? 17 : 19;
    cc.entrada.cvv.maxLength = amex ? 4 : 3;
    cc.entrada.cvv.placeholder = amex ? '1234' : '123';
    cc.entrada.cvv.value = digitos(cc.entrada.cvv.value).slice(0, amex ? 4 : 3);
    desenharCvv();
  }

  function desenharCvv() {
    const tam = estado.bandeira === 'amex' ? 4 : 3;
    const d = digitos(cc.entrada.cvv.value);
    cc.cvv.textContent = d.padEnd(tam, '•');
  }

  cc.entrada.numero.addEventListener('input', (e) => {
    atualizarBandeira();
    aplicarMascara(e.target, mascaras.cartao);
    desenharNumero();
    const tam = estado.bandeira === 'amex' ? 15 : 16;
    if (digitos(e.target.value).length === tam) {
      if (validarCampo(e.target)) cc.entrada.titular.focus();
    }
  });
  cc.entrada.titular.addEventListener('input', (e) => {
    // Só letras e espaços, em maiúsculas como no cartão
    const limpo = e.target.value.replace(/[^A-Za-zÀ-ÿ\s'.-]/g, '');
    if (limpo !== e.target.value) e.target.value = limpo;
    cc.nome.textContent = limpo.trim() ? limpo.toUpperCase() : 'NOME COMO NO CARTÃO';
  });
  cc.entrada.validade.addEventListener('input', (e) => {
    aplicarMascara(e.target, mascaras.validade);
    cc.validade.textContent = e.target.value || 'MM/AA';
    if (digitos(e.target.value).length === 4 && validarCampo(e.target)) cc.entrada.cvv.focus();
  });
  cc.entrada.cvv.addEventListener('input', (e) => {
    const limpo = digitos(e.target.value);
    if (limpo !== e.target.value) e.target.value = limpo;
    desenharCvv();
  });
  // Vira o cartão para o verso enquanto o CVV está em foco
  cc.entrada.cvv.addEventListener('focus', () => cc.raiz.classList.add('cp-cc--verso'));
  cc.entrada.cvv.addEventListener('blur', () => cc.raiz.classList.remove('cp-cc--verso'));

  const formCartao = $('#cp-form-cartao');
  ligarValidacao(formCartao);

  /* ------------------------------------------------------------------
     Cartão · estados de validação (aprovado · recusado · bloqueado)
     ------------------------------------------------------------------ */
  const botaoPagar = $('#cp-pagar-cartao');
  const caixaRecusa = $('#cp-recusa');
  const trava = {
    falhas: 0,        // recusas seguidas; um pagamento aprovado zera
    ativa: false,
    fim: 0,
    total: 0,
    timer: 0,
    el: $('#cp-trava'),
    tempo: $('#cp-trava-tempo'),
    aviso: $('#cp-trava-aviso'),
  };

  /** Erro de Luhn: o número no cartão 3D fica salmão e os grupos "tropeçam". */
  function sinalizarNumeroCartao(input, ok) {
    const completo = digitos(input.value).length >= 13;
    const invalido = !ok && completo;
    const jaEstava = cc.raiz.classList.contains('cp-cc--invalido');
    cc.raiz.classList.toggle('cp-cc--invalido', invalido);
    if (invalido && !jaEstava && !semMovimento) animarClasse(cc.numero, 'cp-cc__numero--erro');
  }

  /** Simula o gateway: devolve { status, motivo, retryAfter } como viria do servidor.
      Cartões em CARTOES_RECUSADOS são recusados; qualquer outro é aprovado. */
  function simularGateway(numero) {
    return new Promise((ok) => {
      setTimeout(() => {
        const recusa = CARTOES_RECUSADOS[digitos(numero)];
        ok(recusa ? { status: recusa.status, motivo: recusa.motivo } : { status: 200 });
      }, 1300);
    });
  }

  formCartao.addEventListener('submit', (e) => {
    e.preventDefault();
    if (trava.ativa || botaoPagar.classList.contains('cp-botao--processando')) return;
    if (!validarFormulario(formCartao)) return;
    limparRecusa();
    cc.raiz.classList.remove('cp-cc--verso'); // o resultado aparece na frente do cartão
    botaoPagar.classList.add('cp-botao--processando');
    botaoPagar.setAttribute('aria-busy', 'true');
    // INTEGRAÇÃO: NUNCA envie o número do cartão ao seu servidor. Use o SDK/tokenização
    // do seu gateway no navegador e mande só o token + parcelas para o backend.
    simularGateway(cc.entrada.numero.value).then(tratarRespostaCartao);
  });

  /** Traduz a resposta do pagamento nos três estados da interface.
   *
   *  INTEGRAÇÃO — com o seu backend real, troque simularGateway() por algo assim:
   *
   *    const r = await fetch('/api/pagamentos/cartao', {
   *      method: 'POST',
   *      headers: { 'Content-Type': 'application/json' },
   *      body: JSON.stringify({ pedido: estado.pedido, token, parcelas: el.parcelas.value }),
   *    });
   *    const corpo = await r.json().catch(() => ({}));
   *    tratarRespostaCartao({
   *      status: r.status,                                   // 200 · 402/422 · 429/423
   *      motivo: corpo.mensagem,                             // texto amigável do motivo da recusa
   *      retryAfter: Number(r.headers.get('Retry-After')),   // segundos de bloqueio
   *    });
   *
   *  200        → APROVADO: carimbo no cartão, o cartão se guarda e vai para a confirmação.
   *  402 / 422  → ERRO: cartão recusado (402 = banco negou, 422 = dados recusados);
   *               mostra o motivo e quantas tentativas restam.
   *  429 / 423  → BLOQUEADO: o servidor travou novas tentativas; use Retry-After
   *               (em segundos) como tempo da contagem. O front também trava sozinho
   *               depois de CONFIG.tentativasCartao recusas seguidas.
   *  O servidor é quem manda: o contador do navegador é só para a experiência.
   */
  function tratarRespostaCartao(resposta) {
    botaoPagar.classList.remove('cp-botao--processando');
    botaoPagar.removeAttribute('aria-busy');
    const status = resposta.status;
    if (status >= 200 && status < 300) return cartaoAprovado();
    if (status === 429 || status === 423) {
      trava.falhas = CONFIG.tentativasCartao;
      return bloquearCartao(resposta.retryAfter || CONFIG.bloqueioSegundos);
    }
    return cartaoRecusado(resposta.motivo || 'O banco não autorizou a compra. Nenhum valor foi cobrado.');
  }

  /** APROVADO: o botão vira "Aprovado", o cartão ganha o carimbo verde e se guarda. */
  function cartaoAprovado() {
    trava.falhas = 0; // um acerto zera o contador de recusas
    cc.raiz.classList.remove('cp-cc--recusado', 'cp-cc--invalido');
    cc.raiz.classList.add('cp-cc--aprovado');
    botaoPagar.classList.add('cp-botao--aprovado');
    trava.aviso.textContent = 'Cartão aprovado. Finalizando o pedido…';
    setTimeout(() => cc.raiz.classList.add('cp-cc--guardando'), semMovimento ? 0 : 720);
    setTimeout(() => {
      confirmar('cartao');
      cc.raiz.classList.remove('cp-cc--aprovado', 'cp-cc--guardando');
      botaoPagar.classList.remove('cp-botao--aprovado');
    }, semMovimento ? 700 : 1350);
  }

  /** ERRO: o cartão treme, ganha a tarja "Recusado" e o aviso mostra o motivo. */
  function cartaoRecusado(motivo) {
    trava.falhas += 1;
    const restam = CONFIG.tentativasCartao - trava.falhas;
    cc.raiz.classList.add('cp-cc--recusado');
    if (!semMovimento) animarClasse(cc.raiz, 'cp-cc--tremendo');
    if (restam <= 0) { bloquearCartao(CONFIG.bloqueioSegundos); return; }

    const pips = Array.from({ length: CONFIG.tentativasCartao }, (_, i) => {
      const usada = i < trava.falhas;
      const nova = i === trava.falhas - 1;
      return `<span class="${usada ? 'cp-pips--usada' : ''}${nova ? ' cp-pips--nova' : ''}"></span>`;
    }).join('');
    caixaRecusa.innerHTML =
      '<span class="cp-recusa__icone" aria-hidden="true"><svg class="cp-ico"><use href="#cp-i-recusa"/></svg></span>' +
      '<p class="cp-recusa__titulo">Cartão recusado pelo banco</p>' +
      '<p class="cp-recusa__motivo"></p>' +
      `<p class="cp-recusa__tentativas"><span class="cp-pips" aria-hidden="true">${pips}</span><span></span></p>` +
      '<button type="button" class="cp-botao cp-botao--secundario cp-recusa__botao">Tentar outro cartão</button>';
    $('.cp-recusa__motivo', caixaRecusa).textContent = motivo;
    $('.cp-recusa__tentativas > span:last-child', caixaRecusa).textContent =
      restam === 1 ? 'Você tem 1 tentativa.' : `Você tem ${restam} tentativas.`;
    $('.cp-recusa__botao', caixaRecusa).addEventListener('click', tentarOutroCartao);
  }

  function limparRecusa() {
    caixaRecusa.innerHTML = '';
    cc.raiz.classList.remove('cp-cc--recusado');
  }

  /** "Tentar outro cartão": limpa número e CVV, tira a tarja e volta o foco ao número. */
  function tentarOutroCartao() {
    limparRecusa();
    cc.entrada.numero.value = '';
    cc.entrada.cvv.value = '';
    cc.entrada.numero.dispatchEvent(new Event('input'));
    desenharCvv();
    [cc.entrada.numero, cc.entrada.cvv].forEach((c) => {
      c.removeAttribute('aria-invalid');
      const erro = document.getElementById(c.id + '-erro');
      if (erro) erro.textContent = '';
    });
    cc.entrada.numero.focus();
  }
  // Digitar um novo número também tira a tarja de recusa
  cc.entrada.numero.addEventListener('input', () => { if (caixaRecusa.firstChild && !trava.ativa) limparRecusa(); });

  /** Liga/desliga de verdade todos os controles do cartão (campos, botão e atalhos). */
  function controlesCartao(ligado) {
    $$('input, select, button', formCartao).forEach((c) => { c.disabled = !ligado; });
  }

  const formatarContagem = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  /** BLOQUEADO: a persiana fria desce sobre o cartão com cadeado e contagem regressiva. */
  function bloquearCartao(segundos) {
    clearInterval(trava.timer);
    trava.ativa = true;
    trava.total = Math.max(1, Math.round(segundos));
    trava.fim = Date.now() + trava.total * 1000;
    caixaRecusa.innerHTML = '';
    controlesCartao(false);
    cc.raiz.classList.remove('cp-cc--aprovado', 'cp-cc--guardando');
    cc.raiz.classList.add('cp-cc--bloqueado');
    trava.el.classList.remove('cp-trava--liberando', 'cp-trava--saindo');
    $('.cp-trava__titulo', trava.el).textContent = 'Pagamento temporariamente bloqueado por segurança';
    $('#cp-trava-texto').textContent = `Foram ${CONFIG.tentativasCartao} recusas seguidas. Para proteger você, novas tentativas com cartão ficam pausadas por alguns instantes.`;
    $('.cp-trava__tempo-rotulo', trava.el).textContent = 'Tente de novo em';
    trava.el.hidden = false;
    trava.aviso.textContent = `Pagamento com cartão bloqueado por segurança durante ${trava.total} segundos. Você pode pagar com Pix enquanto isso.`;
    $('#cp-trava-titulo').focus({ preventScroll: true });
    tiqueTrava();
    trava.timer = setInterval(tiqueTrava, 1000);
  }

  function tiqueTrava() {
    const resta = Math.max(0, Math.ceil((trava.fim - Date.now()) / 1000));
    trava.tempo.textContent = formatarContagem(resta);
    trava.el.style.setProperty('--cp-trava-p', String(1 - resta / trava.total));
    if (resta === 0) liberarCartao();
  }

  /** LIBERAÇÃO: o cadeado abre, o emblema fica verde e a persiana sobe. */
  function liberarCartao() {
    clearInterval(trava.timer);
    trava.falhas = 0;
    trava.el.classList.add('cp-trava--liberando');
    $('.cp-trava__titulo', trava.el).textContent = 'Pagamento liberado';
    $('#cp-trava-texto').textContent = 'Pode tentar de novo — de preferência com outro cartão.';
    $('.cp-trava__tempo-rotulo', trava.el).textContent = 'Liberado';
    trava.tempo.textContent = '✓';
    const terminar = () => {
      trava.el.hidden = true;
      trava.el.classList.remove('cp-trava--liberando', 'cp-trava--saindo');
      trava.ativa = false;
      controlesCartao(true);
      cc.raiz.classList.remove('cp-cc--bloqueado', 'cp-cc--recusado');
      trava.aviso.textContent = 'Pagamento com cartão liberado. Você pode tentar de novo.';
      const focado = document.activeElement;
      if (!focado || focado === document.body || trava.el.contains(focado)) cc.entrada.numero.focus({ preventScroll: true });
      if (!semMovimento) animarClasse(botaoPagar, 'cp-liberado');
    };
    if (semMovimento) { terminar(); return; }
    setTimeout(() => trava.el.classList.add('cp-trava--saindo'), 750);
    setTimeout(terminar, 1300);
  }

  $('#cp-trava-pix').addEventListener('click', () => selecionarAba(abas[0], true));
  $('.cp-trava__suporte').addEventListener('click', (e) => e.preventDefault());

  /** Preenche o formulário do cartão com um número de teste. */
  function preencherCartao(numero) {
    const v = cc.entrada;
    v.numero.value = numero;
    v.numero.dispatchEvent(new Event('input'));
    v.titular.value = 'Marina Albuquerque';
    v.titular.dispatchEvent(new Event('input'));
    const ano = String((new Date().getFullYear() + 3) % 100).padStart(2, '0');
    v.validade.value = '08/' + ano;
    cc.validade.textContent = v.validade.value;
    v.cvv.value = '123';
    desenharCvv();
    [v.numero, v.titular, v.validade, v.cvv].forEach((c) => validarCampo(c));
    v.cvv.focus();
  }
  $('#cp-cartao-exemplo').addEventListener('click', () => preencherCartao('4111 1111 1111 1111'));
  $('#cp-cartao-recusado').addEventListener('click', () => preencherCartao('4000 0000 0000 0002'));

  /* ------------------------------------------------------------------
     Boleto · linha digitável e código de barras (Intercalado 2 de 5)
     ------------------------------------------------------------------ */
  const boleto = { gerado: false, vencimento: null };

  /** Dígito verificador módulo 10 (usado nos campos da linha digitável). */
  function modulo10(num) {
    let soma = 0;
    let peso = 2;
    for (let i = num.length - 1; i >= 0; i--) {
      let p = Number(num[i]) * peso;
      if (p > 9) p = Math.floor(p / 10) + (p % 10);
      soma += p;
      peso = peso === 2 ? 1 : 2;
    }
    return String((10 - (soma % 10)) % 10);
  }

  /* INTEGRAÇÃO: o boleto real (linha, código de barras e PDF) vem do seu banco/PSP. */
  function gerarBoleto() {
    boleto.gerado = true;
    const { total } = calcular();
    const rnd = aleatorio(semente(estado.pedido + total));
    const nums = (q) => Array.from({ length: q }, () => Math.floor(rnd() * 10)).join('');
    const venc = new Date();
    venc.setDate(venc.getDate() + CONFIG.diasBoleto);
    boleto.vencimento = venc;

    const banco = '2379';
    const livre = nums(25);
    const fator = String(1000 + (Math.floor(venc.getTime() / 864e5) % 9000)).padStart(4, '0');
    const valor = String(Math.round(total * 100)).padStart(10, '0');
    const dvGeral = String(1 + Math.floor(rnd() * 9));

    const c1 = banco + livre.slice(0, 5);
    const c2 = livre.slice(5, 15);
    const c3 = livre.slice(15, 25);
    const campo1 = c1 + modulo10(c1);
    const campo2 = c2 + modulo10(c2);
    const campo3 = c3 + modulo10(c3);
    const linha = `${campo1.slice(0, 5)}.${campo1.slice(5)} ${campo2.slice(0, 5)}.${campo2.slice(5)} ${campo3.slice(0, 5)}.${campo3.slice(5)} ${dvGeral} ${fator}${valor}`;
    $('#cp-boleto-linha').value = linha;
    $('#cp-boleto-venc').textContent = venc.toLocaleDateString('pt-BR');

    // Código de barras de 44 dígitos desenhado em I2of5
    const barras = banco + dvGeral + fator + valor + livre;
    $('#cp-boleto-barras').innerHTML = desenharI2de5(barras);
  }

  function desenharI2de5(codigo) {
    const padroes = ['nnwwn', 'wnnnw', 'nwnnw', 'wwnnn', 'nnwnw', 'wnwnn', 'nwwnn', 'nnnww', 'wnnwn', 'nwnwn'];
    const estreita = 1;
    const larga = 2.6;
    const elementos = [];                          // [largura, éBarra]
    const pinta = (seq, primeiraBarra) => seq.split('').forEach((w, i) => elementos.push([w === 'w' ? larga : estreita, primeiraBarra ? i % 2 === 0 : i % 2 === 1]));
    pinta('nnnn', true);                           // início
    for (let i = 0; i < codigo.length; i += 2) {
      const a = padroes[Number(codigo[i])];
      const b = padroes[Number(codigo[i + 1])];
      for (let k = 0; k < 5; k++) { elementos.push([a[k] === 'w' ? larga : estreita, true]); elementos.push([b[k] === 'w' ? larga : estreita, false]); }
    }
    pinta('wnn', true);                            // fim
    let x = 0;
    let rects = '';
    for (const [w, barra] of elementos) {
      if (barra) rects += `<rect x="${x.toFixed(2)}" y="0" width="${w}" height="60"/>`;
      x += w;
    }
    return `<svg viewBox="0 0 ${x.toFixed(2)} 60" preserveAspectRatio="none" aria-hidden="true">${rects}</svg>`;
  }

  $('#cp-concluir-boleto').addEventListener('click', () => confirmar('boleto'));

  /* ------------------------------------------------------------------
     Etapa 3 · Confirmação + confete
     ------------------------------------------------------------------ */
  const nomeBandeira = (id) => (BANDEIRAS.find((b) => b.id === id) || { nome: 'Cartão' }).nome;

  function confirmar(metodo) {
    const { total } = calcular();
    const titulo = $('#cp-confirma-titulo');
    const texto = $('#cp-confirma-texto');
    const forma = $('#cp-pedido-forma');
    const e = estado.endereco || {};
    $('#cp-pedido-num').textContent = '#' + estado.pedido;
    $('#cp-pedido-entrega').textContent = e.cidade ? `${e.cidade}/${e.uf} · ${estado.prazo}` : estado.prazo;

    if (metodo === 'boleto') {
      const data = boleto.vencimento ? boleto.vencimento.toLocaleDateString('pt-BR') : '';
      titulo.textContent = 'Pedido reservado!';
      texto.textContent = `Pague o boleto até ${data}. Assim que ele compensar, separamos seu pedido.`;
      forma.textContent = 'Boleto · vence ' + data;
    } else if (metodo === 'cartao') {
      const p = calcularParcelas(total).find((x) => x.n === Number(el.parcelas.value)) || { n: 1, valor: total };
      titulo.textContent = 'Pagamento aprovado!';
      texto.textContent = 'Tudo certo com o seu cartão. Enviamos o comprovante para o seu e-mail.';
      forma.textContent = `${nomeBandeira(estado.bandeira)} · ${p.n}× de ${brl(p.valor)}`;
    } else {
      titulo.textContent = 'Pagamento aprovado!';
      texto.textContent = 'Recebemos o seu Pix. O pedido já está sendo separado e sai hoje.';
      forma.textContent = 'Pix · aprovado na hora';
    }
    irPara(3);
    titulo.focus({ preventScroll: true });
    if (!semMovimento) setTimeout(() => soltarConfete($('.cp-confirma__check')), 650);
  }

  /** Explosão curta de confete em canvas (para sozinha em ~2,6 s). */
  function soltarConfete(origem) {
    const canvas = $('#cp-confete');
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const r = origem.getBoundingClientRect();
    const ox = r.left + r.width / 2;
    const oy = r.top + r.height / 2;
    const cores = ['#00a868', '#1d5c66', '#f2b84b', '#15171a', '#e9765b', '#8fd3b6'];
    const pecas = Array.from({ length: 140 }, () => {
      const ang = Math.random() * Math.PI * 2;
      const vel = 3 + Math.random() * 9;
      return {
        x: ox, y: oy,
        vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 4,
        g: 0.18 + Math.random() * 0.12,
        l: 5 + Math.random() * 6, a: 3 + Math.random() * 4,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
        cor: cores[Math.floor(Math.random() * cores.length)],
        forma: Math.random() < 0.25 ? 'redondo' : (Math.random() < 0.3 ? 'losango' : 'fita'),
      };
    });
    const inicio = performance.now();
    const duracao = 2600;
    const quadro = (agora) => {
      const t = agora - inicio;
      ctx.clearRect(0, 0, w, h);
      if (t >= duracao) return;
      ctx.globalAlpha = t > duracao - 700 ? (duracao - t) / 700 : 1;
      for (const p of pecas) {
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.cor;
        if (p.forma === 'redondo') { ctx.beginPath(); ctx.arc(0, 0, p.a / 1.4, 0, Math.PI * 2); ctx.fill(); }
        else if (p.forma === 'losango') {
          // Losango, o desenho do Pix
          const s = p.a * 1.1;
          ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0); ctx.closePath(); ctx.fill();
        } else ctx.fillRect(-p.l / 2, -p.a / 2, p.l, p.a * Math.abs(Math.cos(p.rot * 2)) + 0.6);
        ctx.restore();
      }
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }

  $('#cp-recomecar').addEventListener('click', () => {
    formDados.reset();
    formCartao.reset();
    $$('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
    $$('.cp-erro').forEach((c) => { c.textContent = ''; });
    $$('.cp-valido').forEach((c) => c.classList.remove('cp-valido'));
    campo('cp-cep-info').textContent = '';
    cc.entrada.numero.dispatchEvent(new Event('input'));
    cc.entrada.titular.dispatchEvent(new Event('input'));
    cc.validade.textContent = 'MM/AA';
    desenharCvv();
    limparRecusa();
    cc.raiz.classList.remove('cp-cc--invalido', 'cp-cc--aprovado', 'cp-cc--guardando');
    removerCupom(true);
    estado.pedido = novoNumeroPedido();
    estado.endereco = null;
    pix.iniciado = false;
    boleto.gerado = false;
    selecionarAba(abas[0]);
    atualizarFrete('SP');
    irPara(1);
  });

  $('#cp-voltar-dados').addEventListener('click', () => irPara(1));

  /* ------------------------------------------------------------------
     Cupom com validação animada
     ------------------------------------------------------------------ */
  const formCupom = $('#cp-cupom');
  const entradaCupom = $('#cp-cupom-codigo');
  const msgCupom = $('#cp-cupom-msg');

  function mensagemCupom(texto, tipo) {
    msgCupom.textContent = texto;
    msgCupom.className = 'cp-cupom__msg' + (tipo ? ' cp-cupom__msg--' + tipo : '');
  }

  formCupom.addEventListener('submit', (e) => {
    e.preventDefault();
    const codigo = entradaCupom.value.trim().toUpperCase();
    const botao = $('.cp-cupom__botao', formCupom);
    if (!codigo) {
      mensagemCupom('Digite um código de cupom.', 'erro');
      animarClasse($('.cp-cupom__campo', formCupom), 'cp-treme');
      entradaCupom.focus();
      return;
    }
    botao.classList.add('cp-botao--processando');
    // INTEGRAÇÃO: valide o cupom no backend (POST /cupons/validar) — nunca só no front.
    setTimeout(() => {
      botao.classList.remove('cp-botao--processando');
      const cupom = CONFIG.cupons[codigo];
      if (!cupom) {
        entradaCupom.setAttribute('aria-invalid', 'true');
        formCupom.classList.remove('cp-cupom--ok');
        mensagemCupom('Cupom inválido ou expirado.', 'erro');
        animarClasse($('.cp-cupom__campo', formCupom), 'cp-treme');
        return;
      }
      estado.cupom = codigo;
      entradaCupom.value = codigo;
      entradaCupom.setAttribute('aria-invalid', 'false');
      formCupom.classList.add('cp-cupom--ok');
      mensagemCupom(`✓ Cupom aplicado: ${cupom.rotulo}.`, 'ok');
      atualizarValores();
      animarClasse(el.total, 'cp-mudou');
    }, 700);
  });

  entradaCupom.addEventListener('input', () => {
    if (entradaCupom.getAttribute('aria-invalid') === 'true') { entradaCupom.removeAttribute('aria-invalid'); mensagemCupom(''); }
  });

  function removerCupom(silencioso) {
    estado.cupom = null;
    entradaCupom.value = '';
    entradaCupom.removeAttribute('aria-invalid');
    formCupom.classList.remove('cp-cupom--ok');
    mensagemCupom(silencioso === true ? '' : 'Cupom removido.');
    atualizarValores();
  }
  $('#cp-cupom-remover').addEventListener('click', () => { removerCupom(); entradaCupom.focus(); });

  $$('[data-cupom]').forEach((b) => b.addEventListener('click', () => {
    entradaCupom.value = b.dataset.cupom;
    entradaCupom.removeAttribute('aria-invalid');
    if (formCupom.requestSubmit) formCupom.requestSubmit();
    else formCupom.dispatchEvent(new Event('submit', { cancelable: true }));
  }));

  /* ------------------------------------------------------------------
     Resumo em acordeão (celular)
     ------------------------------------------------------------------ */
  const resumo = $('.cp-resumo');
  const alternar = $('#cp-resumo-alternar');
  alternar.addEventListener('click', () => {
    const aberto = resumo.classList.toggle('cp-resumo--aberto');
    alternar.setAttribute('aria-expanded', String(aberto));
    $('.cp-resumo__alternar-texto', alternar).textContent = aberto ? 'Ocultar resumo' : 'Ver resumo';
  });

  /* ------------------------------------------------------------------
     Faixa "Formas aceitas" (reaproveita os logos acima)
     ------------------------------------------------------------------ */
  const SELO_PIX = '<svg viewBox="0 0 60 30" role="img" aria-label="Pix"><rect width="60" height="30" rx="5" fill="#fff"/><path d="M17 8.5 23.5 15 17 21.5 10.5 15z M17 12.4 19.6 15 17 17.6 14.4 15z" fill="none" stroke="#00a868" stroke-width="1.8" stroke-linejoin="round"/><text x="38" y="19.5" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="800" fill="#15171a">pix</text></svg>';
  const SELO_BOLETO = '<svg viewBox="0 0 60 30" role="img" aria-label="Boleto"><rect width="60" height="30" rx="5" fill="#fff"/><path d="M9 9v12M11.5 9v12M13 9v12M16 9v12M18 9v12M20.5 9v12" stroke="#15171a" stroke-width="1.1"/><text x="38" y="19" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="9.5" font-weight="700" fill="#15171a">boleto</text></svg>';
  $('#cp-aceitos').innerHTML = [SELO_PIX, LOGOS.visa, LOGOS.mastercard, LOGOS.elo, LOGOS.amex, LOGOS.hipercard, SELO_BOLETO]
    .map((svg) => '<li>' + svg.replace('role="img"', 'aria-hidden="true"') + '</li>').join('');

  /* ------------------------------------------------------------------
     Atalhos da demo: index.html#pix, #cartao, #boleto ou #confirmacao
     abrem direto naquela tela, com dados de exemplo. Apague se não quiser.
     ------------------------------------------------------------------ */
  function abrirAtalho() {
    const alvo = (location.hash || '').slice(1);
    if (!['pix', 'cartao', 'recusado', 'boleto', 'confirmacao'].includes(alvo)) return;
    $('#cp-preencher').click();
    setTimeout(() => {
      estado.endereco = Object.fromEntries(new FormData(formDados));
      irPara(2);
      if (alvo === 'confirmacao') { confirmar('pix'); return; }
      selecionarAba(abas.find((a) => a.dataset.metodo === (alvo === 'recusado' ? 'cartao' : alvo)));
      if (alvo === 'cartao') $('#cp-cartao-exemplo').click();
      if (alvo === 'recusado') $('#cp-cartao-recusado').click();
    }, 700);
  }

  /* ------------------------------------------------------------------
     Início
     ------------------------------------------------------------------ */
  estado.subtotal = centavos($$('.cp-item[data-preco]').reduce((s, li) => s + Number(li.dataset.preco) * Number(li.dataset.qtd || 1), 0));
  desenharNumero();
  desenharCvv();
  atualizarValores();
  // A barra de progresso começa vazia e "anda" até a etapa 1 logo após carregar
  progresso.style.setProperty('--cp-progresso', '0');
  requestAnimationFrame(() => requestAnimationFrame(() => progresso.style.setProperty('--cp-progresso', String(1 / 3))));
  abrirAtalho();
  window.addEventListener('hashchange', abrirAtalho);
})();
