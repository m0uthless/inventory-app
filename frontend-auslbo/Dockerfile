# build — il contesto Docker è la root del monorepo (inventory-app/)
FROM node:20 AS build
WORKDIR /app

# Installa dipendenze di frontend-auslbo
COPY frontend-auslbo/package*.json ./frontend-auslbo/
RUN cd frontend-auslbo && npm install --legacy-peer-deps

# Copia shared/ e crea symlink node_modules so che tsc trovi react/@mui ecc.
COPY shared/ ./shared/
RUN ln -s /app/frontend-auslbo/node_modules /app/shared/node_modules

# Copia frontend-auslbo e builda
COPY frontend-auslbo/ ./frontend-auslbo/
RUN cd frontend-auslbo && npm run build

# serve
FROM nginx:alpine
COPY frontend-auslbo/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend-auslbo/dist /usr/share/nginx/html
