FROM node:22-alpine

WORKDIR /app

# Instala dependencias primero para aprovechar la caché de Docker.
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

# Ejecutar como usuario sin privilegios.
USER node

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "src/index.js"]
