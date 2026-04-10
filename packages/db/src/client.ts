import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  agentFindingsTable,
  approvalsTable,
  auditLogTable,
  challengesTable,
  decisionsTable,
  pipelineEventsTable,
  repositoriesTable,
  rebuttalsTable
} from "./schema.js";

const schema = {
  pipelineEventsTable,
  agentFindingsTable,
  challengesTable,
  rebuttalsTable,
  decisionsTable,
  approvalsTable,
  auditLogTable,
  repositoriesTable
};

export const createDatabaseClient = (connectionString = process.env.DATABASE_URL) => {
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set to create the database client.");
  }

  const client = postgres(connectionString, {
    max: 1
  });

  return {
    sql: client,
    db: drizzle(client, {
      schema
    })
  };
};

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
