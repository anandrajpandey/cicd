import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import Link from "next/link";

import { panelStyle, pageShellStyle, theme } from "../lib/theme";

const navStyle: CSSProperties = {
  display: "flex",
  gap: "14px",
  flexWrap: "wrap",
  marginBottom: "24px",
  color: theme.mutedText,
  fontSize: "14px"
};

const statGridStyle: CSSProperties = {
  display: "grid",
  gap: "16px",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
};

export const AdminShell = ({
  title,
  subtitle,
  children,
  headerSlot
}: PropsWithChildren<{
  title: string;
  subtitle: string;
  headerSlot?: ReactNode;
}>) => (
  <main style={pageShellStyle}>
    <div style={navStyle}>
      <Link href="/">Dashboard</Link>
      <Link href="/incidents">Incidents</Link>
      <Link href="/approvals">Approvals</Link>
      <Link href="/analytics">Analytics</Link>
      <Link href="/settings">Settings</Link>
    </div>
    <section
      style={{
        ...panelStyle,
        marginBottom: "20px",
        display: "flex",
        justifyContent: "space-between",
        gap: "24px",
        alignItems: "flex-start"
      }}
    >
      <div>
        <p style={{ margin: 0, color: theme.accent, fontSize: "12px", letterSpacing: "0.14em" }}>
          AGENTIC CI/CD CONTROL
        </p>
        <h1 style={{ margin: "8px 0 10px", fontSize: "32px" }}>{title}</h1>
        <p style={{ margin: 0, color: theme.mutedText, maxWidth: "720px" }}>{subtitle}</p>
      </div>
      {headerSlot}
    </section>
    <div style={statGridStyle}>{children}</div>
  </main>
);

export const MetricCard = ({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) => (
  <section style={panelStyle}>
    <p style={{ margin: 0, color: theme.mutedText, fontSize: "12px", letterSpacing: "0.12em" }}>{label}</p>
    <h2 style={{ margin: "10px 0 8px", fontSize: "30px" }}>{value}</h2>
    <p style={{ margin: 0, color: theme.mutedText }}>{detail}</p>
  </section>
);
