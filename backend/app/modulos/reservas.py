"""Reserva com bloqueio de estoque e pagamento (RF001, RF004, RF008, RF009).

Regras:
  RN001 só reserva com estoque disponível
  RN010 a unidade fica bloqueada por 15 minutos (prazo definido no banco)
  RN011 a comissão do shopping é separada no pagamento
"""
import uuid
from typing import Literal

import pymysql
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .. import avisos
from ..auth import exigir_perfil
from ..config import config
from ..db import liberar_reservas_expiradas, transacao
from ..erros import ErroNegocio, nao_encontrado
from ..formatos import buscar_pedidos
from ..regras import dividir_pagamento, gerar_codigo_curto

router = APIRouter(tags=["Reservas e pagamento"])
cliente = exigir_perfil("cliente")


class NovaReserva(BaseModel):
    produtoId: int


class Pagamento(BaseModel):
    metodo: Literal["cartao", "pix"]


def _formatar_reserva(linha: dict) -> dict:
    return {
        "id": linha["id"],
        "pedidoId": linha["pedido_id"],
        "produtoId": linha["produto_id"],
        "status": linha["status"],
        "expiraEm": int(linha["expira_em_ts"] * 1000),
    }


SQL_RESERVA = """
SELECT r.id, r.pedido_id, r.produto_id, r.usuario_id, r.status, r.quantidade,
       UNIX_TIMESTAMP(r.expira_em) AS expira_em_ts, r.expira_em > NOW() AS dentro_do_prazo
  FROM reserva r
"""


@router.post("/orders/checkout-reserve", status_code=201)
def reservar(dados: NovaReserva, usuario: dict = Depends(cliente)) -> dict:
    liberar_reservas_expiradas()
    with transacao() as cur:
        # Se o cliente já tem reserva ativa deste produto, devolve a mesma.
        cur.execute(
            SQL_RESERVA + " WHERE r.usuario_id = %s AND r.produto_id = %s"
                          " AND r.status = 'ativa' AND r.expira_em > NOW()",
            (usuario["id"], dados.produtoId),
        )
        existente = cur.fetchone()
        if existente:
            return _formatar_reserva(existente)

        # FOR UPDATE trava a linha do estoque: dois clientes não reservam a mesma unidade (RNF003).
        cur.execute(
            "SELECT e.quantidade_disponivel, p.preco, p.loja_id"
            "  FROM estoque e"
            "  JOIN produto p ON p.id = e.produto_id"
            "  JOIN loja l    ON l.id = p.loja_id"
            " WHERE e.produto_id = %s AND p.ativo AND l.ativa"
            " FOR UPDATE",
            (dados.produtoId,),
        )
        item = cur.fetchone()
        if not item:
            raise nao_encontrado("Produto")
        if item["quantidade_disponivel"] < 1:
            raise ErroNegocio(409, "SEM_ESTOQUE", "Este produto não tem unidade disponível no momento.")

        cur.execute(
            "UPDATE estoque SET quantidade_disponivel = quantidade_disponivel - 1,"
            " quantidade_reservada = quantidade_reservada + 1 WHERE produto_id = %s",
            (dados.produtoId,),
        )
        cur.execute(
            "INSERT INTO pedido (usuario_id, loja_id, status, valor_total) VALUES (%s, %s, 'pendente', %s)",
            (usuario["id"], item["loja_id"], item["preco"]),
        )
        pedido_id = cur.lastrowid
        cur.execute(
            "INSERT INTO item_pedido (pedido_id, loja_id, produto_id, quantidade, preco_unitario)"
            " VALUES (%s, %s, %s, 1, %s)",
            (pedido_id, item["loja_id"], dados.produtoId, item["preco"]),
        )
        # expira_em usa o padrão do banco: agora + 15 minutos
        cur.execute(
            "INSERT INTO reserva (pedido_id, produto_id, usuario_id, quantidade) VALUES (%s, %s, %s, 1)",
            (pedido_id, dados.produtoId, usuario["id"]),
        )
        cur.execute(SQL_RESERVA + " WHERE r.id = %s", (cur.lastrowid,))
        return _formatar_reserva(cur.fetchone())


def _reserva_do_cliente(cur, reserva_id: int, usuario_id: int) -> dict:
    cur.execute(SQL_RESERVA + " WHERE r.id = %s AND r.usuario_id = %s FOR UPDATE", (reserva_id, usuario_id))
    reserva = cur.fetchone()
    if not reserva:
        raise nao_encontrado("Reserva")
    return reserva


@router.delete("/reservations/{reserva_id}", status_code=204)
def cancelar_reserva(reserva_id: int, usuario: dict = Depends(cliente)) -> None:
    """O cliente desiste: a unidade volta ao estoque e o pedido é cancelado."""
    with transacao() as cur:
        reserva = _reserva_do_cliente(cur, reserva_id, usuario["id"])
        if reserva["status"] != "ativa":
            return
        cur.execute(
            "UPDATE estoque SET quantidade_disponivel = quantidade_disponivel + %s,"
            " quantidade_reservada = quantidade_reservada - %s WHERE produto_id = %s",
            (reserva["quantidade"], reserva["quantidade"], reserva["produto_id"]),
        )
        # o ENUM de reserva não tem 'cancelada': a reserva encerra como 'expirada'
        cur.execute("UPDATE reserva SET status = 'expirada', finalizada_em = NOW() WHERE id = %s", (reserva_id,))
        cur.execute("UPDATE pedido SET status = 'cancelado' WHERE id = %s AND status = 'pendente'", (reserva["pedido_id"],))


@router.post("/reservations/{reserva_id}/pay")
def pagar(reserva_id: int, dados: Pagamento, usuario: dict = Depends(cliente)) -> dict:
    """Pagamento SIMULADO: aprova na hora.

    Na integração real, esta rota cria o pedido no PagBank (charges.splits) e quem
    aprova é o webhook validado pelo x-authenticity-token (RN006).
    """
    if not config.pagamento_simulado:
        raise ErroNegocio(501, "PAGBANK_PENDENTE", "A integração com o PagBank ainda não foi implementada.")

    with transacao() as cur:
        reserva = _reserva_do_cliente(cur, reserva_id, usuario["id"])
        if reserva["status"] != "ativa" or not reserva["dentro_do_prazo"]:
            raise ErroNegocio(409, "RESERVA_EXPIRADA", "O tempo da reserva acabou e o produto voltou ao estoque.")

        cur.execute(
            "SELECT pe.valor_total, c.comissao_percentual"
            "  FROM pedido pe JOIN loja l ON l.id = pe.loja_id JOIN categoria c ON c.id = l.categoria_id"
            " WHERE pe.id = %s FOR UPDATE",
            (reserva["pedido_id"],),
        )
        pedido = cur.fetchone()
        valor_lojista, comissao = dividir_pagamento(pedido["valor_total"], pedido["comissao_percentual"])

        cur.execute(
            "UPDATE estoque SET quantidade_reservada = quantidade_reservada - %s WHERE produto_id = %s",
            (reserva["quantidade"], reserva["produto_id"]),
        )
        cur.execute("UPDATE reserva SET status = 'paga', finalizada_em = NOW() WHERE id = %s", (reserva_id,))
        cur.execute("UPDATE pedido SET status = 'aprovado' WHERE id = %s", (reserva["pedido_id"],))
        cur.execute(
            "INSERT INTO pagamento (pedido_id, valor_total, valor_lojista, comissao_shopping,"
            " comissao_percentual, status, pago_em) VALUES (%s, %s, %s, %s, %s, 'aprovado', NOW())",
            (reserva["pedido_id"], pedido["valor_total"], valor_lojista, comissao, pedido["comissao_percentual"]),
        )
        codigo = _gerar_protocolo(cur, reserva["pedido_id"])
        avisos.pagamento_aprovado(cur, reserva["pedido_id"], codigo)  # RF007
        return buscar_pedidos(cur, "pe.id = %s", (reserva["pedido_id"],))[0]


def _gerar_protocolo(cur, pedido_id: int) -> str:
    """RF008: QR Code (UUID) e código curto únicos para a retirada. Devolve o código curto."""
    for _ in range(5):
        codigo = gerar_codigo_curto(pedido_id)
        try:
            cur.execute(
                "INSERT INTO protocolo_retirada (pedido_id, codigo, codigo_curto) VALUES (%s, %s, %s)",
                (pedido_id, str(uuid.uuid4()), codigo),
            )
            return codigo
        except pymysql.err.IntegrityError as erro:
            if "uq_protocolo_codigo" not in str(erro):
                raise
            # colisão do sufixo aleatório: tenta outro
    raise ErroNegocio(500, "ERRO_CODIGO", "Não foi possível gerar o código de retirada.")
