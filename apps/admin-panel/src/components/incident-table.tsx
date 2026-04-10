import type { CSSProperties } from "react";

import type { IncidentSummary } from "../lib/mock-data";
import { badgeStyle, panelStyle, theme } from "../lib/theme";

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse"
};

export const IncidentTable = ({ incidents }: { incidents: IncidentSummary[] }) => (
  <section style={{ ...panelStyle, gridColumn: "1 / -1" }}>
    <h2 style={{ marginTop: 0 }}>Active Incidents</h2>
    <table style={tableStyle}>
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
            <td style={{ padding: "14px 0" }}>{incident.repository}</td>
            <td style={{ padding: "14px 0" }}>
              <span style={badgeStyle(incident.riskTier)}>{incident.riskTier}</span>
            </td>
            <td style={{ padding: "14px 0", color: theme.mutedText }}>{incident.failureType}</td>
            <td style={{ padding: "14px 0", color: theme.mutedText }}>{incident.summary}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);
