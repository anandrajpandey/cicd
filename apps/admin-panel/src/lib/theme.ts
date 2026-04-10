import type { CSSProperties } from "react";

export const theme = {
  background: "#030712",
  backgroundElevated: "#071321",
  backgroundPanel: "rgba(8, 19, 32, 0.62)",
  backgroundPanelStrong: "rgba(7, 17, 28, 0.82)",
  border: "rgba(78, 255, 166, 0.16)",
  borderStrong: "rgba(78, 255, 166, 0.28)",
  text: "#ecfff4",
  mutedText: "#8eb7a1",
  accent: "#47f5a0",
  accentStrong: "#74ffb7",
  accentSoft: "rgba(71, 245, 160, 0.14)",
  accentGlow: "rgba(71, 245, 160, 0.22)",
  warning: "#ffd44d",
  danger: "#ff7a9a",
  low: "#47f5a0",
  medium: "#ffd44d",
  high: "#ff7a9a"
} as const;

export const pageShellStyle: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(71,245,160,0.2), transparent 22%), radial-gradient(circle at bottom right, rgba(13, 148, 136, 0.18), transparent 28%), linear-gradient(180deg, #02060d 0%, #06111f 42%, #020812 100%)",
  color: theme.text,
  fontFamily: "\"Segoe UI\", sans-serif"
};

export const panelStyle: CSSProperties = {
  background: theme.backgroundPanel,
  border: `1px solid ${theme.border}`,
  borderRadius: "24px",
  boxShadow: "0 24px 80px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  padding: "24px"
};

export const badgeStyle = (tone: "LOW" | "MEDIUM" | "HIGH"): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "7px 12px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  background:
    tone === "LOW"
      ? "rgba(71, 245, 160, 0.14)"
      : tone === "MEDIUM"
        ? "rgba(255, 212, 77, 0.14)"
        : "rgba(255, 122, 154, 0.16)",
  color: tone === "LOW" ? theme.low : tone === "MEDIUM" ? theme.warning : theme.high,
  border: `1px solid ${
    tone === "LOW" ? "rgba(71, 245, 160, 0.22)" : tone === "MEDIUM" ? "rgba(255, 212, 77, 0.2)" : "rgba(255, 122, 154, 0.22)"
  }`
});
