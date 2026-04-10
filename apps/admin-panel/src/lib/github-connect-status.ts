export type GitHubConnectStatus = {
  tone: "neutral" | "success" | "danger";
  text: string;
};

export const getGitHubConnectStatus = (params: {
  error?: string;
  connected?: string;
  synced?: string;
  account?: string;
}): GitHubConnectStatus => {
  const { error, connected, synced, account } = params;

  if (connected === "1") {
    return {
      tone: "success",
      text: `GitHub connected${account ? ` for ${account}` : ""}. Synced ${synced ?? "0"} repositories.`
    };
  }

  if (error === "github_app_not_configured") {
    return {
      tone: "danger",
      text: "GitHub App install flow is not configured yet. Add GITHUB_APP_SLUG to enable the official GitHub prompt."
    };
  }

  if (error === "github_install_sync_failed") {
    return {
      tone: "danger",
      text: "GitHub authorized the app, but repository sync failed. Check the app callback URL and installation permissions."
    };
  }

  if (error === "missing_installation_id") {
    return {
      tone: "danger",
      text: "GitHub redirected back without an installation id. Re-run the GitHub connect flow."
    };
  }

  return {
    tone: "neutral",
    text: "Use the official GitHub install prompt first. The developer token box stays available as a fallback for local testing."
  };
};
