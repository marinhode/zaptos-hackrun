FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# O código fica em /srv/backend: a API grava as fotos em <raiz>/backend/uploads,
# que aqui é /srv/backend/uploads (montado como volume no docker-compose.yml).
WORKDIR /srv/backend

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN mkdir -p uploads

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
