# build — il contesto Docker è la root del monorepo (inventory-app/)
FROM node:20 AS build
WORKDIR /app

# Installa dipendenze di frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --legacy-peer-deps

# Copia shared/ e crea symlink node_modules so che tsc trovi react/@mui ecc.
COPY shared/ ./shared/
RUN ln -s /app/frontend/node_modules /app/shared/node_modules

# Copia frontend e builda
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# serve
FROM nginx:alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
