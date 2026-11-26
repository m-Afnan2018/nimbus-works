FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 5000
CMD ["node", "dist/index.js"]
