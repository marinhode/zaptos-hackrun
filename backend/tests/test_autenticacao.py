"""Login, cadastro e uso do token. Roda contra o MySQL do .env (pulado se indisponível)."""
import dataclasses
import uuid

import pytest
from fastapi.testclient import TestClient

from app import auth
from app.db import conectar, transacao
from app.main import app
from app.seguranca import gerar_hash_senha, ler_token, senha_confere

SENHA_SEED = "zaptos-dev-123"


def _banco_disponivel() -> bool:
    try:
        conectar().close()
        return True
    except Exception:
        return False


def test_hash_de_senha():
    h = gerar_hash_senha("uma-senha-boa")
    assert h != "uma-senha-boa"
    assert senha_confere("uma-senha-boa", h)
    assert not senha_confere("outra-senha", h)
    assert not senha_confere("qualquer", None)


def test_token_adulterado_e_recusado():
    assert ler_token("isto.nao.e-um-token") is None


banco = pytest.mark.skipif(not _banco_disponivel(), reason="MySQL do .env indisponível")


@pytest.fixture(scope="module")
def api():
    with TestClient(app) as cliente:
        yield cliente


def _entrar(api, email, senha=SENHA_SEED):
    return api.post("/api/auth/login", json={"email": email, "senha": senha})


@banco
def test_login_com_conta_do_seed(api):
    r = _entrar(api, "  CLIENTE@zaptos.dev ")  # e-mail sem diferenciar maiúsculas
    assert r.status_code == 200, r.text
    corpo = r.json()
    assert corpo["usuario"]["perfil"] == "cliente"
    assert "senha_hash" not in corpo["usuario"]
    eu = api.get("/api/me", headers={"Authorization": f"Bearer {corpo['token']}"}).json()
    assert eu["email"] == "cliente@zaptos.dev"


@banco
def test_login_errado_tem_mesma_mensagem(api):
    senha_errada = _entrar(api, "cliente@zaptos.dev", "senha-errada")
    email_inexistente = _entrar(api, "ninguem@zaptos.dev", "senha-errada")
    assert senha_errada.status_code == email_inexistente.status_code == 401
    assert senha_errada.json() == email_inexistente.json()


@banco
def test_cadastro_cria_cliente_e_ja_entra(api):
    email = f"teste-{uuid.uuid4().hex[:8]}@zaptos.dev"
    r = api.post("/api/auth/cadastro", json={"nome": " Maria  Teste ", "email": email, "senha": "senha-forte-1"})
    assert r.status_code == 201, r.text
    corpo = r.json()
    assert corpo["usuario"] == {**corpo["usuario"], "perfil": "cliente", "nome": "Maria Teste", "email": email}
    # a conta nova acessa as rotas de cliente
    assert api.get("/api/orders", headers={"Authorization": f"Bearer {corpo['token']}"}).status_code == 200
    # e-mail repetido
    r = api.post("/api/auth/cadastro", json={"nome": "Outra", "email": email.upper(), "senha": "senha-forte-1"})
    assert r.status_code == 409 and r.json()["codigo"] == "EMAIL_EM_USO"


@banco
def test_cadastro_valida_dados(api):
    curta = api.post("/api/auth/cadastro", json={"nome": "Ana", "email": "x@zaptos.dev", "senha": "123"})
    sem_email = api.post("/api/auth/cadastro", json={"nome": "Ana", "email": "nao-e-email", "senha": "senha-forte-1"})
    assert curta.status_code == 422 and sem_email.status_code == 422


@banco
def test_perfis_separados(api):
    token_cliente = _entrar(api, "cliente@zaptos.dev").json()["token"]
    token_lojista = _entrar(api, "lojista@zaptos.dev").json()["token"]
    assert api.get("/api/seller/stores", headers={"Authorization": f"Bearer {token_cliente}"}).status_code == 403
    assert api.get("/api/orders", headers={"Authorization": f"Bearer {token_lojista}"}).status_code == 403
    assert api.get("/api/seller/stores", headers={"Authorization": f"Bearer {token_lojista}"}).status_code == 200


@banco
def test_token_invalido_e_sem_login(api):
    r = api.get("/api/orders", headers={"Authorization": "Bearer token-falso"})
    assert r.status_code == 401 and r.json()["codigo"] == "SESSAO_EXPIRADA"
    assert api.get("/api/orders").status_code == 401


@banco
def test_x_usuario_id_ignorado_fora_do_modo_demo(api, monkeypatch):
    monkeypatch.setattr(auth, "config", dataclasses.replace(auth.config, demo_auth=False))
    assert api.get("/api/orders", headers={"X-Usuario-Id": "1"}).status_code == 401


@banco
def test_conta_bloqueada(api):
    token = _entrar(api, "cliente@zaptos.dev").json()["token"]
    with transacao() as cur:
        cur.execute("UPDATE usuario SET ativo = FALSE WHERE email = 'cliente@zaptos.dev'")
    try:
        r = _entrar(api, "cliente@zaptos.dev")
        assert r.status_code == 403 and r.json()["codigo"] == "CONTA_BLOQUEADA"
        # token emitido antes do bloqueio também para de funcionar
        assert api.get("/api/orders", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    finally:
        with transacao() as cur:
            cur.execute("UPDATE usuario SET ativo = TRUE WHERE email = 'cliente@zaptos.dev'")
