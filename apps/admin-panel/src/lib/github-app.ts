import { createSign, randomUUID } from "node:crypto";

import { readWorkspaceEnvVar } from "./env";

const base64UrlEncode = (value: string): string =>
  Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const normalizePrivateKey = (privateKey: string): string =>
  privateKey.replace(/^"(.*)"$/s, "$1").replace(/\\n/g, "\n");

export const readGitHubAppConfig = () => {
  const appId = process.env.GITHUB_APP_ID ?? readWorkspaceEnvVar("GITHUB_APP_ID");
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY ?? readWorkspaceEnvVar("GITHUB_APP_PRIVATE_KEY");
  const appSlug = process.env.GITHUB_APP_SLUG ?? readWorkspaceEnvVar("GITHUB_APP_SLUG");
  const appUrl = process.env.NEXTAUTH_URL ?? readWorkspaceEnvVar("NEXTAUTH_URL") ?? "http://127.0.0.1:3000";

  return {
    appId,
    privateKey: privateKey ? normalizePrivateKey(privateKey) : undefined,
    appSlug,
    appUrl
  };
};

export const hasGitHubAppInstallFlow = (): boolean => {
  const config = readGitHubAppConfig();
  return Boolean(config.appId && config.privateKey && config.appSlug);
};

export const createGitHubAppJwt = (): string => {
  const config = readGitHubAppConfig();

  if (!config.appId || !config.privateKey) {
    throw new Error("GitHub App credentials are not fully configured.");
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iat: nowInSeconds - 60,
      exp: nowInSeconds + 9 * 60,
      iss: config.appId
    })
  );
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");

  signer.update(unsignedToken);
  signer.end();

  const signature = signer
    .sign(config.privateKey, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${unsignedToken}.${signature}`;
};

export const createGitHubInstallUrl = (): string => {
  const config = readGitHubAppConfig();

  if (!config.appSlug) {
    throw new Error("GITHUB_APP_SLUG is not configured.");
  }

  return `https://github.com/apps/${config.appSlug}/installations/new?state=${randomUUID()}`;
};

export const createInstallationAccessToken = async (installationId: string): Promise<string> => {
  const jwt = createGitHubAppJwt();
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${jwt}`,
      accept: "application/vnd.github+json",
      "user-agent": "agentic-cicd-admin-panel"
    }
  });

  if (!response.ok) {
    throw new Error("GitHub installation token request failed.");
  }

  const payload = (await response.json()) as { token?: string };

  if (!payload.token) {
    throw new Error("GitHub installation token response did not contain a token.");
  }

  return payload.token;
};
