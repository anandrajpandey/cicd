import { createDatabaseClient, upsertRepositories } from "@packages/db";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createGitHubInstallUrl, hasGitHubAppInstallFlow } from "../../../../lib/github-app";
import { readWorkspaceEnvVar } from "../../../../lib/env";

const requestSchema = z.object({
  token: z.string().min(1)
});

type GitHubRepository = {
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  default_branch: string;
  private: boolean;
  html_url: string;
};

export const POST = async (request: Request) => {
  const body = requestSchema.parse(await request.json());
  const databaseUrl = process.env.DATABASE_URL ?? readWorkspaceEnvVar("DATABASE_URL");

  if (!databaseUrl) {
    return NextResponse.json({ message: "DATABASE_URL is not configured." }, { status: 500 });
  }

  const headers = {
    authorization: `Bearer ${body.token}`,
    accept: "application/vnd.github+json",
    "user-agent": "agentic-cicd-admin-panel"
  };

  const [profileResponse, reposResponse] = await Promise.all([
    fetch("https://api.github.com/user", { headers }),
    fetch("https://api.github.com/user/repos?per_page=100&sort=updated", { headers })
  ]);

  if (!profileResponse.ok || !reposResponse.ok) {
    return NextResponse.json(
      { message: "GitHub rejected the token or repository read request." },
      { status: 401 }
    );
  }

  const profile = (await profileResponse.json()) as { login?: string };
  const repos = (await reposResponse.json()) as GitHubRepository[];

  const client = createDatabaseClient(databaseUrl);

  try {
    await upsertRepositories(
      client,
      repos.map((repository) => ({
        provider: "github",
        owner: repository.owner.login,
        name: repository.name,
        fullName: repository.full_name,
        defaultBranch: repository.default_branch,
        isPrivate: repository.private,
        metadata: {
          htmlUrl: repository.html_url,
          syncedFrom: "personal_access_token"
        }
      }))
    );
  } finally {
    await client.sql.end();
  }

  return NextResponse.json({
    accountLogin: profile.login ?? "GitHub",
    syncedCount: repos.length
  });
};

export const GET = async () => {
  const appUrl = process.env.NEXTAUTH_URL ?? readWorkspaceEnvVar("NEXTAUTH_URL") ?? "http://127.0.0.1:3000";

  if (!hasGitHubAppInstallFlow()) {
    return NextResponse.redirect(new URL("/repositories?error=github_app_not_configured", appUrl));
  }

  return NextResponse.redirect(createGitHubInstallUrl());
};
