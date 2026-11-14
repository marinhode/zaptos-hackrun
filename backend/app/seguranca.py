"""Senhas (bcrypt) e tokens de sessão (JWT assinado com SECRET_KEY)."""
import logging
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from .config import config

log = logging.getLogger("zaptos")
ALGORITMO = "HS256"

if config.secret_key:
    _CHAVE = config.secret_key
else:
    # Sem SECRET_KEY no .env, gera uma chave temporária: funciona, mas todo
    # mundo precisa entrar de novo quando a API reinicia.
    _CHAVE = secrets.token_urlsafe(48)
    log.warning("SECRET_KEY não definida no .env: usando chave temporária.")

# Hash usado quando o e-mail não existe, para o tempo de resposta do login ser
# parecido nos dois casos (não revela quais e-mails têm conta).
_HASH_FALSO = bcrypt.hashpw(b"senha-que-nao-existe", bcrypt.gensalt(rounds=12)).decode()


def senha_valida(senha: str) -> bool:
    """bcrypt só considera os primeiros 72 bytes; acima disso recusamos."""
    return 8 <= len(senha) and len(senha.encode("utf-8")) <= 72


def gerar_hash_senha(senha: str) -> str:
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode()


def senha_confere(senha: str, hash_salvo: str | None) -> bool:
    try:
        return bcrypt.checkpw(senha.encode("utf-8"), (hash_salvo or _HASH_FALSO).encode()) and hash_salvo is not None
    except ValueError:
        return False


def gerar_token(usuario_id: int, perfil: str) -> str:
    agora = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": str(usuario_id), "perfil": perfil, "iat": agora, "exp": agora + timedelta(hours=config.token_horas)},
        _CHAVE,
        algorithm=ALGORITMO,
    )


def ler_token(token: str) -> int | None:
    """Devolve o id do usuário, ou None se o token for inválido ou estiver vencido."""
    try:
        dados = jwt.decode(token, _CHAVE, algorithms=[ALGORITMO], options={"require": ["sub", "exp"]})
        return int(dados["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        return None
