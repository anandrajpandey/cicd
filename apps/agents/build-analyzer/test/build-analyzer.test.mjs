import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeBuildFailure,
  buildServer,
  createBuildAnalyzerAdkAgent,
  createBuildRebuttal,
  issueChallenges,
  scoreBuildConfidence
} from "../dist/index.js";

const eventId = "11111111-1111-4111-8111-111111111111";

const makeEvent = (overrides = {}) => ({
  eventId,
  sourceTool: "jenkins",
  repository: "acme/api",
  commitSha: "abc123",
  branch: "main",
  failureType: "build_failure",
  rawLogsRef: "https://jenkins.local/job/acme-api/10/console",
  metadata: {},
  timestamp: new Date("2026-04-10T10:00:00.000Z"),
  context: {
    jenkinsLogLines: [],
    touchedFiles: [],
    recentBuildFailureMatches: 0
  },
  ...overrides
});

test("createBuildAnalyzerAdkAgent exposes the build analyzer runtime", async () => {
  const agent = createBuildAnalyzerAdkAgent();

  assert.equal(agent.name, "build_analyzer");
  assert.ok(agent.runtime);
});

test("scoreBuildConfidence applies both confidence boosters", async () => {
  const event = makeEvent({
    context: {
      jenkinsLogLines: ["Unsupported engine: wanted node >= 22"],
      touchedFiles: ["package.json", "Dockerfile"],
      recentBuildFailureMatches: 2
    }
  });

  const score = scoreBuildConfidence(event, {
    type: "version_mismatch",
    evidence: ["Unsupported engine: wanted node >= 22"],
    hypothesis: "Wrong node version.",
    remediation: "Update the CI node version.",
    baseConfidence: 0.66
  });

  assert.equal(score, 0.91);
});

test("analyzeBuildFailure detects missing dependency failures", async () => {
  const finding = await analyzeBuildFailure(
    makeEvent({
      context: {
        jenkinsLogLines: [
          "npm ERR! code E404",
          "npm ERR! 404 Not Found - GET https://registry.npmjs.org/acme-private-lib"
        ],
        touchedFiles: ["package.json"],
        recentBuildFailureMatches: 1
      }
    })
  );

  assert.equal(finding.agentId, "build_analyzer");
  assert.match(finding.hypothesis, /build|dependency/i);
  assert.ok(finding.confidence >= 0.87);
});

test("issueChallenges challenges weaker non-build findings", async () => {
  const findings = [
    {
      findingId: "22222222-2222-4222-8222-222222222222",
      agentId: "build_analyzer",
      eventId,
      hypothesis: "The build tooling is broken.",
      evidence: ["npm ERR! code E404"],
      confidence: 0.9,
      proposedRemediation: "Pin the package version.",
      createdAt: new Date("2026-04-10T10:01:00.000Z")
    },
    {
      findingId: "33333333-3333-4333-8333-333333333333",
      agentId: "test_analyzer",
      eventId,
      hypothesis: "The tests are flaky.",
      evidence: ["Test failed once."],
      confidence: 0.4,
      proposedRemediation: "Retry the suite.",
      createdAt: new Date("2026-04-10T10:02:00.000Z")
    }
  ];

  const challenges = await issueChallenges({
    event: makeEvent(),
    findings
  });

  assert.equal(challenges.length, 1);
  assert.equal(challenges[0].challengerAgentId, "build_analyzer");
  assert.equal(challenges[0].targetAgentId, "test_analyzer");
  assert.ok(challenges[0].evidence.length > 0);
});

test("createBuildRebuttal defends build-specific challenges", async () => {
  const rebuttal = await createBuildRebuttal({
    event: makeEvent(),
    challenge: {
      challengeId: "44444444-4444-4444-8444-444444444444",
      challengerAgentId: "code_reviewer",
      targetAgentId: "build_analyzer",
      counterHypothesis: "The build log still points to a Docker build failure.",
      evidence: ["executor failed running"],
      confidence: 0.7
    },
    currentFinding: {
      findingId: "55555555-5555-4555-8555-555555555555",
      agentId: "build_analyzer",
      eventId,
      hypothesis: "Docker build step failed.",
      evidence: ["executor failed running"],
      confidence: 0.8,
      proposedRemediation: "Fix the Docker layer.",
      createdAt: new Date("2026-04-10T10:03:00.000Z")
    }
  });

  assert.equal(rebuttal.position, "DEFEND");
  assert.equal(rebuttal.rebuttalFactor, 0.85);
});

test("POST /analyze returns a structured finding", async () => {
  const app = await buildServer();

  const response = await app.inject({
    method: "POST",
    url: "/analyze",
    payload: makeEvent({
      context: {
        jenkinsLogLines: ["Missing required environment variable AWS_ACCESS_KEY_ID"],
        touchedFiles: ["Jenkinsfile"],
        recentBuildFailureMatches: 1
      }
    })
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.agentId, "build_analyzer");
  assert.ok(body.confidence >= 0.9);

  await app.close();
});
