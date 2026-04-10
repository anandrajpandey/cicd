import "./globals.css";

import type { ReactNode } from "react";

export const metadata = {
  title: "Agentic CI/CD Control Center",
  description: "Dark-blue and green command center for CI/CD incident orchestration."
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en">
    <body>{children}</body>
  </html>
);

export default RootLayout;
