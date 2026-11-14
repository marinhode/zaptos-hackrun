"""Login e cadastro de cliente (RF002, RF015).

Lojistas, atendentes e administradores não se cadastram sozinhos: as contas
são criadas pela administração do shopping.
"""
import re

import pymysql
from fastapi import APIRouter
from pydantic import BaseModel, Field, field_validator

from ..db import transacao
from ..erros import ErroNegocio
from ..seguranca import gerar_hash_senha, gerar_token, senha_confere, senha_valida

router = APIRouter(prefix="/auth", tags=["Autenticação"])

EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _email(valor: str) -> str:
    valor = valor.strip().lower()
    if not EMAIL.match(valor) or len(valor) > 160:
        raise ValueError("E-mail inválido.")
    return valor


class Login(BaseModel):
    email: str
    senha: str = Field(min_length=1, max_length=200)

    _validar_email = field_validator("email")(_email)


class Cadastro(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: str
    senha: str = Field(min_length=8, max_length=72)
    telefone: str | None = Field(default=None, max_length=20)

    _validar_email = field_validator("email")(_email)

    @field_validator("nome")
    @classmethod
    def _nome(cls, valor: str) -> str:
        valor = " ".join(valor.split())
        if len(valor) < 2:
            raise ValueError("Informe seu nome.")
        return valor


def _resposta(usuario: dict) -> dict:
    return {
        "token": gerar_token(usuario["id"], usuario["perfil"]),
        "usuario": {k: usuario[k] for k in ("id", "nome", "email", "perfil")},
    }


@router.post("/login")
def entrar(dados: Login) -> dict:
    with transacao() as cur:
        cur.execute(
            "SELECT id, nome, email, perfil, senha_hash, ativo FROM usuario WHERE email = %s",
            (dados.email,),
        )
        usuario = cur.fetchone()

    # Mesma mensagem para e-mail inexistente e senha errada.
    if not senha_confere(dados.senha, usuario["senha_hash"] if usuario else None):
        raise ErroNegocio(401, "CREDENCIAIS_INVALIDAS", "E-mail ou senha incorretos.")
    if not usuario["ativo"]:
        raise ErroNegocio(403, "CONTA_BLOQUEADA", "Esta conta está bloqueada. Procure a administração do shopping.")
    return _resposta(usuario)


@router.post("/cadastro", status_code=201)
def cadastrar(dados: Cadastro) -> dict:
    if not senha_valida(dados.senha):
        raise ErroNegocio(422, "SENHA_FRACA", "A senha precisa ter de 8 a 72 caracteres.")
    try:
        with transacao() as cur:
            cur.execute(
                "INSERT INTO usuario (nome, email, senha_hash, telefone, perfil) VALUES (%s, %s, %s, %s, 'cliente')",
                (dados.nome, dados.email, gerar_hash_senha(dados.senha), dados.telefone),
            )
            usuario = {"id": cur.lastrowid, "nome": dados.nome, "email": dados.email, "perfil": "cliente"}
    except pymysql.err.IntegrityError as erro:
        if "uq_usuario_email" in str(erro):
            raise ErroNegocio(409, "EMAIL_EM_USO", "Já existe uma conta com este e-mail.") from erro
        raise
    return _resposta(usuario)
