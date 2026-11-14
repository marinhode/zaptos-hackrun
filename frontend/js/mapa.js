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

  function tela({ lojas = [], lojaDestaque = null } = {}) {
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

  window.ZaptosMapa = { tela };
})();
