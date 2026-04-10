import {
  createDatabaseClient,
  getAnalyticsSnapshot,
  getApprovalById,
  getIncidentById,
  listApprovals,
  listIncidents,
  type AnalyticsSnapshot,
  type ApprovalDetail,
  type ApprovalListItem,
  type IncidentDetail,
  type IncidentListItem
} from "@packages/db";

import { analyticsSnapshot, approvals, incidents } from "./mock-data";

const withDatabase = async <T>(query: (client: ReturnType<typeof createDatabaseClient>) => Promise<T>): Promise<T | null> => {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    const client = createDatabaseClient(process.env.DATABASE_URL);

    try {
      return await query(client);
    } finally {
      await client.sql.end();
    }
  } catch {
    return null;
  }
};

export const getIncidentListData = async (): Promise<IncidentListItem[]> =>
  (await withDatabase((client) => listIncidents(client))) ?? incidents;

export const getIncidentDetailData = async (id: string): Promise<IncidentDetail | null> => {
  const databaseResult = await withDatabase((client) => getIncidentById(client, id));

  if (databaseResult) {
    return databaseResult;
  }

  const incident = incidents.find((entry) => entry.id === id) ?? incidents[0];

  if (!incident) {
    return null;
  }

  return {
    ...incident,
    commitSha: "unknown",
    branch: "main",
    rawLogsRef: "n/a",
    findings: [],
    decision: {
      compositeScore: incident.riskTier === "HIGH" ? 0.82 : incident.riskTier === "MEDIUM" ? 0.51 : 0.18,
      reasoning: incident.summary,
      recommendedAction: "Review in control center"
    }
  };
};

export const getApprovalListData = async (): Promise<ApprovalListItem[]> =>
  (await withDatabase((client) => listApprovals(client))) ?? approvals;

export const getApprovalDetailData = async (id: string): Promise<ApprovalDetail | null> => {
  const databaseResult = await withDatabase((client) => getApprovalById(client, id));

  if (databaseResult) {
    return databaseResult;
  }

  const approval = approvals.find((entry) => entry.id === id) ?? approvals[0];

  if (!approval) {
    return null;
  }

  return {
    ...approval,
    decisionReasoning: "Human approval is required before the selected remediation can proceed.",
    recommendedAction: "Approve or reject the proposed remediation."
  };
};

export const getAnalyticsData = async (): Promise<AnalyticsSnapshot> =>
  (await withDatabase((client) => getAnalyticsSnapshot(client))) ?? analyticsSnapshot;

export const submitApprovalDecision = async (input: {
  id: string;
  action: "APPROVE" | "REJECT" | "OVERRIDE";
  justification: string;
}): Promise<{ approvalId: string; status: string; justification: string }> => {
  return {
    approvalId: input.id,
    status: input.action,
    justification: input.justification
  };
};
