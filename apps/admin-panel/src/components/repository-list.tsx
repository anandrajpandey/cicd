import type { ConnectedRepository } from "@packages/db";

import { panelStyle, theme } from "../lib/theme";

export const RepositoryList = ({ repositories }: { repositories: ConnectedRepository[] }) => (
  <section style={{ ...panelStyle, gridColumn: "1 / -1" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
      <div>
        <h2 style={{ margin: "0 0 8px" }}>Connected Repositories</h2>
        <p style={{ margin: 0, color: theme.mutedText, lineHeight: 1.6 }}>
          Repositories visible to the connected GitHub account or installation appear here after sync.
        </p>
      </div>
      <div className="glass-pill">{repositories.length} synced</div>
    </div>
    {repositories.length === 0 ? (
      <p style={{ margin: "18px 0 0", color: theme.mutedText }}>
        No repositories are connected yet. Use the GitHub connect prompt to load a repository list.
      </p>
    ) : (
      <div className="glass-table-wrap" style={{ marginTop: "20px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px" }}>
          <thead>
            <tr style={{ color: theme.mutedText, textAlign: "left" }}>
              <th style={{ paddingBottom: "12px" }}>Repository</th>
              <th style={{ paddingBottom: "12px" }}>Provider</th>
              <th style={{ paddingBottom: "12px" }}>Default Branch</th>
              <th style={{ paddingBottom: "12px" }}>Visibility</th>
              <th style={{ paddingBottom: "12px" }}>Last Synced</th>
            </tr>
          </thead>
          <tbody>
            {repositories.map((repository) => (
              <tr key={repository.id} style={{ borderTop: `1px solid ${theme.border}` }}>
                <td style={{ padding: "16px 0" }}>{repository.fullName}</td>
                <td style={{ padding: "16px 0", color: theme.mutedText }}>{repository.provider}</td>
                <td style={{ padding: "16px 0", color: theme.mutedText }}>{repository.defaultBranch}</td>
                <td style={{ padding: "16px 0", color: theme.mutedText }}>
                  {repository.isPrivate ? "Private" : "Public"}
                </td>
                <td style={{ padding: "16px 0", color: theme.mutedText }}>
                  {new Date(repository.lastSyncedAt).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);
