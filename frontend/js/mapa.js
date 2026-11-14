// Mapa digital do shopping (RF018): lojas e serviços de cada piso.
//
// Contrato com o app:
//   ZaptosMapa.tela({ lojas, lojaDestaque }) -> { html, montar(raiz) }
//   - lojas: formato de adaptarLoja (api-remota.js): { id, nome, piso, numero, horario, segmento }
//   - lojaDestaque: id da loja a destacar, ou null
//   - html vai dentro do <main>; montar(raiz) liga os eventos.
//
// A planta é desenhada aqui mesmo, em SVG, sem imagens externas. As lojas são
// colocadas pela ordem do número (1xx no Piso 1, 2xx no Piso 2), alternando os
// dois lados do corredor. Tudo o que o SVG mostra também está em texto (lista de
// lojas e legenda), para quem não vê o mapa.

(() => {
  'use strict';

  const PISOS = [1, 2];

  // Planta: viewBox 320 x 440. Corredor vertical no meio.
  const LARG = 320;
  const ALT = 440;
  const MARGEM = 10;
  const CORREDOR = { x: 130, larg: 60 };
  const VAO = 8;
  const ALTURA_IDEAL = 64;

  // Área das lojas em cada piso (no Piso 1 a praça de alimentação ocupa o fundo).
  const AREA = {
    1: { y: MARGEM, alt: 320 },
    2: { y: MARGEM, alt: ALT - 2 * MARGEM },
  };

  // Serviços fixos. Escadas e elevador ficam alinhados nos dois pisos.
  const SERVICOS = {
    1: [
      { tipo: 'elevador', y: 50, onde: 'no começo do corredor, perto da entrada' },
      { tipo: 'escada', y: 150, onde: 'no meio do corredor' },
      { tipo: 'banheiro', y: 250, onde: 'no corredor, antes da praça de alimentação' },
      { tipo: 'atendimento', y: 306, onde: 'no fim do corredor, ao lado da praça de alimentação' },
      { tipo: 'praca', onde: 'no fundo do piso' },
    ],
    2: [
      { tipo: 'elevador', y: 50, onde: 'no começo do corredor' },
      { tipo: 'escada', y: 150, onde: 'no meio do corredor' },
      { tipo: 'banheiro', y: 250, onde: 'no meio do corredor, depois das escadas rolantes' },
    ],
  };

  const NOMES_SERVICO = {
    elevador: 'Elevador',
    escada: 'Escada rolante',
    banheiro: 'Banheiros',
    atendimento: 'Atendimento ao cliente',
    praca: 'Praça de alimentação',
  };

  // Ícones 24x24, traço em currentColor.
  const ICONES = {
    elevador: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 10l3-3 3 3M9 14l3 3 3-3"/>',
    escada: '<path d="M3 19h4l9-11h5"/><path d="M7 19l9-11"/><circle cx="8" cy="6" r="1.6"/><path d="M8 8.5v3"/>',
    banheiro: '<circle cx="7.5" cy="5" r="1.8"/><path d="M5.5 9h4l-.5 5h-3zM6.5 14v6M8.5 14v6"/><circle cx="16.5" cy="5" r="1.8"/><path d="M16.5 8.5l-3 7h6zM15.5 15.5v4.5M17.5 15.5v4.5"/><path d="M12 3v18"/>',
    atendimento: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r="1.3" fill="currentColor" stroke="none"/>',
    praca: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 21V3c-2 1-3 4-3 7h3"/>',
  };

  let contador = 0;

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const primeiroNumero = (v) => {
    const m = String(v ?? '').match(/\d+/);
    return m ? Number(m[0]) : null;
  };

  /** Normaliza a loja: piso e número sempre como números (ou null). */
  function normalizar(l) {
    const numero = primeiroNumero(l.numero);
    let piso = primeiroNumero(l.piso);
    if (!PISOS.includes(piso) && numero !== null) piso = Math.floor(numero / 100);
    return {
      id: l.id,
      nome: String(l.nome ?? ''),
      segmento: String(l.segmento ?? ''),
      horario: String(l.horario ?? ''),
      piso,
      numero,
      numeroTexto: String(l.numero ?? numero ?? ''),
    };
  }

  const truncar = (s, max) => (s.length > max ? `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…` : s);

  const descricaoLoja = (l) =>
    `${l.nome}${l.segmento ? `, ${l.segmento}` : ''}. Piso ${l.piso}, loja ${l.numeroTexto}`;

  const icone = (tipo, classe = '') =>
    `<svg class="mapa-ic ${classe}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONES[tipo]}</svg>`;

  // ---------------------------------------------------------------------
  // Desenho da planta
  // ---------------------------------------------------------------------

  /** Calcula a posição de cada loja e das vagas livres de um piso. */
  function distribuir(lojasDoPiso, piso) {
    const area = AREA[piso];
    const ordenadas = [...lojasDoPiso].sort((a, b) => (a.numero ?? 9999) - (b.numero ?? 9999) || a.nome.localeCompare(b.nome));
    const filasMin = Math.max(1, Math.floor((area.alt + VAO) / (ALTURA_IDEAL + VAO)));
    const filas = Math.max(filasMin, Math.ceil(ordenadas.length / 2));
    const alt = (area.alt - VAO * (filas - 1)) / filas;
    const larg = CORREDOR.x - MARGEM - 5;
    const xEsq = MARGEM;
    const xDir = CORREDOR.x + CORREDOR.larg + 5;

    const vaga = (i) => ({
      x: i % 2 === 0 ? xEsq : xDir,
      y: area.y + Math.floor(i / 2) * (alt + VAO),
      larg,
      alt,
    });

    const posicoes = ordenadas.map((loja, i) => ({ loja, ...vaga(i) }));
    const vagas = [];
    for (let i = ordenadas.length; i < filas * 2; i += 1) vagas.push(vaga(i));
    return { posicoes, vagas };
  }

  function desenharLoja({ loja, x, y, larg, alt }, destaque) {
    const fonteNum = Math.min(15, Math.max(9, alt * 0.24));
    const fonteNome = Math.min(11, Math.max(8, alt * 0.17));
    const cabe = Math.floor((larg - 12) / (fonteNome * 0.58));
    const cx = x + larg / 2;
    const mostrarNome = alt >= 30;
    const yNum = mostrarNome ? y + alt / 2 - fonteNome * 0.35 : y + alt / 2 + fonteNum * 0.35;
    const yNome = y + alt / 2 + fonteNome * 1.15;
    const rotulo = `${descricaoLoja(loja)}${destaque ? ' (em destaque)' : ''}. Ver detalhes`;

    return `
      <g class="mapa-loja${destaque ? ' mapa-loja--destaque' : ''}" role="button" tabindex="0"
         data-loja="${esc(loja.id)}" aria-label="${esc(rotulo)}">
        ${destaque ? `<rect class="mapa-loja__pulso" x="${x}" y="${y}" width="${larg}" height="${alt}" rx="8"/>` : ''}
        <rect class="mapa-loja__forma" x="${x}" y="${y}" width="${larg}" height="${alt}" rx="8"/>
        <text class="mapa-loja__num" x="${cx}" y="${yNum.toFixed(1)}" font-size="${fonteNum.toFixed(1)}" text-anchor="middle">${esc(loja.numeroTexto)}</text>
        ${mostrarNome ? `<text class="mapa-loja__nome" x="${cx}" y="${yNome.toFixed(1)}" font-size="${fonteNome.toFixed(1)}" text-anchor="middle">${esc(truncar(loja.nome, cabe))}</text>` : ''}
      </g>`;
  }

  function desenharServico(s) {
    const cx = CORREDOR.x + CORREDOR.larg / 2;
    return `
      <g class="mapa-servico mapa-servico--${s.tipo}" transform="translate(${cx - 14} ${s.y - 14})">
        <circle cx="14" cy="14" r="14"/>
        <svg x="3" y="3" width="22" height="22" viewBox="0 0 24 24">${ICONES[s.tipo]}</svg>
      </g>`;
  }

  function desenharPiso(piso, lojasDoPiso, destaqueId, idBase) {
    const { posicoes, vagas } = distribuir(lojasDoPiso, piso);
    const area = AREA[piso];
    const fimCorredor = area.y + area.alt;
    const servicos = SERVICOS[piso].filter((s) => s.y !== undefined);
    const temPraca = SERVICOS[piso].some((s) => s.tipo === 'praca');
    const yPraca = fimCorredor + 10;

    return `
      <svg class="mapa-planta" viewBox="0 0 ${LARG} ${ALT}" role="group"
           aria-labelledby="${idBase}-titulo-svg-${piso}">
        <title id="${idBase}-titulo-svg-${piso}">Planta do Piso ${piso}</title>
        <g aria-hidden="true">
          <rect class="mapa-fundo" x="0" y="0" width="${LARG}" height="${ALT}" rx="14"/>
          <rect class="mapa-corredor" x="${CORREDOR.x}" y="${MARGEM}" width="${CORREDOR.larg}"
                height="${(temPraca ? fimCorredor : ALT - MARGEM) - MARGEM}" rx="6"/>
          ${piso === 1 ? `<text class="mapa-rotulo" x="${CORREDOR.x + CORREDOR.larg / 2}" y="${MARGEM + 14}" text-anchor="middle">Entrada</text>` : ''}
          ${vagas.map((v) => `<rect class="mapa-vaga" x="${v.x}" y="${v.y}" width="${v.larg}" height="${v.alt}" rx="8"/>`).join('')}
          ${temPraca ? `
            <rect class="mapa-praca" x="${MARGEM}" y="${yPraca}" width="${LARG - 2 * MARGEM}" height="${ALT - MARGEM - yPraca}" rx="10"/>
            <svg x="${LARG / 2 - 60}" y="${yPraca + (ALT - MARGEM - yPraca) / 2 - 11}" width="22" height="22" viewBox="0 0 24 24" class="mapa-praca__ic">${ICONES.praca}</svg>
            <text class="mapa-praca__txt" x="${LARG / 2 - 32}" y="${yPraca + (ALT - MARGEM - yPraca) / 2 + 4}">Praça de alimentação</text>` : ''}
          ${servicos.map(desenharServico).join('')}
        </g>
        ${posicoes.map((p) => desenharLoja(p, p.loja.id === destaqueId)).join('')}
      </svg>`;
  }

  // ---------------------------------------------------------------------
  // Partes em texto
  // ---------------------------------------------------------------------

  function htmlCartao(loja, destaqueId) {
    if (!loja) {
      return '<p class="mapa-cartao__dica">Toque numa loja no mapa ou na lista para ver os detalhes.</p>';
    }
    return `
      ${loja.id === destaqueId ? '<span class="mapa-cartao__selo">Em destaque</span>' : ''}
      <h3 class="mapa-cartao__nome">${esc(loja.nome)}</h3>
      ${loja.segmento ? `<p class="mapa-cartao__seg">${esc(loja.segmento)}</p>` : ''}
      <p class="mapa-cartao__onde">Piso ${esc(loja.piso)}, loja ${esc(loja.numeroTexto)}</p>
      ${loja.horario ? `<p class="mapa-cartao__hora">${esc(loja.horario)}</p>` : ''}
      <a class="btn btn--primario btn--pequeno mapa-cartao__link" href="#/loja/${encodeURIComponent(loja.id)}">Ver produtos</a>`;
  }

  function htmlLegenda(piso) {
    return `
      <ul class="mapa-legenda">
        ${SERVICOS[piso].map((s) => `
          <li>${icone(s.tipo, `mapa-ic--${s.tipo}`)}
            <span><strong>${NOMES_SERVICO[s.tipo]}</strong> <span class="mapa-legenda__onde">${s.onde}</span></span>
          </li>`).join('')}
      </ul>`;
  }

  function htmlLista(lojasDoPiso, destaqueId) {
    if (!lojasDoPiso.length) return '<p class="mapa-vazio">Nenhuma loja cadastrada neste piso.</p>';
    const ordenadas = [...lojasDoPiso].sort((a, b) => (a.numero ?? 9999) - (b.numero ?? 9999));
    return `
      <ul class="mapa-lista">
        ${ordenadas.map((l) => `
          <li>
            <button type="button" class="mapa-lista__item${l.id === destaqueId ? ' mapa-lista__item--destaque' : ''}"
                    data-loja="${esc(l.id)}" aria-pressed="${l.id === destaqueId}" aria-label="${esc(`${descricaoLoja(l)}. Ver detalhes`)}">
              <span class="mapa-lista__num">${esc(l.numeroTexto)}</span>
              <span class="mapa-lista__txt">
                <strong>${esc(l.nome)}</strong>
                ${l.segmento ? `<span>${esc(l.segmento)}</span>` : ''}
              </span>
              ${l.id === destaqueId ? '<span class="mapa-lista__selo">Em destaque</span>' : ''}
            </button>
          </li>`).join('')}
      </ul>`;
  }

  // ---------------------------------------------------------------------
  // Tela
  // ---------------------------------------------------------------------

  // Mapa esquemático (desenhado aqui): usado quando a planta real não carrega.
  function telaEsquematica({ lojas = [], lojaDestaque = null } = {}) {
    contador += 1;
    const idBase = `mapa${contador}`;
    const todas = (Array.isArray(lojas) ? lojas : []).map(normalizar);
    const destaque = todas.find((l) => String(l.id) === String(lojaDestaque) && PISOS.includes(l.piso)) || null;
    const destaqueId = destaque ? destaque.id : null;
    const pisoInicial = destaque ? destaque.piso : PISOS[0];
    const porPiso = Object.fromEntries(PISOS.map((p) => [p, todas.filter((l) => l.piso === p)]));

    const html = `
      <div class="mapa" data-mapa="${idBase}">
        <div class="mapa-abas" role="tablist" aria-label="Pisos do shopping">
          ${PISOS.map((p) => `
            <button type="button" role="tab" class="mapa-aba" id="${idBase}-aba-${p}" data-piso="${p}"
                    aria-controls="${idBase}-painel-${p}" aria-selected="${p === pisoInicial}"
                    tabindex="${p === pisoInicial ? 0 : -1}">Piso ${p}</button>`).join('')}
        </div>

        ${PISOS.map((p) => `
          <section class="mapa-painel" role="tabpanel" id="${idBase}-painel-${p}" data-piso="${p}"
                   aria-labelledby="${idBase}-aba-${p}" ${p === pisoInicial ? '' : 'hidden'}>
            <div class="mapa-planta-caixa">
              ${desenharPiso(p, porPiso[p], destaqueId, idBase)}
            </div>
            <h3 class="mapa-subtitulo" id="${idBase}-serv-${p}">Serviços no Piso ${p}</h3>
            ${htmlLegenda(p)}
          </section>`).join('')}

        <section class="mapa-cartao" aria-live="polite" aria-label="Loja selecionada" data-cartao>
          ${htmlCartao(destaque, destaqueId)}
        </section>

        ${PISOS.map((p) => `
          <section class="mapa-lojas" data-lista-piso="${p}" aria-labelledby="${idBase}-lojas-${p}" ${p === pisoInicial ? '' : 'hidden'}>
            <h3 class="mapa-subtitulo" id="${idBase}-lojas-${p}">Lojas neste piso <span class="mapa-subtitulo__piso">(Piso ${p})</span></h3>
            ${htmlLista(porPiso[p], destaqueId)}
          </section>`).join('')}
      </div>`;

    function montar(raiz) {
      const mapa = raiz && raiz.querySelector(`[data-mapa="${idBase}"]`);
      if (!mapa) return;
      const abas = [...mapa.querySelectorAll('.mapa-aba')];
      const cartao = mapa.querySelector('[data-cartao]');
      const porId = new Map(todas.map((l) => [String(l.id), l]));

      function mostrarPiso(piso, focar) {
        for (const aba of abas) {
          const ativa = Number(aba.dataset.piso) === piso;
          aba.setAttribute('aria-selected', String(ativa));
          aba.tabIndex = ativa ? 0 : -1;
          if (ativa && focar) aba.focus();
        }
        for (const el of mapa.querySelectorAll('.mapa-painel, [data-lista-piso]')) {
          el.hidden = Number(el.dataset.piso || el.dataset.listaPiso) !== piso;
        }
      }

      function selecionar(id) {
        const loja = porId.get(String(id));
        if (!loja) return;
        for (const el of mapa.querySelectorAll('[data-loja]')) {
          const sel = el.dataset.loja === String(loja.id);
          el.classList.toggle('mapa-selecionada', sel);
          if (el.tagName === 'BUTTON') el.setAttribute('aria-pressed', String(sel));
        }
        cartao.innerHTML = htmlCartao(loja, destaqueId);
      }

      for (const aba of abas) {
        aba.addEventListener('click', () => mostrarPiso(Number(aba.dataset.piso), false));
      }
      mapa.querySelector('.mapa-abas').addEventListener('keydown', (ev) => {
        const i = abas.indexOf(document.activeElement);
        if (i < 0) return;
        let j = null;
        if (ev.key === 'ArrowRight') j = (i + 1) % abas.length;
        else if (ev.key === 'ArrowLeft') j = (i - 1 + abas.length) % abas.length;
        else if (ev.key === 'Home') j = 0;
        else if (ev.key === 'End') j = abas.length - 1;
        if (j === null) return;
        ev.preventDefault();
        mostrarPiso(Number(abas[j].dataset.piso), true);
      });

      mapa.addEventListener('click', (ev) => {
        const alvo = ev.target.closest('[data-loja]');
        if (alvo && mapa.contains(alvo)) selecionar(alvo.dataset.loja);
      });
      mapa.addEventListener('keydown', (ev) => {
        const alvo = ev.target.closest && ev.target.closest('.mapa-loja');
        if (!alvo) return;
        if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
          ev.preventDefault();
          selecionar(alvo.dataset.loja);
        }
      });

      if (destaque) selecionar(destaque.id);
    }

    return { html, montar };
  }

  // ---------------------------------------------------------------------
  // Planta real (Planta Mix oficial do shopping)
  // Imagens e posições geradas por scripts/gerar_mapa.py a partir do PDF:
  // data/mapa-planta.json -> { pisos: { "1": { imagem, largura, altura,
  //   lojas: { "112": [x%, y%] }, servicos: [{ tipo, pos: [x%, y%] }] } } }
  // As lojas do app aparecem pelo número (Loja 112 -> "112").
  // ---------------------------------------------------------------------

  const NOMES_SERVICO_PLANTA = {
    banheiro: 'Banheiros',
    escada: 'Escadas',
    eventos: 'Praça de eventos',
    familia: 'Espaço família',
    elevador: 'Elevador',
  };
  const ICONES_PLANTA = {
    ...ICONES,
    eventos: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>',
    familia: '<circle cx="8" cy="6" r="2"/><circle cx="16" cy="7" r="1.6"/><path d="M5 21v-7l-1-4h8l-1 4v7M14 21v-5l-1-3h6l-1 3v5"/>',
  };
  const ZOOM_MAX = 6;
  const ZOOM_FOCO = 3.2;
  const semMovimento = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let dadosPlanta = null; // cache da planta entre aberturas da tela
  async function carregarPlanta() {
    if (dadosPlanta) return dadosPlanta;
    const r = await fetch('data/mapa-planta.json');
    if (!r.ok) throw new Error('planta indisponível');
    const dados = await r.json();
    if (!dados || !dados.pisos) throw new Error('planta inválida');
    dadosPlanta = dados;
    return dados;
  }

  const chaveNumero = (l) => String(l.numeroTexto || l.numero || '').replace(/^loja\s*/i, '').replace(/\s+/g, '').toUpperCase();

  function htmlPino(loja, pos, destaqueId) {
    const destaque = loja.id === destaqueId;
    return `
      <button type="button" class="planta__pino${destaque ? ' planta__pino--destaque' : ''}" data-loja="${esc(loja.id)}"
              style="left:${pos[0]}%;top:${pos[1]}%"
              aria-label="${esc(`${descricaoLoja(loja)}${destaque ? ' (em destaque)' : ''}. Ver detalhes`)}">
        <span class="planta__pino-rotulo">${esc(truncar(loja.nome, 18))}</span>
        <span class="planta__pino-ponto" aria-hidden="true"></span>
      </button>`;
  }

  function htmlServicoPlanta(s) {
    return `<span class="planta__servico planta__servico--${esc(s.tipo)}" style="left:${s.pos[0]}%;top:${s.pos[1]}%"
                  title="${esc(NOMES_SERVICO_PLANTA[s.tipo] || s.tipo)}" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">${ICONES_PLANTA[s.tipo] || ''}</svg></span>`;
  }

  function htmlLegendaPlanta(servicos) {
    const tipos = [...new Set(servicos.map((s) => s.tipo))].filter((t) => NOMES_SERVICO_PLANTA[t]);
    if (!tipos.length) return '';
    return `
      <ul class="mapa-legenda">
        ${tipos.map((t) => `
          <li><span class="planta__servico planta__servico--${t} planta__servico--legenda" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">${ICONES_PLANTA[t] || ''}</svg></span>
            <span><strong>${NOMES_SERVICO_PLANTA[t]}</strong>
              <span class="mapa-legenda__onde">${servicos.filter((s) => s.tipo === t).length} no piso</span></span>
          </li>`).join('')}
      </ul>`;
  }

  // Zoom e arrastar sobre a planta (dedo, mouse, roda e teclado).
  function criarVisor(visor, info) {
    const camada = visor.querySelector('.planta__camada');
    const estado = { s: 1, x: 0, y: 0, w: 0, h: 0 };
    const ponteiros = new Map();
    let arrastou = false;
    let anterior = null;

    function medir() {
      const W = visor.clientWidth;
      if (!W) return false;
      estado.w = W;
      estado.h = W * info.altura / info.largura;
      camada.style.width = `${estado.w}px`;
      camada.style.height = `${estado.h}px`;
      return true;
    }

    function limitar() {
      const W = visor.clientWidth;
      const H = visor.clientHeight;
      const lw = estado.w * estado.s;
      const lh = estado.h * estado.s;
      estado.x = lw <= W ? (W - lw) / 2 : Math.min(0, Math.max(W - lw, estado.x));
      estado.y = lh <= H ? (H - lh) / 2 : Math.min(0, Math.max(H - lh, estado.y));
    }

    function aplicar(animado) {
      limitar();
      camada.classList.toggle('planta__camada--animada', !!animado && !semMovimento());
      camada.style.transform = `translate(${estado.x}px, ${estado.y}px) scale(${estado.s})`;
      camada.style.setProperty('--s', estado.s);
      visor.classList.toggle('planta__visor--perto', estado.s >= 2.2);
    }

    function zoomEm(novo, px, py, animado) {
      const s = Math.min(ZOOM_MAX, Math.max(1, novo));
      const wx = (px - estado.x) / estado.s;
      const wy = (py - estado.y) / estado.s;
      estado.s = s;
      estado.x = px - wx * s;
      estado.y = py - wy * s;
      aplicar(animado);
    }

    const centro = () => [visor.clientWidth / 2, visor.clientHeight / 2];

    function focar(pos, zoom = ZOOM_FOCO) {
      if (!medir()) return;
      estado.s = zoom;
      estado.x = visor.clientWidth / 2 - (pos[0] / 100) * estado.w * zoom;
      estado.y = visor.clientHeight / 2 - (pos[1] / 100) * estado.h * zoom;
      aplicar(true);
    }

    function verTudo() {
      if (!medir()) return;
      estado.s = 1;
      aplicar(true);
    }

    // --- dedo e mouse ---
    visor.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('.planta__zoom')) return;
      ponteiros.set(ev.pointerId, [ev.clientX, ev.clientY]);
      arrastou = false;
      anterior = null;
    });
    const aoMover = (ev) => {
      if (!visor.isConnected) { desligar(); return; } // a tela do mapa foi fechada
      if (!ponteiros.has(ev.pointerId)) return;
      const antes = ponteiros.get(ev.pointerId);
      ponteiros.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (ponteiros.size === 1) {
        const dx = ev.clientX - antes[0];
        const dy = ev.clientY - antes[1];
        if (Math.abs(dx) + Math.abs(dy) > 1) arrastou = true;
        estado.x += dx;
        estado.y += dy;
        aplicar(false);
      } else if (ponteiros.size === 2) {
        const [a, b] = [...ponteiros.values()];
        const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const caixa = visor.getBoundingClientRect();
        const mx = (a[0] + b[0]) / 2 - caixa.left;
        const my = (a[1] + b[1]) / 2 - caixa.top;
        if (anterior) zoomEm(estado.s * (dist / anterior), mx, my, false);
        anterior = dist;
        arrastou = true;
      }
    };
    const soltar = (ev) => { ponteiros.delete(ev.pointerId); if (ponteiros.size < 2) anterior = null; };
    function desligar() {
      window.removeEventListener('pointermove', aoMover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
    }
    window.addEventListener('pointermove', aoMover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
    // arrastar não conta como toque num pino
    visor.addEventListener('click', (ev) => {
      if (arrastou) { ev.stopPropagation(); ev.preventDefault(); arrastou = false; }
    }, true);

    visor.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const caixa = visor.getBoundingClientRect();
      zoomEm(estado.s * Math.exp(-ev.deltaY * 0.0015), ev.clientX - caixa.left, ev.clientY - caixa.top, false);
    }, { passive: false });

    // --- botões e teclado ---
    visor.querySelector('[data-zoom="mais"]').addEventListener('click', () => zoomEm(estado.s * 1.6, ...centro(), true));
    visor.querySelector('[data-zoom="menos"]').addEventListener('click', () => zoomEm(estado.s / 1.6, ...centro(), true));
    visor.querySelector('[data-zoom="tudo"]').addEventListener('click', verTudo);
    visor.addEventListener('keydown', (ev) => {
      if (ev.target !== visor) return;
      const passo = 60;
      const acoes = {
        ArrowLeft: () => { estado.x += passo; aplicar(true); },
        ArrowRight: () => { estado.x -= passo; aplicar(true); },
        ArrowUp: () => { estado.y += passo; aplicar(true); },
        ArrowDown: () => { estado.y -= passo; aplicar(true); },
        '+': () => zoomEm(estado.s * 1.6, ...centro(), true),
        '=': () => zoomEm(estado.s * 1.6, ...centro(), true),
        '-': () => zoomEm(estado.s / 1.6, ...centro(), true),
        0: verTudo,
      };
      if (acoes[ev.key]) { ev.preventDefault(); acoes[ev.key](); }
    });

    if (window.ResizeObserver) new ResizeObserver(() => { if (medir()) aplicar(false); }).observe(visor);

    return { medir, aplicar, focar, verTudo };
  }

  function telaPlanta(dados, { lojas = [], lojaDestaque = null } = {}) {
    contador += 1;
    const idBase = `planta${contador}`;
    const pisos = Object.keys(dados.pisos).map(Number).sort();
    const todas = (Array.isArray(lojas) ? lojas : []).map(normalizar);
    const posicao = (l) => (dados.pisos[l.piso] && dados.pisos[l.piso].lojas[chaveNumero(l)]) || null;
    const destaque = todas.find((l) => String(l.id) === String(lojaDestaque)) || null;
    const destaqueId = destaque ? destaque.id : null;
    const pisoInicial = destaque && pisos.includes(destaque.piso) ? destaque.piso : pisos[0];
    const porPiso = Object.fromEntries(pisos.map((p) => [p, todas.filter((l) => l.piso === p)]));

    const html = `
      <div class="mapa mapa--planta" data-mapa="${idBase}">
        <div class="mapa-abas" role="tablist" aria-label="Pisos do shopping">
          ${pisos.map((p) => `
            <button type="button" role="tab" class="mapa-aba" id="${idBase}-aba-${p}" data-piso="${p}"
                    aria-controls="${idBase}-painel-${p}" aria-selected="${p === pisoInicial}"
                    tabindex="${p === pisoInicial ? 0 : -1}">Piso ${p}</button>`).join('')}
        </div>

        ${pisos.map((p) => {
          const info = dados.pisos[p];
          const comPos = porPiso[p].filter((l) => posicao(l));
          return `
          <section class="mapa-painel" role="tabpanel" id="${idBase}-painel-${p}" data-piso="${p}"
                   aria-labelledby="${idBase}-aba-${p}" ${p === pisoInicial ? '' : 'hidden'}>
            <div class="planta__visor" tabindex="0" data-visor="${p}"
                 aria-label="Planta do ${esc(info.nome)}. Arraste para mover, use dois dedos ou os botões para aproximar.">
              <div class="planta__camada">
                <img src="${esc(info.imagem)}" alt="" draggable="false" width="${info.largura}" height="${info.altura}">
                ${(info.servicos || []).map(htmlServicoPlanta).join('')}
                ${comPos.map((l) => htmlPino(l, posicao(l), destaqueId)).join('')}
              </div>
              <div class="planta__zoom">
                <button type="button" data-zoom="mais" aria-label="Aproximar">+</button>
                <button type="button" data-zoom="menos" aria-label="Afastar">−</button>
                <button type="button" data-zoom="tudo" aria-label="Ver o piso inteiro">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
                </button>
              </div>
            </div>
            <p class="planta__fonte">${esc(info.nome)}: planta oficial do shopping. As lojas em dourado são as do app.</p>
            <h3 class="mapa-subtitulo">Serviços no Piso ${p}</h3>
            ${htmlLegendaPlanta(info.servicos || [])}
          </section>`;
        }).join('')}

        <section class="mapa-cartao" aria-live="polite" aria-label="Loja selecionada" data-cartao>
          ${htmlCartao(destaque, destaqueId)}
        </section>

        ${pisos.map((p) => `
          <section class="mapa-lojas" data-lista-piso="${p}" aria-labelledby="${idBase}-lojas-${p}" ${p === pisoInicial ? '' : 'hidden'}>
            <h3 class="mapa-subtitulo" id="${idBase}-lojas-${p}">Lojas do app neste piso <span class="mapa-subtitulo__piso">(Piso ${p})</span></h3>
            ${htmlLista(porPiso[p], destaqueId)}
          </section>`).join('')}
      </div>`;

    function montar(raiz) {
      const mapa = raiz && raiz.querySelector(`[data-mapa="${idBase}"]`);
      if (!mapa) return;
      const abas = [...mapa.querySelectorAll('.mapa-aba')];
      const cartao = mapa.querySelector('[data-cartao]');
      const porId = new Map(todas.map((l) => [String(l.id), l]));
      const visores = {};
      for (const el of mapa.querySelectorAll('[data-visor]')) visores[el.dataset.visor] = criarVisor(el, dados.pisos[el.dataset.visor]);

      function mostrarPiso(piso, focarAba) {
        for (const aba of abas) {
          const ativa = Number(aba.dataset.piso) === piso;
          aba.setAttribute('aria-selected', String(ativa));
          aba.tabIndex = ativa ? 0 : -1;
          if (ativa && focarAba) aba.focus();
        }
        for (const el of mapa.querySelectorAll('.mapa-painel, [data-lista-piso]')) {
          el.hidden = Number(el.dataset.piso || el.dataset.listaPiso) !== piso;
        }
        const v = visores[piso];
        if (v && v.medir()) v.aplicar(false); // o painel estava escondido: mede agora
      }

      function selecionar(id, centralizar) {
        const loja = porId.get(String(id));
        if (!loja) return;
        for (const el of mapa.querySelectorAll('[data-loja]')) {
          const sel = el.dataset.loja === String(loja.id);
          el.classList.toggle('mapa-selecionada', sel);
          if (el.classList.contains('mapa-lista__item')) el.setAttribute('aria-pressed', String(sel));
        }
        cartao.innerHTML = htmlCartao(loja, destaqueId);
        const pos = posicao(loja);
        if (centralizar && pos) {
          mostrarPiso(loja.piso, false);
          visores[loja.piso].focar(pos);
        }
      }

      for (const aba of abas) aba.addEventListener('click', () => mostrarPiso(Number(aba.dataset.piso), false));
      mapa.querySelector('.mapa-abas').addEventListener('keydown', (ev) => {
        const i = abas.indexOf(document.activeElement);
        if (i < 0) return;
        const j = { ArrowRight: (i + 1) % abas.length, ArrowLeft: (i - 1 + abas.length) % abas.length, Home: 0, End: abas.length - 1 }[ev.key];
        if (j === undefined) return;
        ev.preventDefault();
        mostrarPiso(Number(abas[j].dataset.piso), true);
      });
      mapa.addEventListener('click', (ev) => {
        const alvo = ev.target.closest('[data-loja]');
        if (!alvo || !mapa.contains(alvo)) return;
        // tocar na lista leva até a loja na planta; tocar no pino só abre o cartão
        selecionar(alvo.dataset.loja, alvo.classList.contains('mapa-lista__item'));
      });

      mostrarPiso(pisoInicial, false);
      if (destaque && posicao(destaque)) {
        selecionar(destaque.id, false);
        requestAnimationFrame(() => visores[destaque.piso].focar(posicao(destaque)));
      }
    }

    return { html, montar };
  }

  // Tenta a planta real; se ela não carregar, usa o mapa esquemático.
  function tela(opcoes = {}) {
    contador += 1;
    const id = `mapa-carga${contador}`;
    return {
      html: `<div data-mapa-carga="${id}"><p class="carregando">Carregando a planta do shopping…</p></div>`,
      montar(raiz) {
        const caixa = raiz && raiz.querySelector(`[data-mapa-carga="${id}"]`);
        if (!caixa) return;
        carregarPlanta()
          .then((dados) => telaPlanta(dados, opcoes))
          .catch(() => telaEsquematica(opcoes))
          .then((t) => {
            if (!caixa.isConnected) return; // a pessoa já saiu da tela
            caixa.innerHTML = t.html;
            t.montar(caixa);
          });
      },
    };
  }

  window.ZaptosMapa = { tela };
})();
