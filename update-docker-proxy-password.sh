#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# update-docker-proxy-password.sh
#
# Aggiorna SOLO la password nel file /etc/docker/proxy.env usato dal demone
# Docker (caricato via EnvironmentFile= dai drop-in systemd 99-proxy-env.conf
# e proxy.conf). Preserva utente/host/porta/NO_PROXY già presenti nel file,
# fa un backup con timestamp prima di sovrascrivere, e verifica che la nuova
# password sia effettivamente arrivata al processo dockerd in esecuzione
# (non solo scritta nel file — vedi nota sulla verifica in fondo).
#
# Uso: ./update-docker-proxy-password.sh
# Richiede sudo (lettura/scrittura di /etc/docker/proxy.env, riavvio Docker).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROXY_ENV_FILE="/etc/docker/proxy.env"

echo "=== Aggiornamento password proxy Docker ==="
echo

if [ "$(id -u)" -eq 0 ]; then
  echo "Non lanciare questo script con sudo direttamente: chiederà sudo da solo"
  echo "solo per i passaggi che lo richiedono."
  exit 1
fi

if [ ! -f "$PROXY_ENV_FILE" ]; then
  echo "Errore: ${PROXY_ENV_FILE} non trovato."
  echo "Questo script aggiorna solo la password in un file già esistente;"
  echo "se il file non c'è ancora va creato a mano la prima volta."
  exit 1
fi

if ! sudo test -r "$PROXY_ENV_FILE"; then
  echo "Errore: impossibile leggere ${PROXY_ENV_FILE} anche con sudo."
  exit 1
fi

CURRENT_LINE="$(sudo grep '^HTTP_PROXY=' "$PROXY_ENV_FILE" || true)"
if [ -z "$CURRENT_LINE" ]; then
  echo "Errore: non trovo una riga HTTP_PROXY= in ${PROXY_ENV_FILE}."
  echo "Il file non ha il formato atteso, meglio sistemarlo a mano."
  exit 1
fi

# Estrae user/host/porta dalla riga esistente:
# HTTP_PROXY=http://USER:PASSWORD@HOST:PORT
if [[ "$CURRENT_LINE" =~ ^HTTP_PROXY=http://([^:]+):[^@]*@([^:]+):([0-9]+)$ ]]; then
  PROXY_USER="${BASH_REMATCH[1]}"
  PROXY_HOST="${BASH_REMATCH[2]}"
  PROXY_PORT="${BASH_REMATCH[3]}"
else
  echo "Errore: non riesco a interpretare la riga HTTP_PROXY esistente:"
  echo "  ${CURRENT_LINE}"
  echo "Formato atteso: HTTP_PROXY=http://USER:PASSWORD@HOST:PORT"
  exit 1
fi

CURRENT_NO_PROXY="$(sudo grep '^NO_PROXY=' "$PROXY_ENV_FILE" | cut -d= -f2- || true)"
CURRENT_NO_PROXY="${CURRENT_NO_PROXY:-localhost,127.0.0.1,.ausl.bologna.it}"

echo "Trovati nel file esistente:"
echo "  Utente : ${PROXY_USER}"
echo "  Host   : ${PROXY_HOST}"
echo "  Porta  : ${PROXY_PORT}"
echo "  NO_PROXY: ${CURRENT_NO_PROXY}"
echo "(la password attuale non viene mostrata)"
echo

read -r -s -p "Nuova password proxy: " NEW_PASS
echo
if [ -z "$NEW_PASS" ]; then
  echo "Errore: password vuota, operazione annullata."
  exit 1
fi
read -r -s -p "Conferma nuova password: " NEW_PASS_CONFIRM
echo
if [ "$NEW_PASS" != "$NEW_PASS_CONFIRM" ]; then
  echo "Errore: le due password non coincidono, operazione annullata."
  exit 1
fi

# URL-encode della password: eventuali caratteri speciali (!, @, %, ecc.)
# vanno codificati nell'URL del proxy, altrimenti curl/Docker li interpretano
# come separatori. NB: questo NON è lo stesso problema visto in precedenza
# con systemd e il carattere '%' dentro un Environment= inline — qui il file
# è caricato via EnvironmentFile=, che systemd legge come testo grezzo senza
# applicare l'espansione dei propri specifier (%h, %n...), quindi è la strada
# corretta anche per password con caratteri speciali.
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

NEW_PASS_ENC="$(urlencode "$NEW_PASS")"
PROXY_URL="http://${PROXY_USER}:${NEW_PASS_ENC}@${PROXY_HOST}:${PROXY_PORT}"

BACKUP_FILE="${PROXY_ENV_FILE}.bak.$(date +%Y%m%d-%H%M%S)"
echo
echo "Backup del file attuale in: ${BACKUP_FILE}"
sudo cp "$PROXY_ENV_FILE" "$BACKUP_FILE"
sudo chmod 600 "$BACKUP_FILE"

sudo tee "$PROXY_ENV_FILE" > /dev/null <<EOF
HTTP_PROXY=${PROXY_URL}
HTTPS_PROXY=${PROXY_URL}
NO_PROXY=${CURRENT_NO_PROXY}
EOF
sudo chmod 600 "$PROXY_ENV_FILE"

echo "File aggiornato. Riavvio Docker..."
sudo systemctl daemon-reload
sudo systemctl restart docker

echo
echo "=== Verifica ==="
# IMPORTANTE: 'systemctl show --property=Environment docker' NON mostra le
# variabili caricate via EnvironmentFile= (solo quelle da Environment=
# inline nei drop-in) — è un falso negativo se usato per verificare questo
# file, motivo per cui in un giro precedente sembrava che la password non
# venisse mai caricata. La verifica corretta è leggere l'ambiente REALE del
# processo dockerd in esecuzione:
DOCKERD_PID="$(pidof dockerd || true)"
if [ -n "$DOCKERD_PID" ]; then
  echo "Variabili proxy effettivamente in uso dal processo dockerd (PID ${DOCKERD_PID}):"
  # NB: 'sudo tr ... < /proc/.../environ' NON funziona — la redirezione '<'
  # viene aperta dalla shell PRIMA che sudo elevi i privilegi, quindi il file
  # viene letto come utente normale (Permission denied) anche con sudo
  # davanti al comando. Bisogna far leggere il file a un comando eseguito
  # DENTRO sudo (qui: cat), non lasciarlo alla redirezione della shell.
  sudo cat "/proc/${DOCKERD_PID}/environ" | tr '\0' '\n' | grep -i proxy | sed -E 's/(HTTP_PROXY|HTTPS_PROXY)=http:\/\/[^:]+:[^@]+@/\1=http:\/\/'"${PROXY_USER}"':***@/'
else
  echo "Attenzione: non trovo il processo dockerd, verifica manualmente con 'systemctl status docker'."
fi

echo
echo "Fatto. Prova ora:"
echo "  docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build --remove-orphans"
