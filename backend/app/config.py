"""Configuração lida do arquivo .env na raiz do repositório."""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

RAIZ_REPO = Path(__file__).resolve().parents[2]
load_dotenv(RAIZ_REPO / ".env")


def _booleano(nome: str, padrao: str = "0") -> bool:
    return os.getenv(nome, padrao).strip().lower() in {"1", "true", "sim", "yes"}


def _lista(nome: str, padrao: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in os.getenv(nome, padrao).split(",") if item.strip())


@dataclass(frozen=True)
class Config:
    db_host: str = os.getenv("DB_HOST", "localhost")
    db_port: int = int(os.getenv("DB_PORT", "3306"))
    db_name: str = os.getenv("DB_NAME", "zaptos")
    db_user: str = os.getenv("DB_USER", "")
    db_password: str = os.getenv("DB_PASSWORD", "")

    # Endereços do front-end que podem chamar a API.
    cors_origins: tuple[str, ...] = _lista("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")

    # Identificação provisória pelo cabeçalho X-Usuario-Id, até o login (RF015)
    # ficar pronto. NUNCA ligar fora do ambiente de desenvolvimento.
    demo_auth: bool = _booleano("DEMO_AUTH")

    # Enquanto a integração com o PagBank não existe, o pagamento é aprovado na hora.
    pagamento_simulado: bool = _booleano("PAGAMENTO_SIMULADO", "1")

    # De quantos em quantos segundos a API libera reservas vencidas (RN010).
    intervalo_liberacao_s: int = int(os.getenv("INTERVALO_LIBERACAO_S", "60"))


config = Config()
