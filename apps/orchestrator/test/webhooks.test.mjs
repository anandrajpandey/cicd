import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { buildServer } from "../dist/index.js";

const githubSecret = "github-secret";
const jenkinsSecret = "jenkins-secret";

const sign = (body, secret) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

test("POST /webhook/github normalizes and publishes a valid workflow event", async () => {
  process.env.GITHUB_WEBHOOK_SECRET = githubSecret;
  const published = [];
  const app = await buildServer({
    publishEvent: async (event) => {
      published.push(event);
    }
  });

  const payload = {
    action: "completed",
    repository: {
      full_name: "acme/api"
    },
    workflow_run: {
      id: 42,
      head_sha: "abc123",
      head_branch: "main",
      html_url: "https://github.com/acme/api/actions/runs/42",
      conclusion: "failure"
    }
  };
  const body = JSON.stringify(payload);

  const response = await app.inject({
    method: "POST",
    url: "/webhook/github",
    payload: body,
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": sign(body, githubSecret)
    }
  });

  assert.equal(response.statusCode, 202);
  assert.equal(published.length, 1);
  assert.equal(published[0].sourceTool, "github_actions");
  assert.equal(published[0].repository, "acme/api");

  await app.close();
});

test("POST /webhook/github rejects invalid signatures", async () => {
  process.env.GITHUB_WEBHOOK_SECRET = githubSecret;
  const app = await buildServer({
    publishEvent: async () => {}
  });

  const body = JSON.stringify({
    repository: { full_name: "acme/api" },
    workflow_run: {
      head_sha: "abc123",
      head_branch: "main",
      html_url: "https://github.com/acme/api/actions/runs/42"
    }
  });

  const response = await app.inject({
    method: "POST",
    url: "/webhook/github",
    payload: body,
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": "sha256=deadbeef"
    }
  });

  assert.equal(response.statusCode, 401);
  await app.close();
});

test("POST /webhook/jenkins normalizes and publishes a valid build event", async () => {
  process.env.JENKINS_WEBHOOK_SECRET = jenkinsSecret;
  const published = [];
  const app = await buildServer({
    publishEvent: async (event) => {
      published.push(event);
    }
  });

  const payload = {
    repository: "acme/api",
    commitSha: "abc123",
    branch: "main",
    build: {
      id: "jenkins-88",
      number: 88,
      status: "FAILURE",
      url: "https://jenkins.local/job/api/88/console"
    }
  };
  const body = JSON.stringify(payload);

  const response = await app.inject({
    method: "POST",
    url: "/webhook/jenkins",
    payload: body,
    headers: {
      "content-type": "application/json",
      "x-jenkins-signature": sign(body, jenkinsSecret)
    }
  });

  assert.equal(response.statusCode, 202);
  assert.equal(published.length, 1);
  assert.equal(published[0].sourceTool, "jenkins");
  assert.equal(published[0].failureType, "FAILURE");

  await app.close();
});

test("POST /webhook/cloudwatch returns 400 for malformed payloads", async () => {
  const app = await buildServer({
    publishEvent: async () => {}
  });

  const response = await app.inject({
    method: "POST",
    url: "/webhook/cloudwatch",
    payload: {
      detail: {
        repository: "acme/api"
      }
    }
  });

  assert.equal(response.statusCode, 400);
  await app.close();
});

test("POST /webhook/xray normalizes and publishes a valid anomaly event", async () => {
  const published = [];
  const app = await buildServer({
    publishEvent: async (event) => {
      published.push(event);
    }
  });

  const response = await app.inject({
    method: "POST",
    url: "/webhook/xray",
    payload: {
      time: "2026-04-10T11:00:00.000Z",
      detail: {
        repository: "acme/payments-service",
        commitSha: "abc999",
        branch: "main",
        rawLogsRef: "arn:aws:xray:ap-south-1:111111111111:trace/1234",
        metadata: {
          anomaly: "latency_spike"
        }
      }
    }
  });

  assert.equal(response.statusCode, 202);
  assert.equal(published.length, 1);
  assert.equal(published[0].sourceTool, "xray");
  assert.equal(published[0].metadata.anomaly, "latency_spike");

  await app.close();
});
