"""Avisos do usuário logado (RF007). Cada um vê só os próprios avisos."""
from fastapi import APIRouter, Depends, Query

from ..auth import usuario_atual
from ..db import liberar_reservas_expiradas, transacao
from ..erros import nao_encontrado
from ..formatos import data_iso

router = APIRouter(tags=["Avisos"])


def _formatar(linha: dict) -> dict:
    return {
        "id": linha["id"],
        "tipo": linha["tipo"],
        "titulo": linha["titulo"],
        "mensagem": linha["mensagem"],
        "pedidoId": linha["pedido_id"],
        "lido": linha["lida_em"] is not None,
        "criadoEm": data_iso(linha["criado_em"]),
    }


@router.get("/notifications")
def meus_avisos(limite: int = Query(default=30, ge=1, le=100), usuario: dict = Depends(usuario_atual)) -> dict:
    liberar_reservas_expiradas()  # gera o aviso de reserva vencida na hora
    with transacao() as cur:
        cur.execute(
            "SELECT COUNT(*) AS n FROM notificacao WHERE usuario_id = %s AND lida_em IS NULL",
            (usuario["id"],),
        )
        nao_lidas = cur.fetchone()["n"]
        cur.execute(
            "SELECT id, tipo, titulo, mensagem, pedido_id, lida_em, criado_em FROM notificacao"
            " WHERE usuario_id = %s ORDER BY criado_em DESC, id DESC LIMIT %s",
            (usuario["id"], limite),
        )
        return {"naoLidas": nao_lidas, "avisos": [_formatar(l) for l in cur.fetchall()]}


@router.post("/notifications/read-all", status_code=204)
def marcar_todos(usuario: dict = Depends(usuario_atual)) -> None:
    with transacao() as cur:
        cur.execute(
            "UPDATE notificacao SET lida_em = NOW() WHERE usuario_id = %s AND lida_em IS NULL",
            (usuario["id"],),
        )


@router.post("/notifications/{aviso_id}/read", status_code=204)
def marcar_lido(aviso_id: int, usuario: dict = Depends(usuario_atual)) -> None:
    with transacao() as cur:
        cur.execute("SELECT id FROM notificacao WHERE id = %s AND usuario_id = %s", (aviso_id, usuario["id"]))
        if not cur.fetchone():
            raise nao_encontrado("Aviso")
        cur.execute("UPDATE notificacao SET lida_em = COALESCE(lida_em, NOW()) WHERE id = %s", (aviso_id,))
