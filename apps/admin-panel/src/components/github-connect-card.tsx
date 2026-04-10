"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { GitHubConnectStatus } from "../lib/github-connect-status";
import { getGitHubConnectStatus } from "../lib/github-connect-status";
import { panelStyle, theme } from "../lib/theme";

export const GitHubConnectCard = ({ status = getGitHubConnectStatus({}) }: { status?: GitHubConnectStatus }) => {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [manualMessage, setManualMessage] = useState("Developer fallback: paste a GitHub token only if you are testing locally.");
  const [isPending, startTransition] = useTransition();

  const connectGitHubWithToken = () => {
    startTransition(async () => {
      setManualMessage("Syncing repositories from the developer token...");

      const response = await fetch("/api/github/connect", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ token })
      });

      const payload = (await response.json()) as { message?: string; syncedCount?: number; accountLogin?: string };

      if (!response.ok) {
        setManualMessage(payload.message ?? "GitHub sync failed.");
        return;
      }

      setToken("");
      setManualMessage(`Connected ${payload.accountLogin ?? "GitHub"} and synced ${payload.syncedCount ?? 0} repositories.`);
      router.refresh();
    });
  };

  return (
    <section style={{ ...panelStyle, gridColumn: "1 / -1" }}>
      <div className="connect-grid">
        <div className="stack-md">
          <div>
            <div className="glass-pill">Official GitHub connection</div>
            <h2 style={{ margin: "18px 0 12px", fontSize: "30px", lineHeight: 1.06 }}>
              Connect with GitHub and load repositories through the real consent prompt
            </h2>
            <p className="connect-helper" style={{ margin: 0 }}>
              The primary flow now opens GitHub&apos;s own installation screen so a user can approve repository access the
              same way they would on a production SaaS app.
            </p>
          </div>

          <div className="connect-benefits">
            <div className="connect-benefit">
              <h3>Install once, sync many repos</h3>
              <p>The app can load the repositories that the connected GitHub installation actually has access to.</p>
            </div>
            <div className="connect-benefit">
              <h3>Incidents attach to real repositories</h3>
              <p>Failures stop looking anonymous because repository health, approvals, and analytics stay tied to known repos.</p>
            </div>
            <div className="connect-benefit">
              <h3>Developer fallback stays available</h3>
              <p>If you are testing locally and the GitHub App install flow is not configured yet, a manual token sync still works.</p>
            </div>
          </div>
        </div>

        <div className="stack-md">
          <section
            style={{
              borderRadius: "22px",
              border: `1px solid ${status.tone === "danger" ? "rgba(255, 122, 154, 0.24)" : theme.border}`,
              background: status.tone === "success" ? "rgba(71, 245, 160, 0.08)" : "rgba(255, 255, 255, 0.03)",
              padding: "18px"
            }}
          >
            <p
              style={{
                margin: 0,
                color:
                  status.tone === "success" ? theme.accentStrong : status.tone === "danger" ? theme.danger : theme.mutedText,
                lineHeight: 1.7
              }}
            >
              {status.text}
            </p>
          </section>

          <div className="stack-sm">
            <Link href="/api/github/connect" className="glow-button">
              Connect with GitHub
            </Link>
            <p className="connect-helper" style={{ margin: 0 }}>
              You&apos;ll be redirected to GitHub to review access and install the app, then sent back here with synced repos.
            </p>
          </div>

          <details
            style={{
              borderRadius: "22px",
              border: `1px solid ${theme.border}`,
              background: "rgba(255, 255, 255, 0.025)",
              padding: "18px"
            }}
          >
            <summary style={{ cursor: "pointer", color: theme.accentStrong, fontWeight: 700 }}>
              Use developer token fallback
            </summary>
            <div className="stack-md" style={{ marginTop: "16px" }}>
              <label className="field-label">
                GitHub token
                <input
                  className="field-input"
                  type="password"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="ghp_..."
                />
              </label>
              <div className="stack-sm">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={connectGitHubWithToken}
                  disabled={isPending || token.trim().length === 0}
                  style={{
                    opacity: isPending || token.trim().length === 0 ? 0.6 : 1,
                    cursor: isPending || token.trim().length === 0 ? "not-allowed" : "pointer"
                  }}
                >
                  {isPending ? "Syncing..." : "Sync with developer token"}
                </button>
                <p className="connect-helper" style={{ margin: 0 }}>
                  {manualMessage}
                </p>
              </div>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
};
