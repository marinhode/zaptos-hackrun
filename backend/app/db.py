"""Conexão com o MySQL.

Cada requisição abre uma conexão e trabalha dentro de uma transação:
tudo é confirmado no fim ou desfeito se der erro.
"""
from contextlib import contextmanager
from typing import Iterator

import pymysql
from pymysql.cursors import DictCursor

from .config import config


def conectar(autocommit: bool = False) -> pymysql.connections.Connection:
    return pymysql.connect(
        host=config.db_host,
        port=config.db_port,
        user=config.db_user,
        password=config.db_password,
        database=config.db_name,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=autocommit,
        # mesmo fuso do schema.sql (Palmas/TO), para NOW() e os prazos baterem
        init_command="SET time_zone = '-03:00'",
    )


@contextmanager
def transacao() -> Iterator[DictCursor]:
    con = conectar()
    try:
        with con.cursor() as cur:
            yield cur
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def liberar_reservas_expiradas() -> None:
    """RN010: devolve ao estoque as reservas que passaram de 15 minutos.

    A procedure tem a própria transação, por isso roda numa conexão separada.
    """
    con = conectar(autocommit=True)
    try:
        with con.cursor() as cur:
            cur.execute("CALL sp_liberar_reservas_expiradas()")
    finally:
        con.close()
