import type { CSSProperties } from "react";

import type { IncidentSummary } from "../lib/mock-data";
import { badgeStyle, panelStyle, theme } from "../lib/theme";

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse"
};

export const IncidentTable = ({ incidents }: { incidents: IncidentSummary[] }) => (
  <section style={{ ...panelStyle, gridColumn: "1 / -1" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
      <div>
        <h2 style={{ margin: "0 0 8px" }}>Active Incidents</h2>
        <p style={{ margin: 0, color: theme.mutedText, lineHeight: 1.6 }}>
          Every incident lands against a connected repository once GitHub is linked and syncing.
        </p>
      </div>
      <div className="glass-pill">{incidents.length} active</div>
    </div>
    <div className="glass-table-wrap" style={{ marginTop: "20px" }}>
      <table style={{ ...tableStyle, minWidth: "760px" }}>
        <thead>
          <tr style={{ color: theme.mutedText, textAlign: "left" }}>
            <th style={{ paddingBottom: "12px" }}>Repository</th>
            <th style={{ paddingBottom: "12px" }}>Risk</th>
            <th style={{ paddingBottom: "12px" }}>Failure</th>
            <th style={{ paddingBottom: "12px" }}>Summary</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((incident) => (
            <tr key={incident.id} style={{ borderTop: `1px solid ${theme.border}` }}>
              <td style={{ padding: "16px 0" }}>{incident.repository}</td>
              <td style={{ padding: "16px 0" }}>
                <span style={badgeStyle(incident.riskTier)}>{incident.riskTier}</span>
              </td>
              <td style={{ padding: "16px 0", color: theme.mutedText }}>{incident.failureType}</td>
              <td style={{ padding: "16px 0", color: theme.mutedText }}>{incident.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);
