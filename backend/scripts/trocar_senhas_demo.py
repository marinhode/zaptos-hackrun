"""Troca as senhas das contas de teste do seed antes de publicar o link.

A senha de desenvolvimento do seed está escrita no README de um repositório
público. Com o app aberto na internet, qualquer pessoa poderia entrar como
administrador. Este script gera uma senha nova e forte para cada conta do seed,
grava o hash no banco e salva as senhas em um arquivo local (fora do git) para
a equipe usar na demonstração.

Uso (na pasta backend, com o .env apontando para o banco):
    python scripts/trocar_senhas_demo.py
"""
import secrets
import string
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import RAIZ_REPO  # noqa: E402
from app.db import transacao  # noqa: E402
from app.seguranca import gerar_hash_senha  # noqa: E402

ARQUIVO = RAIZ_REPO / "contas-demo.local.txt"  # o .gitignore ignora *.local.txt
LETRAS = string.ascii_letters + string.digits


def senha_nova() -> str:
    # 3 blocos de 4 caracteres, fácil de digitar no celular: ex. aB3d-9xYz-K2mP
    return "-".join("".join(secrets.choice(LETRAS) for _ in range(4)) for _ in range(3))


def main() -> None:
    linhas = []
    with transacao() as cur:
        cur.execute("SELECT id, email, perfil FROM usuario WHERE email LIKE %s ORDER BY id", ("%@zaptos.dev",))
        contas = cur.fetchall()
        for conta in contas:
            senha = senha_nova()
            cur.execute("UPDATE usuario SET senha_hash = %s WHERE id = %s", (gerar_hash_senha(senha), conta["id"]))
            linhas.append(f"{conta['perfil']:<9} {conta['email']:<28} {senha}")

    ARQUIVO.write_text(
        "Contas da demonstração do Zaptos — NÃO compartilhe nem faça commit deste arquivo.\n"
        "Rodar scripts/trocar_senhas_demo.py de novo gera senhas novas.\n"
        "Recarregar o seed.sql volta para a senha de desenvolvimento (só use isso fora do link público).\n\n"
        + "\n".join(linhas) + "\n",
        encoding="utf-8",
    )
    print(f"{len(linhas)} senhas trocadas. Veja o arquivo: {ARQUIVO}")


if __name__ == "__main__":
    main()
