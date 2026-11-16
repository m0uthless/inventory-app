# build — il contesto Docker è la root del monorepo (inventory-app/)
FROM node:20.19.0 AS build
WORKDIR /app

# Installa dipendenze di frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci --legacy-peer-deps

# Copia shared/ e crea symlink node_modules so che tsc trovi react/@mui ecc.
COPY shared/ ./shared/
RUN ln -s /app/frontend/node_modules /app/shared/node_modules

# Identifica l'ambiente di build (dev/prod), passato da docker-compose
# tramite build.args. Default "production" se l'arg non viene passato
# (es. build manuale senza compose).
ARG VITE_APP_ENV=production
ENV VITE_APP_ENV=${VITE_APP_ENV}

# Copia frontend e builda
COPY frontend/ ./frontend/
# B-01 (QA 2026-11-15): `npm run build` legge sempre .env.production, quindi
# in dev il link "Portale clienti" portava alla produzione. In dev l'URL resta
# vuoto e Login.tsx lo ricava dall'host della pagina (porta 8081). Una
# variabile già presente ha la precedenza sui file .env di Vite.
RUN cd frontend && if [ "$VITE_APP_ENV" = "development" ]; then VITE_PORTAL_URL= npm run build; else npm run build; fi

# serve
# Fase 6 (0.9.1, audit 2026-08-19, fix post-staging): nginx:1.27-alpine
# standard crea /var/cache/nginx/client_temp a runtime assumendo un master
# process root — con `USER nginx` falliva su mkdir() Permission denied.
# nginxinc/nginx-unprivileged è l'immagine ufficiale NGINX Inc. pensata
# apposta per questo caso (stesso uid/gid 101, PID/cache dir già configurati
# per l'utente non-root).
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
