import { randomUUID } from "node:crypto";

import { createDatabaseClient } from "./client.js";
import { pipelineEventsTable } from "./schema.js";

const sampleEvents = [
  {
    eventId: randomUUID(),
    sourceTool: "jenkins",
    repository: "acme/platform-api",
    commitSha: "8f4c3b1",
    branch: "main",
    failureType: "build_failure",
    rawLogsRef: "https://jenkins.local/job/platform-api/421/console",
    metadata: {
      pipelineId: "platform-api-main",
      buildNumber: 421
    },
    timestamp: new Date("2026-04-10T08:15:00.000Z")
  },
  {
    eventId: randomUUID(),
    sourceTool: "github_actions",
    repository: "acme/web-portal",
    commitSha: "2c9da61",
    branch: "release/2026.04",
    failureType: "test_failure",
    rawLogsRef: "s3://agentic-cicd/logs/web-portal/8932",
    metadata: {
      workflowRunId: 8932,
      suite: "e2e"
    },
    timestamp: new Date("2026-04-10T09:45:00.000Z")
  },
  {
    eventId: randomUUID(),
    sourceTool: "cloudwatch",
    repository: "acme/payments-service",
    commitSha: "d11ab52",
    branch: "main",
    failureType: "runtime_anomaly",
    rawLogsRef: "arn:aws:logs:ap-south-1:111111111111:log-group:/ecs/payments-service",
    metadata: {
      alarmName: "payments-5xx-spike",
      severity: "high"
    },
    timestamp: new Date("2026-04-10T10:30:00.000Z")
  }
];

const main = async () => {
  const { db, sql } = createDatabaseClient();

  try {
    await db.insert(pipelineEventsTable).values(sampleEvents);
    console.log(`Seeded ${sampleEvents.length} pipeline events.`);
  } finally {
    await sql.end();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
