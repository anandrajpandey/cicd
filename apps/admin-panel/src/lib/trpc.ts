import { initTRPC } from "@trpc/server";
import { z } from "zod";

import {
  getAnalyticsData,
  getApprovalDetailData,
  getApprovalListData,
  getIncidentDetailData,
  getIncidentListData,
  submitApprovalDecision
} from "./data";

const t = initTRPC.create();

export const appRouter = t.router({
  incidents: t.router({
    list: t.procedure
      .input(
        z
          .object({
            repository: z.string().optional(),
            riskTier: z.enum(["LOW", "MEDIUM", "HIGH"]).optional()
          })
          .optional()
      )
      .query(async ({ input }) =>
        (await getIncidentListData()).filter((incident) => {
          const matchesRepository = input?.repository
            ? incident.repository.toLowerCase().includes(input.repository.toLowerCase())
            : true;
          const matchesRisk = input?.riskTier ? incident.riskTier === input.riskTier : true;
          return matchesRepository && matchesRisk;
        })
      ),
    getById: t.procedure.input(z.string()).query(({ input }) => getIncidentDetailData(input))
  }),
  approvals: t.router({
    list: t.procedure.query(() => getApprovalListData()),
    getById: t.procedure.input(z.string()).query(({ input }) => getApprovalDetailData(input)),
    submit: t.procedure
      .input(
        z.object({
          id: z.string(),
          action: z.enum(["APPROVE", "REJECT", "OVERRIDE"]),
          justification: z.string().min(1)
        })
      )
      .mutation(({ input }) => submitApprovalDecision(input))
  }),
  analytics: t.router({
    agentAccuracy: t.procedure.query(async () => (await getAnalyticsData()).agentAccuracy),
    slaCompliance: t.procedure.query(async () => (await getAnalyticsData()).slaCompliance),
    riskDistribution: t.procedure.query(async () => (await getAnalyticsData()).riskDistribution)
  }),
  settings: t.router({
    getRiskThresholds: t.procedure.query(() => ({
      lowMax: 0.35,
      mediumMax: 0.7
    })),
    updateRiskThresholds: t.procedure
      .input(
        z.object({
          lowMax: z.number().min(0).max(1),
          mediumMax: z.number().min(0).max(1)
        })
      )
      .mutation(({ input }) => input)
  })
});

export type AppRouter = typeof appRouter;
