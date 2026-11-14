"""Ponto de entrada da API do Zaptos.

Rodar (na pasta backend):  uvicorn app.main:app --reload
Documentação automática:   http://localhost:8000/docs
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import config
from .db import conectar, liberar_reservas_expiradas
from .erros import ErroNegocio
from .modulos import admin, catalogo, lojista, pedidos, reservas, usuarios

log = logging.getLogger("zaptos")


async def _rotina_liberacao() -> None:
    """RN010: a cada minuto devolve ao estoque as reservas vencidas."""
    while True:
        try:
            await asyncio.to_thread(liberar_reservas_expiradas)
        except Exception:  # banco fora do ar não pode derrubar a API
            log.warning("Não foi possível liberar reservas vencidas agora.", exc_info=True)
        await asyncio.sleep(config.intervalo_liberacao_s)


@asynccontextmanager
async def ciclo_de_vida(_: FastAPI):
    tarefa = asyncio.create_task(_rotina_liberacao())
    yield
    tarefa.cancel()


app = FastAPI(
    title="Zaptos API",
    version="0.1.0",
    description="Reserva online e retirada na loja do Capim Dourado Shopping.",
    lifespan=ciclo_de_vida,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(config.cors_origins),
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-Usuario-Id"],
)


@app.exception_handler(ErroNegocio)
async def tratar_erro_negocio(_, erro: ErroNegocio) -> JSONResponse:
    return JSONResponse(status_code=erro.status, content={"codigo": erro.codigo, "mensagem": erro.mensagem})


@app.get("/api/health", tags=["Status"])
def saude() -> JSONResponse:
    try:
        con = conectar()
        try:
            with con.cursor() as cur:
                cur.execute("SELECT 1")
        finally:
            con.close()
        return JSONResponse({"status": "ok", "banco": "ok"})
    except Exception:
        log.warning("Banco indisponível no health check.", exc_info=True)
        return JSONResponse({"status": "degradado", "banco": "indisponivel"}, status_code=503)


for modulo in (catalogo, reservas, pedidos, lojista, usuarios, admin):
    app.include_router(modulo.router, prefix="/api")
