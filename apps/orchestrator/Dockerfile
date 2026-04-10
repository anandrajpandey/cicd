FROM node:22-bookworm-slim

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/orchestrator/package.json apps/orchestrator/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/kafka-client/package.json packages/kafka-client/package.json

RUN corepack enable && corepack pnpm install --frozen-lockfile

COPY apps/orchestrator apps/orchestrator
COPY packages/shared-types packages/shared-types
COPY packages/kafka-client packages/kafka-client

RUN corepack pnpm --filter @packages/shared-types build && \
    corepack pnpm --filter @packages/kafka-client build && \
    corepack pnpm --filter @apps/orchestrator build

EXPOSE 4000

CMD ["node", "apps/orchestrator/dist/index.js"]
