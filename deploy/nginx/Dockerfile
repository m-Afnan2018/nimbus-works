# Gateway image: both frontends as static files + nginx. Build context: repo root.
#
# The Next.js apps are statically exported at build time, so production needs
# no Node process for the UI at all (this stack targets a 512 MB VPS). Build
# the image on a bigger machine; `next build` needs ~1 GB of RAM.

FROM node:20-alpine AS workspace-build
WORKDIR /app
COPY workspace/frontend/package.json workspace/frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY workspace/frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=1024 \
    NEXT_PUBLIC_API_URL=/api \
    NEXT_PUBLIC_SOCKET_URL=/api
ARG NEXT_PUBLIC_DEMO_MODE=true
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
RUN npm run build

FROM node:20-alpine AS finance-build
# Depend on the workspace build so BuildKit runs the two `next build`s one
# after the other instead of in parallel (halves peak RAM on the build host).
COPY --from=workspace-build /app/package.json /tmp/built-after-workspace
WORKDIR /app
COPY finance/client/package.json finance/client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY finance/client/ ./
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=1024
ARG NEXT_PUBLIC_DEMO_MODE=true
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx/gateway.conf /etc/nginx/conf.d/default.conf
COPY --from=workspace-build /app/out /srv/workspace
COPY --from=finance-build /app/out /srv/finance
