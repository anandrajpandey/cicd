import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeDependencies,
  buildServer,
  createDependencyCheckerAdkAgent,
  createDependencyRebuttal,
  issueChallenges,
  scoreDependencyConfidence
} from "../dist/index.js";

const eventId = "12121212-1212-4121-8121-121212121212";

const makeEvent = (overrides = {}) => ({
  eventId,
  sourceTool: "github_actions",
  repository: "acme/api",
  commitSha: "abc123",
  branch: "main",
  failureType: "dependency_failure",
  rawLogsRef: "https://github.com/acme/api/actions/runs/100",
  metadata: {},
  timestamp: new Date("2026-04-10T13:00:00.000Z"),
  context: {
    manifestContents: "",
    dependencies: [],
    changedFiles: []
  },
  ...overrides
});

test("createDependencyCheckerAdkAgent exposes the dependency checker runtime", async () => {
  const agent = createDependencyCheckerAdkAgent();

  assert.equal(agent.name, "dependency_checker");
  assert.ok(agent.runtime);
});

test("scoreDependencyConfidence applies CVSS and direct-import boosters", async () => {
  const score = scoreDependencyConfidence(
    makeEvent({
      context: {
        dependencies: [
          {
            name: "lodash",
            version: "4.17.20",
            cvssScore: 8.1,
            directlyImportedInChangedFiles: true
          }
        ]
      }
    }),
    {
      type: "critical_vulnerability",
      evidence: ["lodash@4.17.20 cvss=8.1"],
      hypothesis: "Critical dependency issue.",
      remediation: "Upgrade package.",
      baseConfidence: 0.62
    }
  );

  assert.equal(score, 1);
});

test("analyzeDependencies detects critical vulnerable dependencies", async () => {
  const finding = await analyzeDependencies(
    makeEvent({
      context: {
        dependencies: [
          {
            name: "axios",
            version: "0.27.0",
            cvssScore: 7.5,
            vulnerable: true,
            directlyImportedInChangedFiles: true
          }
        ]
      }
    })
  );

  assert.equal(finding.agentId, "dependency_checker");
  assert.match(finding.hypothesis, /dependency|vulnerab|package/i);
  assert.ok(finding.confidence >= 0.92);
});

test("issueChallenges challenges weaker non-dependency findings", async () => {
  const findings = [
    {
      findingId: "13131313-1313-4131-8131-131313131313",
      agentId: "dependency_checker",
      eventId,
      hypothesis: "A dependency is vulnerable.",
      evidence: ["axios@0.27.0 cvss=7.5"],
      confidence: 0.9,
      proposedRemediation: "Upgrade axios.",
      createdAt: new Date("2026-04-10T13:01:00.000Z")
    },
    {
      findingId: "14141414-1414-4141-8141-141414141414",
      agentId: "test_analyzer",
      eventId,
      hypothesis: "The suite is flaky.",
      evidence: ["test failed twice"],
      confidence: 0.4,
      proposedRemediation: "Retry tests.",
      createdAt: new Date("2026-04-10T13:02:00.000Z")
    }
  ];

  const challenges = await issueChallenges({
    event: makeEvent(),
    findings
  });

  assert.equal(challenges.length, 1);
  assert.equal(challenges[0].challengerAgentId, "dependency_checker");
  assert.equal(challenges[0].targetAgentId, "test_analyzer");
});

test("createDependencyRebuttal defends dependency-specific challenges", async () => {
  const rebuttal = await createDependencyRebuttal({
    event: makeEvent(),
    challenge: {
      challengeId: "15151515-1515-4151-8151-151515151515",
      challengerAgentId: "code_reviewer",
      targetAgentId: "dependency_checker",
      counterHypothesis: "The manifest still shows a dependency CVE with a high CVSS score.",
      evidence: ["axios@0.27.0 cvss=7.5"],
      confidence: 0.7
    },
    currentFinding: {
      findingId: "16161616-1616-4161-8161-161616161616",
      agentId: "dependency_checker",
      eventId,
      hypothesis: "High-risk dependency issue.",
      evidence: ["axios@0.27.0 cvss=7.5"],
      confidence: 0.78,
      proposedRemediation: "Upgrade axios.",
      createdAt: new Date("2026-04-10T13:03:00.000Z")
    }
  });

  assert.equal(rebuttal.position, "DEFEND");
  assert.equal(rebuttal.rebuttalFactor, 0.85);
});

test("POST /analyze returns a structured dependency finding", async () => {
  const app = await buildServer();

  const response = await app.inject({
    method: "POST",
    url: "/analyze",
    payload: makeEvent({
      context: {
        dependencies: [
          {
            name: "axios",
            version: "0.27.0",
            cvssScore: 7.5,
            vulnerable: true,
            directlyImportedInChangedFiles: true
          }
        ]
      }
    })
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.agentId, "dependency_checker");
  assert.ok(body.confidence >= 0.9);

  await app.close();
});
