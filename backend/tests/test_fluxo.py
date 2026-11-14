"""Teste de ponta a ponta contra um MySQL de verdade.

Usa o banco do .env (com schema.sql e seed.sql carregados) e é pulado se o
banco não estiver acessível. ATENÇÃO: altera dados; rode só em desenvolvimento.

Usuários do seed: 1 = cliente (Ana), 2 = lojista da Casa e Cia (loja 1).
"""
import os
import threading

import pytest

os.environ.setdefault("DEMO_AUTH", "1")
os.environ.setdefault("PAGAMENTO_SIMULADO", "1")

from fastapi.testclient import TestClient  # noqa: E402

from app.db import conectar, transacao  # noqa: E402
from app.main import app  # noqa: E402

CLIENTE = {"X-Usuario-Id": "1"}
LOJISTA = {"X-Usuario-Id": "2"}


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


def _estoque(produto_id: int) -> tuple[int, int]:
    with transacao() as cur:
        cur.execute("SELECT quantidade_disponivel, quantidade_reservada FROM estoque WHERE produto_id = %s", (produto_id,))
        e = cur.fetchone()
    return e["quantidade_disponivel"], e["quantidade_reservada"]


def _definir_estoque(produto_id: int, disponivel: int) -> None:
    """Deixa o produto num estado conhecido: sem reservas ativas e com N unidades livres."""
    with transacao() as cur:
        cur.execute(
            "UPDATE reserva SET status = 'expirada', finalizada_em = NOW()"
            " WHERE produto_id = %s AND status = 'ativa'",
            (produto_id,),
        )
        cur.execute(
            "UPDATE estoque SET quantidade_disponivel = %s, quantidade_reservada = 0 WHERE produto_id = %s",
            (disponivel, produto_id),
        )


def test_health(api):
    r = api.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "banco": "ok"}


def test_catalogo_e_busca(api):
    produtos = api.get("/api/products", params={"q": "poltrona"}).json()
    nomes = {p["nome"] for p in produtos}
    assert "Poltrona Lina" in nomes
    lina = next(p for p in produtos if p["nome"] == "Poltrona Lina")
    assert lina["loja"]["nome"] == "Casa e Cia"
    assert lina["medidas"] == {"largura": 78.0, "altura": 72.0, "profundidade": 85.0}

    disponiveis = api.get("/api/products", params={"disponivel": True}).json()
    assert all(p["estoque"] > 0 for p in disponiveis)

    assert api.get("/api/products/999999").status_code == 404


def test_me_devolve_usuario_sem_dados_sensiveis(api):
    eu = api.get("/api/me", headers=CLIENTE).json()
    assert eu["id"] == 1 and eu["perfil"] == "cliente"
    assert "senha_hash" not in eu


def test_rotas_protegidas_exigem_usuario(api):
    assert api.get("/api/orders").status_code == 401
    # lojista não acessa rotas de cliente (RNF006)
    assert api.get("/api/orders", headers=LOJISTA).status_code == 403


def test_fluxo_reserva_pagamento_retirada(api):
    _definir_estoque(1, 3)
    disp0, res0 = _estoque(1)

    r = api.post("/api/orders/checkout-reserve", json={"produtoId": 1}, headers=CLIENTE)
    assert r.status_code == 201, r.text
    reserva = r.json()
    assert _estoque(1) == (disp0 - 1, res0 + 1)

    # pedir de novo devolve a mesma reserva, sem bloquear outra unidade
    again = api.post("/api/orders/checkout-reserve", json={"produtoId": 1}, headers=CLIENTE).json()
    assert again["id"] == reserva["id"]
    assert _estoque(1) == (disp0 - 1, res0 + 1)

    r = api.post(f"/api/reservations/{reserva['id']}/pay", json={"metodo": "pix"}, headers=CLIENTE)
    assert r.status_code == 200, r.text
    pedido = r.json()
    assert pedido["status"] == "aprovado"
    assert pedido["codigo"].startswith(f"CD-{pedido['id']}-")
    assert _estoque(1) == (disp0 - 1, res0)

    # divisão do pagamento: lojista + comissão = total (RN011)
    with transacao() as cur:
        cur.execute("SELECT valor_total, valor_lojista, comissao_shopping FROM pagamento WHERE pedido_id = %s", (pedido["id"],))
        pg = cur.fetchone()
    assert pg["valor_lojista"] + pg["comissao_shopping"] == pg["valor_total"]

    # cliente vê o pedido no histórico (RF010)
    meus = api.get("/api/orders", headers=CLIENTE).json()
    assert any(p["id"] == pedido["id"] for p in meus)

    # lojista valida (código digitado em minúsculas também vale) e confirma
    codigo = pedido["codigo"]
    r = api.get(f"/api/seller/stores/1/pickups/{codigo.lower()}", headers=LOJISTA)
    assert r.status_code == 200, r.text
    r = api.post(f"/api/seller/stores/1/pickups/{codigo}/confirm", headers=LOJISTA)
    assert r.status_code == 200 and r.json()["status"] == "retirado"

    # uso único do código (RN003)
    r = api.post(f"/api/seller/stores/1/pickups/{codigo}/confirm", headers=LOJISTA)
    assert r.status_code == 409 and r.json()["codigo"] == "JA_RETIRADO"


def test_sem_estoque_nao_reserva(api):
    _definir_estoque(3, 0)
    r = api.post("/api/orders/checkout-reserve", json={"produtoId": 3}, headers=CLIENTE)
    assert r.status_code == 409 and r.json()["codigo"] == "SEM_ESTOQUE"


def test_cancelar_devolve_ao_estoque(api):
    _definir_estoque(4, 5)
    disp0, res0 = _estoque(4)
    reserva = api.post("/api/orders/checkout-reserve", json={"produtoId": 4}, headers=CLIENTE).json()
    assert api.delete(f"/api/reservations/{reserva['id']}", headers=CLIENTE).status_code == 204
    assert _estoque(4) == (disp0, res0)
    r = api.post(f"/api/reservations/{reserva['id']}/pay", json={"metodo": "cartao"}, headers=CLIENTE)
    assert r.status_code == 409


def test_reserva_vencida_volta_ao_estoque(api):
    _definir_estoque(4, 5)
    disp0, res0 = _estoque(4)
    reserva = api.post("/api/orders/checkout-reserve", json={"produtoId": 4}, headers=CLIENTE).json()
    with transacao() as cur:  # simula a passagem dos 15 minutos
        cur.execute(
            "UPDATE reserva SET criado_em = NOW() - INTERVAL 20 MINUTE, expira_em = NOW() - INTERVAL 5 MINUTE WHERE id = %s",
            (reserva["id"],),
        )
    pedido = api.get(f"/api/orders/{reserva['pedidoId']}", headers=CLIENTE).json()  # dispara a liberação
    assert pedido["status"] == "expirado"
    assert _estoque(4) == (disp0, res0)


def test_lojista_so_mexe_na_propria_loja(api):
    # produto 2 é da Lar & Estilo, não da Casa e Cia (RN004)
    r = api.patch("/api/seller/products/2/stock", json={"delta": 1}, headers=LOJISTA)
    assert r.status_code == 404
    assert api.get("/api/seller/stores/2/dashboard", headers=LOJISTA).status_code == 404
    r = api.patch("/api/seller/products/1/stock", json={"delta": -999}, headers=LOJISTA)
    assert r.status_code == 200 and r.json()["estoque"] == 0  # nunca negativo


def test_concorrencia_ultima_unidade(api):
    """Dois clientes disputam a última unidade: só um consegue (RNF003)."""
    _definir_estoque(2, 1)
    with transacao() as cur:  # garante um segundo cliente para a disputa
        cur.execute(
            "INSERT IGNORE INTO usuario (id, nome, email, senha_hash, perfil) VALUES "
            "(900, 'Cliente Teste', 'teste-concorrencia@zaptos.dev', REPEAT('x', 60), 'cliente')"
        )
    resultados: list[int] = []

    def tentar(usuario_id: str):
        with TestClient(app) as c:
            r = c.post("/api/orders/checkout-reserve", json={"produtoId": 2}, headers={"X-Usuario-Id": usuario_id})
            resultados.append(r.status_code)

    threads = [threading.Thread(target=tentar, args=(u,)) for u in ("1", "900")]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(resultados) == [201, 409]
    assert _estoque(2)[0] == 0
