// Telas e navegação do Zaptos (SPA com rotas por hash: #/buscar, #/produto/1 ...).
(function () {
  'use strict';

  // Escolhida em iniciar(): API Python (js/api-remota.js) ou simulação (js/api.js).
  let API = window.ZaptosApiDemo;
  let lojaDoLojista = null; // loja do lojista logado, carregada no primeiro acesso ao painel

  async function lojaAtual() {
    if (lojaDoLojista == null) lojaDoLojista = await API.lojaDoLojista();
    return lojaDoLojista;
  }

  const app = document.getElementById('app');
  const conteudo = document.getElementById('conteudo');
  const elTitulo = document.getElementById('titulo');
  const elSubtitulo = document.getElementById('subtitulo');
  const elLogo = document.getElementById('logo');
  const btnVoltar = document.getElementById('btn-voltar');
  const tabbar = document.getElementById('tabbar');
  const btnAvisos = document.getElementById('btn-avisos');
  const contadorAvisos = document.getElementById('contador-avisos');

  // ---------- utilitários ----------

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);

  function brl(valor) {
    const inteiro = Number.isInteger(valor);
    return 'R$ ' + valor.toLocaleString('pt-BR', {
      minimumFractionDigits: inteiro ? 0 : 2,
      maximumFractionDigits: inteiro ? 0 : 2,
    });
  }

  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function dataCurta(iso) {
    const d = new Date(iso);
    return `${d.getDate()} ${MESES[d.getMonth()]}`;
  }

  function saudacao() {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  const ICONES = {
    poltrona: '<path d="M6 11V8a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3"/><path d="M4 11a2 2 0 0 1 2 2v2h12v-2a2 2 0 1 1 4 0v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z"/><path d="M6 18v2M18 18v2"/>',
    mesa: '<path d="M2 9h20"/><path d="M5 9v11M19 9v11"/><path d="M5 14h14"/>',
    luminaria: '<path d="M5 21h8"/><path d="M9 21V9a5 5 0 0 1 10 0"/><path d="M15 9h8l-4 4z"/>',
    tenis: '<path d="M2 17v-5l5-1 3-4 3 3 5 1.5a4 4 0 0 1 4 3.5v2z"/><path d="M2 17h20v2H2z"/>',
    loja: '<path d="M4 10v10h16V10"/><path d="M3 10l2-6h14l2 6z"/><path d="M10 20v-5h4v5"/>',
    busca: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    sacola: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    local: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
    alerta: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5"/><path d="M12 16.5h.01"/>',
    regua: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  };
  const icone = (nome, classe = '') =>
    `<svg class="ico ${classe}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome] || ICONES.poltrona}</svg>`;

  // Miniatura do produto: imagem real (quando houver) ou ilustração.
  function midia(p, classe = '') {
    if (p.imagens && p.imagens.length) {
      return `<div class="thumb ${classe}"><img src="${esc(p.imagens[0])}" alt="" loading="lazy" data-fallback></div>`;
    }
    return `<div class="thumb ${classe}">${icone(p.icone)}</div>`;
  }

  // RNF004: imagem que não carrega vira uma imagem padrão, sem tela de erro.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.hasAttribute('data-fallback')) {
      img.removeAttribute('data-fallback');
      img.src = 'img/produto-padrao.svg';
    }
  }, true);

  function badgeEstoque(n) {
    if (n <= 0) return '<span class="badge badge--perigo">Esgotado</span>';
    if (n === 1) return '<span class="badge badge--ok">Última unidade</span>';
    return `<span class="badge badge--ok">${n} na loja</span>`;
  }

  const STATUS = {
    pendente: ['Aguardando pagamento', 'aviso'],
    aprovado: ['Pronto para retirar', 'ok'],
    retirado: ['Retirado', 'neutro'],
    expirado: ['Reserva expirou', 'perigo'],
    cancelado: ['Cancelado', 'neutro'],
  };
  function badgeStatus(status) {
    const [texto, tipo] = STATUS[status] || [status, 'neutro'];
    return `<span class="badge badge--${tipo}">${esc(texto)}</span>`;
  }

  const localLoja = (l) => `${esc(l.nome)}, piso ${l.piso}, loja ${esc(l.numero)}`;

  function vazio(ico, titulo, texto, acao) {
    return `<div class="vazio">${icone(ico)}<h2>${esc(titulo)}</h2>${texto ? `<p>${esc(texto)}</p>` : ''}${acao || ''}</div>`;
  }

  function campoBusca(valor) {
    return `
      <form class="busca" role="search" data-busca>
        <label class="sr-only" for="campo-busca">Buscar produtos ou lojas</label>
        ${icone('busca')}
        <input id="campo-busca" type="search" name="q" value="${esc(valor)}"
               placeholder="Buscar produtos ou lojas" autocomplete="off" enterkeyhint="search">
      </form>`;
  }

  // Ao buscar, mantém os filtros que já estavam ativos.
  function ligarBusca(raiz, consultaAtual, naTelaDeBusca) {
    const form = raiz.querySelector('[data-busca]');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = new URLSearchParams(consultaAtual || '');
      const termo = form.q.value.trim();
      if (termo) q.set('q', termo); else q.delete('q');
      const s = q.toString();
      ir('#/buscar' + (s ? '?' + s : ''), !!naTelaDeBusca);
    });
  }

  // ---------- rotas ----------

  let aoSairFns = [];
  const aoSair = (fn) => aoSairFns.push(fn);
  let navegacao = 0;

  function ir(hash, substituir) {
    if (substituir) location.replace(hash);
    else location.hash = hash;
  }

  function lerHash() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [caminho, qs] = h.split('?');
    return { caminho, consulta: new URLSearchParams(qs || '') };
  }

  const ROTAS = [
    [/^\/$/, telaInicio],
    [/^\/buscar$/, telaBuscar],
    [/^\/loja\/(\d+)$/, telaLoja],
    [/^\/produto\/(\d+)$/, telaProduto],
    [/^\/reservar\/(\d+)$/, telaReservar],
    [/^\/pedido\/(\d+)$/, telaComprovante],
    [/^\/pedidos$/, telaPedidos],
    [/^\/ajuda$/, telaAjuda],
    [/^\/perfil$/, telaPerfil],
    [/^\/lojista$/, telaPainel],
    [/^\/lojista\/validar$/, telaValidar],
    [/^\/entrar$/, telaEntrar],
    [/^\/cadastro$/, telaCadastro],
    [/^\/lojista\/produto\/novo$/, telaProdutoLojista],
    [/^\/lojista\/produto\/(\d+)$/, telaProdutoLojista],
    [/^\/avisos$/, telaAvisos],
    [/^\/mapa$/, telaMapa],
  ];

  // ---------- sessão e acesso por perfil (RF015, RNF006) ----------

  // Telas que exigem login, e de qual perfil.
  const ACESSO = [
    [/^\/(reservar|pedido|pedidos)(\/|$)/, 'cliente'],
    [/^\/lojista(\/|$)/, 'lojista'],
  ];

  // No modo demonstração não há login: tudo fica liberado.
  const sessao = () => (API.usuario ? API.usuario() : { perfil: 'demo', nome: `${API.cliente().nome} ${API.cliente().sobrenome}` });
  const NOME_PERFIL = { cliente: 'clientes', lojista: 'lojistas', admin: 'a administração', atendente: 'atendentes' };

  function irParaEntrar(perfil) {
    const volta = encodeURIComponent(location.hash || '#/');
    ir(`#/entrar?volta=${volta}${perfil ? `&perfil=${perfil}` : ''}`, true);
  }

  function telaOutroPerfil(perfil) {
    return {
      titulo: 'Área restrita',
      aba: perfil === 'cliente' ? 'pedidos' : null,
      voltar: '#/',
      html: vazio('alerta', `Esta área é para ${NOME_PERFIL[perfil] || perfil}`,
        sessao()
          ? `Você está logado como ${sessao().nome} (${sessao().perfil}), talvez em outra aba. Para continuar, entre com uma conta de ${perfil}.`
          : 'Para continuar, entre com outra conta.',
        '<button class="btn btn--primario" type="button" data-trocar>Entrar com outra conta</button>'),
      montar: (raiz) => raiz.querySelector('[data-trocar]').addEventListener('click', () => {
        API.sair();
        lojaDoLojista = null;
        irParaEntrar(perfil);
      }),
    };
  }

  async function rotear() {
    aoSairFns.forEach((fn) => { try { fn(); } catch (e) { /* ignora */ } });
    aoSairFns = [];

    const { caminho, consulta } = lerHash();
    let tela = telaNaoEncontrada;
    let params = [];
    for (const [re, fn] of ROTAS) {
      const m = caminho.match(re);
      if (m) { tela = fn; params = m.slice(1).map(Number); break; }
    }

    const exigido = (ACESSO.find(([re]) => re.test(caminho)) || [])[1];
    if (exigido) {
      const s = sessao();
      if (!s) { irParaEntrar(exigido); return; }
      if (s.perfil !== 'demo' && s.perfil !== exigido) tela = () => telaOutroPerfil(exigido);
    }

    const minha = ++navegacao;
    let v;
    try {
      v = await tela(params, consulta);
    } catch (err) {
      if (err && (err.codigo === 'NAO_AUTENTICADO' || err.codigo === 'SESSAO_EXPIRADA')) {
        if (minha === navegacao) irParaEntrar(exigido);
        return;
      }
      // O login foi trocado em outra aba: a API respondeu com o perfil novo.
      if (err && err.codigo === 'SEM_PERMISSAO' && API.iniciar) {
        try { await API.iniciar(); } catch (e) { /* segue com o aviso */ }
        if (minha !== navegacao) return;
        mostrar(exigido ? telaOutroPerfil(exigido) : telaErro(err));
        return;
      }
      console.error(err);
      v = telaErro(err);
    }
    if (minha !== navegacao) return; // o usuário já navegou para outra tela
    mostrar(v);
  }

  function mostrar(v) {
    elTitulo.textContent = v.titulo;
    elSubtitulo.textContent = v.subtitulo || '';
    document.title = `${v.titulo} · Capim Dourado`;
    elLogo.hidden = !v.logo;
    // Na tela inicial, o logo já diz "Capim Dourado Shopping": o título fica só para leitores de tela.
    elLogo.closest('.topbar').classList.toggle('topbar--marca', !!v.logo && v.titulo === 'Capim Dourado');
    btnVoltar.hidden = !v.voltar;
    btnVoltar.dataset.destino = typeof v.voltar === 'string' ? v.voltar : '';

    const semAbas = v.aba === null;
    tabbar.hidden = semAbas;
    app.classList.toggle('app--sem-tabbar', semAbas);
    tabbar.querySelectorAll('a').forEach((a) => {
      if (a.dataset.aba === v.aba) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    conteudo.innerHTML = v.html;
    window.scrollTo(0, 0);
    if (v.montar) v.montar(conteudo);
    conteudo.focus({ preventScroll: true });
    atualizarAvisos();
  }

  // ---------- sino de avisos (RF007) ----------

  let consultandoAvisos = false;
  async function atualizarAvisos() {
    const logado = API.avisos && API.usuario && API.usuario();
    btnAvisos.hidden = !logado;
    if (!logado || consultandoAvisos) return;
    consultandoAvisos = true;
    try {
      const { naoLidas } = await API.avisos();
      contadorAvisos.hidden = naoLidas < 1;
      contadorAvisos.textContent = naoLidas > 9 ? '9+' : String(naoLidas);
      btnAvisos.setAttribute('aria-label', naoLidas ? `Avisos: ${naoLidas} não lido${naoLidas > 1 ? 's' : ''}` : 'Avisos');
    } catch (e) {
      /* sem conexão: tenta de novo na próxima vez */
    } finally {
      consultandoAvisos = false;
    }
  }
  // confere de tempos em tempos (só com a aba visível)
  setInterval(() => { if (!document.hidden) atualizarAvisos(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizarAvisos(); });

  const ICONE_AVISO = {
    pagamento_aprovado: 'check',
    nova_retirada: 'sacola',
    retirada_confirmada: 'check',
    reserva_expirada: 'alerta',
  };

  function quandoFoi(iso) {
    const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return `há ${min} min`;
    if (min < 24 * 60) return `há ${Math.round(min / 60)} h`;
    return dataCurta(iso);
  }

  async function telaAvisos() {
    if (!API.avisos) {
      return { titulo: 'Avisos', aba: 'perfil', voltar: '#/', html: vazio('alerta', 'Disponível só com o servidor', '') };
    }
    const s = sessao();
    if (!s) { irParaEntrar(null); return telaNaoEncontrada(); }
    const { avisos } = await API.avisos();
    const destino = (a) => {
      if (!a.pedidoId) return null;
      if (s.perfil === 'lojista') return '#/lojista';
      return `#/pedido/${a.pedidoId}`;
    };
    return {
      titulo: 'Avisos',
      subtitulo: 'Pagamentos, retiradas e reservas',
      aba: s.perfil === 'cliente' ? 'pedidos' : null,
      voltar: true,
      html: avisos.length ? `
        <ul class="lista avisos">
          ${avisos.map((a) => {
            const link = destino(a);
            const corpo = `
              <div class="thumb thumb--p aviso__icone aviso__icone--${esc(a.tipo)}">${icone(ICONE_AVISO[a.tipo] || 'check')}</div>
              <div class="item__info">
                <span class="item__nome">${esc(a.titulo)}${a.lido ? '' : '<span class="sr-only"> (novo)</span>'}</span>
                <span class="suave pequeno">${esc(a.mensagem)}</span>
                <span class="suave pequeno">${quandoFoi(a.criadoEm)}</span>
              </div>`;
            return `<li class="${a.lido ? '' : 'aviso--novo'}">${link ? `<a class="item" href="${link}">${corpo}</a>` : `<div class="item">${corpo}</div>`}</li>`;
          }).join('')}
        </ul>` : vazio('check', 'Nenhum aviso por enquanto', 'Quando um pagamento for aprovado ou uma retirada for confirmada, você fica sabendo aqui.'),
      montar: async () => {
        // abrir a tela conta como ler os avisos
        if (avisos.some((a) => !a.lido)) {
          try { await API.marcarAvisosLidos(); } catch (e) { /* tenta na próxima */ }
          atualizarAvisos();
        }
      },
    };
  }

  // ---------- mapa do shopping (RF018) ----------
  // O desenho do mapa fica em js/mapa.js (window.ZaptosMapa), carregado só aqui.

  let carregandoMapa = null;
  function carregarMapa() {
    if (window.ZaptosMapa) return Promise.resolve(true);
    if (!carregandoMapa) {
      carregandoMapa = new Promise((ok) => {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'css/mapa.css';
        document.head.appendChild(css);
        const js = document.createElement('script');
        js.src = 'js/mapa.js';
        js.onload = () => ok(!!window.ZaptosMapa);
        js.onerror = () => { carregandoMapa = null; css.remove(); ok(false); };
        document.head.appendChild(js);
      });
    }
    return carregandoMapa;
  }

  async function telaMapa(_, consulta) {
    const destaque = Number(consulta.get('loja')) || null;
    const [temMapa, lojas] = await Promise.all([carregarMapa(), API.lojas()]);
    const base = { titulo: 'Mapa do shopping', subtitulo: 'Lojas e serviços', aba: 'inicio', voltar: true };
    if (!temMapa) {
      const loja = lojas.find((l) => l.id === destaque);
      return {
        ...base,
        html: vazio('local', 'Mapa em breve', loja ? `${loja.nome} fica no piso ${loja.piso}, loja ${loja.numero}.` : 'Em breve você vai ver aqui a planta de cada piso.'),
      };
    }
    const tela = window.ZaptosMapa.tela({ lojas, lojaDestaque: destaque });
    return { ...base, html: tela.html, montar: tela.montar };
  }

  btnVoltar.addEventListener('click', () => {
    const destino = btnVoltar.dataset.destino;
    if (destino) ir(destino);
    else if (history.length > 1) history.back();
    else ir('#/');
  });

  // ---------- Tela 1: Início ----------

  async function telaInicio() {
    const [categorias, lojas, disponiveis] = await Promise.all([
      API.categorias(), API.lojas(), API.produtos({ disponivel: true }),
    ]);
    return {
      titulo: 'Capim Dourado',
      subtitulo: API.cliente().nome ? `${saudacao()}, ${API.cliente().nome}` : `${saudacao()}!`,
      logo: true,
      aba: 'inicio',
      html: `
        ${campoBusca('')}

        <a class="hero" href="#/buscar?disp=1">
          <div class="hero__texto">
            <h2>Reserve agora,<br>retire hoje.</h2>
            <p>Seu produto fica separado na loja por você.</p>
          </div>
          <svg class="hero__espiral" viewBox="0 0 200 200" aria-hidden="true">
            <!-- espiral do capim dourado (a mesma do logo), em fios trançados -->
            <path pathLength="1" d="M100 100a6 6 0 1 1 6 6 14 14 0 1 1 7-20 24 24 0 1 1-37-6 34 34 0 1 1 57 33 46 46 0 1 1-78-49 58 58 0 1 1 105 39 70 70 0 1 1-118-82"/>
            <path class="hero__fio" pathLength="1" d="M100 100a6 6 0 1 1 6 6 14 14 0 1 1 7-20 24 24 0 1 1-37-6 34 34 0 1 1 57 33 46 46 0 1 1-78-49 58 58 0 1 1 105 39 70 70 0 1 1-118-82"/>
          </svg>
        </a>

        <section class="secao" aria-labelledby="t-cat">
          <h2 class="secao__titulo" id="t-cat">Categorias</h2>
          <div class="chips">
            ${categorias.map((c) => `<a class="chip" href="#/buscar?cat=${encodeURIComponent(c.nome)}">${esc(c.nome)}</a>`).join('')}
          </div>
        </section>

        <section class="secao" aria-labelledby="t-disp">
          <h2 class="secao__titulo" id="t-disp">Disponíveis agora</h2>
          <div class="carrossel">
            ${disponiveis.map((p) => `
              <a class="mini" href="#/produto/${p.id}">
                ${midia(p)}
                <strong>${esc(p.nome)}</strong>
                <span class="suave">${brl(p.preco)}</span>
              </a>`).join('')}
          </div>
        </section>

        <section class="secao" aria-labelledby="t-lojas">
          <div class="secao__cabecalho">
            <h2 class="secao__titulo" id="t-lojas">Lojas do shopping</h2>
            <a class="pequeno" href="#/mapa">Ver mapa</a>
          </div>
          <ul class="lista">
            ${lojas.map((l) => `
              <li><a class="item" href="#/loja/${l.id}">
                <div class="thumb thumb--p">${icone('loja')}</div>
                <div class="item__info">
                  <span class="item__nome">${esc(l.nome)}</span>
                  <span class="suave">${esc(l.segmento)}, piso ${l.piso}</span>
                </div>
              </a></li>`).join('')}
          </ul>
        </section>`,
      montar: (raiz) => ligarBusca(raiz),
    };
  }

  // ---------- Tela 2: Busca com filtros ----------

  function itemProduto(p) {
    return `
      <li><a class="item" href="#/produto/${p.id}">
        ${midia(p)}
        <div class="item__info">
          <span class="item__nome">${esc(p.nome)}</span>
          <span class="suave">${esc(p.loja.nome)}</span>
          ${badgeEstoque(p.estoque)}
        </div>
        <span class="preco">${brl(p.preco)}</span>
      </a></li>`;
  }

  async function telaBuscar(_, consulta) {
    const filtros = {
      q: consulta.get('q') || '',
      categoria: consulta.get('cat') || '',
      disponivel: consulta.get('disp') === '1',
      precoMax: Number(consulta.get('max')) || null,
      piso: Number(consulta.get('piso')) || null,
    };
    const [categorias, resultados] = await Promise.all([API.categorias(), API.produtos(filtros)]);

    // Liga/desliga um filtro na URL.
    function chip(chave, valor, rotulo) {
      const q = new URLSearchParams(consulta);
      const ativo = q.get(chave) === String(valor);
      if (ativo) q.delete(chave); else q.set(chave, valor);
      const s = q.toString();
      return `<a class="chip ${ativo ? 'chip--ativo' : ''}" href="#/buscar${s ? '?' + s : ''}"
                 data-filtro aria-pressed="${ativo}">${esc(rotulo)}</a>`;
    }

    const n = resultados.length;
    const subtitulo = `${n} ${n === 1 ? 'resultado' : 'resultados'}${filtros.q ? ` para ${filtros.q}` : ''}`;

    return {
      titulo: 'Buscar',
      subtitulo,
      aba: 'buscar',
      html: `
        ${campoBusca(filtros.q)}
        <div class="chips chips--rolagem" role="group" aria-label="Filtros" style="margin-top:16px">
          ${chip('disp', '1', 'Disponível agora')}
          ${categorias.map((c) => chip('cat', c.nome, c.nome)).join('')}
          ${chip('max', '1500', 'Até R$ 1.500')}
          ${chip('piso', '1', 'Piso 1')}
          ${chip('piso', '2', 'Piso 2')}
        </div>
        ${n
          ? `<ul class="lista" style="margin-top:12px">${resultados.map(itemProduto).join('')}</ul>`
          : vazio('busca', 'Nada encontrado', 'Tente outra palavra ou tire algum filtro.',
              '<a class="btn btn--contorno" href="#/buscar">Limpar busca</a>')}`,
      montar: (raiz) => {
        ligarBusca(raiz, consulta.toString(), true);
        // filtros trocam a URL sem empilhar histórico
        raiz.querySelectorAll('[data-filtro]').forEach((a) =>
          a.addEventListener('click', (e) => { e.preventDefault(); ir(a.getAttribute('href'), true); }));
      },
    };
  }

  // ---------- Vitrine da loja (RF011) ----------

  async function telaLoja([id]) {
    const [loja, produtos] = await Promise.all([API.loja(id), API.produtos({ lojaId: id })]);
    return {
      titulo: loja.nome,
      subtitulo: `${loja.segmento}, piso ${loja.piso}`,
      aba: 'buscar',
      voltar: true,
      html: `
        <div class="card">
          <p><strong>Onde fica:</strong> piso ${loja.piso}, loja ${esc(loja.numero)}</p>
          <p style="margin-top:4px"><strong>Horário:</strong> ${esc(loja.horario)}</p>
        </div>
        <section class="secao">
          <h2 class="secao__titulo">Produtos</h2>
          ${produtos.length ? `<ul class="lista">${produtos.map(itemProduto).join('')}</ul>`
                            : vazio('sacola', 'Nenhum produto cadastrado ainda')}
        </section>`,
    };
  }

  // ---------- Tela 3: Produto (galeria e medidas, RF013) ----------

  // Nota (RF020, segunda versão) e compras verificadas, quando houver.
  function avaliacao(p) {
    const compras = p.comprasVerificadas || 0;
    const partes = [];
    if (p.avaliacao != null) partes.push(`<span class="estrela" aria-hidden="true">★</span><span>${p.avaliacao.toLocaleString('pt-BR')}</span>`);
    if (compras > 0) partes.push(`<span>${partes.length ? '· ' : ''}${compras} ${compras === 1 ? 'compra verificada' : 'compras verificadas'}</span>`);
    return partes.length ? `<p class="avaliacao">${partes.join(' ')}</p>` : '';
  }

  async function telaProduto([id]) {
    const p = await API.produto(id);
    const vistas = p.imagens && p.imagens.length
      ? p.imagens.map((src, i) => ({ html: `<img src="${esc(src)}" alt="${esc(p.nome)}, foto ${i + 1}" data-fallback>`, rotulo: `Foto ${i + 1}` }))
      : ['Frente', 'Lateral', 'Detalhe'].map((rotulo, i) => ({ html: icone(p.icone), rotulo, classe: `vista--${i}` }));

    const m = p.medidas;
    const esgotado = p.estoque < 1;

    return {
      titulo: p.nome,
      subtitulo: p.loja.nome,
      aba: 'buscar',
      voltar: true,
      html: `
        <div class="galeria" data-galeria>
          <div class="galeria__principal ${vistas[0].classe || ''}" data-principal role="img" aria-label="${esc(p.nome)}, ${esc(vistas[0].rotulo)}">
            ${vistas[0].html}
            <span class="galeria__rotulo" data-rotulo>${esc(vistas[0].rotulo)}</span>
          </div>
          <div class="galeria__miniaturas" role="group" aria-label="Fotos do produto">
            ${vistas.map((v, i) => `
              <button type="button" class="${v.classe || ''}" data-vista="${i}" aria-current="${i === 0}"
                      aria-label="Ver ${esc(v.rotulo)}">${v.html}</button>`).join('')}
          </div>
        </div>

        <div class="produto__cabecalho">
          <h2>${esc(p.nome)}</h2>
          <p class="produto__preco">${brl(p.preco)}</p>
          <p class="produto__onde">
            <a href="#/loja/${p.loja.id}">${esc(p.loja.nome)}</a>, piso ${esc(p.loja.piso)}
          </p>
          <div class="produto__selos">${badgeEstoque(p.estoque)}${avaliacao(p)}</div>
        </div>

        <button class="btn btn--contorno btn--pequeno produto__ar" type="button" data-ver-em-casa>
          <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-7 9 7v9H3z"/><path d="M8 20v-5h8v5"/></svg>
          Ver na sua casa
        </button>

        <div class="barra-reserva">
          <div class="barra-reserva__preco">
            <span class="suave pequeno">${esgotado ? 'Sem unidades agora' : 'Retire hoje na loja'}</span>
            <strong>${brl(p.preco)}</strong>
          </div>
          <button class="btn btn--destaque" type="button" data-reservar ${esgotado ? 'disabled' : ''}>
            ${esgotado ? 'Esgotado' : 'Reservar na loja'}
          </button>
        </div>

        ${m ? `
        <section class="bloco" aria-labelledby="t-medidas">
          <h2 id="t-medidas">Medidas</h2>
          <p class="suave pequeno">Confira se cabe no seu espaço antes de reservar.</p>
          <dl class="medidas">
            <div><dt>Largura</dt><dd>${m.largura} cm</dd></div>
            <div><dt>Altura</dt><dd>${m.altura} cm</dd></div>
            <div><dt>Profundidade</dt><dd>${m.profundidade} cm</dd></div>
          </dl>
        </section>` : ''}

        <section class="bloco">
          <h2>Sobre o produto</h2>
          <p class="suave">${esc(p.descricao)}</p>
        </section>

        <section class="bloco">
          <h2>Onde retirar</h2>
          <p class="suave">${localLoja(p.loja)}<br>${esc(p.loja.horario)}</p>
        </section>`,
      montar: (raiz) => {
        const principal = raiz.querySelector('[data-principal]');
        const botoes = raiz.querySelectorAll('[data-vista]');
        botoes.forEach((b) => b.addEventListener('click', () => {
          const v = vistas[Number(b.dataset.vista)];
          principal.className = `galeria__principal ${v.classe || ''}`;
          principal.setAttribute('aria-label', `${p.nome}, ${v.rotulo}`);
          principal.innerHTML = `${v.html}<span class="galeria__rotulo">${esc(v.rotulo)}</span>`;
          botoes.forEach((x) => x.setAttribute('aria-current', String(x === b)));
        }));
        const reservar = raiz.querySelector('[data-reservar]');
        reservar.addEventListener('click', () => ir(`#/reservar/${p.id}`));

        // "Ver na sua casa": 1ª foto do produto (de preferência PNG sem fundo) ou o desenho dele
        raiz.querySelector('[data-ver-em-casa]').addEventListener('click', () => {
          if (!window.VerEmCasa) return;
          const fechar = window.VerEmCasa.abrir({
            nome: p.nome,
            imagem: p.imagens && p.imagens.length ? p.imagens[0] : null,
            svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(243,238,229,.55)" stroke="#0e3d3c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONES[p.icone] || ICONES.poltrona}</svg>`,
            medidas: p.medidas,
          });
          aoSair(fechar); // fecha a câmera se sair da tela
        });
      },
    };
  }

  // ---------- Tela 4: Reserva e pagamento ----------

  function formatarTempo(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const min = Math.floor(total / 60);
    const seg = total % 60;
    return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  }

  async function telaReservar([produtoId]) {
    const p = await API.produto(produtoId);
    const base = { titulo: 'Reservar', subtitulo: `Retirada na ${p.loja.nome}`, aba: 'buscar', voltar: `#/produto/${p.id}` };

    let reserva;
    try {
      reserva = await API.reservar(p.id);
    } catch (err) {
      if (err.codigo !== 'SEM_ESTOQUE') throw err;
      return {
        ...base,
        html: vazio('alerta', 'Sem unidade disponível', err.message,
          `<a class="btn btn--contorno" href="#/buscar?q=${encodeURIComponent(p.nome.split(' ')[0])}">Ver parecidos</a>`),
      };
    }

    const htmlExpirada = vazio('alerta', 'O tempo da reserva acabou',
      'A unidade voltou para o estoque da loja. Você pode tentar reservar de novo.',
      `<a class="btn btn--primario" href="#/produto/${p.id}">Voltar ao produto</a>`);

    return {
      ...base,
      html: `
        <div class="card resumo">
          ${midia(p)}
          <div class="item__info">
            <span class="item__nome">${esc(p.nome)}</span>
            <span class="suave">1 unidade</span>
          </div>
          <span class="preco">${brl(p.preco)}</span>
        </div>

        <div class="timer" role="timer" aria-label="Tempo restante da reserva">
          <span>Separada para você</span>
          <strong data-tempo>${formatarTempo(reserva.expiraEm - Date.now())}</strong>
        </div>

        <section class="bloco">
          <h2>Onde retirar</h2>
          <p class="suave">${localLoja(p.loja)}<br>Hoje até ${esc(p.loja.fechaAs)}</p>
        </section>

        <form class="bloco" data-pagamento>
          <h2 id="t-pag">Pagamento</h2>
          <div class="opcoes" role="radiogroup" aria-labelledby="t-pag" style="margin-top:10px">
            <label><input type="radio" name="metodo" value="cartao" checked><span class="chip">Cartão</span></label>
            <label><input type="radio" name="metodo" value="pix"><span class="chip">Pix</span></label>
          </div>
          <p class="nota">Ambiente de demonstração: nenhum valor é cobrado. Na versão final, o cartão ou o Pix é processado pelo PagBank.</p>
          <div data-erro></div>
          <div class="pilha pilha--topo">
            <button class="btn btn--primario btn--bloco" type="submit" data-pagar>Pagar ${brl(p.preco)}</button>
            <button class="btn btn--link" type="button" data-cancelar>Cancelar reserva</button>
          </div>
        </form>`,
      montar: (raiz) => {
        const elTempo = raiz.querySelector('[data-tempo]');
        const relogio = setInterval(() => {
          const resta = reserva.expiraEm - Date.now();
          elTempo.textContent = formatarTempo(resta);
          if (resta <= 0) { clearInterval(relogio); raiz.innerHTML = htmlExpirada; }
        }, 1000);
        aoSair(() => clearInterval(relogio));

        const form = raiz.querySelector('[data-pagamento]');
        const btnPagar = raiz.querySelector('[data-pagar]');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          btnPagar.disabled = true;
          btnPagar.textContent = 'Processando pagamento…';
          try {
            const pedido = await API.pagar(reserva.id, form.metodo.value);
            ir(`#/pedido/${pedido.id}`, true);
          } catch (err) {
            if (err.codigo === 'RESERVA_EXPIRADA') { clearInterval(relogio); raiz.innerHTML = htmlExpirada; return; }
            raiz.querySelector('[data-erro]').innerHTML = `<p class="alerta alerta--erro" role="alert">${esc(err.message)}</p>`;
            btnPagar.disabled = false;
            btnPagar.textContent = `Pagar ${brl(p.preco)}`;
          }
        });

        raiz.querySelector('[data-cancelar]').addEventListener('click', async () => {
          await API.cancelarReserva(reserva.id);
          ir(`#/produto/${p.id}`, true);
        });
      },
    };
  }

  // ---------- Tela 5: Comprovante com QR Code (RF008) ----------

  async function telaComprovante([id]) {
    const ped = await API.pedido(id);
    const p = ped.produto;

    if (ped.status !== 'aprovado' && ped.status !== 'retirado') {
      return {
        titulo: `Pedido ${ped.id}`,
        subtitulo: p.nome,
        aba: 'pedidos',
        voltar: '#/pedidos',
        html: `<p>${badgeStatus(ped.status)}</p>
               ${ped.status === 'pendente'
                 ? `<div class="pilha pilha--topo"><a class="btn btn--primario btn--bloco" href="#/reservar/${p.id}">Continuar pagamento</a></div>`
                 : vazio('alerta', 'Este pedido não tem código de retirada', 'A reserva não foi paga a tempo.')}`,
      };
    }

    const retirado = ped.status === 'retirado';
    return {
      titulo: retirado ? 'Pedido retirado' : 'Reserva confirmada',
      subtitulo: `Pedido ${ped.id}`,
      aba: 'pedidos',
      voltar: '#/pedidos',
      html: `
        <div class="comprovante">
          <h2>${retirado ? `Você retirou ${esc(p.nome)}.` : `Sua ${esc(p.nome)}<br>está separada.`}</h2>
          ${retirado
            ? `<p style="margin-top:12px">${badgeStatus('retirado')}</p>`
            : `<div class="qr" data-qr role="img" aria-label="QR Code de retirada do pedido ${ped.id}"></div>
               <p class="suave" style="margin-top:14px">Mostre este código no balcão</p>`}
          <p class="codigo">${esc(ped.codigo)}</p>
        </div>
        <hr class="separador">
        <p><strong>${localLoja(ped.loja)}</strong></p>
        <p class="suave">${retirado ? `Retirado em ${dataCurta(ped.retiradoEm)}` : `Retire até hoje, ${esc(ped.loja.fechaAs)}`}</p>
        <div class="pilha pilha--topo">
          <a class="btn btn--contorno btn--bloco" href="#/mapa?loja=${ped.loja.id}">Ver no mapa do shopping</a>
          <a class="btn btn--link" href="#/pedidos">Ver meus pedidos</a>
        </div>`,
      montar: (raiz) => {
        const alvo = raiz.querySelector('[data-qr]');
        if (!alvo) return;
        if (window.QRCode) {
          new window.QRCode(alvo, {
            // a API gera um UUID para o QR Code; o código curto fica para digitar
            text: ped.qrCodigo || ped.codigo, width: 200, height: 200,
            colorDark: '#0e3d3c', colorLight: '#ffffff',
            correctLevel: window.QRCode.CorrectLevel.M,
          });
          alvo.removeAttribute('title');
        } else {
          alvo.innerHTML = '<p class="suave pequeno">Sem conexão para gerar o QR Code. Mostre o código abaixo.</p>';
        }
      },
    };
  }

  // ---------- Tela 6: Meus pedidos (RF010) ----------

  async function telaPedidos(_, consulta) {
    const filtro = consulta.get('f') || 'todos';
    const todos = await API.pedidos();
    const lista = todos.filter((p) =>
      filtro === 'todos' ||
      (filtro === 'retirar' && (p.status === 'aprovado' || p.status === 'pendente')) ||
      (filtro === 'retirados' && p.status === 'retirado'));

    const aba = (valor, rotulo) =>
      `<a class="chip ${filtro === valor ? 'chip--ativo' : ''}" href="#/pedidos${valor === 'todos' ? '' : '?f=' + valor}"
          data-filtro aria-pressed="${filtro === valor}">${rotulo}</a>`;

    return {
      titulo: 'Meus pedidos',
      subtitulo: 'Reservas e compras',
      aba: 'pedidos',
      html: `
        <div class="chips" role="group" aria-label="Filtrar pedidos">
          ${aba('todos', 'Todos')}${aba('retirar', 'A retirar')}${aba('retirados', 'Retirados')}
        </div>
        ${lista.length ? `
        <ul class="lista" style="margin-top:12px">
          ${lista.map((ped) => `
            <li class="item">
              ${midia(ped.produto)}
              <div class="item__info">
                <span class="item__nome">${esc(ped.produto.nome)}</span>
                <span class="suave">${esc(ped.loja.nome)}, ${dataCurta(ped.criadoEm)}</span>
                ${badgeStatus(ped.status)}
                ${ped.status === 'aprovado' ? `<a class="btn btn--contorno btn--pequeno item__acao" href="#/pedido/${ped.id}">Mostrar QR Code</a>` : ''}
                ${ped.status === 'pendente' ? `<a class="btn btn--primario btn--pequeno item__acao" href="#/reservar/${ped.produto.id}">Continuar pagamento</a>` : ''}
              </div>
              <span class="preco" style="align-self:flex-start">${brl(ped.valor)}</span>
            </li>`).join('')}
        </ul>` : vazio('sacola', 'Nenhum pedido aqui', 'Quando você reservar um produto, ele aparece nesta lista.',
            '<a class="btn btn--primario" href="#/buscar">Buscar produtos</a>')}`,
      montar: (raiz) => raiz.querySelectorAll('[data-filtro]').forEach((a) =>
        a.addEventListener('click', (e) => { e.preventDefault(); ir(a.getAttribute('href'), true); })),
    };
  }

  // ---------- Ajuda / FAQ (RF003) ----------

  async function telaAjuda() {
    const perguntas = [
      ['Como funciona a reserva?', 'Você escolhe o produto, toca em "Reservar na loja" e paga pelo app. A unidade fica separada só para você e é retirada na loja com o QR Code.'],
      ['Quanto tempo tenho para pagar?', 'A unidade fica bloqueada por 15 minutos enquanto você paga. Se o pagamento não for concluído nesse prazo, ela volta para o estoque.'],
      ['Como faço a retirada?', 'Vá até a loja e mostre o QR Code (ou o código, como CD-4821-7KQ) no balcão. O lojista confirma e o pedido aparece como retirado.'],
      ['Até quando posso retirar?', 'No mesmo dia do pagamento, até o horário de fechamento da loja.'],
      ['Posso trocar o produto?', 'As trocas seguem a política de cada loja. Fale com a loja pelo telefone ou no balcão de atendimento do shopping.'],
      ['Quais formas de pagamento?', 'Cartão de crédito e Pix. O pagamento vai direto para a loja; a comissão do shopping é descontada automaticamente.'],
    ];
    return {
      titulo: 'Ajuda',
      subtitulo: 'Dúvidas frequentes',
      logo: true,
      aba: 'ajuda',
      html: `
        <div class="faq">
          ${perguntas.map(([p, r]) => `<details><summary>${esc(p)}</summary><p>${esc(r)}</p></details>`).join('')}
        </div>
        <section class="secao">
          <h2 class="secao__titulo">Ainda precisa de ajuda?</h2>
          <div class="card">
            <p><strong>Atendimento do shopping</strong></p>
            <p class="suave">Piso 1, ao lado da praça de alimentação · 10h às 22h</p>
          </div>
          <p class="nota">Em breve: assistente virtual e conversa direta com a loja pelo app.</p>
          ${avisoAcademico()}
        </section>`,
    };
  }

  // ---------- Perfil ----------

  // O logo e o nome do shopping são usados com autorização, só para a apresentação.
  function avisoAcademico() {
    return `<p class="aviso-academico">Projeto acadêmico do HACKRUN 2026 (Desafio 04). Não é o aplicativo oficial do Capim Dourado Shopping; produtos e preços são de demonstração.</p>`;
  }

  async function telaPerfil() {
    const s = sessao();
    if (!s) {
      return {
        titulo: 'Perfil',
        subtitulo: 'Entre para reservar e acompanhar pedidos',
        aba: 'perfil',
        html: `
          ${vazio('sacola', 'Você ainda não entrou', 'Com uma conta você reserva produtos e retira na loja com QR Code.')}
          <div class="pilha">
            <a class="btn btn--primario btn--bloco" href="#/entrar?volta=${encodeURIComponent('#/perfil')}">Entrar</a>
            <a class="btn btn--contorno btn--bloco" href="#/cadastro?volta=${encodeURIComponent('#/perfil')}">Criar conta</a>
          </div>
          ${avisoAcademico()}`,
      };
    }

    const c = API.cliente();
    const iniciais = `${c.nome[0] || ''}${c.sobrenome ? c.sobrenome[0] : ''}`;
    const atalhos = {
      demo: '<a class="btn btn--contorno btn--bloco" href="#/pedidos">Meus pedidos</a><a class="btn btn--contorno btn--bloco" href="#/lojista">Área do lojista</a>',
      cliente: '<a class="btn btn--contorno btn--bloco" href="#/pedidos">Meus pedidos</a>',
      lojista: '<a class="btn btn--contorno btn--bloco" href="#/lojista">Painel da loja</a>',
      admin: '<a class="btn btn--contorno btn--bloco" href="admin.html">Painel administrativo</a>',
    };
    return {
      titulo: 'Perfil',
      subtitulo: 'Sua conta',
      aba: 'perfil',
      html: `
        <div class="card perfil">
          <div class="avatar" aria-hidden="true">${esc(iniciais.toUpperCase())}</div>
          <div>
            <p class="item__nome">${esc(c.nome)} ${esc(c.sobrenome)}</p>
            <p class="suave">${esc(c.email)}</p>
          </div>
        </div>
        <div class="pilha pilha--topo">
          ${atalhos[s.perfil] || ''}
          ${API.sair ? '<button class="btn btn--link" type="button" data-sair>Sair da conta</button>' : ''}
        </div>
        ${API.restaurarDemo ? `
        <section class="secao">
          <h2 class="secao__titulo">Demonstração</h2>
          <p class="suave pequeno">Os dados desta versão ficam só neste navegador.</p>
          <div class="pilha" style="margin-top:12px">
            <button class="btn btn--link" type="button" data-restaurar>Restaurar dados de demonstração</button>
          </div>
          <div data-msg></div>
        </section>` : ''}
        ${avisoAcademico()}`,
      montar: (raiz) => {
        const sair = raiz.querySelector('[data-sair]');
        if (sair) {
          sair.addEventListener('click', () => {
            API.sair();
            lojaDoLojista = null;
            ir('#/', true);
          });
        }
        const restaurar = raiz.querySelector('[data-restaurar]');
        if (!restaurar) return;
        restaurar.addEventListener('click', () => {
          API.restaurarDemo();
          raiz.querySelector('[data-msg]').innerHTML = '<p class="alerta alerta--ok" role="status">Dados restaurados.</p>';
        });
      },
    };
  }

  // ---------- Entrar e criar conta (RF002, RF015) ----------

  function destinoDepoisDoLogin(usuario, consulta) {
    const volta = consulta.get('volta');
    if (volta && volta.startsWith('#/') && !volta.startsWith('#/entrar') && !volta.startsWith('#/cadastro')) return volta;
    if (usuario.perfil === 'lojista') return '#/lojista';
    return '#/';
  }

  function seguir(usuario, consulta) {
    if (usuario.perfil === 'admin') { location.href = 'admin.html'; return; }
    ir(destinoDepoisDoLogin(usuario, consulta), true);
  }

  async function telaEntrar(_, consulta) {
    if (!API.entrar) {
      return {
        titulo: 'Entrar', aba: 'perfil', voltar: '#/',
        html: vazio('check', 'Modo demonstração', 'Nesta versão não é preciso entrar: tudo já está liberado.',
          '<a class="btn btn--primario" href="#/">Ir para o início</a>'),
      };
    }
    const area = consulta.get('perfil') === 'lojista' ? 'Área do lojista' : 'Reserve e acompanhe seus pedidos';
    const volta = consulta.get('volta') || '';
    return {
      titulo: 'Entrar',
      subtitulo: area,
      aba: 'perfil',
      voltar: '#/',
      html: `
        <form class="pilha" data-entrar novalidate>
          <div class="campo">
            <label for="email">E-mail</label>
            <input id="email" name="email" type="email" autocomplete="email" inputmode="email" required>
          </div>
          <div class="campo">
            <label for="senha">Senha</label>
            <input id="senha" name="senha" type="password" autocomplete="current-password" required>
          </div>
          <div data-erro aria-live="polite"></div>
          <button class="btn btn--primario btn--bloco" type="submit">Entrar</button>
        </form>
        <p class="suave" style="margin-top:24px;text-align:center">
          Ainda não tem conta? <a href="#/cadastro${volta ? `?volta=${encodeURIComponent(volta)}` : ''}">Criar conta</a>
        </p>
        <p class="nota">Lojistas: a conta da loja é criada pela administração do shopping.</p>
        ${avisoAcademico()}`,
      montar: (raiz) => {
        const form = raiz.querySelector('[data-entrar]');
        const erroEl = raiz.querySelector('[data-erro]');
        const botao = form.querySelector('button[type=submit]');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = form.email.value.trim();
          const senha = form.senha.value;
          if (!email || !senha) {
            erroEl.innerHTML = '<p class="alerta alerta--erro" role="alert">Preencha o e-mail e a senha.</p>';
            return;
          }
          botao.disabled = true;
          botao.textContent = 'Entrando…';
          try {
            const usuario = await API.entrar(email, senha);
            lojaDoLojista = null;
            seguir(usuario, consulta);
          } catch (err) {
            erroEl.innerHTML = `<p class="alerta alerta--erro" role="alert">${esc(err.message)}</p>`;
            botao.disabled = false;
            botao.textContent = 'Entrar';
            form.senha.value = '';
            form.senha.focus();
          }
        });
        form.email.focus();
      },
    };
  }

  async function telaCadastro(_, consulta) {
    if (!API.cadastrar) return telaEntrar(_, consulta);
    return {
      titulo: 'Criar conta',
      subtitulo: 'Leva menos de um minuto',
      aba: 'perfil',
      voltar: '#/entrar',
      html: `
        <form class="pilha" data-cadastro novalidate>
          <div class="campo">
            <label for="nome">Nome completo</label>
            <input id="nome" name="nome" autocomplete="name" required maxlength="120">
          </div>
          <div class="campo">
            <label for="email">E-mail</label>
            <input id="email" name="email" type="email" autocomplete="email" inputmode="email" required>
          </div>
          <div class="campo">
            <label for="senha">Senha</label>
            <input id="senha" name="senha" type="password" autocomplete="new-password" minlength="8" maxlength="72" required
                   aria-describedby="dica-senha">
            <span class="suave pequeno" id="dica-senha">Pelo menos 8 caracteres.</span>
          </div>
          <div class="campo">
            <label for="senha2">Repita a senha</label>
            <input id="senha2" name="senha2" type="password" autocomplete="new-password" required>
          </div>
          <div data-erro aria-live="polite"></div>
          <button class="btn btn--primario btn--bloco" type="submit">Criar conta</button>
        </form>
        <p class="nota">Seus dados são usados só para as reservas e o atendimento, conforme a LGPD.</p>`,
      montar: (raiz) => {
        const form = raiz.querySelector('[data-cadastro]');
        const erroEl = raiz.querySelector('[data-erro]');
        const botao = form.querySelector('button[type=submit]');
        const falha = (texto) => { erroEl.innerHTML = `<p class="alerta alerta--erro" role="alert">${esc(texto)}</p>`; };
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const nome = form.nome.value.trim();
          const email = form.email.value.trim();
          const senha = form.senha.value;
          if (nome.length < 2) return falha('Informe seu nome.');
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return falha('Informe um e-mail válido.');
          if (senha.length < 8) return falha('A senha precisa ter pelo menos 8 caracteres.');
          if (senha !== form.senha2.value) return falha('As senhas não são iguais.');
          botao.disabled = true;
          botao.textContent = 'Criando conta…';
          try {
            const usuario = await API.cadastrar({ nome, email, senha });
            seguir(usuario, consulta);
          } catch (err) {
            falha(err.message);
            botao.disabled = false;
            botao.textContent = 'Criar conta';
          }
        });
        form.nome.focus();
      },
    };
  }

  // ---------- Tela 7: Painel do lojista (RF006) ----------

  function rotuloEstoque(n) {
    return n > 0 ? 'Visível para reserva' : 'Esgotado: não aparece como disponível';
  }

  async function telaPainel() {
    const lojaId = await lojaAtual();
    const painel = await API.painelLoja(lojaId);
    const aguardando = painel.aguardandoRetirada;
    return {
      titulo: painel.loja.nome,
      subtitulo: 'Painel da loja',
      aba: null,
      voltar: '#/perfil',
      html: `
        <div class="stats">
          <div class="stat"><strong>${painel.reservasHoje}</strong><span>reservas hoje</span></div>
          <div class="stat ${aguardando.length ? 'stat--alerta' : ''}"><strong>${aguardando.length}</strong><span>esperando retirada</span></div>
        </div>

        <section class="secao" aria-labelledby="t-est">
          <h2 class="secao__titulo" id="t-est">Estoque</h2>
          <ul class="lista">
            ${painel.produtos.map((p) => `
              <li class="item">
                <div class="item__info">
                  ${API.produtoDoLojista
                    ? `<a class="item__nome" href="#/lojista/produto/${p.id}">${esc(p.nome)}</a>`
                    : `<span class="item__nome">${esc(p.nome)}</span>`}
                  ${p.ativo === false
                    ? '<span class="badge badge--neutro">Desativado: não aparece no app</span>'
                    : `<span class="suave pequeno" data-rotulo="${p.id}">${rotuloEstoque(p.estoque)}</span>`}
                </div>
                <div class="contador" role="group" aria-label="Estoque de ${esc(p.nome)}">
                  <button type="button" data-ajuste="-1" data-produto="${p.id}" aria-label="Diminuir" ${p.estoque < 1 ? 'disabled' : ''}>−</button>
                  <output data-qtd="${p.id}" class="${p.estoque < 1 ? 'zero' : ''}" aria-live="polite">${p.estoque}</output>
                  <button type="button" data-ajuste="1" data-produto="${p.id}" aria-label="Aumentar">+</button>
                </div>
              </li>`).join('')}
          </ul>
        </section>

        ${aguardando.length ? `
        <section class="secao" aria-labelledby="t-ret">
          <h2 class="secao__titulo" id="t-ret">Esperando retirada</h2>
          <ul class="lista">
            ${aguardando.map((ped) => `
              <li class="item">
                ${midia(ped.produto, 'thumb--p')}
                <div class="item__info">
                  <span class="item__nome">${esc(ped.produto.nome)}</span>
                  <span class="suave pequeno">Pedido ${ped.id} · pago em ${dataCurta(ped.pagoEm)}</span>
                </div>
              </li>`).join('')}
          </ul>
        </section>` : ''}

        <div class="pilha pilha--topo">
          <a class="btn btn--destaque btn--bloco" href="#/lojista/validar${window.LeitorQR && window.LeitorQR.disponivel() ? '?camera=1' : ''}">Ler QR Code de retirada</a>
          ${API.criarProduto
            ? '<a class="btn btn--contorno btn--bloco" href="#/lojista/produto/novo">Cadastrar produto</a>'
            : '<button class="btn btn--contorno btn--bloco" type="button" disabled>Cadastrar produto <span class="em-breve">com o servidor</span></button>'}
        </div>`,
      montar: (raiz) => {
        raiz.querySelectorAll('[data-ajuste]').forEach((b) => b.addEventListener('click', async () => {
          const id = Number(b.dataset.produto);
          let n;
          try {
            n = await API.ajustarEstoque(lojaId, id, Number(b.dataset.ajuste));
          } catch (err) {
            alertaFlutuante(err.message);
            return;
          }
          const out = raiz.querySelector(`[data-qtd="${id}"]`);
          out.textContent = n;
          out.classList.toggle('zero', n < 1);
          const rotulo = raiz.querySelector(`[data-rotulo="${id}"]`);
          if (rotulo) rotulo.textContent = rotuloEstoque(n);
          raiz.querySelector(`[data-ajuste="-1"][data-produto="${id}"]`).disabled = n < 1;
        }));
      },
    };
  }

  // ---------- Cadastro e edição de produto pelo lojista (RF013) ----------

  // Aceita "1.290,50", "1290,50" e "1290.50".
  function lerPreco(texto) {
    let t = String(texto || '').trim().replace(/^R\$\s*/i, '');
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    const n = Number(t);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  }

  const valorPreco = (n) => (n == null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  function camposProduto(p, novo) {
    const m = (p && p.medidas) || {};
    return `
      <div class="campo">
        <label for="nome">Nome do produto</label>
        <input id="nome" name="nome" required maxlength="150" value="${esc(p ? p.nome : '')}">
      </div>
      <div class="campo">
        <label for="descricao">Descrição <span class="suave">(opcional)</span></label>
        <textarea id="descricao" name="descricao" rows="3" maxlength="2000">${esc(p && p.descricao ? p.descricao : '')}</textarea>
      </div>
      <div class="campo">
        <label for="preco">Preço (R$)</label>
        <input id="preco" name="preco" inputmode="decimal" required placeholder="0,00" value="${esc(valorPreco(p && p.preco))}">
      </div>
      <fieldset class="campo-grupo">
        <legend>Medidas em cm <span class="suave">(opcional: preencha as três)</span></legend>
        <div class="medidas-form">
          <div class="campo"><label for="largura">Largura</label><input id="largura" name="largura" type="number" min="0.1" step="0.1" inputmode="decimal" value="${m.largura ?? ''}"></div>
          <div class="campo"><label for="altura">Altura</label><input id="altura" name="altura" type="number" min="0.1" step="0.1" inputmode="decimal" value="${m.altura ?? ''}"></div>
          <div class="campo"><label for="profundidade">Profund.</label><input id="profundidade" name="profundidade" type="number" min="0.1" step="0.1" inputmode="decimal" value="${m.profundidade ?? ''}"></div>
        </div>
      </fieldset>
      ${novo ? `
      <div class="campo">
        <label for="estoque">Unidades em estoque</label>
        <input id="estoque" name="estoque" type="number" min="0" step="1" inputmode="numeric" value="1" required>
      </div>` : `
      <label class="alternar">
        <input type="checkbox" name="ativo" ${p.ativo === false ? '' : 'checked'}>
        <span>Visível no app para os clientes</span>
      </label>`}`;
  }

  // Lê o formulário e confere antes de enviar; devolve {dados} ou {erro}.
  function lerFormularioProduto(form, novo) {
    const nome = form.nome.value.trim();
    const preco = lerPreco(form.preco.value);
    const medidas = ['largura', 'altura', 'profundidade'].map((c) => form[c].value.trim());
    if (nome.length < 2) return { erro: 'Informe o nome do produto.' };
    if (!(preco > 0)) return { erro: 'Informe um preço válido, por exemplo 1.290,00.' };
    const preenchidas = medidas.filter(Boolean).length;
    if (preenchidas && preenchidas < 3) return { erro: 'Preencha largura, altura e profundidade, ou deixe as três em branco.' };
    if (medidas.some((v) => v && !(Number(v) > 0))) return { erro: 'As medidas precisam ser maiores que zero.' };

    const dados = {
      nome,
      descricao: form.descricao.value.trim() || null,
      preco: preco.toFixed(2),
      largura: medidas[0] ? Number(medidas[0]) : null,
      altura: medidas[1] ? Number(medidas[1]) : null,
      profundidade: medidas[2] ? Number(medidas[2]) : null,
    };
    if (novo) {
      const estoque = Number(form.estoque.value);
      if (!Number.isInteger(estoque) || estoque < 0) return { erro: 'O estoque precisa ser um número inteiro, 0 ou mais.' };
      dados.estoque = estoque;
    } else {
      dados.ativo = form.ativo.checked;
    }
    return { dados };
  }

  function htmlGaleriaEdicao(p) {
    const fotos = p.galeria || [];
    return `
      <div class="galeria-edicao">
        ${fotos.map((img, i) => `
          <figure>
            <img src="${esc(img.url)}" alt="${esc(p.nome)}, foto ${i + 1}" data-fallback>
            ${i === 0 ? '<figcaption>Principal</figcaption>' : ''}
            <button type="button" class="galeria-edicao__remover" data-remover="${img.id}" aria-label="Remover foto ${i + 1}">×</button>
          </figure>`).join('')}
      </div>
      ${fotos.length ? '' : '<p class="suave pequeno">Nenhuma foto ainda. Sem foto, o app mostra uma ilustração.</p>'}
      ${fotos.length < 6 ? `
      <label class="btn btn--contorno btn--bloco envio" style="margin-top:12px">
        Adicionar fotos
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple data-arquivos>
      </label>
      <p class="suave pequeno" style="margin-top:6px">JPG, PNG ou WebP, até 8 MB cada (máximo 6 fotos). A primeira é a principal. As fotos são reduzidas automaticamente.</p>` : '<p class="suave pequeno">Limite de 6 fotos atingido.</p>'}
      <div data-msg-fotos aria-live="polite"></div>`;
  }

  async function telaProdutoLojista([id], consulta) {
    if (!API.criarProduto) {
      return {
        titulo: 'Cadastrar produto', aba: null, voltar: '#/lojista',
        html: vazio('alerta', 'Disponível só com o servidor', 'O cadastro de produtos precisa da API ligada.'),
      };
    }
    const lojaId = await lojaAtual();
    const novo = !id;
    const p = novo ? null : await API.produtoDoLojista(id);

    return {
      titulo: novo ? 'Cadastrar produto' : 'Editar produto',
      subtitulo: novo ? 'Novo item da loja' : p.nome,
      aba: null,
      voltar: '#/lojista',
      html: `
        ${consulta.get('criado') ? '<p class="alerta alerta--ok" role="status" style="margin-top:0">Produto cadastrado. Agora adicione as fotos.</p>' : ''}
        <form class="pilha" data-produto novalidate>
          ${camposProduto(p, novo)}
          <div data-erro aria-live="polite"></div>
          <button class="btn btn--primario btn--bloco" type="submit">${novo ? 'Cadastrar e adicionar fotos' : 'Salvar alterações'}</button>
        </form>
        ${novo ? '' : `
        <section class="secao" aria-labelledby="t-fotos">
          <h2 class="secao__titulo" id="t-fotos">Fotos</h2>
          <div data-galeria>${htmlGaleriaEdicao(p)}</div>
        </section>
        <a class="btn btn--link" href="#/produto/${p.id}">Ver como o cliente vê</a>`}`,
      montar: (raiz) => {
        const form = raiz.querySelector('[data-produto]');
        const erroEl = raiz.querySelector('[data-erro]');
        const botao = form.querySelector('button[type=submit]');
        const textoBotao = botao.textContent;

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const { dados, erro } = lerFormularioProduto(form, novo);
          if (erro) { erroEl.innerHTML = `<p class="alerta alerta--erro" role="alert">${esc(erro)}</p>`; return; }
          erroEl.innerHTML = '';
          botao.disabled = true;
          botao.textContent = 'Salvando…';
          try {
            if (novo) {
              const criado = await API.criarProduto(lojaId, dados);
              ir(`#/lojista/produto/${criado.id}?criado=1`, true);
              return;
            }
            const salvo = await API.editarProduto(p.id, dados);
            elSubtitulo.textContent = salvo.nome;
            erroEl.innerHTML = '<p class="alerta alerta--ok" role="status">Alterações salvas.</p>';
          } catch (err) {
            erroEl.innerHTML = `<p class="alerta alerta--erro" role="alert">${esc(err.message)}</p>`;
          }
          botao.disabled = false;
          botao.textContent = textoBotao;
        });

        if (novo) return;
        const area = raiz.querySelector('[data-galeria]');
        let produtoAtual = p;

        const redesenhar = (msg) => {
          area.innerHTML = htmlGaleriaEdicao(produtoAtual);
          if (msg) area.querySelector('[data-msg-fotos]').innerHTML = msg;
        };

        area.addEventListener('click', async (e) => {
          const botaoRemover = e.target.closest('[data-remover]');
          if (!botaoRemover) return;
          botaoRemover.disabled = true;
          try {
            produtoAtual = await API.apagarImagem(produtoAtual.id, Number(botaoRemover.dataset.remover));
            redesenhar('<p class="alerta alerta--ok" role="status">Foto removida.</p>');
          } catch (err) {
            botaoRemover.disabled = false;
            alertaFlutuante(err.message);
          }
        });

        area.addEventListener('change', async (e) => {
          const entrada = e.target.closest('[data-arquivos]');
          if (!entrada || !entrada.files.length) return;
          const arquivos = [...entrada.files];
          const msg = area.querySelector('[data-msg-fotos]');
          const erros = [];
          for (let i = 0; i < arquivos.length; i++) {
            msg.innerHTML = `<p class="nota" role="status">Enviando foto ${i + 1} de ${arquivos.length}…</p>`;
            try {
              produtoAtual = await API.enviarImagem(produtoAtual.id, arquivos[i]);
            } catch (err) {
              erros.push(`${arquivos[i].name}: ${err.message}`);
              if (err.codigo === 'LIMITE_IMAGENS') break;
            }
          }
          redesenhar(erros.length
            ? `<p class="alerta alerta--erro" role="alert">${erros.map(esc).join('<br>')}</p>`
            : '<p class="alerta alerta--ok" role="status">Fotos enviadas.</p>');
        });
      },
    };
  }

  // ---------- Tela 8: Validar retirada (RF006, RF008) ----------

  async function telaValidar(_, consulta) {
    const lojaId = await lojaAtual();
    const painel = await API.painelLoja(lojaId);
    const codigos = painel.aguardandoRetirada.map((p) => p.codigo);
    const temCamera = !!(window.LeitorQR && window.LeitorQR.disponivel());
    return {
      titulo: 'Validar retirada',
      subtitulo: `Retirada na ${painel.loja.nome}`,
      aba: null,
      voltar: '#/lojista',
      html: `
        ${temCamera ? `
        <button class="btn btn--destaque btn--bloco" type="button" data-camera>
          <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3"/><path d="M8 12h8"/></svg>
          Ler QR Code com a câmera
        </button>
        <p class="suave pequeno" style="margin:14px 0 6px;text-align:center">ou digite o código que aparece abaixo do QR Code</p>` : ''}
        <form data-validar novalidate>
          <div class="campo campo--codigo">
            <label for="codigo">Código do cliente</label>
            <input id="codigo" name="codigo" inputmode="text" autocomplete="off" autocapitalize="characters"
                   placeholder="CD-0000-XXX" required>
          </div>
          <div class="pilha" style="margin-top:12px">
            <button class="btn btn--primario btn--bloco" type="submit">Validar código</button>
          </div>
        </form>
        ${temCamera ? '' : '<p class="nota">A leitura pela câmera precisa de conexão segura (HTTPS) e de um aparelho com câmera. Digite o código que aparece abaixo do QR Code do cliente.</p>'}
        ${codigos.length ? `
          <p class="suave pequeno" style="margin-top:16px">Pedidos desta loja esperando retirada (toque para preencher):</p>
          <div class="chips" style="margin-top:8px">
            ${codigos.map((c) => `<button class="chip" type="button" data-preencher="${esc(c)}">${esc(c)}</button>`).join('')}
          </div>` : ''}
        <div data-resultado aria-live="polite"></div>`,
      montar: (raiz) => {
        const form = raiz.querySelector('[data-validar]');
        const campo = form.codigo;
        const resultado = raiz.querySelector('[data-resultado]');

        raiz.querySelectorAll('[data-preencher]').forEach((b) =>
          b.addEventListener('click', () => { campo.value = b.dataset.preencher; campo.focus(); }));

        // Código digitado (CD-4821-7KQ) ou lido do QR Code (UUID): a API aceita os dois.
        async function validar(codigo) {
          try {
            const ped = await API.validarCodigo(lojaId, codigo);
            const nomeCliente = ped.cliente ? ped.cliente.nome : `${API.cliente().nome} ${API.cliente().sobrenome}`;
            const [primeiro, ...resto] = nomeCliente.split(' ');
            const clienteCurto = resto.length ? `${primeiro} ${resto[resto.length - 1][0]}.` : primeiro;
            resultado.innerHTML = `
              <div class="card" style="margin-top:20px">
                <span class="badge badge--ok">Código válido</span>
                <div class="resumo" style="margin-top:12px">
                  ${midia(ped.produto, 'thumb--p')}
                  <div class="item__info">
                    <span class="item__nome">${esc(ped.produto.nome)}, pedido ${ped.id}</span>
                    <span class="suave pequeno">${esc(clienteCurto)}, pago em ${dataCurta(ped.pagoEm)}</span>
                  </div>
                </div>
                <button class="btn btn--primario btn--bloco" type="button" data-confirmar style="margin-top:16px">Confirmar retirada</button>
              </div>`;
            resultado.querySelector('[data-confirmar]').addEventListener('click', async (ev) => {
              ev.currentTarget.disabled = true;
              try {
                await API.confirmarRetirada(lojaId, ped.codigo);
                resultado.innerHTML = `<p class="alerta alerta--ok" role="status">Retirada confirmada. O pedido ${ped.id} foi para o histórico do cliente.</p>`;
                form.reset();
                raiz.querySelector(`[data-preencher="${ped.codigo}"]`)?.remove();
              } catch (err) {
                resultado.innerHTML = `<p class="alerta alerta--erro" role="alert">${esc(err.message)}</p>`;
              }
            });
          } catch (err) {
            resultado.innerHTML = `<p class="alerta alerta--erro" role="alert">${esc(err.message)}</p>`;
          }
          resultado.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        form.addEventListener('submit', (e) => {
          e.preventDefault();
          if (!campo.value.trim()) {
            resultado.innerHTML = '<p class="alerta alerta--erro" role="alert">Digite o código do cliente.</p>';
            return;
          }
          validar(campo.value);
        });

        // Leitura pela câmera
        const botaoCamera = raiz.querySelector('[data-camera]');
        if (botaoCamera) {
          const abrirCamera = () => {
            resultado.innerHTML = '';
            const fechar = window.LeitorQR.abrir({
              aoLer: (texto) => {
                resultado.innerHTML = '<p class="nota" role="status">QR Code lido. Conferindo…</p>';
                validar(texto);
              },
              aoErro: (msg) => {
                resultado.innerHTML = `<p class="alerta alerta--erro" role="alert">${esc(msg)}</p>`;
                campo.focus();
              },
            });
            aoSair(fechar); // fecha a câmera se o lojista sair da tela
          };
          botaoCamera.addEventListener('click', abrirCamera);
          if (consulta.get('camera') === '1') abrirCamera();
        }
      },
    };
  }

  // ---------- erros ----------

  function telaNaoEncontrada() {
    return {
      titulo: 'Página não encontrada',
      aba: 'inicio',
      voltar: '#/',
      html: vazio('alerta', 'Essa página não existe', '', '<a class="btn btn--primario" href="#/">Ir para o início</a>'),
    };
  }

  function telaErro(err) {
    return {
      titulo: 'Algo deu errado',
      aba: 'inicio',
      voltar: '#/',
      html: vazio('alerta', err && err.codigo === 'NAO_ENCONTRADO' ? err.message : 'Não foi possível carregar esta tela.',
        'Tente novamente em instantes.', '<a class="btn btn--primario" href="#/">Ir para o início</a>'),
    };
  }

  // ---------- avisos ----------

  function alertaFlutuante(texto) {
    const el = document.createElement('p');
    el.className = 'alerta alerta--erro toast';
    el.setAttribute('role', 'alert');
    el.textContent = texto;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  // ---------- início ----------

  async function iniciar() {
    const cfg = window.ZAPTOS_CONFIG || {};
    if (cfg.modo === 'api' && window.ZaptosApiRemota) {
      try {
        await window.ZaptosApiRemota.iniciar();
        API = window.ZaptosApiRemota;
      } catch (err) {
        console.warn('API indisponível; usando dados de demonstração.', err);
        API = window.ZaptosApiDemo;
        const aviso = document.getElementById('aviso-modo');
        aviso.textContent = 'Servidor fora do ar: mostrando dados de demonstração.';
        aviso.hidden = false;
      }
    }
    window.addEventListener('hashchange', rotear);
    // Entrou ou saiu em outra aba: o navegador guarda um login só, então
    // esta aba recarrega para mostrar quem está logado agora.
    window.addEventListener('storage', (e) => {
      if (e.key === 'zaptos-token') location.reload();
    });
    rotear();
  }

  iniciar();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* PWA opcional */ });
  }
})();
