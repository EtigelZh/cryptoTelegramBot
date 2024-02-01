FROM node:20-slim as builder
# Choose a workdir
WORKDIR /usr/src/app
# Copy sources
COPY package.json .

COPY nx.json .
COPY tsconfig.base.json .

COPY package-lock.json .
RUN npm ci --legacy-peer-deps

COPY libs /usr/src/app/libs
COPY apps/crypto-investing-bot /usr/src/app/apps/crypto-investing-bot

# Build app
RUN npm run build:crypto-investing-bot

RUN npm prune --production --legacy-peer-deps

FROM node:20-alpine
#ENV NODE_ENV=production
RUN mkdir -p /usr/api

WORKDIR /usr/api

COPY --from=builder /usr/src/app/dist/apps/crypto-investing-bot /usr/api/apps/crypto-investing-bot
COPY --from=builder /usr/src/app/node_modules /usr/api/node_modules

CMD ["sh", "-c", "node ./apps/crypto-investing-bot/main.js"]
EXPOSE 3333
