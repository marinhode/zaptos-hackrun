"""Pedidos do cliente (RF010). RN005: cada cliente vê só os próprios pedidos."""
from fastapi import APIRouter, Depends

from ..auth import exigir_perfil
from ..db import liberar_reservas_expiradas, transacao
from ..erros import nao_encontrado
from ..formatos import buscar_pedidos

router = APIRouter(tags=["Pedidos"])
cliente = exigir_perfil("cliente")


@router.get("/orders")
def meus_pedidos(usuario: dict = Depends(cliente)) -> list[dict]:
    liberar_reservas_expiradas()
    with transacao() as cur:
        return buscar_pedidos(cur, "pe.usuario_id = %s", (usuario["id"],))


@router.get("/orders/{pedido_id}")
def meu_pedido(pedido_id: int, usuario: dict = Depends(cliente)) -> dict:
    liberar_reservas_expiradas()
    with transacao() as cur:
        pedidos = buscar_pedidos(cur, "pe.id = %s AND pe.usuario_id = %s", (pedido_id, usuario["id"]))
    if not pedidos:
        raise nao_encontrado("Pedido")
    return pedidos[0]
