# Demo reset job: contains both compiled backends' seed scripts. run.sh sleeps
# in a shell and starts Node only to wipe + re-seed (daily, and on first boot).
# Build context: repository root.

FROM node:20-alpine AS build
WORKDIR /src
COPY workspace/backend/package*.json workspace/backend/
COPY finance/server/package*.json finance/server/
RUN npm ci --prefix workspace/backend && npm ci --prefix finance/server
COPY workspace/backend/tsconfig.json workspace/backend/
COPY workspace/backend/src workspace/backend/src
COPY finance/server/tsconfig.json finance/server/
COPY finance/server/src finance/server/src
RUN npm run build --prefix workspace/backend && npm run build --prefix finance/server \
 && npm prune --omit=dev --prefix workspace/backend && npm prune --omit=dev --prefix finance/server

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /src/workspace/backend/node_modules workspace/node_modules
COPY --from=build /src/workspace/backend/dist workspace/dist
COPY --from=build /src/finance/server/node_modules finance/node_modules
COPY --from=build /src/finance/server/dist finance/dist
COPY deploy/reset/scheduler.js deploy/reset/run.sh ./
USER node
CMD ["sh", "run.sh"]
