import type { CSSProperties, PropsWithChildren, ReactNode } from "react";
import Link from "next/link";

import { pageShellStyle, panelStyle, theme } from "../lib/theme";

const navItems = [
  { href: "/", label: "Dashboard", badge: "01" },
  { href: "/repositories", label: "Repositories", badge: "02" },
  { href: "/incidents", label: "Incidents", badge: "03" },
  { href: "/approvals", label: "Approvals", badge: "04" },
  { href: "/analytics", label: "Analytics", badge: "05" },
  { href: "/settings", label: "Settings", badge: "06" }
];

const headerPanelStyle: CSSProperties = {
  ...panelStyle,
  position: "relative",
  overflow: "hidden"
};

const headerGlowStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "radial-gradient(circle at top right, rgba(71, 245, 160, 0.18), transparent 36%), linear-gradient(135deg, rgba(71, 245, 160, 0.08), transparent 55%)",
  pointerEvents: "none"
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
    <div className="admin-shell">
      <aside className="sidebar-shell">
        <div className="sidebar-inner">
          <div className="sidebar-brand">
            <p className="sidebar-kicker">Agentic CI/CD</p>
            <h1 className="sidebar-title">Control Center</h1>
            <p className="sidebar-subtitle">
              Dark glass operations console for repository health, incident routing, and debate-driven automation.
            </p>
          </div>

          <nav className="mobile-topbar">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="sidebar-link">
                <span className="sidebar-link-label">{item.label}</span>
              </Link>
            ))}
          </nav>

          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="sidebar-link">
                <span className="sidebar-link-label">{item.label}</span>
                <span className="sidebar-link-badge">{item.badge}</span>
              </Link>
            ))}
          </nav>

          <section className="sidebar-status">
            <p className="sidebar-status-label">Live posture</p>
            <div className="sidebar-status-value">Ready</div>
            <p className="sidebar-status-copy">
              Connect GitHub, sync repositories, and let incidents attach to actual repos instead of demo data.
            </p>
          </section>
        </div>
      </aside>

      <div className="content-shell">
        <div className="content-stack">
          <section style={headerPanelStyle}>
            <div style={headerGlowStyle} />
            <div
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                justifyContent: "space-between",
                gap: "24px",
                alignItems: "flex-start",
                flexWrap: "wrap"
              }}
            >
              <div style={{ maxWidth: "780px" }}>
                <div className="glass-pill">Bright green signal mode</div>
                <h2 style={{ margin: "18px 0 12px", fontSize: "40px", lineHeight: 1.02 }}>{title}</h2>
                <p style={{ margin: 0, color: theme.mutedText, fontSize: "16px", lineHeight: 1.7 }}>{subtitle}</p>
              </div>
              {headerSlot}
            </div>
          </section>

          <div className="metric-grid">{children}</div>
        </div>
      </div>
    </div>
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
    <p style={{ margin: 0, color: theme.mutedText, fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase" }}>
      {label}
    </p>
    <h2 style={{ margin: "16px 0 10px", fontSize: "34px", lineHeight: 1 }}>{value}</h2>
    <p style={{ margin: 0, color: theme.mutedText, lineHeight: 1.6 }}>{detail}</p>
  </section>
);
