-- =====================================================================
-- Zaptos - HACKRUN 2026
-- Esquema do banco de dados (MySQL 8.0.16+, InnoDB, utf8mb4)
--
-- Baseado no modelo de classes (Documentacao, secao 8.7) e nas regras de
-- negocio (secao 8.5). Rodar antes do seed.sql:
--   mysql -u <usuario> -p < backend/db/schema.sql
--
-- ATENCAO: recria o banco "zaptos" do zero (apaga os dados existentes).
-- =====================================================================

DROP DATABASE IF EXISTS zaptos;
CREATE DATABASE zaptos
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;
USE zaptos;

SET NAMES utf8mb4;
SET time_zone = '-03:00';  -- horario de Palmas/TO

-- ---------------------------------------------------------------------
-- usuario: clientes, lojistas, atendentes e administradores
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nome           VARCHAR(120)  NOT NULL,
  email          VARCHAR(160)  NOT NULL,
  senha_hash     CHAR(60)      NOT NULL COMMENT 'hash bcrypt; nunca a senha',
  telefone       VARCHAR(20)   NULL,
  perfil         ENUM('cliente','lojista','atendente','admin') NOT NULL DEFAULT 'cliente',
  ativo          BOOLEAN       NOT NULL DEFAULT TRUE,
  criado_em      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuario_email (email),
  KEY ix_usuario_perfil (perfil)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- categoria: agrupa lojas e define a comissao do shopping (split)
-- ---------------------------------------------------------------------
CREATE TABLE categoria (
  id                    INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  nome                  VARCHAR(80)   NOT NULL,
  comissao_percentual   DECIMAL(5,2)  NOT NULL COMMENT 'percentual retido pelo shopping no split',
  criado_em             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categoria_nome (nome),
  CONSTRAINT ck_categoria_comissao CHECK (comissao_percentual BETWEEN 0 AND 100)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- loja: pertence a um lojista e a uma categoria (RN004)
-- Os tokens do PagBank Connect sao gravados CIFRADOS pela API
-- (chave no .env); nunca em texto puro.
-- ---------------------------------------------------------------------
CREATE TABLE loja (
  id                        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  lojista_id                INT UNSIGNED  NOT NULL,
  categoria_id              INT UNSIGNED  NOT NULL,
  nome                      VARCHAR(120)  NOT NULL,
  descricao                 TEXT          NULL,
  piso                      VARCHAR(20)   NOT NULL COMMENT 'ex.: Terreo, Piso 1',
  localizacao               VARCHAR(120)  NULL     COMMENT 'ex.: Loja 112, ala norte',
  horario_funcionamento     VARCHAR(120)  NULL,
  telefone                  VARCHAR(20)   NULL,
  email                     VARCHAR(160)  NULL,
  pagbank_account_id        VARCHAR(64)   NULL COMMENT 'conta do lojista no PagBank (recebedor do split)',
  pagbank_access_token      VARBINARY(1024) NULL COMMENT 'cifrado pela API',
  pagbank_refresh_token     VARBINARY(1024) NULL COMMENT 'cifrado pela API; substituido a cada renovacao',
  pagbank_token_expira_em   DATETIME      NULL,
  pagbank_conectado_em      DATETIME      NULL,
  ativa                     BOOLEAN       NOT NULL DEFAULT TRUE,
  criado_em                 DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_loja_nome (nome),
  UNIQUE KEY uq_loja_pagbank_account (pagbank_account_id),
  KEY ix_loja_lojista (lojista_id),
  KEY ix_loja_categoria (categoria_id),
  CONSTRAINT fk_loja_lojista   FOREIGN KEY (lojista_id)   REFERENCES usuario (id),
  CONSTRAINT fk_loja_categoria FOREIGN KEY (categoria_id) REFERENCES categoria (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- produto: pertence a uma loja; medidas em centimetros
-- ---------------------------------------------------------------------
CREATE TABLE produto (
  id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  loja_id           INT UNSIGNED  NOT NULL,
  nome              VARCHAR(150)  NOT NULL,
  descricao         TEXT          NULL,
  preco             DECIMAL(10,2) NOT NULL,
  largura_cm        DECIMAL(7,2)  NULL,
  altura_cm         DECIMAL(7,2)  NULL,
  profundidade_cm   DECIMAL(7,2)  NULL,
  ativo             BOOLEAN       NOT NULL DEFAULT TRUE,
  criado_em         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_produto_id_loja (id, loja_id) COMMENT 'alvo da FK composta de item_pedido (RN012)',
  KEY ix_produto_loja_ativo (loja_id, ativo),
  KEY ix_produto_preco (preco),
  FULLTEXT KEY ft_produto_busca (nome, descricao),
  CONSTRAINT fk_produto_loja FOREIGN KEY (loja_id) REFERENCES loja (id),
  CONSTRAINT ck_produto_preco CHECK (preco >= 0),
  CONSTRAINT ck_produto_medidas CHECK (
    (largura_cm IS NULL OR largura_cm > 0) AND
    (altura_cm IS NULL OR altura_cm > 0) AND
    (profundidade_cm IS NULL OR profundidade_cm > 0)
  )
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- produto_imagem: galeria do produto (imagens planas), com ordem
-- ---------------------------------------------------------------------
CREATE TABLE produto_imagem (
  id                  INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  produto_id          INT UNSIGNED      NOT NULL,
  url                 VARCHAR(500)      NOT NULL,
  texto_alternativo   VARCHAR(200)      NULL,
  ordem               SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1 = imagem principal',
  criado_em           DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_produto_imagem_ordem (produto_id, ordem),
  CONSTRAINT fk_produto_imagem_produto FOREIGN KEY (produto_id)
    REFERENCES produto (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- estoque: um registro por produto (RN001)
--   quantidade_disponivel: unidades livres para reservar
--   quantidade_reservada : unidades bloqueadas por reservas ativas
-- Reservar  = disponivel - 1, reservada + 1 (na mesma transacao, com
--             SELECT ... FOR UPDATE). O CHECK impede disponivel < 0.
-- ---------------------------------------------------------------------
CREATE TABLE estoque (
  produto_id              INT UNSIGNED NOT NULL,
  quantidade_disponivel   INT          NOT NULL DEFAULT 0,
  quantidade_reservada    INT          NOT NULL DEFAULT 0,
  atualizado_em           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (produto_id),
  KEY ix_estoque_disponivel (quantidade_disponivel),
  CONSTRAINT fk_estoque_produto FOREIGN KEY (produto_id)
    REFERENCES produto (id) ON DELETE CASCADE,
  CONSTRAINT ck_estoque_disponivel CHECK (quantidade_disponivel >= 0),
  CONSTRAINT ck_estoque_reservada  CHECK (quantidade_reservada >= 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- pedido: pertence a UM usuario e a UMA loja (RN012)
-- ---------------------------------------------------------------------
CREATE TABLE pedido (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  usuario_id      INT UNSIGNED  NOT NULL,
  loja_id         INT UNSIGNED  NOT NULL,
  status          ENUM('pendente','aprovado','retirado','cancelado','expirado') NOT NULL DEFAULT 'pendente'
                  COMMENT 'expirado = reserva venceu sem pagamento; cancelado = cliente desistiu',
  valor_total     DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  criado_em       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pedido_id_loja (id, loja_id) COMMENT 'alvo da FK composta de item_pedido (RN012)',
  KEY ix_pedido_usuario (usuario_id, criado_em),
  KEY ix_pedido_loja_status (loja_id, status),
  CONSTRAINT fk_pedido_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id),
  CONSTRAINT fk_pedido_loja    FOREIGN KEY (loja_id)    REFERENCES loja (id),
  CONSTRAINT ck_pedido_valor   CHECK (valor_total >= 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- item_pedido: itens do pedido. As FKs compostas (pedido_id, loja_id) e
-- (produto_id, loja_id) garantem que todo item e da MESMA loja do pedido.
-- ---------------------------------------------------------------------
CREATE TABLE item_pedido (
  id               INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  pedido_id        INT UNSIGNED      NOT NULL,
  loja_id          INT UNSIGNED      NOT NULL,
  produto_id       INT UNSIGNED      NOT NULL,
  quantidade       SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  preco_unitario   DECIMAL(10,2)     NOT NULL COMMENT 'preco no momento da compra',
  subtotal         DECIMAL(10,2)     AS (quantidade * preco_unitario) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uq_item_pedido_produto (pedido_id, produto_id),
  KEY ix_item_pedido_pedido_loja (pedido_id, loja_id),
  KEY ix_item_pedido_produto_loja (produto_id, loja_id),
  CONSTRAINT fk_item_pedido_pedido FOREIGN KEY (pedido_id, loja_id)
    REFERENCES pedido (id, loja_id) ON DELETE CASCADE,
  CONSTRAINT fk_item_pedido_produto FOREIGN KEY (produto_id, loja_id)
    REFERENCES produto (id, loja_id),
  CONSTRAINT ck_item_pedido_quantidade CHECK (quantidade > 0),
  CONSTRAINT ck_item_pedido_preco CHECK (preco_unitario >= 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- reserva: bloqueia unidade(s) de um produto por no maximo 15 minutos
-- (RN010). Ao expirar, a rotina de liberacao devolve ao estoque.
-- ---------------------------------------------------------------------
CREATE TABLE reserva (
  id            INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  pedido_id     INT UNSIGNED      NOT NULL,
  produto_id    INT UNSIGNED      NOT NULL,
  usuario_id    INT UNSIGNED      NOT NULL,
  quantidade    SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  status        ENUM('ativa','paga','expirada') NOT NULL DEFAULT 'ativa',
  criado_em     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em     DATETIME          NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL 15 MINUTE),
  finalizada_em DATETIME          NULL COMMENT 'quando virou paga ou expirada',
  PRIMARY KEY (id),
  UNIQUE KEY uq_reserva_pedido_produto (pedido_id, produto_id),
  KEY ix_reserva_status_expira (status, expira_em) COMMENT 'usado pela rotina de liberacao',
  KEY ix_reserva_produto (produto_id),
  KEY ix_reserva_usuario (usuario_id),
  CONSTRAINT fk_reserva_pedido  FOREIGN KEY (pedido_id)  REFERENCES pedido (id) ON DELETE CASCADE,
  CONSTRAINT fk_reserva_produto FOREIGN KEY (produto_id) REFERENCES produto (id),
  CONSTRAINT fk_reserva_usuario FOREIGN KEY (usuario_id) REFERENCES usuario (id),
  CONSTRAINT ck_reserva_quantidade CHECK (quantidade > 0),
  CONSTRAINT ck_reserva_prazo CHECK (
    expira_em > criado_em AND expira_em <= criado_em + INTERVAL 15 MINUTE
  )
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- pagamento: um por pedido; divisao lojista x shopping (charges.splits)
-- ---------------------------------------------------------------------
CREATE TABLE pagamento (
  id                    INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  pedido_id             INT UNSIGNED  NOT NULL,
  pagbank_order_id      VARCHAR(64)   NULL COMMENT 'ORDE_... retornado pelo PagBank',
  pagbank_charge_id     VARCHAR(64)   NULL COMMENT 'CHAR_... retornado pelo PagBank',
  valor_total           DECIMAL(10,2) NOT NULL,
  valor_lojista         DECIMAL(10,2) NOT NULL,
  comissao_shopping     DECIMAL(10,2) NOT NULL,
  comissao_percentual   DECIMAL(5,2)  NOT NULL COMMENT 'copia da categoria no momento do pagamento',
  status                ENUM('pendente','aprovado','recusado','cancelado','estornado') NOT NULL DEFAULT 'pendente',
  pago_em               DATETIME      NULL,
  criado_em             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pagamento_pedido (pedido_id),
  UNIQUE KEY uq_pagamento_pagbank_order (pagbank_order_id),
  KEY ix_pagamento_status (status),
  CONSTRAINT fk_pagamento_pedido FOREIGN KEY (pedido_id) REFERENCES pedido (id),
  CONSTRAINT ck_pagamento_valores CHECK (
    valor_total > 0 AND valor_lojista >= 0 AND comissao_shopping >= 0
    AND valor_lojista + comissao_shopping = valor_total
  ),
  CONSTRAINT ck_pagamento_percentual CHECK (comissao_percentual BETWEEN 0 AND 100)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- protocolo_retirada: QR Code unico e de uso unico, um por pedido pago
--   codigo      : UUID gravado no QR Code
--   codigo_curto: codigo que o cliente mostra e o lojista digita, no
--                 formato CD-<id do pedido>-<3 caracteres>, ex.: CD-4821-7KQ.
--                 Caracteres: ABCDEFGHJKMNPQRSTUVWXYZ23456789 (sem I, L, O,
--                 0 e 1, que se confundem). Gerado pela API.
-- ---------------------------------------------------------------------
CREATE TABLE protocolo_retirada (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pedido_id        INT UNSIGNED NOT NULL,
  codigo           CHAR(36)     NOT NULL COMMENT 'conteudo do QR Code (UUID gerado pela API)',
  codigo_curto     VARCHAR(16)  NOT NULL COMMENT 'CD-<id do pedido>-<3 caracteres>, digitado pelo lojista',
  gerado_em        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usado_em         DATETIME     NULL COMMENT 'preenchido uma unica vez, na retirada',
  validado_por_id  INT UNSIGNED NULL COMMENT 'usuario da loja que leu o QR Code',
  PRIMARY KEY (id),
  UNIQUE KEY uq_protocolo_codigo (codigo),
  UNIQUE KEY uq_protocolo_codigo_curto (codigo_curto),
  UNIQUE KEY uq_protocolo_pedido (pedido_id),
  CONSTRAINT fk_protocolo_pedido FOREIGN KEY (pedido_id) REFERENCES pedido (id),
  CONSTRAINT fk_protocolo_validado_por FOREIGN KEY (validado_por_id) REFERENCES usuario (id),
  CONSTRAINT ck_protocolo_codigo_curto CHECK (
    REGEXP_LIKE(codigo_curto, '^CD-[0-9]+-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{3}$', 'c')
    AND codigo_curto LIKE CONCAT('CD-', pedido_id, '-%')
  ),
  CONSTRAINT ck_protocolo_uso CHECK (
    (usado_em IS NULL AND validado_por_id IS NULL) OR
    (usado_em IS NOT NULL AND validado_por_id IS NOT NULL AND usado_em >= gerado_em)
  )
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- registro_admin: registro das operacoes administrativas (RF016)
-- A API grava uma linha a cada alteracao feita no painel do admin, na
-- MESMA transacao da alteracao. Somente insercao: os gatilhos abaixo
-- impedem alterar ou apagar linhas.
--   acao     : ex.: usuario.bloquear, loja.editar, categoria.comissao
--   alvo_tipo: usuario, loja ou categoria
--   detalhes : {"antes": {...}, "depois": {...}} com os campos alterados
-- ---------------------------------------------------------------------
CREATE TABLE registro_admin (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id    INT UNSIGNED NOT NULL,
  acao        VARCHAR(60)  NOT NULL,
  alvo_tipo   VARCHAR(30)  NOT NULL,
  alvo_id     INT UNSIGNED NOT NULL,
  detalhes    JSON         NULL,
  criado_em   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_registro_admin_criado (criado_em),
  KEY ix_registro_admin_alvo (alvo_tipo, alvo_id),
  KEY ix_registro_admin_admin (admin_id),
  CONSTRAINT fk_registro_admin_usuario FOREIGN KEY (admin_id) REFERENCES usuario (id)
) ENGINE=InnoDB;

-- =====================================================================
-- Gatilhos e rotinas
-- =====================================================================
DELIMITER $$

-- RF016: so um usuario com perfil 'admin' pode ser autor do registro
CREATE TRIGGER tg_registro_admin_bi_perfil BEFORE INSERT ON registro_admin
FOR EACH ROW
BEGIN
  IF (SELECT perfil FROM usuario WHERE id = NEW.admin_id) <> 'admin' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF016: registro_admin.admin_id deve ser um usuario com perfil admin';
  END IF;
END$$

-- RF016: o registro e somente de insercao
CREATE TRIGGER tg_registro_admin_bu_bloqueio BEFORE UPDATE ON registro_admin
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF016: o registro administrativo nao pode ser alterado';
END$$

CREATE TRIGGER tg_registro_admin_bd_bloqueio BEFORE DELETE ON registro_admin
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RF016: o registro administrativo nao pode ser apagado';
END$$

-- RN004: o dono de uma loja precisa ter perfil 'lojista'
CREATE TRIGGER tg_loja_bi_lojista BEFORE INSERT ON loja
FOR EACH ROW
BEGIN
  IF (SELECT perfil FROM usuario WHERE id = NEW.lojista_id) <> 'lojista' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN004: loja.lojista_id deve ser um usuario com perfil lojista';
  END IF;
END$$

CREATE TRIGGER tg_loja_bu_lojista BEFORE UPDATE ON loja
FOR EACH ROW
BEGIN
  IF (SELECT perfil FROM usuario WHERE id = NEW.lojista_id) <> 'lojista' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN004: loja.lojista_id deve ser um usuario com perfil lojista';
  END IF;
END$$

-- Uso unico do QR Code: depois de usado, usado_em nao pode mudar
CREATE TRIGGER tg_protocolo_bu_uso_unico BEFORE UPDATE ON protocolo_retirada
FOR EACH ROW
BEGIN
  IF OLD.usado_em IS NOT NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'QR Code ja utilizado';
  END IF;
END$$

-- RN010: libera reservas vencidas, devolve as unidades ao estoque e
-- marca como 'expirado' os pedidos que ficaram sem pagamento ('cancelado'
-- fica para quando o cliente desiste). Chamada pela API
-- (rotina periodica) ou pelo evento abaixo.
CREATE PROCEDURE sp_liberar_reservas_expiradas()
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  DROP TEMPORARY TABLE IF EXISTS tmp_reservas_vencidas;
  CREATE TEMPORARY TABLE tmp_reservas_vencidas (
    id INT UNSIGNED PRIMARY KEY, pedido_id INT UNSIGNED, produto_id INT UNSIGNED, quantidade SMALLINT UNSIGNED
  ) ENGINE=MEMORY;

  START TRANSACTION;

  -- trava as reservas vencidas para nao competir com o webhook de pagamento
  INSERT INTO tmp_reservas_vencidas (id, pedido_id, produto_id, quantidade)
  SELECT id, pedido_id, produto_id, quantidade
    FROM reserva
   WHERE status = 'ativa' AND expira_em <= NOW()
   FOR UPDATE;

  UPDATE estoque e
    JOIN (SELECT produto_id, SUM(quantidade) AS qtd
            FROM tmp_reservas_vencidas GROUP BY produto_id) r
      ON r.produto_id = e.produto_id
     SET e.quantidade_disponivel = e.quantidade_disponivel + r.qtd,
         e.quantidade_reservada  = e.quantidade_reservada  - r.qtd;

  UPDATE reserva r
    JOIN tmp_reservas_vencidas t ON t.id = r.id
     SET r.status = 'expirada', r.finalizada_em = NOW();

  UPDATE pedido p
    JOIN (SELECT DISTINCT pedido_id FROM tmp_reservas_vencidas) t ON t.pedido_id = p.id
     SET p.status = 'expirado'
   WHERE p.status = 'pendente';

  COMMIT;
  DROP TEMPORARY TABLE tmp_reservas_vencidas;
END$$

DELIMITER ;

-- Evento opcional: roda a liberacao a cada minuto.
-- So executa se o agendador estiver ligado: SET GLOBAL event_scheduler = ON;
CREATE EVENT ev_liberar_reservas_expiradas
  ON SCHEDULE EVERY 1 MINUTE
  DO CALL sp_liberar_reservas_expiradas();
