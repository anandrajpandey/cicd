FROM node:22-bookworm-slim

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/admin-panel/package.json apps/admin-panel/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN corepack enable && corepack pnpm install --frozen-lockfile

COPY apps/admin-panel apps/admin-panel
COPY packages/shared-types packages/shared-types

RUN corepack pnpm --filter @packages/shared-types build && \
    corepack pnpm --filter @apps/admin-panel build

EXPOSE 3000

CMD ["node", "apps/admin-panel/dist/index.js"]
