# Imagen de Veta Roja. Se construye desde la raíz del repositorio:
#   docker build -f deploy/Dockerfile -t veta-roja .
#
# Etapa 1: instala todo y compila el cliente (panel + landings) con Vite.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci
COPY shared shared
COPY server server
COPY web web
RUN npm run build -w web

# Etapa 2: solo lo necesario para ejecutar. El servidor corre con tsx (el SSR importa TSX de web/src).
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev && npm cache clean --force
COPY shared shared
COPY server server
COPY web/src web/src
COPY web/public web/public
COPY web/tsconfig.json web/
COPY --from=build /app/web/dist web/dist

# Carpeta persistente de imágenes subidas (se monta como volumen).
RUN mkdir -p /data/uploads && chown -R node:node /data /app
ENV UPLOADS_DIR=/data/uploads PORT=3000 HOST=0.0.0.0
USER node
WORKDIR /app/server
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["../node_modules/.bin/tsx", "src/index.ts"]
