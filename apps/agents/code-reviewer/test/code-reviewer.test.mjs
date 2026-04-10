import test from "node:test";
import assert from "node:assert/strict";

import {
  analyzeCodeReview,
  buildServer,
  createCodeReviewerAdkAgent,
  createCodeRebuttal,
  issueChallenges,
  scoreCodeConfidence
} from "../dist/index.js";

const eventId = "66666666-6666-4666-8666-666666666666";

const makeEvent = (overrides = {}) => ({
  eventId,
  sourceTool: "github_actions",
  repository: "acme/api",
  commitSha: "abc123",
  branch: "main",
  failureType: "lint_failure",
  rawLogsRef: "https://github.com/acme/api/actions/runs/12",
  metadata: {},
  timestamp: new Date("2026-04-10T11:00:00.000Z"),
  context: {
    gitDiff: "",
    changedFiles: [],
    suspiciousPatterns: []
  },
  ...overrides
});

test("createCodeReviewerAdkAgent exposes the code reviewer runtime", async () => {
  const agent = createCodeReviewerAdkAgent();

  assert.equal(agent.name, "code_reviewer");
  assert.ok(agent.runtime);
});

test("scoreCodeConfidence applies auth/payment and CVSS boosters", async () => {
  const score = scoreCodeConfidence(
    makeEvent({
      context: {
        gitDiff: "+ const token = input.token",
        changedFiles: ["src/auth/session.ts"],
        linkedCvssScore: 8.2
      }
    }),
    {
      type: "security_antipattern",
      evidence: ["+ eval(userInput)"],
      hypothesis: "Unsafe code added.",
      remediation: "Remove eval.",
      baseConfidence: 0.6
    }
  );

  assert.equal(score, 1);
});

test("analyzeCodeReview detects security anti-patterns in the diff", async () => {
  const finding = await analyzeCodeReview(
    makeEvent({
      context: {
        gitDiff: [
          "+ const password = 'hardcoded-secret';",
          "+ const html = userInput; element.innerHTML = html;"
        ].join("\n"),
        changedFiles: ["src/auth/login.ts"]
      }
    })
  );

  assert.equal(finding.agentId, "code_reviewer");
  assert.match(finding.hypothesis, /security|unsafe|code/i);
  assert.ok(finding.confidence >= 0.8);
});

test("issueChallenges challenges weaker non-code findings", async () => {
  const findings = [
    {
      findingId: "77777777-7777-4777-8777-777777777777",
      agentId: "code_reviewer",
      eventId,
      hypothesis: "The diff introduced a risky auth change.",
      evidence: ["+ eval(userInput)"],
      confidence: 0.85,
      proposedRemediation: "Remove eval.",
      createdAt: new Date("2026-04-10T11:01:00.000Z")
    },
    {
      findingId: "88888888-8888-4888-8888-888888888888",
      agentId: "build_analyzer",
      eventId,
      hypothesis: "The build image is wrong.",
      evidence: ["docker build failed"],
      confidence: 0.4,
      proposedRemediation: "Retry.",
      createdAt: new Date("2026-04-10T11:02:00.000Z")
    }
  ];

  const challenges = await issueChallenges({
    event: makeEvent(),
    findings
  });

  assert.equal(challenges.length, 1);
  assert.equal(challenges[0].challengerAgentId, "code_reviewer");
  assert.equal(challenges[0].targetAgentId, "build_analyzer");
});

test("createCodeRebuttal defends code-specific challenges", async () => {
  const rebuttal = await createCodeRebuttal({
    event: makeEvent(),
    challenge: {
      challengeId: "99999999-9999-4999-8999-999999999999",
      challengerAgentId: "test_analyzer",
      targetAgentId: "code_reviewer",
      counterHypothesis: "The code diff still contains a security regression in auth.",
      evidence: ["+ eval(userInput)"],
      confidence: 0.7
    },
    currentFinding: {
      findingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      agentId: "code_reviewer",
      eventId,
      hypothesis: "Unsafe auth diff.",
      evidence: ["+ eval(userInput)"],
      confidence: 0.78,
      proposedRemediation: "Remove eval.",
      createdAt: new Date("2026-04-10T11:03:00.000Z")
    }
  });

  assert.equal(rebuttal.position, "DEFEND");
  assert.equal(rebuttal.rebuttalFactor, 0.85);
});

test("POST /analyze returns a structured code-review finding", async () => {
  const app = await buildServer();

  const response = await app.inject({
    method: "POST",
    url: "/analyze",
    payload: makeEvent({
      context: {
        gitDiff: "+ const html = userInput; element.innerHTML = html;",
        changedFiles: ["src/payment/checkout.ts"]
      }
    })
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.agentId, "code_reviewer");
  assert.ok(body.confidence >= 0.8);

  await app.close();
});
