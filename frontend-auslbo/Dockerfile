# build — il contesto Docker è la root del monorepo (inventory-app/)
FROM node:20.19.0 AS build
WORKDIR /app

# Installa dipendenze di frontend-auslbo
COPY frontend-auslbo/package*.json ./frontend-auslbo/
RUN cd frontend-auslbo && npm install --legacy-peer-deps

# Copia shared/ e crea symlink node_modules so che tsc trovi react/@mui ecc.
COPY shared/ ./shared/
RUN ln -s /app/frontend-auslbo/node_modules /app/shared/node_modules

# Identifica l'ambiente di build (dev/prod), passato da docker-compose
# tramite build.args. Default "production" se l'arg non viene passato
# (es. build manuale senza compose).
ARG VITE_APP_ENV=production
ENV VITE_APP_ENV=${VITE_APP_ENV}

# Copia frontend-auslbo e builda
COPY frontend-auslbo/ ./frontend-auslbo/
RUN cd frontend-auslbo && npm run build

# serve
FROM nginx:1.27-alpine
COPY frontend-auslbo/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend-auslbo/dist /usr/share/nginx/html
