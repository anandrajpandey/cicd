import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { buildServer } from "../dist/index.js";
import {
  dispatchAgentFindings,
  enrichPipelineEvent,
  orchestrateIncident,
  routeDecision,
  runDebate
} from "../dist/orchestration.js";

const baseEvent = {
  eventId: "24242424-2424-4242-8242-242424242424",
  sourceTool: "github_actions",
  repository: "acme/api",
  commitSha: "abc123",
  branch: "main",
  failureType: "pipeline_failure",
  rawLogsRef: "https://github.com/acme/api/actions/runs/123",
  metadata: {},
  timestamp: new Date("2026-04-10T15:00:00.000Z")
};

const makeFinding = (agentId, confidence, hypothesis) => ({
  findingId: randomUUID(),
  agentId,
  eventId: baseEvent.eventId,
  hypothesis,
  evidence: [`evidence-from-${agentId}`],
  confidence,
  proposedRemediation: hypothesis,
  createdAt: new Date("2026-04-10T15:01:00.000Z")
});

const makeDependencies = () => {
  const calls = {
    slack: 0,
    pagerDuty: 0,
    githubIssue: 0,
    retry: 0,
    skipPr: 0,
    depPr: 0,
    lintPr: 0,
    published: []
  };

  const agents = {
    build_analyzer: {
      analyze: async () => makeFinding("build_analyzer", 0.2, "Transient pipeline issue."),
      challenge: async () => [],
      rebuttal: async ({ challenge, currentFinding }) => ({
        rebuttalId: randomUUID(),
        respondingAgentId: "build_analyzer",
        challengeId: challenge.challengeId,
        position: "DEFEND",
        updatedConfidence: currentFinding?.confidence ?? 0,
        rebuttalFactor: 0.85
      })
    },
    code_reviewer: {
      analyze: async () => makeFinding("code_reviewer", 0.25, "Lint issue in changed file."),
      challenge: async () => [],
      rebuttal: async ({ challenge, currentFinding }) => ({
        rebuttalId: randomUUID(),
        respondingAgentId: "code_reviewer",
        challengeId: challenge.challengeId,
        position: "DEFEND",
        updatedConfidence: currentFinding?.confidence ?? 0,
        rebuttalFactor: 0.85
      })
    },
    test_analyzer: {
      analyze: async () => makeFinding("test_analyzer", 0.3, "Flaky test failure."),
      challenge: async ({ findings }) => [
        {
          challengeId: randomUUID(),
          challengerAgentId: "test_analyzer",
          targetAgentId: "build_analyzer",
          counterHypothesis: "The test history points to a flaky test, not a build issue.",
          evidence: findings[2]?.evidence ?? ["test-history"],
          confidence: 0.7
        }
      ],
      rebuttal: async ({ challenge, currentFinding }) => ({
        rebuttalId: randomUUID(),
        respondingAgentId: "test_analyzer",
        challengeId: challenge.challengeId,
        position: "DEFEND",
        updatedConfidence: currentFinding?.confidence ?? 0,
        rebuttalFactor: 0.85
      })
    },
    dependency_checker: {
      analyze: async () => makeFinding("dependency_checker", 0.2, "No critical dependency issue."),
      challenge: async () => [],
      rebuttal: async ({ challenge, currentFinding }) => ({
        rebuttalId: randomUUID(),
        respondingAgentId: "dependency_checker",
        challengeId: challenge.challengeId,
        position: "CONCEDE",
        updatedConfidence: currentFinding?.confidence ?? 0,
        rebuttalFactor: 0.7
      })
    }
  };

  const judge = {
    synthesize: async ({ event, findings, rebuttals }) => ({
      decisionId: randomUUID(),
      eventId: event.eventId,
      compositeScore: 0.28,
      riskTier: "LOW",
      reasoning: `Used ${findings.length} findings and ${rebuttals.length} rebuttals.`,
      recommendedAction: "Proceed with automated remediation and record the action in the audit log.",
      agentWeights: {
        build_analyzer: 0.3,
        code_reviewer: 0.25,
        test_analyzer: 0.25,
        dependency_checker: 0.2
      },
      createdAt: new Date("2026-04-10T15:02:00.000Z")
    })
  };

  return {
    calls,
    dependencies: {
      agents,
      judge,
      notifications: {
        sendSlack: async () => {
          calls.slack += 1;
        },
        sendPagerDuty: async () => {
          calls.pagerDuty += 1;
        },
        createGitHubIssue: async () => {
          calls.githubIssue += 1;
        }
      },
      remediation: {
        createSkipPullRequest: async () => {
          calls.skipPr += 1;
          return "skip-pr";
        },
        createDependencyPinPullRequest: async () => {
          calls.depPr += 1;
          return "dependency-pr";
        },
        createLintFixPullRequest: async () => {
          calls.lintPr += 1;
          return "lint-pr";
        },
        retryPipeline: async () => {
          calls.retry += 1;
          return "retry";
        }
      },
      enrichment: {
        fetchGitHubContext: async () => ({
          gitDiff: "diff --git a/package.json b/package.json\n+\"version\": \"1.0.1\"",
          changedFiles: ["package.json"],
          touchedFiles: ["package.json"],
          githubCommitUrl: "https://github.com/acme/api/commit/abc123"
        }),
        fetchJenkinsContext: async () => ({
          jenkinsLogLines: ["Build failed for acme/api", "npm ERR! missing script: build"],
          rawLogExcerpt: "npm ERR! missing script: build"
        })
      },
      publishEvent: async (message) => {
        calls.published.push(message);
      }
    }
  };
};

test("enrichPipelineEvent merges GitHub diff and Jenkins log context", async () => {
  const { dependencies } = makeDependencies();
  const enriched = await enrichPipelineEvent(baseEvent, dependencies.enrichment);

  assert.match(enriched.context.gitDiff, /package\.json/);
  assert.deepEqual(enriched.context.changedFiles, ["package.json"]);
  assert.deepEqual(enriched.context.jenkinsLogLines, [
    "Build failed for acme/api",
    "npm ERR! missing script: build"
  ]);
  assert.equal(enriched.context.githubCommitUrl, "https://github.com/acme/api/commit/abc123");
});

test("dispatchAgentFindings fans out to all four specialist agents", async () => {
  const { dependencies } = makeDependencies();
  const findings = await dispatchAgentFindings(
    {
      ...baseEvent,
      context: {}
    },
    dependencies.agents
  );

  assert.equal(findings.length, 4);
  assert.deepEqual(
    findings.map((finding) => finding.agentId),
    ["build_analyzer", "code_reviewer", "test_analyzer", "dependency_checker"]
  );
});

test("runDebate collects valid challenges and rebuttals", async () => {
  const { dependencies } = makeDependencies();
  const findings = await dispatchAgentFindings(
    {
      ...baseEvent,
      context: {}
    },
    dependencies.agents
  );

  const result = await runDebate(
    {
      ...baseEvent,
      context: {}
    },
    findings,
    dependencies.agents
  );

  assert.equal(result.challenges.length, 1);
  assert.equal(result.rebuttals.length, 1);
});

test("routeDecision auto-remediates LOW risk findings", async () => {
  const { dependencies, calls } = makeDependencies();
  const routing = await routeDecision(
    baseEvent,
    {
      decisionId: randomUUID(),
      eventId: baseEvent.eventId,
      compositeScore: 0.2,
      riskTier: "LOW",
      reasoning: "Low risk.",
      recommendedAction: "Proceed with automated remediation.",
      agentWeights: {
        build_analyzer: 0.3,
        code_reviewer: 0.25,
        test_analyzer: 0.25,
        dependency_checker: 0.2
      },
      createdAt: new Date("2026-04-10T15:03:00.000Z")
    },
    [makeFinding("test_analyzer", 0.4, "Flaky test failure.")],
    dependencies
  );

  assert.equal(routing.mode, "AUTO_REMEDIATE");
  assert.equal(routing.remediationResult, "skip-pr");
  assert.equal(calls.skipPr, 1);
});

test("orchestrateIncident publishes findings and decisions and returns routing output", async () => {
  const { dependencies, calls } = makeDependencies();
  const result = await orchestrateIncident(baseEvent, dependencies);

  assert.equal(result.findings.length, 4);
  assert.equal(result.decision.riskTier, "LOW");
  assert.equal(result.routing.mode, "AUTO_REMEDIATE");
  assert.equal(calls.published.length, 2);
});

test("POST /internal/orchestrate runs the full orchestration flow", async () => {
  const { dependencies } = makeDependencies();
  const app = await buildServer({
    orchestratorDependencies: dependencies
  });

  const response = await app.inject({
    method: "POST",
    url: "/internal/orchestrate",
    payload: baseEvent
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.decision.riskTier, "LOW");
  assert.equal(body.routing.mode, "AUTO_REMEDIATE");

  await app.close();
});
