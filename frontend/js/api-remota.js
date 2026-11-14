// Camada de dados que conversa com a API Python (backend/app).
// Tem as mesmas funções da simulação (js/api.js) e devolve os dados no mesmo
// formato, então as telas funcionam igual nos dois modos.
(function () {
  'use strict';

  const cfg = window.ZAPTOS_CONFIG || {};
  const BASE = String(cfg.apiUrl || '').replace(/\/$/, '');
  const CHAVE_TOKEN = 'zaptos-token';
  let usuarioLogado = null;

  function erro(codigo, mensagem) {
    const e = new Error(mensagem);
    e.codigo = codigo;
    return e;
  }

  // ---------- sessão (token do login) ----------

  function lerToken() {
    try { return localStorage.getItem(CHAVE_TOKEN); } catch (e) { return null; }
  }

  function guardarToken(token) {
    try {
      if (token) localStorage.setItem(CHAVE_TOKEN, token);
      else localStorage.removeItem(CHAVE_TOKEN);
    } catch (e) { /* navegador sem armazenamento: a sessão dura só esta página */ }
  }

  // Erro de validação do FastAPI (422) vem como {"detail": [{"msg": ...}]}.
  function mensagemDe(dados) {
    if (dados && dados.mensagem) return dados.mensagem;
    if (dados && Array.isArray(dados.detail) && dados.detail[0]) {
      return String(dados.detail[0].msg || '').replace(/^Value error,\s*/i, '') || 'Confira os dados informados.';
    }
    return 'Algo deu errado. Tente de novo.';
  }

  // auth: envia o token do usuário logado (rotas de cliente e de lojista)
  // formulario: FormData (envio de arquivo); o navegador define o Content-Type
  async function chamar(caminho, { metodo = 'GET', corpo, formulario, auth = true, params } = {}) {
    const url = new URL(BASE + caminho);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
      });
    }
    const headers = {};
    const token = lerToken();
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    if (corpo !== undefined) headers['Content-Type'] = 'application/json';
    const body = formulario || (corpo !== undefined ? JSON.stringify(corpo) : undefined);

    let resp;
    try {
      resp = await fetch(url, { method: metodo, headers, body });
    } catch (e) {
      throw erro('SEM_CONEXAO', 'Não foi possível falar com o servidor. Verifique a conexão e tente de novo.');
    }
    if (resp.status === 204) return null;

    let dados = null;
    try { dados = await resp.json(); } catch (e) { /* resposta sem corpo */ }
    if (!resp.ok) {
      const codigo = (dados && dados.codigo) || `ERRO_${resp.status}`;
      // sessão vencida ou conta bloqueada: esquece o login salvo
      if (resp.status === 401 && auth) { guardarToken(null); usuarioLogado = null; }
      throw erro(codigo, mensagemDe(dados));
    }
    return dados;
  }

  // ---------- conversão para o formato das telas ----------

  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const primeiroNumero = (s) => {
    const m = String(s || '').match(/\d+/);
    return m ? Number(m[0]) : null;
  };

  // Escolhe a ilustração usada quando o produto ainda não tem foto.
  function iconePara(nome) {
    const n = semAcento(nome);
    if (n.includes('poltrona') || n.includes('sofa') || n.includes('cadeira')) return 'poltrona';
    if (n.includes('mesa')) return 'mesa';
    if (n.includes('lumin') || n.includes('abajur')) return 'luminaria';
    if (n.includes('tenis') || n.includes('sapato') || n.includes('sandalia')) return 'tenis';
    return 'sacola';
  }

  // Banco: piso "Piso 1", localizacao "Loja 112", horario "Seg a sáb 10h-22h"
  function adaptarLoja(l, categoria) {
    const cat = l.categoria || categoria || null;
    const fecha = String(l.horario || '').match(/(\d{1,2}h)\s*$/);
    return {
      id: l.id,
      nome: l.nome,
      piso: primeiroNumero(l.piso) ?? l.piso ?? '',
      numero: primeiroNumero(l.localizacao) ?? l.localizacao ?? '',
      horario: l.horario || '',
      fechaAs: fecha ? fecha[1] : '22h',
      segmento: cat ? cat.nome : '',
      categoria: cat,
    };
  }

  // Imagens enviadas ficam na API ("/uploads/..."): completa com o endereço dela.
  const ORIGEM_API = (() => { try { return new URL(BASE).origin; } catch (e) { return ''; } })();
  const urlAbsoluta = (u) => (u && u.startsWith('/') ? ORIGEM_API + u : u);

  function adaptarProduto(p) {
    return {
      ...p,
      icone: iconePara(p.nome),
      imagens: (p.imagens || []).map((i) => urlAbsoluta(i.url)),
      // com id, para o lojista poder remover cada imagem
      galeria: (p.imagens || []).map((i) => ({ id: i.id, url: urlAbsoluta(i.url) })),
      loja: adaptarLoja(p.loja, p.categoria),
    };
  }

  function adaptarPedido(p) {
    const item = p.produto || {};
    return {
      ...p,
      produto: { id: item.produtoId, nome: item.nome, icone: iconePara(item.nome), imagens: [] },
      loja: adaptarLoja(p.loja),
    };
  }

  // ---------- funções usadas pelas telas ----------

  const API = {
    modo: 'api',

    // Confere se a API e o banco estão no ar e carrega o usuário.
    // Confere se a API e o banco estão no ar e recupera o login salvo, se houver.
    async iniciar() {
      const saude = await fetch(`${BASE}/health`).then((r) => r.json());
      if (saude.status !== 'ok') throw erro('SEM_BANCO', 'Banco de dados indisponível.');
      usuarioLogado = null;
      if (lerToken()) {
        try { usuarioLogado = await chamar('/me'); } catch (e) { /* login vencido: segue como visitante */ }
      }
    },

    // ---------- login (RF002, RF015) ----------

    // null = visitante; senão {id, nome, email, perfil}
    usuario() {
      return usuarioLogado;
    },

    async entrar(email, senha) {
      const r = await chamar('/auth/login', { metodo: 'POST', corpo: { email, senha }, auth: false });
      guardarToken(r.token);
      usuarioLogado = r.usuario;
      return r.usuario;
    },

    async cadastrar(dados) {
      const r = await chamar('/auth/cadastro', { metodo: 'POST', corpo: dados, auth: false });
      guardarToken(r.token);
      usuarioLogado = r.usuario;
      return r.usuario;
    },

    sair() {
      guardarToken(null);
      usuarioLogado = null;
    },

    cliente() {
      const [nome, ...resto] = String((usuarioLogado && usuarioLogado.nome) || '').split(' ');
      return { id: usuarioLogado && usuarioLogado.id, nome, sobrenome: resto.join(' '), email: (usuarioLogado && usuarioLogado.email) || '' };
    },

    categorias: () => chamar('/categories', { auth: false }),

    async lojas() {
      return (await chamar('/stores', { auth: false })).map((l) => adaptarLoja(l));
    },

    async loja(id) {
      return adaptarLoja(await chamar(`/stores/${id}`, { auth: false }));
    },

    async produtos(f = {}) {
      const lista = await chamar('/products', {
        auth: false,
        params: {
          q: f.q,
          categoria: f.categoria,
          disponivel: f.disponivel ? 'true' : undefined,
          preco_max: f.precoMax,
          piso: f.piso ? `Piso ${f.piso}` : undefined,
          loja_id: f.lojaId,
        },
      });
      return lista.map(adaptarProduto);
    },

    async produto(id) {
      return adaptarProduto(await chamar(`/products/${id}`, { auth: false }));
    },

    reservar: (produtoId) => chamar('/orders/checkout-reserve', { metodo: 'POST', corpo: { produtoId } }),

    cancelarReserva: (reservaId) => chamar(`/reservations/${reservaId}`, { metodo: 'DELETE' }),

    async pagar(reservaId, metodo) {
      return adaptarPedido(await chamar(`/reservations/${reservaId}/pay`, { metodo: 'POST', corpo: { metodo } }));
    },

    async pedidos() {
      return (await chamar('/orders')).map(adaptarPedido);
    },

    async pedido(id) {
      return adaptarPedido(await chamar(`/orders/${id}`));
    },

    async lojaDoLojista() {
      const lojas = await chamar('/seller/stores', {});
      if (!lojas.length) throw erro('SEM_LOJA', 'Nenhuma loja vinculada a este lojista.');
      return lojas[0].id;
    },

    async painelLoja(lojaId) {
      const d = await chamar(`/seller/stores/${lojaId}/dashboard`, {});
      return {
        loja: adaptarLoja(d.loja),
        reservasHoje: d.reservasHoje,
        produtos: d.produtos.map(adaptarProduto),
        aguardandoRetirada: d.aguardandoRetirada.map(adaptarPedido),
      };
    },

    async ajustarEstoque(lojaId, produtoId, delta) {
      const r = await chamar(`/seller/products/${produtoId}/stock`, { metodo: 'PATCH', corpo: { delta } });
      return r.estoque;
    },

    async validarCodigo(lojaId, codigo) {
      const c = encodeURIComponent(String(codigo || '').trim());
      if (!c) throw erro('CODIGO_VAZIO', 'Digite o código do cliente.');
      return adaptarPedido(await chamar(`/seller/stores/${lojaId}/pickups/${c}`, {}));
    },

    async confirmarRetirada(lojaId, codigo) {
      const c = encodeURIComponent(String(codigo || '').trim());
      return adaptarPedido(await chamar(`/seller/stores/${lojaId}/pickups/${c}/confirm`, { metodo: 'POST' }));
    },

    // ---------- cadastro de produtos pelo lojista ----------

    async produtoDoLojista(id) {
      return adaptarProduto(await chamar(`/seller/products/${id}`));
    },

    async criarProduto(lojaId, dados) {
      return adaptarProduto(await chamar(`/seller/stores/${lojaId}/products`, { metodo: 'POST', corpo: dados }));
    },

    async editarProduto(id, dados) {
      return adaptarProduto(await chamar(`/seller/products/${id}`, { metodo: 'PATCH', corpo: dados }));
    },

    async enviarImagem(id, arquivo) {
      const formulario = new FormData();
      formulario.append('arquivo', arquivo);
      return adaptarProduto(await chamar(`/seller/products/${id}/images`, { metodo: 'POST', formulario }));
    },

    async apagarImagem(id, imagemId) {
      return adaptarProduto(await chamar(`/seller/products/${id}/images/${imagemId}`, { metodo: 'DELETE' }));
    },
  };

  window.ZaptosApiRemota = API;
})();
