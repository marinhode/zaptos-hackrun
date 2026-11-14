// Camada de acesso a dados do front-end.
//
// Por enquanto é uma SIMULAÇÃO que guarda o estado no localStorage do navegador.
// Cada função tem o mesmo papel de uma rota da futura API Python; quando a API
// estiver pronta, basta trocar o corpo das funções por chamadas fetch().
//
// Regras simuladas (ver docs, seção 8.5):
//   RN001 só reserva com estoque disponível
//   RN003 retirada só com pedido pago e código válido
//   RN004 o lojista só mexe nos produtos e pedidos da própria loja
//   RN010 a unidade fica bloqueada por 15 minutos; depois volta ao estoque
(function () {
  'use strict';

  const D = window.ZAPTOS_DADOS;
  const CHAVE = 'zaptos-demo-v1';
  const RESERVA_MINUTOS = 15;

  // ---------- estado ----------

  function estadoInicial() {
    const estoque = {};
    D.produtos.forEach((p) => { estoque[p.id] = { disponivel: p.estoque, reservado: 0 }; });
    return {
      versao: 1,
      estoque,
      reservas: [],
      pedidos: D.pedidos.map((p) => ({ ...p })),
      proximaReserva: 1,
      proximoPedido: 4821,
    };
  }

  function carregar() {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE));
      if (salvo && salvo.versao === 1) return salvo;
    } catch (e) { /* sem acesso ao armazenamento: usa o estado inicial */ }
    return estadoInicial();
  }

  let st = carregar();

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(st)); } catch (e) { /* ignora */ }
  }

  // simula a latência da rede
  const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms));

  function erro(codigo, mensagem) {
    const e = new Error(mensagem);
    e.codigo = codigo;
    return e;
  }

  // RN010: devolve ao estoque as reservas vencidas
  function liberarExpiradas() {
    const agora = Date.now();
    let mudou = false;
    st.reservas.forEach((r) => {
      if (r.status === 'ativa' && r.expiraEm <= agora) {
        r.status = 'expirada';
        const e = st.estoque[r.produtoId];
        e.reservado -= 1;
        e.disponivel += 1;
        const ped = st.pedidos.find((p) => p.id === r.pedidoId);
        if (ped && ped.status === 'pendente') ped.status = 'expirado';
        mudou = true;
      }
    });
    if (mudou) salvar();
  }

  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const loja = (id) => D.lojas.find((l) => l.id === id);
  const categoria = (id) => D.categorias.find((c) => c.id === id);

  function completarProduto(p) {
    const l = loja(p.lojaId);
    return {
      ...p,
      estoque: st.estoque[p.id].disponivel,
      loja: l,
      categoria: categoria(l.categoriaId),
    };
  }

  function completarPedido(p) {
    const prod = D.produtos.find((x) => x.id === p.produtoId);
    const extra = p.codigo ? { qrCodigo: qrDoPedido(p) } : {};
    // nome do cliente do pedido (o lojista vê o nome de quem comprou, não o próprio)
    const conta = Object.values(CONTAS).find((c) => c.id === p.clienteId && c.perfil === 'cliente');
    if (conta) extra.cliente = { nome: conta.nome };
    return { ...p, ...extra, produto: completarProduto(prod), loja: loja(p.lojaId) };
  }

  // Na demonstração cada aparelho guarda os próprios dados (localStorage).
  // Para o lojista validar no celular dele um pedido feito no celular do
  // cliente, o QR Code leva os dados do pedido junto com o código.
  const PREFIXO_QR = 'ZAPTOS1:';
  function qrDoPedido(p) {
    const dados = [p.codigo, p.id, p.clienteId, p.produtoId, p.lojaId, p.valor, p.metodo || '', p.pagoEm, p.criadoEm];
    return PREFIXO_QR + btoa(unescape(encodeURIComponent(JSON.stringify(dados))));
  }
  function pedidoDoQr(texto) {
    if (!texto.startsWith(PREFIXO_QR)) return null;
    try {
      const [codigo, id, clienteId, produtoId, lojaId, valor, metodo, pagoEm, criadoEm] =
        JSON.parse(decodeURIComponent(escape(atob(texto.slice(PREFIXO_QR.length)))));
      if (!codigo || !D.produtos.some((x) => x.id === produtoId)) return null;
      return { id, clienteId, produtoId, lojaId, valor, metodo: metodo || undefined,
               pagoEm, criadoEm, codigo, status: 'aprovado', importado: true };
    } catch (_) {
      return null;
    }
  }

  function gerarCodigo(pedidoId) {
    const letras = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let sufixo = '';
    for (let i = 0; i < 3; i++) sufixo += letras[Math.floor(Math.random() * letras.length)];
    return `CD-${pedidoId}-${sufixo}`;
  }

  const ehHoje = (iso) => new Date(iso).toDateString() === new Date().toDateString();

  // ---------- funções públicas ----------

  // Contas de teste da demonstração (sem servidor): o perfil decide o que cada uma vê.
  const CONTAS = {
    'cliente@zaptos.dev': { senha: 'cliente123', id: 1, nome: 'Ana Souza', perfil: 'cliente' },
    'lojista@zaptos.dev': { senha: 'lojista123', id: 2, nome: 'Carlos Lojista', perfil: 'lojista' },
    'admin@zaptos.dev': { senha: 'admin123', id: 3, nome: 'Admin Capim Dourado', perfil: 'admin' },
  };
  const CHAVE_LOGIN = 'zaptos-demo-login';
  let logado = null;
  try { logado = JSON.parse(localStorage.getItem(CHAVE_LOGIN)); } catch (e) { logado = null; }

  const API = {
    modo: 'demo',

    usuario() {
      return logado;
    },

    async entrar(email, senha) {
      await espera(300);
      const conta = CONTAS[String(email).trim().toLowerCase()];
      if (!conta || conta.senha !== senha) throw erro('CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos.');
      logado = { id: conta.id, nome: conta.nome, email: String(email).trim().toLowerCase(), perfil: conta.perfil };
      try { localStorage.setItem(CHAVE_LOGIN, JSON.stringify(logado)); } catch (e) { /* ignora */ }
      return logado;
    },

    async cadastrar(dados) {
      await espera(300);
      logado = { id: 1, nome: dados.nome, email: dados.email, perfil: 'cliente' };
      try { localStorage.setItem(CHAVE_LOGIN, JSON.stringify(logado)); } catch (e) { /* ignora */ }
      return logado;
    },

    sair() {
      logado = null;
      try { localStorage.removeItem(CHAVE_LOGIN); } catch (e) { /* ignora */ }
    },

    // Resumo para a tela do administrador na demonstração (comissão de 10%).
    async resumoAdmin() {
      await espera();
      liberarExpiradas();
      const pagos = st.pedidos.filter((p) => p.status === 'aprovado' || p.status === 'retirado');
      const total = pagos.reduce((s, p) => s + p.valor, 0);
      return {
        vendas: pagos.length,
        total,
        comissao: Math.round(total * 10) / 100,
        lojas: D.lojas.length,
        pedidos: st.pedidos.map(completarPedido),
      };
    },

    cliente() {
      if (logado) {
        const [nome, ...resto] = logado.nome.split(' ');
        return { id: logado.id, nome, sobrenome: resto.join(' '), email: logado.email };
      }
      return D.cliente;
    },

    // GET /categories
    async categorias() {
      await espera();
      return D.categorias;
    },

    // GET /stores
    async lojas() {
      await espera();
      return D.lojas.map((l) => ({ ...l, categoria: categoria(l.categoriaId) }));
    },

    // GET /stores/:id
    async loja(id) {
      await espera();
      const l = loja(id);
      if (!l) throw erro('NAO_ENCONTRADO', 'Loja não encontrada.');
      return { ...l, categoria: categoria(l.categoriaId) };
    },

    // GET /products?q=&categoria=&disponivel=&precoMax=&piso=&loja=
    async produtos(filtros = {}) {
      await espera();
      liberarExpiradas();
      const termo = semAcento(filtros.q);
      return D.produtos
        .map(completarProduto)
        .filter((p) => {
          if (termo) {
            const alvo = semAcento([p.nome, p.descricao, p.loja.nome, p.categoria.nome].join(' '));
            if (!termo.split(/\s+/).every((t) => alvo.includes(t))) return false;
          }
          if (filtros.categoria && p.categoria.nome !== filtros.categoria) return false;
          if (filtros.disponivel && p.estoque < 1) return false;
          if (filtros.precoMax && p.preco > filtros.precoMax) return false;
          if (filtros.piso && p.loja.piso !== filtros.piso) return false;
          if (filtros.lojaId && p.lojaId !== filtros.lojaId) return false;
          return true;
        });
    },

    // GET /products/:id
    async produto(id) {
      await espera();
      liberarExpiradas();
      const p = D.produtos.find((x) => x.id === id);
      if (!p) throw erro('NAO_ENCONTRADO', 'Produto não encontrado.');
      return completarProduto(p);
    },

    // POST /orders/checkout-reserve  (RN001, RN010)
    // Reaproveita a reserva ativa do mesmo produto, se existir.
    async reservar(produtoId) {
      await espera();
      liberarExpiradas();
      const ativa = st.reservas.find((r) => r.status === 'ativa' && r.produtoId === produtoId && r.clienteId === D.cliente.id);
      if (ativa) return { ...ativa };

      const e = st.estoque[produtoId];
      if (!e || e.disponivel < 1) throw erro('SEM_ESTOQUE', 'Este produto não tem unidade disponível no momento.');

      const prod = D.produtos.find((x) => x.id === produtoId);
      const agora = Date.now();
      const pedido = {
        id: st.proximoPedido++,
        clienteId: D.cliente.id,
        produtoId,
        lojaId: prod.lojaId,
        valor: prod.preco,
        status: 'pendente',
        codigo: null,
        criadoEm: new Date(agora).toISOString(),
      };
      const reserva = {
        id: st.proximaReserva++,
        clienteId: D.cliente.id,
        produtoId,
        pedidoId: pedido.id,
        status: 'ativa',
        criadaEm: agora,
        expiraEm: agora + RESERVA_MINUTOS * 60 * 1000,
      };
      e.disponivel -= 1;
      e.reservado += 1;
      st.pedidos.push(pedido);
      st.reservas.push(reserva);
      salvar();
      return { ...reserva };
    },

    // DELETE /reservations/:id
    async cancelarReserva(reservaId) {
      await espera();
      const r = st.reservas.find((x) => x.id === reservaId);
      if (!r || r.status !== 'ativa') return;
      r.status = 'cancelada';
      const e = st.estoque[r.produtoId];
      e.reservado -= 1;
      e.disponivel += 1;
      const ped = st.pedidos.find((p) => p.id === r.pedidoId);
      if (ped) ped.status = 'cancelado';
      salvar();
    },

    // Pagamento simulado. Na versão real: o PagBank processa e confirma por
    // webhook (x-authenticity-token); só então o pedido vira "aprovado".
    async pagar(reservaId, metodo) {
      await espera(900);
      liberarExpiradas();
      const r = st.reservas.find((x) => x.id === reservaId);
      if (!r) throw erro('NAO_ENCONTRADO', 'Reserva não encontrada.');
      if (r.status !== 'ativa') throw erro('RESERVA_EXPIRADA', 'O tempo da reserva acabou e o produto voltou ao estoque.');

      r.status = 'paga';
      st.estoque[r.produtoId].reservado -= 1;
      const ped = st.pedidos.find((p) => p.id === r.pedidoId);
      ped.status = 'aprovado';
      ped.metodo = metodo;
      ped.pagoEm = new Date().toISOString();
      ped.codigo = gerarCodigo(ped.id);
      salvar();
      return completarPedido(ped);
    },

    // GET /orders (do cliente logado, RN005)
    async pedidos() {
      await espera();
      liberarExpiradas();
      return st.pedidos
        .filter((p) => p.clienteId === D.cliente.id)
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
        .map(completarPedido);
    },

    // GET /orders/:id
    async pedido(id) {
      await espera();
      liberarExpiradas();
      const p = st.pedidos.find((x) => x.id === id && x.clienteId === D.cliente.id);
      if (!p) throw erro('NAO_ENCONTRADO', 'Pedido não encontrado.');
      return completarPedido(p);
    },

    // GET /seller/stores/:id/dashboard
    async painelLoja(lojaId) {
      await espera();
      liberarExpiradas();
      const produtos = D.produtos.filter((p) => p.lojaId === lojaId).map(completarProduto);
      const daLoja = st.pedidos.filter((p) => p.lojaId === lojaId);
      return {
        loja: loja(lojaId),
        produtos,
        reservasHoje: daLoja.filter((p) => ehHoje(p.criadoEm) && p.status !== 'cancelado').length,
        aguardandoRetirada: daLoja.filter((p) => p.status === 'aprovado').map(completarPedido),
      };
    },

    // PATCH /seller/products/:id/stock  (RN004)
    async ajustarEstoque(lojaId, produtoId, delta) {
      await espera(60);
      const p = D.produtos.find((x) => x.id === produtoId);
      if (!p || p.lojaId !== lojaId) throw erro('SEM_PERMISSAO', 'Este produto não pertence à sua loja.');
      const e = st.estoque[produtoId];
      e.disponivel = Math.max(0, e.disponivel + delta);
      salvar();
      return e.disponivel;
    },

    // GET /seller/pickups/:codigo  (RN003, RN004)
    async validarCodigo(lojaId, codigo) {
      await espera();
      const bruto = String(codigo || '').trim();
      const doQr = pedidoDoQr(bruto);
      const limpo = doQr ? doQr.codigo : bruto.toUpperCase();
      let p = st.pedidos.find((x) => x.codigo && x.codigo === limpo);
      if (!p && doQr) {
        // pedido feito em outro aparelho: passa a existir neste também
        st.pedidos.push(doQr);
        salvar();
        p = doQr;
      }
      if (!p) throw erro('NAO_ENCONTRADO', 'Código não encontrado. Confira com o cliente.');
      if (p.lojaId !== lojaId) throw erro('OUTRA_LOJA', 'Este pedido é de outra loja.');
      if (p.status === 'retirado') throw erro('JA_RETIRADO', 'Este código já foi usado: o pedido já foi retirado.');
      if (p.status !== 'aprovado') throw erro('NAO_PAGO', 'Este pedido ainda não foi pago.');
      return completarPedido(p);
    },

    // POST /seller/pickups/:codigo/confirm
    async confirmarRetirada(lojaId, codigo) {
      const p = await API.validarCodigo(lojaId, codigo);
      const real = st.pedidos.find((x) => x.codigo === p.codigo);
      real.status = 'retirado';
      real.retiradoEm = new Date().toISOString();
      salvar();
      return completarPedido(real);
    },

    // Loja usada no painel do lojista de demonstração.
    async lojaDoLojista() {
      return 1; // Casa e Cia
    },

    // Volta os dados de demonstração ao estado inicial.
    restaurarDemo() {
      st = estadoInicial();
      salvar();
    },
  };

  window.ZaptosApiDemo = API;
})();
