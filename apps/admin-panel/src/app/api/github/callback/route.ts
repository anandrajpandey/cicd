import { createDatabaseClient, upsertRepositories } from "@packages/db";
import { NextResponse } from "next/server";

import { createGitHubAppJwt, createInstallationAccessToken } from "../../../../lib/github-app";
import { readWorkspaceEnvVar } from "../../../../lib/env";

type GitHubInstallationRepository = {
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  owner: {
    login: string;
  };
};

const buildRedirectUrl = (search: URLSearchParams): URL => {
  const appUrl = process.env.NEXTAUTH_URL ?? readWorkspaceEnvVar("NEXTAUTH_URL") ?? "http://127.0.0.1:3000";
  return new URL(`/repositories?${search.toString()}`, appUrl);
};

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const installationId = url.searchParams.get("installation_id");

  if (!installationId) {
    return NextResponse.redirect(buildRedirectUrl(new URLSearchParams({ error: "missing_installation_id" })));
  }

  const databaseUrl = process.env.DATABASE_URL ?? readWorkspaceEnvVar("DATABASE_URL");

  if (!databaseUrl) {
    return NextResponse.redirect(buildRedirectUrl(new URLSearchParams({ error: "database_not_configured" })));
  }

  try {
    const installationToken = await createInstallationAccessToken(installationId);
    const appJwt = createGitHubAppJwt();
    const [installationResponse, repositoriesResponse] = await Promise.all([
      fetch("https://api.github.com/installation/repositories?per_page=100", {
        headers: {
          authorization: `Bearer ${installationToken}`,
          accept: "application/vnd.github+json",
          "user-agent": "agentic-cicd-admin-panel"
        }
      }),
      fetch(`https://api.github.com/app/installations/${installationId}`, {
        headers: {
          authorization: `Bearer ${appJwt}`,
          accept: "application/vnd.github+json",
          "user-agent": "agentic-cicd-admin-panel"
        }
      })
    ]);

    if (!installationResponse.ok) {
      throw new Error("GitHub installation repositories request failed.");
    }

    const installationPayload = repositoriesResponse.ok ? ((await repositoriesResponse.json()) as { account?: { login?: string } }) : undefined;
    const repositoriesPayload = (await installationResponse.json()) as {
      repositories?: GitHubInstallationRepository[];
    };

    const repositories = repositoriesPayload.repositories ?? [];
    const client = createDatabaseClient(databaseUrl);

    try {
      await upsertRepositories(
        client,
        repositories.map((repository) => ({
          provider: "github",
          owner: repository.owner.login,
          name: repository.name,
          fullName: repository.full_name,
          defaultBranch: repository.default_branch,
          isPrivate: repository.private,
          metadata: {
            htmlUrl: repository.html_url,
            syncedFrom: "github_app_installation",
            installationId
          }
        }))
      );
    } finally {
      await client.sql.end();
    }

    return NextResponse.redirect(
      buildRedirectUrl(
        new URLSearchParams({
          connected: "1",
          synced: String(repositories.length),
          account: installationPayload?.account?.login ?? "github"
        })
      )
    );
  } catch {
    return NextResponse.redirect(buildRedirectUrl(new URLSearchParams({ error: "github_install_sync_failed" })));
  }
};
