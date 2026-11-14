"""Painel do lojista: estoque e retirada (RF001, RF006, RF008).

RN004: o lojista só vê e altera o que é das próprias lojas.
RN003: a retirada exige pedido pago e código válido, usado uma única vez.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from .. import avisos
from ..auth import exigir_perfil
from ..db import liberar_reservas_expiradas, transacao
from ..erros import ErroNegocio, nao_encontrado
from ..formatos import SQL_PRODUTO_TODOS, buscar_pedidos, formatar_produto, imagens_por_produto
from ..regras import normalizar_codigo

router = APIRouter(prefix="/seller", tags=["Lojista"])
lojista = exigir_perfil("lojista")


class AjusteEstoque(BaseModel):
    delta: int = Field(ge=-1000, le=1000, description="Quanto somar (ou subtrair) do estoque livre")


def _loja_do_lojista(cur, loja_id: int, usuario_id: int) -> dict:
    cur.execute("SELECT id, nome FROM loja WHERE id = %s AND lojista_id = %s", (loja_id, usuario_id))
    loja = cur.fetchone()
    if not loja:
        # mesma resposta para "não existe" e "não é sua", para não revelar lojas de outros
        raise nao_encontrado("Loja")
    return loja


@router.get("/stores")
def minhas_lojas(usuario: dict = Depends(lojista)) -> list[dict]:
    with transacao() as cur:
        cur.execute("SELECT id, nome FROM loja WHERE lojista_id = %s ORDER BY nome", (usuario["id"],))
        return cur.fetchall()


@router.get("/stores/{loja_id}/dashboard")
def painel(loja_id: int, usuario: dict = Depends(lojista)) -> dict:
    liberar_reservas_expiradas()
    with transacao() as cur:
        loja = _loja_do_lojista(cur, loja_id, usuario["id"])
        cur.execute(
            "SELECT COUNT(*) AS n FROM pedido"
            " WHERE loja_id = %s AND DATE(criado_em) = CURDATE() AND status <> 'cancelado'",
            (loja_id,),
        )
        reservas_hoje = cur.fetchone()["n"]
        cur.execute(SQL_PRODUTO_TODOS + " WHERE p.loja_id = %s ORDER BY p.ativo DESC, p.nome", (loja_id,))
        linhas = cur.fetchall()
        imagens = imagens_por_produto(cur, [l["id"] for l in linhas])
        aguardando = buscar_pedidos(cur, "pe.loja_id = %s AND pe.status = 'aprovado'", (loja_id,))
    return {
        "loja": loja,
        "reservasHoje": reservas_hoje,
        "produtos": [formatar_produto(l, imagens.get(l["id"], [])) for l in linhas],
        "aguardandoRetirada": aguardando,
    }


@router.patch("/products/{produto_id}/stock")
def ajustar_estoque(produto_id: int, dados: AjusteEstoque, usuario: dict = Depends(lojista)) -> dict:
    with transacao() as cur:
        cur.execute(
            "SELECT e.quantidade_disponivel FROM estoque e"
            "  JOIN produto p ON p.id = e.produto_id JOIN loja l ON l.id = p.loja_id"
            " WHERE e.produto_id = %s AND l.lojista_id = %s FOR UPDATE",
            (produto_id, usuario["id"]),
        )
        atual = cur.fetchone()
        if not atual:
            raise nao_encontrado("Produto")
        novo = max(0, atual["quantidade_disponivel"] + dados.delta)
        cur.execute("UPDATE estoque SET quantidade_disponivel = %s WHERE produto_id = %s", (novo, produto_id))
    return {"produtoId": produto_id, "estoque": novo}


def _protocolo(cur, loja_id: int, codigo: str, travar: bool) -> dict:
    """Aceita o código curto (digitado) ou o UUID (lido do QR Code)."""
    limpo = normalizar_codigo(codigo)
    cur.execute(
        "SELECT pt.id, pt.usado_em, pe.id AS pedido_id, pe.status, pe.loja_id"
        "  FROM protocolo_retirada pt JOIN pedido pe ON pe.id = pt.pedido_id"
        " WHERE pt.codigo_curto = %s OR pt.codigo = %s" + (" FOR UPDATE" if travar else ""),
        (limpo, codigo.strip().lower()),
    )
    p = cur.fetchone()
    if not p:
        raise ErroNegocio(404, "NAO_ENCONTRADO", "Código não encontrado. Confira com o cliente.")
    if p["loja_id"] != loja_id:
        raise ErroNegocio(403, "OUTRA_LOJA", "Este pedido é de outra loja.")
    if p["usado_em"] is not None or p["status"] == "retirado":
        raise ErroNegocio(409, "JA_RETIRADO", "Este código já foi usado: o pedido já foi retirado.")
    if p["status"] != "aprovado":
        raise ErroNegocio(409, "NAO_PAGO", "Este pedido ainda não foi pago.")
    return p


@router.get("/stores/{loja_id}/pickups/{codigo}")
def validar_codigo(loja_id: int, codigo: str, usuario: dict = Depends(lojista)) -> dict:
    with transacao() as cur:
        _loja_do_lojista(cur, loja_id, usuario["id"])
        p = _protocolo(cur, loja_id, codigo, travar=False)
        return buscar_pedidos(cur, "pe.id = %s", (p["pedido_id"],))[0]


@router.post("/stores/{loja_id}/pickups/{codigo}/confirm")
def confirmar_retirada(loja_id: int, codigo: str, usuario: dict = Depends(lojista)) -> dict:
    with transacao() as cur:
        _loja_do_lojista(cur, loja_id, usuario["id"])
        p = _protocolo(cur, loja_id, codigo, travar=True)
        cur.execute(
            "UPDATE protocolo_retirada SET usado_em = NOW(), validado_por_id = %s WHERE id = %s",
            (usuario["id"], p["id"]),
        )
        cur.execute("UPDATE pedido SET status = 'retirado' WHERE id = %s", (p["pedido_id"],))
        avisos.retirada_confirmada(cur, p["pedido_id"])  # RF007
        return buscar_pedidos(cur, "pe.id = %s", (p["pedido_id"],))[0]
