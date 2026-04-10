import test from "node:test";
import assert from "node:assert/strict";

import {
  TOPICS,
  createConsumer,
  createProducer,
  getPartitionKey,
  publishMessage
} from "../dist/index.js";

const createKafkaStub = () => {
  const state = {
    createdTopics: [],
    producerConnects: 0,
    producerSends: [],
    consumerSubscriptions: [],
    committedOffsets: [],
    runConfig: null
  };

  const producer = {
    async connect() {
      state.producerConnects += 1;
    },
    async send(payload) {
      state.producerSends.push(payload);
    }
  };

  const consumer = {
    async connect() {},
    async subscribe(payload) {
      state.consumerSubscriptions.push(payload);
    },
    async run(config) {
      state.runConfig = config;
    },
    async commitOffsets(offsets) {
      state.committedOffsets.push(offsets);
    }
  };

  const admin = {
    async connect() {},
    async createTopics(payload) {
      state.createdTopics.push(payload);
    },
    async disconnect() {}
  };

  return {
    state,
    kafka: {
      admin: () => admin,
      producer: () => producer,
      consumer: () => consumer
    }
  };
};

test("getPartitionKey always uses the repository field", () => {
  assert.equal(
    getPartitionKey({
      repository: "acme/payments"
    }),
    "acme/payments"
  );
});

test("createProducer is singleton per kafka instance and configures topics", async () => {
  const { kafka, state } = createKafkaStub();

  const producerOne = await createProducer(kafka);
  const producerTwo = await createProducer(kafka);

  assert.equal(producerOne, producerTwo);
  assert.equal(state.producerConnects, 1);
  assert.equal(state.createdTopics.length, 1);
  assert.deepEqual(
    state.createdTopics[0].topics.map((entry) => entry.topic),
    [TOPICS.pipelineEvents, TOPICS.agentFindings, TOPICS.decisions, TOPICS.approvalQueue]
  );
});

test("publishMessage uses repository as the Kafka key and acks all", async () => {
  const { kafka, state } = createKafkaStub();

  await publishMessage(
    {
      topic: TOPICS.pipelineEvents,
      repository: "acme/api",
      payload: {
        eventId: "evt-1"
      }
    },
    kafka
  );

  assert.equal(state.producerSends.length, 1);
  assert.equal(state.producerSends[0].acks, -1);
  assert.equal(state.producerSends[0].messages[0].key, "acme/api");
  assert.match(state.producerSends[0].messages[0].value, /"repository":"acme\/api"/);
});

test("createConsumer disables auto commit and commits after the handler resolves", async () => {
  const { kafka, state } = createKafkaStub();
  const handled = [];

  await createConsumer(
    "agent-group",
    TOPICS.pipelineEvents,
    async ({ topic, partition, message }) => {
      handled.push({
        topic,
        partition,
        offset: message.offset
      });
    },
    kafka
  );

  assert.equal(state.consumerSubscriptions.length, 1);
  assert.equal(state.consumerSubscriptions[0].topic, TOPICS.pipelineEvents);
  assert.equal(state.runConfig.autoCommit, false);

  await state.runConfig.eachMessage({
    topic: TOPICS.pipelineEvents,
    partition: 0,
    message: {
      offset: "7",
      key: Buffer.from("acme/api"),
      value: Buffer.from("{}"),
      headers: {}
    },
    heartbeat: async () => {},
    pause: () => () => {}
  });

  assert.deepEqual(handled, [
    {
      topic: TOPICS.pipelineEvents,
      partition: 0,
      offset: "7"
    }
  ]);
  assert.deepEqual(state.committedOffsets, [
    [
      {
        topic: TOPICS.pipelineEvents,
        partition: 0,
        offset: "8"
      }
    ]
  ]);
});
