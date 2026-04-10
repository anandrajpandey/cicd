FROM node:22-bookworm-slim

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/agents/code-reviewer/package.json apps/agents/code-reviewer/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/llm-client/package.json packages/llm-client/package.json

RUN corepack enable && corepack pnpm install --frozen-lockfile

COPY apps/agents/code-reviewer apps/agents/code-reviewer
COPY packages/shared-types packages/shared-types
COPY packages/llm-client packages/llm-client

RUN corepack pnpm --filter @packages/shared-types build && \
    corepack pnpm --filter @packages/llm-client build && \
    corepack pnpm --filter @agents/code-reviewer build

EXPOSE 4102

CMD ["node", "apps/agents/code-reviewer/dist/index.js"]
