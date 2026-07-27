# ---- builder: compila le dipendenze Python che richiedono un toolchain ----
# (psycopg[binary] è già una wheel precompilata, ma python-magic/cryptography
# ecc. possono richiedere build-essential/libpq-dev/libmagic-dev su alcune
# architetture; li teniamo solo qui, non nell'immagine finale).
FROM python:3.12.8-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libpq-dev libmagic-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --user -r requirements.txt

# ---- runtime: solo le librerie condivise necessarie a runtime ----
FROM python:3.12.8-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Fix P3 18 (audit 2026-07): prima l'immagine finale includeva anche
# build-essential/libpq-dev/libmagic-dev (compilatori e header di sviluppo),
# inutili a runtime e che aumentano superficie d'attacco e dimensione
# dell'immagine. Ora restano solo le librerie condivise (libpq5, libmagic1)
# e tesseract-ocr (necessario a runtime per l'OCR ServiceNow).
RUN apt-get update && apt-get install -y --no-install-recommends \
      libpq5 libmagic1 tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

COPY . /app

EXPOSE 8000

# Run collectstatic/migrate hooks before starting the server.
# NOTE: we intentionally execute the script from /app so that the
# docker-compose bind mount (./backend:/app) updates the entrypoint in dev.
ENTRYPOINT ["sh", "/app/entrypoint.sh"]

