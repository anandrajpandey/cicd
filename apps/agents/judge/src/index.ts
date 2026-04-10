import { fileURLToPath } from "node:url";

import { buildServer } from "./server.js";

export { createJudgeAdkAgent } from "./adk.js";
export { buildServer } from "./server.js";
export { createDecision, judgeWeightsSchema, synthesizeRequestSchema } from "./schemas.js";
export {
  classifyRiskTier,
  computeCompositeScore,
  getRebuttalFactorForFinding,
  recommendedActionForRisk,
  synthesizeDecision
} from "./service.js";

export const judgeAgentName = "judge";

const main = async () => {
  const app = await buildServer();

  try {
    const port = Number.parseInt(process.env.PORT ?? "4105", 10);
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
