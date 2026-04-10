import type { CSSProperties } from "react";

export const theme = {
  background: "#081a2d",
  backgroundElevated: "#0d2742",
  backgroundPanel: "#103354",
  border: "#1b4a6b",
  text: "#e6f7ef",
  mutedText: "#97b8ac",
  accent: "#2bd17e",
  accentSoft: "#173f33",
  warning: "#f8c24d",
  danger: "#ff6b6b",
  low: "#2bd17e",
  medium: "#f8c24d",
  high: "#ff6b6b"
} as const;

export const pageShellStyle: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, rgba(43,209,126,0.14), transparent 28%), linear-gradient(180deg, #081a2d 0%, #091f35 100%)",
  color: theme.text,
  fontFamily: "\"Segoe UI\", sans-serif",
  padding: "24px"
};

export const panelStyle: CSSProperties = {
  background: "rgba(16, 51, 84, 0.92)",
  border: `1px solid ${theme.border}`,
  borderRadius: "18px",
  boxShadow: "0 20px 60px rgba(1, 11, 20, 0.35)",
  padding: "20px"
};

export const badgeStyle = (tone: "LOW" | "MEDIUM" | "HIGH"): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  background:
    tone === "LOW"
      ? "rgba(43, 209, 126, 0.16)"
      : tone === "MEDIUM"
        ? "rgba(248, 194, 77, 0.16)"
        : "rgba(255, 107, 107, 0.16)",
  color: tone === "LOW" ? theme.low : tone === "MEDIUM" ? theme.warning : theme.high
});
