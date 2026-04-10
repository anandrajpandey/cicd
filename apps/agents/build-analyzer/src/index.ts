import { fileURLToPath } from "node:url";

import { buildServer } from "./server.js";

export { createBuildAnalyzerAdkAgent } from "./adk.js";
export { buildServer } from "./server.js";
export {
  analyzeBuildFailure,
  createBuildRebuttal,
  issueChallenges,
  scoreBuildConfidence
} from "./service.js";
export {
  challengeRequestSchema,
  createTimeoutFinding,
  enrichedPipelineEventSchema,
  rebuttalRequestSchema
} from "./schemas.js";

export const buildAnalyzerAgentName = "build-analyzer";

const main = async () => {
  const app = await buildServer();

  try {
    const port = Number.parseInt(process.env.PORT ?? "4101", 10);
    await app.listen({
      port,
      host: "0.0.0.0"
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  void main();
}
