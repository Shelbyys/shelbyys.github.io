/* =========================================================================
   TEXTOS CINÉTICOS — biblioteca (HTML + CSS + JS puros, zero dependências)

   Como usar:
     1) marque o elemento:     <h2 data-tc="revelar">Seu texto</h2>
     2) inicie (1 linha):      TextosCineticos.iniciar();
        — ou só num pedaço:    TextosCineticos.iniciar(document.querySelector("#hero"));
        — a biblioteca já se inicia sozinha ao carregar a página, a não ser que
          o <body> tenha o atributo data-tc-manual.

   Efeitos: revelar · decodificar · digitar · varredura · onda · desfocar ·
            contador · destaque · cair · girar · glitch · neon · fatiar ·
            trocar · contorno · gradiente · espalhar · riscar

   Ajustes opcionais, em qualquer efeito (data-atributos):
     data-atraso="0.4"   espera, em segundos, antes de começar
     data-passo="40"     intervalo entre letras/palavras, em milissegundos
     data-duracao="1.5"  duração total, em segundos (decodificar)
     data-palavras="a|b" lista de palavras que se alternam (trocar)
     data-pausa="1800"   tempo, em ms, que cada palavra fica parada (trocar)

   API pública:
     TextosCineticos.iniciar(raiz?)   prepara os elementos [data-tc] de dentro de "raiz"
     TextosCineticos.repetir(alvo)    toca de novo o elemento (ou todos os de dentro dele)
     TextosCineticos.efeitos          lista com os nomes dos efeitos
   ========================================================================= */
(function (global) {
  "use strict";

  var doc = global.document;

  /* O usuário pediu menos movimento? Então tudo aparece já no estado final. */
  var reduzMovimento =
    !!global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Registro: guarda, para cada elemento, qual efeito o controla e o seu estado */
  var registro = new WeakMap();

  /* ---------------------------------------------------------------------
     Utilidades
     --------------------------------------------------------------------- */

  /** Lista de elementos (Array de verdade) que combinam com o seletor. */
  function todos(seletor, raiz) {
    return Array.prototype.slice.call((raiz || doc).querySelectorAll(seletor));
  }

  /** Lê um número de um data-atributo (ex.: data-atraso). */
  function numero(el, nome, padrao) {
    var v = parseFloat(el.dataset[nome]);
    return isNaN(v) ? padrao : v;
  }

  /** Cria um <span> com classe e texto. */
  function criar(classe, texto) {
    var s = doc.createElement("span");
    if (classe) s.className = classe;
    if (texto != null) s.textContent = texto;
    return s;
  }

  /** Esconde um nó dos leitores de tela (o texto completo fica no aria-label do pai). */
  function esconder(no) {
    no.setAttribute("aria-hidden", "true");
    return no;
  }

  /**
   * Põe o texto completo no aria-label do elemento. Títulos (h1–h6) já têm papel
   * próprio; nos demais usamos role="group" para o rótulo ser lido de verdade.
   */
  function rotular(el, texto) {
    el.setAttribute("aria-label", texto);
    if (!el.getAttribute("role") && !/^H[1-6]$/.test(el.tagName)) {
      el.setAttribute("role", "group");
    }
  }

  /** Número "aleatório" fixo (0–1) por índice: o embaralhado fica sempre igual. */
  function pseudo(i) {
    var x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /** Reinicia as animações de CSS do elemento e o põe no estado "ativo". */
  function reiniciarClasse(el) {
    el.classList.add("tc-reset"); // desliga transições/animações por um instante
    el.classList.remove("tc-ativo");
    void el.offsetWidth; // força o navegador a "enxergar" o estado inicial
    el.classList.remove("tc-reset");
    el.classList.add("tc-ativo");
  }

  /**
   * Separa o texto do elemento em palavras e (opcionalmente) letras.
   *   <span class="tc-palavra" style="--p:0">
   *     <span class="tc-letra" style="--i:0">O</span>…
   * Mantém a estrutura interna (<em>, <mark> etc.) e as quebras <br>.
   * Retorna { palavras: [...], letras: [...] }.
   */
  function dividir(el, comLetras) {
    var resultado = { palavras: [], letras: [] };
    var indiceLetra = 0;
    var indicePalavra = 0;

    rotular(el, el.textContent.replace(/\s+/g, " ").trim());

    function percorrer(pai) {
      Array.prototype.slice.call(pai.childNodes).forEach(function (no) {
        if (no.nodeType === 1) {
          if (no.tagName !== "BR") percorrer(no); // desce em <em>, <strong>…
          return;
        }
        if (no.nodeType !== 3) return;

        var fragmento = doc.createDocumentFragment();
        no.textContent.split(/(\s+)/).forEach(function (parte) {
          if (!parte) return;
          if (/^\s+$/.test(parte)) {
            fragmento.appendChild(doc.createTextNode(" ")); // espaço normal: a linha quebra aqui
            return;
          }
          var palavra = esconder(criar("tc-palavra"));
          palavra.style.setProperty("--p", indicePalavra++);
          if (comLetras) {
            Array.from(parte).forEach(function (caractere) {
              var letra = criar("tc-letra", caractere);
              letra.style.setProperty("--i", indiceLetra++);
              palavra.appendChild(letra);
              resultado.letras.push(letra);
            });
          } else {
            palavra.textContent = parte;
          }
          resultado.palavras.push(palavra);
          fragmento.appendChild(palavra);
        });
        pai.replaceChild(fragmento, no);
      });
    }

    percorrer(el);
    return resultado;
  }

  /* ---------------------------------------------------------------------
     Os 8 efeitos.  Cada um tem:
       preparar(el)        monta o HTML interno; devolve um "estado"
       tocar(el, estado)   roda a animação (também usada no "Repetir")
       final(el, estado)   mostra o resultado final, sem animar
     --------------------------------------------------------------------- */
  var efeitos = {};

  /* Efeitos controlados só por CSS: basta dividir o texto e ligar a classe .tc-ativo */
  function efeitoDeClasse(preparar) {
    return {
      preparar: preparar || function () { return {}; },
      tocar: function (el) { reiniciarClasse(el); },
      final: function (el) { el.classList.add("tc-ativo"); }
    };
  }

  /* 1. revelar — letras sobem de dentro de uma máscara, em cascata */
  efeitos.revelar = efeitoDeClasse(function (el) {
    return dividir(el, true);
  });

  /* 5. onda — letras oscilando em onda contínua (a animação está no CSS) */
  efeitos.onda = efeitoDeClasse(function (el) {
    return dividir(el, true);
  });

  /* 6. desfocar — palavras saem do desfoque uma a uma */
  efeitos.desfocar = efeitoDeClasse(function (el) {
    return dividir(el, false);
  });

  /* 4. varredura — faixa de cor passando pelo texto (tudo no CSS, sem divisão) */
  efeitos.varredura = efeitoDeClasse();

  /* 8. destaque — marca-texto desenhado atrás dos <mark> */
  efeitos.destaque = efeitoDeClasse(function (el) {
    todos("mark", el).forEach(function (marca, i) {
      marca.style.setProperty("--m", i); // ordem em que os traços são desenhados
    });
    return {};
  });

  /* 2. decodificar — caracteres embaralhados que se resolvem no texto final */
  var SIMBOLOS = "▓▒░<>/\\{}[]#$%&@*+=?!01ABCDEFXYZ";

  function simboloAleatorio() {
    return SIMBOLOS.charAt(Math.floor(Math.random() * SIMBOLOS.length));
  }

  efeitos.decodificar = {
    preparar: function (el) {
      var letras = dividir(el, true).letras;
      var n = letras.length;
      var estado = {
        letras: letras,
        finais: letras.map(function (l) { return l.textContent; }),
        // momento (0–1 da duração) em que cada letra "trava" no valor certo:
        // avança da esquerda para a direita, com uma variação por letra
        travas: letras.map(function (_, i) { return (i / n) * 0.7 + pseudo(i) * 0.3; }),
        quadro: 0
      };
      estado.letras.forEach(function (l) { l.textContent = simboloAleatorio(); });
      return estado;
    },

    tocar: function (el, estado) {
      cancelAnimationFrame(estado.quadro);
      var duracao = numero(el, "duracao", 1.4) * 1000;
      var inicio = performance.now() + numero(el, "atraso", 0) * 1000;
      var ultimaTroca = 0;

      estado.letras.forEach(function (l) { l.classList.remove("tc-resolvida"); });

      function quadro(agora) {
        var passou = agora - inicio;
        var trocar = agora - ultimaTroca > 55; // embaralha ~18×/s, não a cada quadro
        var faltam = 0;

        estado.letras.forEach(function (letra, i) {
          if (letra.classList.contains("tc-resolvida")) return;
          if (passou >= estado.travas[i] * duracao) {
            letra.textContent = estado.finais[i];
            letra.classList.add("tc-resolvida");
            return;
          }
          faltam++;
          if (trocar) letra.textContent = simboloAleatorio();
        });

        if (trocar) ultimaTroca = agora;
        if (faltam) estado.quadro = requestAnimationFrame(quadro);
      }
      estado.quadro = requestAnimationFrame(quadro);
    },

    final: function (el, estado) {
      estado.letras.forEach(function (letra, i) {
        letra.textContent = estado.finais[i];
        letra.classList.add("tc-resolvida");
      });
    }
  };

  /* 3. digitar — máquina de escrever alternando frases (data-frases="a|b|c") */
  efeitos.digitar = {
    preparar: function (el) {
      var frases = (el.dataset.frases || el.textContent)
        .split("|")
        .map(function (f) { return f.trim(); })
        .filter(Boolean);

      rotular(el, frases.join(". "));
      el.textContent = "";
      var texto = esconder(criar("tc-texto"));
      var cursor = esconder(criar("tc-cursor"));
      el.appendChild(texto);
      el.appendChild(cursor);

      return { frases: frases, texto: texto, ficha: 0 };
    },

    tocar: function (el, estado) {
      var minhaFicha = ++estado.ficha; // quem chegar depois "cancela" o laço anterior
      var velocidade = numero(el, "velocidade", 60);
      var pausa = numero(el, "pausa", 1600);
      var viva = function () { return estado.ficha === minhaFicha; };
      var esperar = function (ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); };

      estado.texto.textContent = "";

      (async function () {
        await esperar(numero(el, "atraso", 0) * 1000);
        var i = 0;
        while (viva()) {
          var frase = estado.frases[i % estado.frases.length];

          // digita
          el.classList.add("tc-digitando");
          for (var k = 1; k <= frase.length && viva(); k++) {
            estado.texto.textContent = frase.slice(0, k);
            await esperar(velocidade + Math.random() * velocidade * 0.7);
          }
          el.classList.remove("tc-digitando");
          if (estado.frases.length === 1) return; // frase única: fica escrita

          // espera e apaga
          await esperar(pausa);
          el.classList.add("tc-digitando");
          for (k = frase.length - 1; k >= 0 && viva(); k--) {
            estado.texto.textContent = frase.slice(0, k);
            await esperar(velocidade * 0.4);
          }
          el.classList.remove("tc-digitando");
          await esperar(350);
          i++;
        }
      })();
    },

    final: function (el, estado) {
      estado.ficha++; // interrompe qualquer laço
      estado.texto.textContent = estado.frases[0];
    }
  };

  /* 7. contador — odômetro até data-valor, formatado em pt-BR
        data-valor="1284750"  data-decimais="0"  data-prefixo="R$ "  data-sufixo="%" */
  efeitos.contador = {
    preparar: function (el) {
      var valor = parseFloat(el.dataset.valor) || 0;
      var decimais = parseInt(el.dataset.decimais, 10) || 0;
      var formatado = valor.toLocaleString("pt-BR", {
        minimumFractionDigits: decimais,
        maximumFractionDigits: decimais
      });
      var texto = (el.dataset.prefixo || "") + formatado + (el.dataset.sufixo || "");

      rotular(el, texto);
      el.textContent = "";

      // total de dígitos, para os da esquerda girarem por mais tempo
      var totalDigitos = (texto.match(/\d/g) || []).length;
      var posicao = 0;

      Array.from(texto).forEach(function (caractere) {
        if (!/\d/.test(caractere)) {
          el.appendChild(esconder(criar("tc-fixo", caractere === " " ? "\u00a0" : caractere)));
          return;
        }
        // cada dígito é uma "fita" 0–9 repetida 3×; ela rola até a 3ª repetição
        var coluna = esconder(criar("tc-digito"));
        var fita = criar("tc-fita");
        fita.style.setProperty("--alvo", 20 + Number(caractere));
        fita.style.setProperty("--i", totalDigitos - 1 - posicao++);
        for (var n = 0; n < 30; n++) fita.appendChild(criar("", n % 10));
        coluna.appendChild(fita);
        el.appendChild(coluna);
      });
      return {};
    },
    tocar: function (el) { reiniciarClasse(el); },
    final: function (el) { el.classList.add("tc-ativo"); }
  };

  /* ---------------------------------------------------------------------
     Efeitos 9 a 18 (versão 1.1)
     --------------------------------------------------------------------- */

  /** Divide em letras e dá a cada uma um "sorteio" fixo: --dx, --dy (em em) e --r (graus). */
  function dividirComSorteio(el) {
    var r = dividir(el, true);
    r.letras.forEach(function (letra, i) {
      letra.style.setProperty("--dx", ((pseudo(i * 3 + 1) - 0.5) * 2).toFixed(2) + "em");
      letra.style.setProperty("--dy", ((pseudo(i * 3 + 2) - 0.5) * 1.6).toFixed(2) + "em");
      letra.style.setProperty("--r", ((pseudo(i * 3 + 3) - 0.5) * 90).toFixed(1) + "deg");
    });
    return r;
  }

  /* 9. cair — letras despencam de cima, quicam e assentam */
  efeitos.cair = efeitoDeClasse(dividirComSorteio);

  /* 10. girar — cada letra vira em 3D a partir da base, em cascata */
  efeitos.girar = efeitoDeClasse(function (el) { return dividir(el, true); });

  /* 15. contorno — letras só com o traço, que se preenchem uma a uma */
  efeitos.contorno = efeitoDeClasse(function (el) { return dividir(el, true); });

  /* 17. espalhar — letras chegam de posições aleatórias e se encaixam */
  efeitos.espalhar = efeitoDeClasse(dividirComSorteio);

  /* 16. gradiente — faixa de cores correndo pelo texto em loop (só CSS) */
  efeitos.gradiente = efeitoDeClasse();

  /* 12. neon — letreiro que pisca até acender (só CSS) */
  efeitos.neon = efeitoDeClasse();

  /* 11. glitch — cópias do texto deslocadas em RGB, recortadas em fatias.
        As cópias são pseudo-elementos que leem data-texto. */
  efeitos.glitch = efeitoDeClasse(function (el) {
    el.setAttribute("data-texto", el.textContent.replace(/\s+/g, " ").trim());
    return {};
  });

  /* 13. fatiar — o texto é cortado em três fatias horizontais que deslizam
        de lados opostos até se alinharem. */
  efeitos.fatiar = efeitoDeClasse(function (el) {
    var texto = el.textContent.replace(/\s+/g, " ").trim();
    var fatias = numero(el, "fatias", 3);
    rotular(el, texto);
    el.textContent = "";
    for (var f = 0; f < fatias; f++) {
      var fatia = esconder(criar("tc-fatia", texto));
      fatia.style.setProperty("--f", f);
      fatia.style.setProperty("--n", fatias);
      el.appendChild(fatia);
    }
    return {};
  });

  /* 18. riscar — risca o <s> com um traço e revela o <ins> ao lado */
  efeitos.riscar = efeitoDeClasse(function (el) {
    todos("s, ins", el).forEach(function (no, i) { no.style.setProperty("--m", Math.floor(i / 2)); });
    return {};
  });

  /* 14. trocar — uma palavra sobe e a próxima entra por baixo, em loop
        data-palavras="rápido|bonito|simples"  data-pausa="1800" */
  efeitos.trocar = {
    preparar: function (el) {
      var palavras = (el.dataset.palavras || el.textContent)
        .split("|").map(function (p) { return p.trim(); }).filter(Boolean);
      rotular(el, palavras.join(", "));
      el.textContent = "";
      var janela = esconder(criar("tc-janela"));
      var atual = criar("tc-troca", palavras[0]);
      janela.appendChild(atual);
      el.appendChild(janela);
      return { palavras: palavras, janela: janela, atual: atual, indice: 0, ficha: 0, timer: 0 };
    },

    tocar: function (el, estado) {
      var minhaFicha = ++estado.ficha;
      var pausa = numero(el, "pausa", 1800);
      clearTimeout(estado.timer);

      function ajustarLargura(span) {
        estado.janela.style.width = span.offsetWidth + "px";
      }
      ajustarLargura(estado.atual);
      el.classList.add("tc-ativo");

      function proxima() {
        if (estado.ficha !== minhaFicha || estado.palavras.length < 2) return;
        estado.indice = (estado.indice + 1) % estado.palavras.length;
        var nova = criar("tc-troca tc-entra", estado.palavras[estado.indice]);
        var velha = estado.atual;
        estado.janela.appendChild(nova);
        ajustarLargura(nova);
        velha.classList.add("tc-sai");
        requestAnimationFrame(function () { nova.classList.remove("tc-entra"); });
        setTimeout(function () { if (velha.parentNode) velha.parentNode.removeChild(velha); }, 700);
        estado.atual = nova;
        estado.timer = setTimeout(proxima, pausa);
      }
      estado.timer = setTimeout(proxima, pausa + numero(el, "atraso", 0) * 1000);
    },

    final: function (el, estado) {
      estado.ficha++;
      clearTimeout(estado.timer);
      el.classList.add("tc-ativo");
    }
  };

  /* ---------------------------------------------------------------------
     Motor: encontra os elementos, prepara e dispara ao entrar na tela
     --------------------------------------------------------------------- */

  function tocar(el) {
    var item = registro.get(el);
    if (item) item.efeito.tocar(el, item.estado);
  }

  /** Lê data-atraso / data-passo e os entrega ao CSS como variáveis. */
  function aplicarVariaveis(el) {
    if (el.dataset.atraso != null) el.style.setProperty("--atraso", numero(el, "atraso", 0) + "s");
    if (el.dataset.passo != null) el.style.setProperty("--passo", numero(el, "passo", 30) + "ms");
  }

  function iniciar(raiz) {
    var base = raiz || doc;
    var alvos = todos("[data-tc]", base);
    if (base !== doc && base.matches && base.matches("[data-tc]")) alvos.unshift(base);

    // dispara quando ~25% do elemento aparece, uma única vez
    var observador = null;
    if ("IntersectionObserver" in global) {
      observador = new IntersectionObserver(
        function (entradas) {
          entradas.forEach(function (entrada) {
            if (!entrada.isIntersecting) return;
            observador.unobserve(entrada.target);
            tocar(entrada.target);
          });
        },
        { threshold: 0.25, rootMargin: "0px 0px -8% 0px" }
      );
    }

    alvos.forEach(function (el) {
      if (registro.has(el)) return; // já preparado
      var efeito = efeitos[el.dataset.tc];
      if (!efeito) {
        console.warn('[TextosCineticos] efeito desconhecido: "' + el.dataset.tc + '"');
        return;
      }
      aplicarVariaveis(el);
      var estado = efeito.preparar(el);
      registro.set(el, { efeito: efeito, estado: estado });
      el.classList.add("tc-pronto");

      if (reduzMovimento) {
        efeito.final(el, estado); // sem animação: texto final direto
      } else if (observador) {
        observador.observe(el);
      } else {
        tocar(el); // navegador antigo, sem IntersectionObserver
      }
    });
  }

  /** Toca de novo: o próprio elemento ou todos os [data-tc] de dentro dele. */
  function repetir(alvo) {
    if (!alvo || reduzMovimento) return;
    if (registro.has(alvo)) tocar(alvo);
    todos("[data-tc]", alvo).forEach(tocar);
  }

  global.TextosCineticos = {
    iniciar: iniciar,
    repetir: repetir,
    efeitos: Object.keys(efeitos)
  };

  /* ---------------------------------------------------------------------
     Início automático (desligue com <body data-tc-manual>)
     --------------------------------------------------------------------- */
  function auto() {
    if (!doc.body.hasAttribute("data-tc-manual")) iniciar();
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", auto);
  else auto();

  /* ---------------------------------------------------------------------
     Só da página demo: botões "Repetir" (data-repetir) tocam a área (data-area)
     onde estão. Pode apagar este trecho no seu projeto.
     --------------------------------------------------------------------- */
  doc.addEventListener("click", function (evento) {
    var botao = evento.target.closest && evento.target.closest("[data-repetir]");
    if (!botao) return;
    repetir(botao.closest("[data-area]"));
  });
})(window);
