-- =====================================================================
-- Zaptos - dados de exemplo (desenvolvimento/apresentacao)
-- Rodar DEPOIS do schema.sql:
--   mysql -u <usuario> -p zaptos < backend/db/seed.sql
--
-- Alinhado com o prototipo (docs/telas) e com frontend/js/data.js.
--
-- Senhas: todos os usuarios usam o MESMO hash bcrypt de exemplo, gerado a
-- partir da senha de desenvolvimento "zaptos-dev-123". Nao e senha real e
-- nao deve ser usada em producao.
-- Nenhum token do PagBank e gravado aqui: as lojas comecam desconectadas e
-- o lojista vincula a conta pelo PagBank Connect (sandbox).
-- =====================================================================

USE zaptos;
SET NAMES utf8mb4;
SET time_zone = '-03:00';  -- horario de Palmas/TO

START TRANSACTION;

-- Usuarios ------------------------------------------------------------
-- 1 cliente, 1 admin e um lojista por loja
INSERT INTO usuario (id, nome, email, senha_hash, telefone, perfil) VALUES
  (1, 'Ana Souza',           'cliente@zaptos.dev',    '$2a$12$2jO.RDePm1DqTSOiAmuO7.P/g5wCOQXzuhJ6HBVSfaEZ5vvMoy2KK', '63900000001', 'cliente'),
  (2, 'Carlos Lojista',      'lojista@zaptos.dev',    '$2a$12$2jO.RDePm1DqTSOiAmuO7.P/g5wCOQXzuhJ6HBVSfaEZ5vvMoy2KK', '63900000002', 'lojista'),
  (3, 'Admin Capim Dourado', 'admin@zaptos.dev',      '$2a$12$2jO.RDePm1DqTSOiAmuO7.P/g5wCOQXzuhJ6HBVSfaEZ5vvMoy2KK', NULL,          'admin'),
  (4, 'Marina Lojista',      'larestilo@zaptos.dev',  '$2a$12$2jO.RDePm1DqTSOiAmuO7.P/g5wCOQXzuhJ6HBVSfaEZ5vvMoy2KK', '63900000004', 'lojista'),
  (5, 'Rafael Lojista',      'passocerto@zaptos.dev', '$2a$12$2jO.RDePm1DqTSOiAmuO7.P/g5wCOQXzuhJ6HBVSfaEZ5vvMoy2KK', '63900000005', 'lojista');

-- Categorias (comissao do shopping, em %) -----------------------------
INSERT INTO categoria (id, nome, comissao_percentual) VALUES
  (1, 'Decoração',   10.00),
  (2, 'Moda',        12.00),
  (3, 'Eletrônicos',  8.00),
  (4, 'Calçados',    10.00);

-- Lojas ---------------------------------------------------------------
INSERT INTO loja (id, lojista_id, categoria_id, nome, descricao, piso, localizacao,
                  horario_funcionamento, telefone, email) VALUES
  (1, 2, 1, 'Casa e Cia',
   'Móveis e objetos de decoração para sala, quarto e varanda.',
   'Piso 1', 'Loja 112', 'Seg a sáb 10h-22h', '6332140000', 'contato@casaecia.zaptos.dev'),
  (2, 4, 1, 'Lar & Estilo',
   'Móveis e iluminação com design contemporâneo.',
   'Piso 2', 'Loja 204', 'Seg a sáb 10h-22h', '6332140001', 'contato@larestilo.zaptos.dev'),
  (3, 5, 4, 'Passo Certo',
   'Calçados esportivos e casuais.',
   'Piso 1', 'Loja 130', 'Seg a sáb 10h-22h', '6332140002', 'contato@passocerto.zaptos.dev');

-- Produtos (medidas em cm: largura x altura x profundidade) ------------
-- Sem produto_imagem por enquanto: as imagens ainda nao existem.
INSERT INTO produto (id, loja_id, nome, descricao, preco, largura_cm, altura_cm, profundidade_cm) VALUES
  (1, 1, 'Poltrona Lina',
   'Poltrona estofada em linho com pés de madeira maciça. Disponível em verde-musgo e terracota.',
   1290.00,  78.00,  72.00,  85.00),
  (2, 2, 'Poltrona Oslo',
   'Linhas retas inspiradas no design escandinavo, assento com espuma de alta densidade.',
   1450.00,  80.00,  76.00,  82.00),
  (3, 1, 'Poltrona Ripa',
   'Estrutura em ripas de madeira e almofadas removíveis.',
    990.00,  70.00,  74.00,  78.00),
  (4, 1, 'Mesa Tora',
   'Mesa de jantar para 6 lugares em madeira de reflorestamento.',
   2100.00, 160.00,  76.00,  90.00),
  (5, 2, 'Luminária Arco',
   'Luminária de piso com haste curva e cúpula em metal.',
    420.00,  40.00, 190.00, 120.00),
  (6, 3, 'Tênis Run',
   'Tênis de corrida leve, numeração do 34 ao 44.',
    380.00,   NULL,   NULL,   NULL);

-- Estoque -------------------------------------------------------------
INSERT INTO estoque (produto_id, quantidade_disponivel, quantidade_reservada) VALUES
  (1, 3, 0),
  (2, 1, 0),
  (3, 0, 0),  -- esgotado: serve para testar RN001
  (4, 5, 0),
  (5, 4, 0),
  (6, 6, 0);

-- Historico da cliente Ana Souza --------------------------------------
-- Pedido 4790: Luminaria Arco (Lar & Estilo), pago e retirado em 2026-11-02
INSERT INTO pedido (id, usuario_id, loja_id, status, valor_total, criado_em, atualizado_em) VALUES
  (4790, 1, 2, 'retirado', 420.00, '2026-11-02 15:20:00', '2026-11-02 18:40:00');

INSERT INTO item_pedido (pedido_id, loja_id, produto_id, quantidade, preco_unitario) VALUES
  (4790, 2, 5, 1, 420.00);

INSERT INTO reserva (pedido_id, produto_id, usuario_id, quantidade, status, criado_em, expira_em, finalizada_em) VALUES
  (4790, 5, 1, 1, 'paga', '2026-11-02 15:20:00', '2026-11-02 15:35:00', '2026-11-02 15:22:00');

-- Decoracao: 10% para o shopping
INSERT INTO pagamento (pedido_id, valor_total, valor_lojista, comissao_shopping, comissao_percentual,
                       status, pago_em, criado_em, atualizado_em) VALUES
  (4790, 420.00, 378.00, 42.00, 10.00, 'aprovado',
   '2026-11-02 15:22:00', '2026-11-02 15:20:00', '2026-11-02 15:22:00');

INSERT INTO protocolo_retirada (pedido_id, codigo, codigo_curto, gerado_em, usado_em, validado_por_id) VALUES
  (4790, '6f1c2b0e-8d4a-4c3e-9b7a-2e5d1f0a4790', 'CD-4790-2HM',
   '2026-11-02 15:22:00', '2026-11-02 18:40:00', 4);

-- Pedido 4712: Tenis Run (Passo Certo), reserva venceu sem pagamento
INSERT INTO pedido (id, usuario_id, loja_id, status, valor_total, criado_em, atualizado_em) VALUES
  (4712, 1, 3, 'expirado', 380.00, '2026-10-20 18:05:00', '2026-10-20 18:20:00');

INSERT INTO item_pedido (pedido_id, loja_id, produto_id, quantidade, preco_unitario) VALUES
  (4712, 3, 6, 1, 380.00);

INSERT INTO reserva (pedido_id, produto_id, usuario_id, quantidade, status, criado_em, expira_em, finalizada_em) VALUES
  (4712, 6, 1, 1, 'expirada', '2026-10-20 18:05:00', '2026-10-20 18:20:00', '2026-10-20 18:20:00');

COMMIT;

-- Proximo pedido criado pela API sera o 4821 (ALTER TABLE faz commit
-- implicito, por isso fica fora da transacao).
ALTER TABLE pedido AUTO_INCREMENT = 4821;
