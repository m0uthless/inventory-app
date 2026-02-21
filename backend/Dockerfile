FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y build-essential libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

EXPOSE 8000

# Run collectstatic/migrate hooks before starting the server.
# NOTE: we intentionally execute the script from /app so that the
# docker-compose bind mount (./backend:/app) updates the entrypoint in dev.
ENTRYPOINT ["sh", "/app/entrypoint.sh"]

