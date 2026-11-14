"""Testes do painel do administrador (RF016) contra um MySQL de verdade.

Usa o banco do .env (com schema.sql e seed.sql carregados) e é pulado se o
banco não estiver acessível. ATENÇÃO: altera dados; rode só em desenvolvimento.
Os testes devolvem lojas e categorias ao estado do seed no final.

Usuários do seed: 1 = cliente (Ana), 2 = lojista (Carlos), 3 = admin.
"""
import os

import pytest

os.environ.setdefault("DEMO_AUTH", "1")
os.environ.setdefault("PAGAMENTO_SIMULADO", "1")

from fastapi.testclient import TestClient  # noqa: E402

from app.db import conectar, transacao  # noqa: E402
from app.main import app  # noqa: E402

ADMIN = {"X-Usuario-Id": "3"}
CLIENTE = {"X-Usuario-Id": "1"}
LOJISTA = {"X-Usuario-Id": "2"}
USUARIO_TESTE = 910  # cliente criado só para os testes de bloqueio


def _banco_disponivel() -> bool:
    try:
        conectar().close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _banco_disponivel(), reason="MySQL do .env indisponível")


@pytest.fixture(scope="module")
def api():
    with transacao() as cur:
        cur.execute(
            "INSERT IGNORE INTO usuario (id, nome, email, senha_hash, perfil) VALUES "
            "(%s, 'Cliente Bloqueio', 'teste-bloqueio@zaptos.dev', REPEAT('x', 60), 'cliente')",
            (USUARIO_TESTE,),
        )
        cur.execute("UPDATE usuario SET ativo = TRUE WHERE id = %s", (USUARIO_TESTE,))
    with TestClient(app) as cliente:
        yield cliente


def _ultimo_registro_id() -> int:
    with transacao() as cur:
        cur.execute("SELECT COALESCE(MAX(id), 0) AS id FROM registro_admin")
        return cur.fetchone()["id"]


def _registros_depois(id_inicial: int) -> list[dict]:
    with transacao() as cur:
        cur.execute(
            "SELECT admin_id, acao, alvo_tipo, alvo_id, detalhes FROM registro_admin WHERE id > %s ORDER BY id",
            (id_inicial,),
        )
        return list(cur.fetchall())


ROTAS_GET = ["/api/admin/usuarios", "/api/admin/lojas", "/api/admin/categorias", "/api/admin/resumo", "/api/admin/registro"]


@pytest.mark.parametrize("rota", ROTAS_GET)
def test_so_admin_acessa(api, rota):
    assert api.get(rota).status_code == 401
    assert api.get(rota, headers=CLIENTE).status_code == 403
    assert api.get(rota, headers=LOJISTA).status_code == 403
    assert api.get(rota, headers=ADMIN).status_code == 200


def test_cliente_e_lojista_nao_alteram(api):
    inicio = _ultimo_registro_id()
    for cab in (CLIENTE, LOJISTA):
        assert api.patch(f"/api/admin/usuarios/{USUARIO_TESTE}", json={"ativo": False}, headers=cab).status_code == 403
        assert api.patch("/api/admin/lojas/3", json={"ativa": False}, headers=cab).status_code == 403
        assert api.patch("/api/admin/categorias/4", json={"comissaoPercentual": 50}, headers=cab).status_code == 403
    assert _registros_depois(inicio) == []


def test_lista_usuarios_sem_senha_e_com_filtros(api):
    todos = api.get("/api/admin/usuarios", headers=ADMIN).json()
    assert all("senha_hash" not in u and "senhaHash" not in u for u in todos)
    assert {"id", "nome", "email", "perfil", "ativo"} <= set(todos[0])

    lojistas = api.get("/api/admin/usuarios", params={"perfil": "lojista"}, headers=ADMIN).json()
    assert lojistas and all(u["perfil"] == "lojista" for u in lojistas)

    ana = api.get("/api/admin/usuarios", params={"busca": "souza"}, headers=ADMIN).json()
    assert [u["email"] for u in ana] == ["cliente@zaptos.dev"]
    assert api.get("/api/admin/usuarios", params={"busca": "%"}, headers=ADMIN).json() == []
    assert api.get("/api/admin/usuarios", params={"perfil": "chefe"}, headers=ADMIN).status_code == 422


def test_bloquear_e_desbloquear_usuario(api):
    inicio = _ultimo_registro_id()
    r = api.patch(f"/api/admin/usuarios/{USUARIO_TESTE}", json={"ativo": False}, headers=ADMIN)
    assert r.status_code == 200, r.text
    assert r.json()["ativo"] is False
    # usuário bloqueado não consegue mais usar a API
    assert api.get("/api/me", headers={"X-Usuario-Id": str(USUARIO_TESTE)}).status_code == 401

    # repetir o mesmo pedido não muda nada e não gera registro
    assert api.patch(f"/api/admin/usuarios/{USUARIO_TESTE}", json={"ativo": False}, headers=ADMIN).status_code == 200

    r = api.patch(f"/api/admin/usuarios/{USUARIO_TESTE}", json={"ativo": True}, headers=ADMIN)
    assert r.status_code == 200 and r.json()["ativo"] is True
    assert api.get("/api/me", headers={"X-Usuario-Id": str(USUARIO_TESTE)}).status_code == 200

    regs = _registros_depois(inicio)
    assert [(g["acao"], g["alvo_tipo"], g["alvo_id"], g["admin_id"]) for g in regs] == [
        ("usuario.bloquear", "usuario", USUARIO_TESTE, 3),
        ("usuario.desbloquear", "usuario", USUARIO_TESTE, 3),
    ]


def test_admin_nao_bloqueia_a_si_mesmo(api):
    inicio = _ultimo_registro_id()
    r = api.patch("/api/admin/usuarios/3", json={"ativo": False}, headers=ADMIN)
    assert r.status_code == 409 and r.json()["codigo"] == "BLOQUEIO_PROPRIO"
    assert api.get("/api/me", headers=ADMIN).status_code == 200
    assert api.patch("/api/admin/usuarios/999999", json={"ativo": False}, headers=ADMIN).status_code == 404
    assert api.patch(f"/api/admin/usuarios/{USUARIO_TESTE}", json={"ativo": "nao"}, headers=ADMIN).status_code == 422
    assert _registros_depois(inicio) == []


def test_lojas_nao_expoem_tokens(api):
    lojas = api.get("/api/admin/lojas", headers=ADMIN).json()
    assert [l["nome"] for l in lojas] == ["Casa e Cia", "Lar & Estilo", "Passo Certo"]
    for l in lojas:
        assert not any("token" in chave.lower() for chave in l)
        assert l["pagbankConectado"] is False
        assert l["lojista"]["id"] and l["categoria"]["nome"]


def test_editar_e_desativar_loja(api):
    inicio = _ultimo_registro_id()
    try:
        r = api.patch("/api/admin/lojas/3", json={"horario": "Seg a dom 10h-22h", "piso": "Piso 2"}, headers=ADMIN)
        assert r.status_code == 200, r.text
        assert r.json()["horario"] == "Seg a dom 10h-22h" and r.json()["piso"] == "Piso 2"

        r = api.patch("/api/admin/lojas/3", json={"ativa": False}, headers=ADMIN)
        assert r.status_code == 200 and r.json()["ativa"] is False
        # loja desativada some do catálogo do cliente
        assert all(l["id"] != 3 for l in api.get("/api/stores").json())

        regs = _registros_depois(inicio)
        assert [g["acao"] for g in regs] == ["loja.editar", "loja.desativar"]
        assert '"Seg a sáb 10h-22h"' in regs[0]["detalhes"] and '"Piso 1"' in regs[0]["detalhes"]
    finally:
        api.patch("/api/admin/lojas/3", json={"horario": "Seg a sáb 10h-22h", "piso": "Piso 1", "ativa": True}, headers=ADMIN)
    assert any(l["id"] == 3 for l in api.get("/api/stores").json())


def test_loja_validacoes_nao_alteram_nem_registram(api):
    inicio = _ultimo_registro_id()
    r = api.patch("/api/admin/lojas/3", json={"nome": "Casa e Cia"}, headers=ADMIN)
    assert r.status_code == 409 and r.json()["codigo"] == "NOME_EM_USO"
    assert api.patch("/api/admin/lojas/3", json={"categoriaId": 999}, headers=ADMIN).status_code == 404
    assert api.patch("/api/admin/lojas/3", json={"nome": "   "}, headers=ADMIN).status_code == 422
    assert api.patch("/api/admin/lojas/3", json={}, headers=ADMIN).status_code == 422
    assert api.patch("/api/admin/lojas/999", json={"ativa": False}, headers=ADMIN).status_code == 404
    # mesmo valor: nada muda e nada é registrado
    assert api.patch("/api/admin/lojas/3", json={"nome": "Passo Certo"}, headers=ADMIN).status_code == 200
    assert _registros_depois(inicio) == []


def test_alterar_comissao_da_categoria(api):
    inicio = _ultimo_registro_id()
    try:
        r = api.patch("/api/admin/categorias/4", json={"comissaoPercentual": 12.5}, headers=ADMIN)
        assert r.status_code == 200, r.text
        assert r.json()["comissaoPercentual"] == 12.5
        cats = {c["id"]: c for c in api.get("/api/admin/categorias", headers=ADMIN).json()}
        assert cats[4]["comissaoPercentual"] == 12.5 and cats[4]["lojas"] == 1

        for invalido in (-1, 100.01, 150, "dez"):
            r = api.patch("/api/admin/categorias/4", json={"comissaoPercentual": invalido}, headers=ADMIN)
            assert r.status_code == 422, invalido
        assert api.patch("/api/admin/categorias/999", json={"comissaoPercentual": 5}, headers=ADMIN).status_code == 404

        regs = _registros_depois(inicio)
        assert [(g["acao"], g["alvo_id"]) for g in regs] == [("categoria.comissao", 4)]
    finally:
        api.patch("/api/admin/categorias/4", json={"comissaoPercentual": 10}, headers=ADMIN)


def test_resumo(api):
    r = api.get("/api/admin/resumo", headers=ADMIN).json()
    assert set(r["usuariosPorPerfil"]) == {"cliente", "lojista", "atendente", "admin"}
    assert r["usuariosPorPerfil"]["admin"]["ativos"] >= 1
    assert set(r["pedidosHoje"]) == {"pendente", "aprovado", "retirado", "cancelado", "expirado"}
    assert r["lojasAtivas"] <= r["lojasTotal"]
    assert round(r["comissaoShoppingHoje"] + r["valorLojistasHoje"], 2) == r["valorVendidoHoje"]


def test_resumo_conta_venda_de_hoje(api):
    antes = api.get("/api/admin/resumo", headers=ADMIN).json()
    with transacao() as cur:  # garante uma unidade livre da Luminária Arco (produto 5)
        cur.execute("UPDATE estoque SET quantidade_disponivel = quantidade_disponivel + 1 WHERE produto_id = 5")
    reserva = api.post("/api/orders/checkout-reserve", json={"produtoId": 5}, headers=CLIENTE).json()
    r = api.post(f"/api/reservations/{reserva['id']}/pay", json={"metodo": "pix"}, headers=CLIENTE)
    assert r.status_code == 200, r.text
    depois = api.get("/api/admin/resumo", headers=ADMIN).json()
    assert depois["pedidosHoje"]["aprovado"] == antes["pedidosHoje"]["aprovado"] + 1
    assert round(depois["valorVendidoHoje"] - antes["valorVendidoHoje"], 2) == 420.0
    assert round(depois["comissaoShoppingHoje"] - antes["comissaoShoppingHoje"], 2) == 42.0  # Decoração: 10%


def test_registro_lista_mais_recentes_primeiro(api):
    api.patch(f"/api/admin/usuarios/{USUARIO_TESTE}", json={"ativo": False}, headers=ADMIN)
    api.patch(f"/api/admin/usuarios/{USUARIO_TESTE}", json={"ativo": True}, headers=ADMIN)
    regs = api.get("/api/admin/registro", params={"limite": 2}, headers=ADMIN).json()
    assert len(regs) == 2 and regs[0]["id"] > regs[1]["id"]
    assert regs[0]["acao"] == "usuario.desbloquear"
    assert regs[0]["admin"] == {"id": 3, "nome": "Admin Capim Dourado"}
    assert regs[0]["detalhes"]["depois"] == {"ativo": True}
    assert api.get("/api/admin/registro", params={"limite": 0}, headers=ADMIN).status_code == 422


def test_registro_e_somente_insercao():
    with transacao() as cur:
        cur.execute("SELECT MAX(id) AS id FROM registro_admin")
        ultimo = cur.fetchone()["id"]
    assert ultimo, "os testes anteriores deveriam ter gerado registros"
    for sql in ("UPDATE registro_admin SET acao = 'x' WHERE id = %s", "DELETE FROM registro_admin WHERE id = %s"):
        with pytest.raises(Exception, match="RF016"):
            with transacao() as cur:
                cur.execute(sql, (ultimo,))
