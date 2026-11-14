"""Dados do usuário logado."""
from fastapi import APIRouter, Depends

from ..auth import usuario_atual

router = APIRouter(tags=["Usuário"])


@router.get("/me")
def eu(usuario: dict = Depends(usuario_atual)) -> dict:
    return usuario
