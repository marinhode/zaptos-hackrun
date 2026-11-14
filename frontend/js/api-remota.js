// Camada de dados que conversa com a API Python (backend/app).
// Tem as mesmas funções da simulação (js/api.js) e devolve os dados no mesmo
// formato, então as telas funcionam igual nos dois modos.
(function () {
  'use strict';

  const cfg = window.ZAPTOS_CONFIG || {};
  const BASE = String(cfg.apiUrl || '').replace(/\/$/, '');
  let usuarioLogado = null;

  function erro(codigo, mensagem) {
    const e = new Error(mensagem);
    e.codigo = codigo;
    return e;
  }

  // como: 'cliente' | 'lojista' | null (rota pública)
  async function chamar(caminho, { metodo = 'GET', corpo, como = 'cliente', params } = {}) {
    const url = new URL(BASE + caminho);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
      });
    }
    const headers = {};
    if (como) headers['X-Usuario-Id'] = String(como === 'lojista' ? cfg.usuarioLojista : cfg.usuarioCliente);
    if (corpo !== undefined) headers['Content-Type'] = 'application/json';

    let resp;
    try {
      resp = await fetch(url, { method: metodo, headers, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
    } catch (e) {
      throw erro('SEM_CONEXAO', 'Não foi possível falar com o servidor. Verifique a conexão e tente de novo.');
    }
    if (resp.status === 204) return null;

    let dados = null;
    try { dados = await resp.json(); } catch (e) { /* resposta sem corpo */ }
    if (!resp.ok) {
      throw erro((dados && dados.codigo) || `ERRO_${resp.status}`,
        (dados && dados.mensagem) || 'Algo deu errado. Tente de novo.');
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

  function adaptarProduto(p) {
    return {
      ...p,
      icone: iconePara(p.nome),
      imagens: (p.imagens || []).map((i) => i.url),
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
    async iniciar() {
      const saude = await fetch(`${BASE}/health`).then((r) => r.json());
      if (saude.status !== 'ok') throw erro('SEM_BANCO', 'Banco de dados indisponível.');
      usuarioLogado = await chamar('/me');
    },

    cliente() {
      const [nome, ...resto] = String((usuarioLogado && usuarioLogado.nome) || 'Cliente').split(' ');
      return { id: usuarioLogado && usuarioLogado.id, nome, sobrenome: resto.join(' '), email: (usuarioLogado && usuarioLogado.email) || '' };
    },

    categorias: () => chamar('/categories', { como: null }),

    async lojas() {
      return (await chamar('/stores', { como: null })).map((l) => adaptarLoja(l));
    },

    async loja(id) {
      return adaptarLoja(await chamar(`/stores/${id}`, { como: null }));
    },

    async produtos(f = {}) {
      const lista = await chamar('/products', {
        como: null,
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
      return adaptarProduto(await chamar(`/products/${id}`, { como: null }));
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
      const lojas = await chamar('/seller/stores', { como: 'lojista' });
      if (!lojas.length) throw erro('SEM_LOJA', 'Nenhuma loja vinculada a este lojista.');
      return lojas[0].id;
    },

    async painelLoja(lojaId) {
      const d = await chamar(`/seller/stores/${lojaId}/dashboard`, { como: 'lojista' });
      return {
        loja: adaptarLoja(d.loja),
        reservasHoje: d.reservasHoje,
        produtos: d.produtos.map(adaptarProduto),
        aguardandoRetirada: d.aguardandoRetirada.map(adaptarPedido),
      };
    },

    async ajustarEstoque(lojaId, produtoId, delta) {
      const r = await chamar(`/seller/products/${produtoId}/stock`, { metodo: 'PATCH', corpo: { delta }, como: 'lojista' });
      return r.estoque;
    },

    async validarCodigo(lojaId, codigo) {
      const c = encodeURIComponent(String(codigo || '').trim());
      if (!c) throw erro('CODIGO_VAZIO', 'Digite o código do cliente.');
      return adaptarPedido(await chamar(`/seller/stores/${lojaId}/pickups/${c}`, { como: 'lojista' }));
    },

    async confirmarRetirada(lojaId, codigo) {
      const c = encodeURIComponent(String(codigo || '').trim());
      return adaptarPedido(await chamar(`/seller/stores/${lojaId}/pickups/${c}/confirm`, { metodo: 'POST', como: 'lojista' }));
    },
  };

  window.ZaptosApiRemota = API;
})();
