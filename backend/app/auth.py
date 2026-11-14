"""Identificação do usuário.

PROVISÓRIO: enquanto o login (RF015) não existe, o usuário é identificado pelo
cabeçalho X-Usuario-Id, e só quando DEMO_AUTH=1 no .env. Isso não é seguro
(qualquer um pode se passar por outro usuário) e existe apenas para o time
testar o fluxo em desenvolvimento. O login vai substituir esta função.
"""
from typing import Callable

from fastapi import Depends, Header

from .config import config
from .db import transacao
from .erros import ErroNegocio


def usuario_atual(x_usuario_id: int | None = Header(default=None)) -> dict:
    if not config.demo_auth:
        raise ErroNegocio(501, "LOGIN_PENDENTE", "O login ainda não foi implementado (RF015).")
    if x_usuario_id is None:
        raise ErroNegocio(401, "NAO_AUTENTICADO", "Informe o cabeçalho X-Usuario-Id.")
    with transacao() as cur:
        cur.execute(
            "SELECT id, nome, email, perfil FROM usuario WHERE id = %s AND ativo",
            (x_usuario_id,),
        )
        usuario = cur.fetchone()
    if not usuario:
        raise ErroNegocio(401, "NAO_AUTENTICADO", "Usuário não encontrado ou inativo.")
    return usuario


def exigir_perfil(*perfis: str) -> Callable[..., dict]:
    """RNF006: libera a rota só para os perfis informados."""

    def dependencia(usuario: dict = Depends(usuario_atual)) -> dict:
        if usuario["perfil"] not in perfis:
            raise ErroNegocio(403, "SEM_PERMISSAO", "Seu perfil não tem acesso a esta área.")
        return usuario

    return dependencia
