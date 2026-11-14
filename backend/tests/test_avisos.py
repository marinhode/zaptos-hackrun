"""Avisos dentro do app (RF007). Roda contra o MySQL do .env."""
import os

import pytest

os.environ.setdefault("DEMO_AUTH", "1")

from fastapi.testclient import TestClient  # noqa: E402

from app.db import conectar, transacao  # noqa: E402
from app.main import app  # noqa: E402

CLIENTE = {"X-Usuario-Id": "1"}   # Ana
LOJISTA = {"X-Usuario-Id": "2"}   # Carlos, Casa e Cia
OUTRO = {"X-Usuario-Id": "4"}     # Marina, Lar & Estilo


def _banco_disponivel() -> bool:
    try:
        conectar().close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _banco_disponivel(), reason="MySQL do .env indisponível")


@pytest.fixture(scope="module")
def api():
    with TestClient(app) as cliente:
        yield cliente


def _preparar_produto(produto_id: int, unidades: int = 3) -> None:
    with transacao() as cur:
        cur.execute("UPDATE reserva SET status = 'expirada', finalizada_em = NOW() WHERE produto_id = %s AND status = 'ativa'", (produto_id,))
        cur.execute("UPDATE estoque SET quantidade_disponivel = %s, quantidade_reservada = 0 WHERE produto_id = %s", (unidades, produto_id))


def _avisos(api, quem):
    r = api.get("/api/notifications", headers=quem)
    assert r.status_code == 200, r.text
    return r.json()


def _do_pedido(dados, pedido_id):
    return [a for a in dados["avisos"] if a["pedidoId"] == pedido_id]


def test_pagamento_e_retirada_geram_avisos(api):
    _preparar_produto(4)
    reserva = api.post("/api/orders/checkout-reserve", json={"produtoId": 4}, headers=CLIENTE).json()
    pedido = api.post(f"/api/reservations/{reserva['id']}/pay", json={"metodo": "pix"}, headers=CLIENTE).json()

    cliente = _do_pedido(_avisos(api, CLIENTE), pedido["id"])
    assert [a["tipo"] for a in cliente] == ["pagamento_aprovado"]
    assert pedido["codigo"] in cliente[0]["mensagem"] and cliente[0]["lido"] is False

    lojista = _do_pedido(_avisos(api, LOJISTA), pedido["id"])
    assert [a["tipo"] for a in lojista] == ["nova_retirada"]
    # lojista de outra loja não recebe
    assert _do_pedido(_avisos(api, OUTRO), pedido["id"]) == []

    api.post(f"/api/seller/stores/1/pickups/{pedido['codigo']}/confirm", headers=LOJISTA)
    tipos = [a["tipo"] for a in _do_pedido(_avisos(api, CLIENTE), pedido["id"])]
    assert tipos[0] == "retirada_confirmada" and "pagamento_aprovado" in tipos


def test_reserva_vencida_gera_aviso(api):
    _preparar_produto(4)
    reserva = api.post("/api/orders/checkout-reserve", json={"produtoId": 4}, headers=CLIENTE).json()
    with transacao() as cur:
        cur.execute(
            "UPDATE reserva SET criado_em = NOW() - INTERVAL 20 MINUTE, expira_em = NOW() - INTERVAL 5 MINUTE WHERE id = %s",
            (reserva["id"],),
        )
    avisos = _do_pedido(_avisos(api, CLIENTE), reserva["pedidoId"])  # a consulta libera as vencidas
    assert [a["tipo"] for a in avisos] == ["reserva_expirada"]
    # não duplica numa segunda liberação
    assert len(_do_pedido(_avisos(api, CLIENTE), reserva["pedidoId"])) == 1


def test_cancelar_nao_gera_aviso_de_expiracao(api):
    _preparar_produto(4)
    reserva = api.post("/api/orders/checkout-reserve", json={"produtoId": 4}, headers=CLIENTE).json()
    api.delete(f"/api/reservations/{reserva['id']}", headers=CLIENTE)
    assert _do_pedido(_avisos(api, CLIENTE), reserva["pedidoId"]) == []


def test_marcar_lidos_e_privacidade(api):
    dados = _avisos(api, CLIENTE)
    assert dados["avisos"], "o teste anterior deveria ter criado avisos"
    um = dados["avisos"][0]["id"]
    # outro usuário não marca aviso alheio (RN005)
    assert api.post(f"/api/notifications/{um}/read", headers=LOJISTA).status_code == 404
    assert api.post(f"/api/notifications/{um}/read", headers=CLIENTE).status_code == 204
    assert next(a for a in _avisos(api, CLIENTE)["avisos"] if a["id"] == um)["lido"] is True

    assert api.post("/api/notifications/read-all", headers=CLIENTE).status_code == 204
    assert _avisos(api, CLIENTE)["naoLidas"] == 0
    assert api.get("/api/notifications").status_code == 401
