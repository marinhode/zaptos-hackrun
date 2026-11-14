// Painel do administrador do shopping (RF016).
// Página separada do app do cliente, pensada para computador.
// Fala com a API em window.ZAPTOS_CONFIG.apiUrl (js/config.js), rotas /admin/*.

(() => {
  'use strict';

  const API = ((window.ZAPTOS_CONFIG && window.ZAPTOS_CONFIG.apiUrl) || 'http://localhost:8000/api').replace(/\/$/, '');
  const CHAVE_TOKEN = 'zaptos-token'; // salvo pela tela de login (index.html#/entrar)
  const ABAS = ['resumo', 'usuarios', 'lojas', 'categorias', 'registro'];

  const $ = (sel) => document.querySelector(sel);
  const main = $('#adm-conteudo');
  const abasNav = $('#adm-abas');

  let eu = null;          // admin logado (GET /me)
  let semAcesso = false;  // sem token, 401 ou 403: mostra a tela de acesso
  let geracao = 0;        // descarta respostas de uma aba que já foi trocada

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------

  /** Cria elementos sem innerHTML: textos entram sempre como texto. */
  function el(tag, attrs, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
    for (const f of filhos.flat(Infinity)) {
      if (f === null || f === undefined || f === false) continue;
      e.append(f instanceof Node ? f : document.createTextNode(String(f)));
    }
    return e;
  }

  const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const percentual = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  const formatoData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
  const formatoDataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

  const fmtMoeda = (v) => moeda.format(Number(v) || 0);
  const fmtPct = (v) => `${percentual.format(Number(v) || 0)}%`;
  const fmtData = (iso) => (iso ? formatoData.format(new Date(iso)) : '—');
  const fmtDataHora = (iso) => (iso ? formatoDataHora.format(new Date(iso)) : '—');

  const PERFIS = { cliente: 'Cliente', lojista: 'Lojista', atendente: 'Atendente', admin: 'Administrador' };
  const STATUS_PEDIDO = {
    pendente: ['Aguardando pagamento', 'aviso'],
    aprovado: ['Pago, a retirar', 'ok'],
    retirado: ['Retirado', 'neutro'],
    cancelado: ['Cancelado', 'perigo'],
    expirado: ['Expirado', 'perigo'],
  };
  const ACOES = {
    'usuario.bloquear': 'Bloqueou usuário',
    'usuario.desbloquear': 'Desbloqueou usuário',
    'loja.editar': 'Editou loja',
    'loja.ativar': 'Ativou loja',
    'loja.desativar': 'Desativou loja',
    'categoria.comissao': 'Alterou comissão',
  };
  const CAMPOS = {
    nome: 'Nome', piso: 'Piso', localizacao: 'Localização', horario: 'Horário', telefone: 'Telefone',
    categoriaId: 'Categoria', ativa: 'Ativa', ativo: 'Ativo', comissaoPercentual: 'Comissão',
  };
  const ALVOS = { usuario: 'Usuário', loja: 'Loja', categoria: 'Categoria' };

  const badge = (texto, tipo) => el('span', { class: `badge badge--${tipo}`, text: texto });

  // ---------------------------------------------------------------------
  // Chamadas à API
  // ---------------------------------------------------------------------

  class ErroApi extends Error {
    constructor(status, codigo, mensagem) {
      super(mensagem);
      this.status = status;
      this.codigo = codigo;
    }
  }

  function lerToken() {
    try { return localStorage.getItem(CHAVE_TOKEN); } catch (_) { return null; /* navegador sem localStorage */ }
  }

  function apagarToken() {
    try { localStorage.removeItem(CHAVE_TOKEN); } catch (_) { /* navegador sem localStorage */ }
  }

  async function chamar(caminho, { metodo = 'GET', corpo, params } = {}) {
    let url = API + caminho;
    if (params) {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) if (v !== '' && v !== null && v !== undefined) q.set(k, v);
      if (q.toString()) url += `?${q}`;
    }
    const token = lerToken();
    if (!token) {
      mostrarEntrar();
      throw new ErroApi(401, 'SEM_ACESSO', 'Entre como administrador.');
    }
    const headers = { Authorization: `Bearer ${token}` };
    if (corpo !== undefined) headers['Content-Type'] = 'application/json';
    let r;
    try {
      r = await fetch(url, {
        method: metodo,
        headers,
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      });
    } catch (_) {
      throw new ErroApi(0, 'SEM_CONEXAO', `Não foi possível falar com a API (${API}). Confira se ela está rodando.`);
    }
    if (r.status === 401) {
      // Sessão expirada ou conta bloqueada: o token não serve mais.
      apagarToken();
      mostrarEntrar();
      throw new ErroApi(401, 'SEM_ACESSO', 'Entre como administrador.');
    }
    if (r.status === 403) {
      mostrarSemPermissao();
      throw new ErroApi(403, 'SEM_ACESSO', 'Esta área é só para a administração do shopping.');
    }
    if (r.status === 204) return null;
    let dados = null;
    try { dados = await r.json(); } catch (_) { /* resposta sem JSON */ }
    if (!r.ok) {
      const msg = dados && dados.mensagem
        ? dados.mensagem
        : r.status === 422 ? 'Confira os dados informados.' : `Algo deu errado (erro ${r.status}).`;
      throw new ErroApi(r.status, (dados && dados.codigo) || 'ERRO', msg);
    }
    return dados;
  }

  // ---------------------------------------------------------------------
  // Avisos, confirmação e acesso
  // ---------------------------------------------------------------------

  let temporizadorAviso = null;
  function avisar(texto, tipo = 'ok') {
    const a = $('#adm-aviso');
    a.textContent = texto;
    a.className = `adm-aviso adm-aviso--${tipo}`;
    a.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => { a.hidden = true; }, tipo === 'erro' ? 8000 : 4000);
  }

  function tratarErro(erro) {
    if (erro instanceof ErroApi && erro.codigo === 'SEM_ACESSO') return; // a tela de entrar já apareceu
    avisar(erro.message || 'Algo deu errado.', 'erro');
  }

  /** Confirmação dentro da página. Resolve true só se a pessoa confirmar. */
  function confirmar(titulo, texto, rotuloSim) {
    const dlg = $('#dlg-confirmar');
    $('#dlg-confirmar-titulo').textContent = titulo;
    $('#dlg-confirmar-texto').textContent = texto;
    $('#dlg-confirmar-sim').textContent = rotuloSim;
    dlg.returnValue = '';
    return new Promise((resolve) => {
      dlg.addEventListener('close', () => resolve(dlg.returnValue === 'sim'), { once: true });
      dlg.showModal();
    });
  }

  /** Troca o painel por uma tela de acesso (sem login ou sem permissão). */
  function telaAcesso(titulo, texto, acao) {
    if (semAcesso) return;
    semAcesso = true;
    geracao += 1;
    abasNav.hidden = true;
    $('#adm-usuario').textContent = '';
    $('#adm-sair').hidden = true;
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
    const titulo2 = el('h2', { id: 'tit-acesso', tabindex: '-1', text: titulo });
    main.removeAttribute('aria-labelledby');
    main.replaceChildren(
      el('section', { class: 'adm-entrar', 'aria-labelledby': 'tit-acesso' }, titulo2, el('p', { text: texto }), acao),
    );
    titulo2.focus();
  }

  function mostrarEntrar() {
    telaAcesso(
      'Entre como administrador',
      'Esta área é só para a administração do shopping. Entre com uma conta de administrador para continuar.',
      el('a', { class: 'btn btn--primario', href: 'index.html#/entrar?volta=admin', text: 'Entrar' }),
    );
  }

  function mostrarSemPermissao() {
    telaAcesso(
      'Esta área é só para a administração do shopping',
      'A conta que você usou não é de administrador. Entre com uma conta de administrador para continuar.',
      el('button', {
        type: 'button',
        class: 'btn btn--primario',
        text: 'Entrar com outra conta',
        onclick: () => { apagarToken(); location.href = 'index.html#/entrar'; },
      }),
    );
  }

  function sair() {
    apagarToken();
    location.href = 'index.html';
  }

  // ---------------------------------------------------------------------
  // Abas
  // ---------------------------------------------------------------------

  function abaAtual() {
    const h = location.hash.replace('#', '');
    return ABAS.includes(h) ? h : 'resumo';
  }

  function marcarAba(aba) {
    for (const b of abasNav.querySelectorAll('[role="tab"]')) {
      const ativa = b.dataset.aba === aba;
      b.setAttribute('aria-selected', String(ativa));
      b.tabIndex = ativa ? 0 : -1;
    }
    main.setAttribute('aria-labelledby', `aba-${aba}`);
  }

  async function mostrarAba() {
    if (semAcesso) return;
    const aba = abaAtual();
    marcarAba(aba);
    const g = ++geracao;
    main.replaceChildren(el('p', { class: 'adm-carregando', text: 'Carregando…' }));
    try {
      const conteudo = await TELAS[aba](() => g === geracao);
      if (g === geracao && conteudo) main.replaceChildren(conteudo);
    } catch (erro) {
      if (g !== geracao) return;
      tratarErro(erro);
      if (!semAcesso) main.replaceChildren(el('p', { class: 'adm-carregando', text: 'Não foi possível carregar esta seção.' }));
    }
  }

  abasNav.addEventListener('click', (ev) => {
    const b = ev.target.closest('[role="tab"]');
    if (!b) return;
    if (location.hash === `#${b.dataset.aba}`) mostrarAba();
    else location.hash = b.dataset.aba;
  });

  abasNav.addEventListener('keydown', (ev) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
    ev.preventDefault();
    const i = ABAS.indexOf(abaAtual());
    const j = ev.key === 'Home' ? 0 : ev.key === 'End' ? ABAS.length - 1
      : (i + (ev.key === 'ArrowRight' ? 1 : -1) + ABAS.length) % ABAS.length;
    location.hash = ABAS[j];
    abasNav.querySelector(`[data-aba="${ABAS[j]}"]`).focus();
  });

  window.addEventListener('hashchange', mostrarAba);

  // ---------------------------------------------------------------------
  // Telas
  // ---------------------------------------------------------------------

  const tabela = (cabecas, linhas, vazio) =>
    el('div', { class: 'adm-tabela-caixa' },
      el('table', { class: 'adm-tabela' },
        el('thead', {}, el('tr', {}, cabecas.map((c) => (typeof c === 'string' ? el('th', { scope: 'col', text: c }) : c)))),
        el('tbody', {}, linhas.length ? linhas : el('tr', {}, el('td', { class: 'vazio-linha', colspan: cabecas.length, text: vazio }))),
      ),
    );

  const cartao = (rotulo, valor, nota) =>
    el('div', { class: 'adm-cartao' }, el('span', { text: rotulo }), el('strong', { text: valor }), nota ? el('small', { text: nota }) : null);

  const TELAS = {};

  // Resumo ------------------------------------------------------------------
  TELAS.resumo = async () => {
    const r = await chamar('/admin/resumo');
    const pedidosTotal = Object.values(r.pedidosHoje).reduce((a, b) => a + b, 0);
    const pagamentos = r.pagamentosHoje === 1 ? '1 pagamento aprovado' : `${r.pagamentosHoje} pagamentos aprovados`;

    return el('div', {},
      el('section', { class: 'adm-secao', 'aria-labelledby': 'tit-hoje' },
        el('h2', { id: 'tit-hoje', text: 'Hoje' }),
        el('div', { class: 'adm-cartoes' },
          cartao('Valor vendido', fmtMoeda(r.valorVendidoHoje), pagamentos),
          cartao('Comissão do shopping', fmtMoeda(r.comissaoShoppingHoje)),
          cartao('Repasse aos lojistas', fmtMoeda(r.valorLojistasHoje)),
          cartao('Pedidos criados', String(pedidosTotal)),
          cartao('Lojas ativas', `${r.lojasAtivas} de ${r.lojasTotal}`),
        ),
      ),
      el('div', { class: 'adm-colunas adm-secao' },
        el('section', { 'aria-labelledby': 'tit-pedidos' },
          el('h2', { id: 'tit-pedidos', text: 'Pedidos de hoje por situação' }),
          tabela([ 'Situação', el('th', { scope: 'col', class: 'num', text: 'Pedidos' }) ],
            Object.entries(STATUS_PEDIDO).map(([s, [rotulo, tipo]]) =>
              el('tr', {}, el('td', {}, badge(rotulo, tipo)), el('td', { class: 'num', text: String(r.pedidosHoje[s] || 0) }))),
            'Nenhum pedido hoje.'),
        ),
        el('section', { 'aria-labelledby': 'tit-perfis' },
          el('h2', { id: 'tit-perfis', text: 'Usuários por perfil' }),
          tabela([ 'Perfil', el('th', { scope: 'col', class: 'num', text: 'Ativos' }), el('th', { scope: 'col', class: 'num', text: 'Total' }) ],
            Object.entries(PERFIS).map(([p, rotulo]) => {
              const n = r.usuariosPorPerfil[p] || { ativos: 0, total: 0 };
              return el('tr', {}, el('td', { text: rotulo }), el('td', { class: 'num', text: String(n.ativos) }), el('td', { class: 'num', text: String(n.total) }));
            }),
            'Nenhum usuário.'),
        ),
      ),
    );
  };

  // Usuários ----------------------------------------------------------------
  const filtroUsuarios = { busca: '', perfil: '' };

  TELAS.usuarios = async (aindaAtual) => {
    const corpo = el('div', {}, el('p', { class: 'adm-carregando', text: 'Carregando…' }));
    let temporizador = null;

    const busca = el('input', {
      type: 'search', name: 'busca', placeholder: 'Nome ou e-mail', value: filtroUsuarios.busca, autocomplete: 'off',
      oninput: (ev) => {
        filtroUsuarios.busca = ev.target.value;
        clearTimeout(temporizador);
        temporizador = setTimeout(carregar, 300);
      },
    });
    const perfil = el('select', {
      name: 'perfil',
      onchange: (ev) => { filtroUsuarios.perfil = ev.target.value; carregar(); },
    },
    el('option', { value: '', text: 'Todos' }),
    Object.entries(PERFIS).map(([v, rotulo]) => el('option', { value: v, text: rotulo, selected: v === filtroUsuarios.perfil })));

    async function alternar(u) {
      if (u.ativo) {
        const ok = await confirmar(
          `Bloquear ${u.nome}?`,
          'A pessoa não vai conseguir entrar nem usar o app até ser desbloqueada.',
          'Bloquear',
        );
        if (!ok) return;
      }
      try {
        await chamar(`/admin/usuarios/${u.id}`, { metodo: 'PATCH', corpo: { ativo: !u.ativo } });
        avisar(u.ativo ? `${u.nome} foi bloqueado(a).` : `${u.nome} foi desbloqueado(a).`);
        carregar();
      } catch (erro) { tratarErro(erro); }
    }

    async function carregar() {
      try {
        const lista = await chamar('/admin/usuarios', { params: { busca: filtroUsuarios.busca.trim(), perfil: filtroUsuarios.perfil } });
        if (!aindaAtual()) return;
        corpo.replaceChildren(tabela(
          ['Nome', 'Perfil', 'Telefone', 'Cadastro', 'Situação', el('th', { scope: 'col', class: 'num' }, el('span', { class: 'sr-only', text: 'Ações' }))],
          lista.map((u) => {
            const souEu = eu && u.id === eu.id;
            return el('tr', {},
              el('td', {}, u.nome, el('span', { class: 'sub', text: u.email })),
              el('td', { text: PERFIS[u.perfil] || u.perfil }),
              el('td', { text: u.telefone || '—' }),
              el('td', { text: fmtData(u.criadoEm) }),
              el('td', {}, u.ativo ? badge('Ativo', 'ok') : badge('Bloqueado', 'perigo')),
              el('td', { class: 'acoes' },
                el('button', {
                  type: 'button',
                  class: `btn btn--pequeno ${u.ativo ? 'btn--contorno' : 'btn--primario'}`,
                  disabled: souEu && u.ativo,
                  title: souEu ? 'Você não pode bloquear o seu próprio usuário' : null,
                  'aria-label': `${u.ativo ? 'Bloquear' : 'Desbloquear'} ${u.nome}`,
                  text: u.ativo ? 'Bloquear' : 'Desbloquear',
                  onclick: () => alternar(u),
                })),
            );
          }),
          'Nenhum usuário encontrado.'));
      } catch (erro) {
        if (!aindaAtual()) return;
        tratarErro(erro);
        corpo.replaceChildren(el('p', { class: 'adm-carregando', text: 'Não foi possível carregar os usuários.' }));
      }
    }

    await carregar();
    return el('section', { class: 'adm-secao', 'aria-labelledby': 'tit-usuarios' },
      el('h2', { id: 'tit-usuarios', text: 'Usuários' }),
      el('div', { class: 'adm-filtros', role: 'search' },
        el('label', {}, 'Buscar', busca),
        el('label', {}, 'Perfil', perfil),
      ),
      corpo,
    );
  };

  // Lojas -------------------------------------------------------------------
  TELAS.lojas = async () => {
    const [lojas, categorias] = await Promise.all([chamar('/admin/lojas'), chamar('/admin/categorias')]);

    async function alternar(l) {
      if (l.ativa) {
        const ok = await confirmar(
          `Desativar a loja ${l.nome}?`,
          'A loja e os produtos dela deixam de aparecer no app e não recebem novas reservas.',
          'Desativar',
        );
        if (!ok) return;
      }
      try {
        await chamar(`/admin/lojas/${l.id}`, { metodo: 'PATCH', corpo: { ativa: !l.ativa } });
        avisar(l.ativa ? `Loja ${l.nome} desativada.` : `Loja ${l.nome} ativada.`);
        mostrarAba();
      } catch (erro) { tratarErro(erro); }
    }

    return el('section', { class: 'adm-secao', 'aria-labelledby': 'tit-lojas' },
      el('h2', { id: 'tit-lojas', text: 'Lojas' }),
      tabela(
        ['Loja', 'Categoria', 'Lojista', 'Horário', 'PagBank', 'Situação', el('th', { scope: 'col', class: 'num' }, el('span', { class: 'sr-only', text: 'Ações' }))],
        lojas.map((l) => el('tr', {},
          el('td', {}, l.nome, el('span', { class: 'sub', text: [l.piso, l.localizacao].filter(Boolean).join(' · ') })),
          el('td', {}, l.categoria.nome, el('span', { class: 'sub', text: `Comissão ${fmtPct(l.categoria.comissaoPercentual)}` })),
          el('td', {}, l.lojista.nome, ' ', l.lojista.ativo ? null : badge('Bloqueado', 'perigo'), el('span', { class: 'sub', text: l.lojista.email })),
          el('td', { text: l.horario || '—' }),
          el('td', {}, l.pagbankConectado ? badge('Conectado', 'ok') : badge('Não conectado', 'neutro')),
          el('td', {}, l.ativa ? badge('Ativa', 'ok') : badge('Desativada', 'perigo')),
          el('td', { class: 'acoes' },
            el('button', { type: 'button', class: 'btn btn--pequeno btn--contorno', text: 'Editar', 'aria-label': `Editar ${l.nome}`, onclick: () => editarLoja(l, categorias) }),
            el('button', {
              type: 'button',
              class: `btn btn--pequeno ${l.ativa ? 'btn--destaque' : 'btn--primario'}`,
              text: l.ativa ? 'Desativar' : 'Ativar',
              'aria-label': `${l.ativa ? 'Desativar' : 'Ativar'} ${l.nome}`,
              onclick: () => alternar(l),
            })),
        )),
        'Nenhuma loja cadastrada.'),
    );
  };

  function editarLoja(loja, categorias) {
    const dlg = $('#dlg-loja');
    const form = $('#form-loja');
    const erro = $('#form-loja-erro');
    const original = {
      nome: loja.nome, piso: loja.piso, localizacao: loja.localizacao, horario: loja.horario,
      telefone: loja.telefone, categoriaId: loja.categoria.id,
    };

    $('#dlg-loja-titulo').textContent = `Editar ${loja.nome}`;
    form.categoriaId.replaceChildren(...categorias.map((c) =>
      el('option', { value: c.id, text: `${c.nome} (${fmtPct(c.comissaoPercentual)})` })));
    for (const [campo, valor] of Object.entries(original)) form[campo].value = valor ?? '';
    erro.hidden = true;

    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const novos = {};
      for (const campo of Object.keys(original)) {
        let v = form[campo].value.trim();
        if (campo === 'categoriaId') v = Number(v);
        else if (v === '') v = null;
        if (v !== original[campo]) novos[campo] = v;
      }
      if (!form.nome.value.trim() || !form.piso.value.trim()) {
        erro.textContent = 'Nome e piso são obrigatórios.';
        erro.hidden = false;
        return;
      }
      if (!Object.keys(novos).length) { dlg.close(); return; }
      try {
        await chamar(`/admin/lojas/${loja.id}`, { metodo: 'PATCH', corpo: novos });
        dlg.close();
        avisar(`Loja ${novos.nome || loja.nome} atualizada.`);
        mostrarAba();
      } catch (e) {
        if (e.codigo === 'SEM_ACESSO') { dlg.close(); return; }
        erro.textContent = e.message;
        erro.hidden = false;
      }
    };
    $('#form-loja-cancelar').onclick = () => dlg.close();
    dlg.showModal();
    form.nome.focus();
  }

  // Categorias --------------------------------------------------------------
  TELAS.categorias = async () => {
    const categorias = await chamar('/admin/categorias');

    const linha = (c) => {
      const entrada = el('input', {
        type: 'number', min: '0', max: '100', step: '0.01', inputmode: 'decimal',
        value: String(c.comissaoPercentual), 'aria-label': `Comissão de ${c.nome} (%)`,
      });
      const salvar = el('button', { type: 'button', class: 'btn btn--pequeno btn--primario', text: 'Salvar', disabled: true });
      const valido = () => {
        const v = entrada.valueAsNumber;
        return Number.isFinite(v) && v >= 0 && v <= 100 && Math.round(v * 100) === v * 100 ? v : null;
      };
      entrada.addEventListener('input', () => {
        const v = valido();
        salvar.disabled = v === null || v === c.comissaoPercentual;
      });
      salvar.addEventListener('click', async () => {
        const v = valido();
        if (v === null) return;
        salvar.disabled = true;
        try {
          await chamar(`/admin/categorias/${c.id}`, { metodo: 'PATCH', corpo: { comissaoPercentual: v } });
          avisar(`Comissão de ${c.nome} alterada para ${fmtPct(v)}.`);
          mostrarAba();
        } catch (erro) {
          salvar.disabled = false;
          tratarErro(erro);
        }
      });
      return el('tr', {},
        el('td', { text: c.nome }),
        el('td', { class: 'num', text: String(c.lojas) }),
        el('td', {}, el('span', { class: 'adm-comissao' }, entrada, '%')),
        el('td', { class: 'acoes' }, salvar),
      );
    };

    return el('section', { class: 'adm-secao', 'aria-labelledby': 'tit-categorias' },
      el('h2', { id: 'tit-categorias', text: 'Categorias e comissão do shopping' }),
      el('p', { class: 'adm-nota', text: 'A comissão vale para os próximos pagamentos. Os pagamentos já feitos guardam o percentual da época.' }),
      tabela(
        ['Categoria', el('th', { scope: 'col', class: 'num', text: 'Lojas' }), 'Comissão', el('th', { scope: 'col', class: 'num' }, el('span', { class: 'sr-only', text: 'Ações' }))],
        categorias.map(linha),
        'Nenhuma categoria cadastrada.'),
    );
  };

  // Registro ----------------------------------------------------------------
  let limiteRegistro = 50;

  function fmtValor(campo, v, categorias) {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
    if (campo === 'comissaoPercentual') return fmtPct(v);
    if (campo === 'categoriaId') return (categorias.find((c) => c.id === v) || {}).nome || `#${v}`;
    return String(v);
  }

  TELAS.registro = async () => {
    const [registros, categorias] = await Promise.all([
      chamar('/admin/registro', { params: { limite: limiteRegistro } }),
      chamar('/admin/categorias'),
    ]);

    const limite = el('select', {
      name: 'limite',
      onchange: (ev) => { limiteRegistro = Number(ev.target.value); mostrarAba(); },
    }, [50, 100, 200].map((n) => el('option', { value: n, text: `Últimas ${n}`, selected: n === limiteRegistro })));

    return el('section', { class: 'adm-secao', 'aria-labelledby': 'tit-registro' },
      el('h2', { id: 'tit-registro', text: 'Registro das operações administrativas' }),
      el('div', { class: 'adm-filtros' }, el('label', {}, 'Mostrar', limite)),
      tabela(['Quando', 'Administrador', 'Ação', 'Alvo', 'Alterações'],
        registros.map((r) => {
          const d = r.detalhes || {};
          const antes = d.antes || {};
          const depois = d.depois || {};
          const nomeAlvo = d.nome || d.email;
          return el('tr', {},
            el('td', { text: fmtDataHora(r.criadoEm) }),
            el('td', { text: r.admin.nome }),
            el('td', { text: ACOES[r.acao] || r.acao }),
            el('td', {}, `${ALVOS[r.alvoTipo] || r.alvoTipo} #${r.alvoId}`, nomeAlvo ? el('span', { class: 'sub', text: nomeAlvo }) : null),
            el('td', { class: 'adm-detalhes' },
              Object.keys(depois).map((campo, i) => [
                i ? el('br') : null,
                el('b', { text: `${CAMPOS[campo] || campo}: ` }),
                `${fmtValor(campo, antes[campo], categorias)} → ${fmtValor(campo, depois[campo], categorias)}`,
              ])),
          );
        }),
        'Nenhuma operação registrada ainda.'),
    );
  };

  // ---------------------------------------------------------------------
  // Início
  // ---------------------------------------------------------------------

  async function iniciar() {
    $('#adm-sair').addEventListener('click', sair);
    if (!lerToken()) { mostrarEntrar(); return; } // sem token: nem chama a API
    try {
      eu = await chamar('/me');
    } catch (erro) {
      tratarErro(erro);
      if (!semAcesso) main.replaceChildren(el('p', { class: 'adm-carregando', text: 'Não foi possível carregar o painel.' }));
      return;
    }
    if (!eu || eu.perfil !== 'admin') { mostrarSemPermissao(); return; }
    $('#adm-usuario').textContent = `${eu.nome} · administrador`;
    $('#adm-sair').hidden = false;
    abasNav.hidden = false;
    mostrarAba();
  }

  iniciar();
})();
