FROM node:22-bookworm-slim

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/agents/build-analyzer/package.json apps/agents/build-analyzer/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/llm-client/package.json packages/llm-client/package.json

RUN corepack enable && corepack pnpm install --frozen-lockfile

COPY apps/agents/build-analyzer apps/agents/build-analyzer
COPY packages/shared-types packages/shared-types
COPY packages/llm-client packages/llm-client

RUN corepack pnpm --filter @packages/shared-types build && \
    corepack pnpm --filter @packages/llm-client build && \
    corepack pnpm --filter @agents/build-analyzer build

EXPOSE 4101

CMD ["node", "apps/agents/build-analyzer/dist/index.js"]
