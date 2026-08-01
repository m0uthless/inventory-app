#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# configure-docker-proxy.sh
#
# Configura il proxy autenticato per il demone Docker (dockerd), necessario
# per i pull di immagini da Docker Hub quando si è dietro al proxy aziendale
# AUSL (172.23.1.39:8080). Non tocca ~/.docker/config.json: quel file
# configura il proxy iniettato DENTRO ai container in esecuzione (docker run),
# mentre qui il problema è il demone stesso che deve raggiungere
# auth.docker.io/registry-1.docker.io per fare il pull — serve configurare
# systemd, non il client.
#
# Uso: ./configure-docker-proxy.sh
# Richiede sudo (per scrivere il drop-in systemd e riavviare Docker).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DROPIN_DIR="/etc/systemd/system/docker.service.d"
DROPIN_FILE="${DROPIN_DIR}/http-proxy.conf"
DEFAULT_PROXY_HOST="172.23.1.39"
DEFAULT_PROXY_PORT="8080"
DEFAULT_NO_PROXY="localhost,127.0.0.1,.ausl.bologna.it"

echo "=== Configurazione proxy per il demone Docker ==="
echo

if [ "$(id -u)" -eq 0 ]; then
  echo "Non lanciare questo script con sudo direttamente: lo script stesso"
  echo "chiederà sudo solo per i passaggi che lo richiedono."
  exit 1
fi

read -r -p "Host proxy [${DEFAULT_PROXY_HOST}]: " PROXY_HOST
PROXY_HOST="${PROXY_HOST:-$DEFAULT_PROXY_HOST}"

read -r -p "Porta proxy [${DEFAULT_PROXY_PORT}]: " PROXY_PORT
PROXY_PORT="${PROXY_PORT:-$DEFAULT_PROXY_PORT}"

read -r -p "Username proxy: " PROXY_USER
if [ -z "$PROXY_USER" ]; then
  echo "Errore: username obbligatorio."
  exit 1
fi

read -r -s -p "Password proxy: " PROXY_PASS
echo
if [ -z "$PROXY_PASS" ]; then
  echo "Errore: password obbligatoria."
  exit 1
fi

read -r -p "NO_PROXY [${DEFAULT_NO_PROXY}]: " NO_PROXY_VALUE
NO_PROXY_VALUE="${NO_PROXY_VALUE:-$DEFAULT_NO_PROXY}"

# URL-encode di user/password (nel caso contengano caratteri speciali tipo @ o :)
urlencode() {
  local raw="$1"
  local out=""
  local i c
  for (( i=0; i<${#raw}; i++ )); do
    c="${raw:$i:1}"
    case "$c" in
      [a-zA-Z0-9.~_-]) out+="$c" ;;
      *) out+=$(printf '%%%02X' "'$c") ;;
    esac
  done
  echo "$out"
}

PROXY_USER_ENC="$(urlencode "$PROXY_USER")"
PROXY_PASS_ENC="$(urlencode "$PROXY_PASS")"
PROXY_URL="http://${PROXY_USER_ENC}:${PROXY_PASS_ENC}@${PROXY_HOST}:${PROXY_PORT}"

echo
echo "Verrà creato/sovrascritto: ${DROPIN_FILE}"
echo "(la password non viene stampata a schermo qui sotto)"
echo

sudo mkdir -p "$DROPIN_DIR"
sudo tee "$DROPIN_FILE" > /dev/null <<EOF
[Service]
Environment="HTTP_PROXY=${PROXY_URL}"
Environment="HTTPS_PROXY=${PROXY_URL}"
Environment="NO_PROXY=${NO_PROXY_VALUE}"
EOF

sudo chmod 600 "$DROPIN_FILE"

echo "Ricarico systemd e riavvio Docker..."
sudo systemctl daemon-reload
sudo systemctl restart docker

echo
echo "Verifica variabili caricate dal demone:"
sudo systemctl show --property=Environment docker

echo
echo "=== Controllo builder BuildKit/buildx attivo ==="
echo "Se 'docker compose build' usa un builder con driver 'docker-container'"
echo "(non il default 'docker'), quel builder gira in un container SEPARATO"
echo "che non eredita automaticamente il proxy appena configurato sul demone:"
echo "in quel caso serve ricrearlo passando le stesse variabili."
echo
docker buildx ls || true

echo
echo "Fatto. Prova ora:"
echo "  docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --remove-orphans"
echo
echo "Se l'errore 'Proxy Authentication Required' persiste ed il builder sopra"
echo "risulta di tipo 'docker-container', fammelo sapere: serve un passaggio"
echo "in più per propagare il proxy a quel builder."
