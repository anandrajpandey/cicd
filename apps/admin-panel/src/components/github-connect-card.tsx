"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { panelStyle, theme } from "../lib/theme";

export const GitHubConnectCard = () => {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("Paste a GitHub personal access token with repo read access to sync repositories.");
  const [isPending, startTransition] = useTransition();

  const connectGitHub = () => {
    startTransition(async () => {
      setMessage("Connecting to GitHub...");

      const response = await fetch("/api/github/connect", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ token })
      });

      const payload = (await response.json()) as { message?: string; syncedCount?: number; accountLogin?: string };

      if (!response.ok) {
        setMessage(payload.message ?? "GitHub sync failed.");
        return;
      }

      setToken("");
      setMessage(`Connected ${payload.accountLogin ?? "GitHub"} and synced ${payload.syncedCount ?? 0} repositories.`);
      router.refresh();
    });
  };

  return (
    <section
      style={{
        ...panelStyle,
        gridColumn: "1 / -1",
        display: "grid",
        gap: "14px"
      }}
    >
      <div>
        <p style={{ margin: "0 0 8px", color: theme.accent, fontSize: "12px", letterSpacing: "0.12em" }}>
          CONNECT GITHUB
        </p>
        <h2 style={{ margin: "0 0 10px", fontSize: "26px" }}>Connect a GitHub account to load repositories</h2>
        <p style={{ margin: 0, color: theme.mutedText, maxWidth: "760px" }}>
          Once connected, the app can show the repositories available to that account and then attach incidents, approvals,
          and health metrics to those repos instead of only showing failures after they happen.
        </p>
      </div>
      <label style={{ display: "grid", gap: "8px", color: theme.mutedText }}>
        GitHub Token
        <input
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="ghp_..."
          style={{
            borderRadius: "12px",
            border: `1px solid ${theme.border}`,
            background: "rgba(8, 26, 45, 0.82)",
            color: theme.text,
            padding: "12px 14px",
            outline: "none"
          }}
        />
      </label>
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={connectGitHub}
          disabled={isPending || token.trim().length === 0}
          style={{
            borderRadius: "999px",
            border: "none",
            padding: "10px 18px",
            background: isPending ? theme.accentSoft : theme.accent,
            color: "#04131f",
            fontWeight: 700,
            cursor: isPending ? "wait" : "pointer"
          }}
        >
          {isPending ? "Syncing..." : "Connect GitHub"}
        </button>
        <span style={{ color: theme.mutedText }}>{message}</span>
      </div>
    </section>
  );
};

