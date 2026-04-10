export type RiskTier = "LOW" | "MEDIUM" | "HIGH";
export type Role = "Admin" | "Approver" | "Viewer";

export type IncidentSummary = {
  id: string;
  repository: string;
  riskTier: RiskTier;
  failureType: string;
  updatedAt: string;
  summary: string;
};

export type ApprovalItem = {
  id: string;
  incidentId: string;
  repository: string;
  riskTier: RiskTier;
  slaMinutesRemaining: number;
};

export const incidents: IncidentSummary[] = [
  {
    id: "inc_001",
    repository: "acme/payments-api",
    riskTier: "HIGH",
    failureType: "dependency_failure",
    updatedAt: "2026-04-10T14:22:00.000Z",
    summary: "A high-CVSS dependency update is directly imported in the changed payment path."
  },
  {
    id: "inc_002",
    repository: "acme/web-portal",
    riskTier: "MEDIUM",
    failureType: "test_failure",
    updatedAt: "2026-04-10T14:40:00.000Z",
    summary: "A new failing checkout test has low changed-line coverage and needs approval."
  },
  {
    id: "inc_003",
    repository: "acme/platform-build",
    riskTier: "LOW",
    failureType: "lint_failure",
    updatedAt: "2026-04-10T14:48:00.000Z",
    summary: "Formatting drift was detected in a low-risk frontend patch."
  }
];

export const approvals: ApprovalItem[] = [
  {
    id: "approval_001",
    incidentId: "inc_001",
    repository: "acme/payments-api",
    riskTier: "HIGH",
    slaMinutesRemaining: 14
  },
  {
    id: "approval_002",
    incidentId: "inc_002",
    repository: "acme/web-portal",
    riskTier: "MEDIUM",
    slaMinutesRemaining: 38
  }
];

export const analyticsSnapshot = {
  healthScore: 83,
  riskDistribution: {
    low: 14,
    medium: 7,
    high: 3
  },
  agentAccuracy: {
    build: 0.82,
    code: 0.76,
    test: 0.8,
    dependency: 0.79
  },
  slaCompliance: 0.93
};
