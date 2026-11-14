"""Identificação do usuário logado (RF015) e controle de acesso por perfil (RNF006).

O front envia o token recebido no login no cabeçalho:
    Authorization: Bearer <token>

Só em desenvolvimento (DEMO_AUTH=1) também aceita X-Usuario-Id, usado pelos testes.
"""
from typing import Callable

from fastapi import Depends, Header

from .config import config
from .db import transacao
from .erros import ErroNegocio
from .seguranca import ler_token


def usuario_atual(
    authorization: str | None = Header(default=None),
    x_usuario_id: int | None = Header(default=None),
) -> dict:
    usuario_id = None
    if authorization and authorization.lower().startswith("bearer "):
        usuario_id = ler_token(authorization[7:].strip())
        if usuario_id is None:
            raise ErroNegocio(401, "SESSAO_EXPIRADA", "Sua sessão expirou. Entre de novo.")
    elif x_usuario_id is not None and config.demo_auth:
        usuario_id = x_usuario_id

    if usuario_id is None:
        raise ErroNegocio(401, "NAO_AUTENTICADO", "Entre na sua conta para continuar.")

    # Consulta o banco a cada requisição: usuário bloqueado perde o acesso na hora.
    with transacao() as cur:
        cur.execute(
            "SELECT id, nome, email, perfil FROM usuario WHERE id = %s AND ativo",
            (usuario_id,),
        )
        usuario = cur.fetchone()
    if not usuario:
        raise ErroNegocio(401, "NAO_AUTENTICADO", "Conta não encontrada ou bloqueada.")
    return usuario


def exigir_perfil(*perfis: str) -> Callable[..., dict]:
    """RNF006: libera a rota só para os perfis informados."""

    def dependencia(usuario: dict = Depends(usuario_atual)) -> dict:
        if usuario["perfil"] not in perfis:
            raise ErroNegocio(403, "SEM_PERMISSAO", "Seu perfil não tem acesso a esta área.")
        return usuario

    return dependencia
