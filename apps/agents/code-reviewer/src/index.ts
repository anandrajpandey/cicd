import { fileURLToPath } from "node:url";

import { buildServer } from "./server.js";

export { createCodeReviewerAdkAgent } from "./adk.js";
export { buildServer } from "./server.js";
export {
  analyzeCodeReview,
  createCodeRebuttal,
  issueChallenges,
  scoreCodeConfidence
} from "./service.js";
export {
  challengeRequestSchema,
  createTimeoutFinding,
  enrichedPipelineEventSchema,
  rebuttalRequestSchema
} from "./schemas.js";

export const codeReviewerAgentName = "code-reviewer";

const main = async () => {
  const app = await buildServer();

  try {
    const port = Number.parseInt(process.env.PORT ?? "4102", 10);
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
