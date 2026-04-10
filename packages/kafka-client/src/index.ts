import { Kafka, logLevel, type Consumer, type EachMessagePayload, type KafkaMessage, type Producer } from "kafkajs";
import type { PipelineEvent } from "@packages/shared-types";

export const kafkaClientPackageName = "kafka-client";

export const TOPICS = {
  pipelineEvents: "pipeline-events",
  agentFindings: "agent-findings",
  decisions: "decisions",
  approvalQueue: "approval-queue"
} as const;

const TOPIC_LIST = Object.values(TOPICS);

type KafkaLike = Pick<Kafka, "admin" | "producer" | "consumer">;

export type TopicName = (typeof TOPIC_LIST)[number];

export type EventEnvelope<TPayload> = {
  repository: string;
  payload: TPayload;
};

export type ConsumerMessage = KafkaMessage;

export type ConsumerContext = {
  topic: string;
  partition: number;
  message: ConsumerMessage;
};

export type ConsumerHandler = (message: ConsumerContext) => Promise<void>;

export type ProducerMessage<TPayload> = {
  topic: TopicName;
  repository: string;
  payload: TPayload;
  headers?: Record<string, string>;
};

const producerCache = new WeakMap<object, Promise<Producer>>();

let defaultKafkaInstance: Kafka | undefined;

const getBrokers = (): string[] => {
  const brokers = process.env.KAFKA_BROKERS?.split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);

  if (!brokers || brokers.length === 0) {
    throw new Error("KAFKA_BROKERS must be set to a comma-separated list of brokers.");
  }

  return brokers;
};

const getKafka = (): Kafka => {
  if (!defaultKafkaInstance) {
    defaultKafkaInstance = new Kafka({
      clientId: "agentic-cicd-orchestration-system",
      brokers: getBrokers(),
      logLevel: process.env.NODE_ENV === "development" ? logLevel.INFO : logLevel.NOTHING
    });
  }

  return defaultKafkaInstance;
};

export const getPartitionKey = (event: Pick<PipelineEvent, "repository">): string => event.repository;

export const serializeEnvelope = <TPayload>(envelope: EventEnvelope<TPayload>): string =>
  JSON.stringify(envelope);

export const ensureTopics = async (kafka: KafkaLike = getKafka()): Promise<void> => {
  const admin = kafka.admin();
  await admin.connect();

  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: TOPIC_LIST.map((topic) => ({
        topic,
        numPartitions: 1,
        replicationFactor: 1
      }))
    });
  } finally {
    await admin.disconnect();
  }
};

export const createProducer = async (kafka: KafkaLike = getKafka()): Promise<Producer> => {
  const cacheKey = kafka as object;
  const cached = producerCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const producerPromise = (async () => {
    await ensureTopics(kafka);

    const producer = kafka.producer({
      idempotent: true,
      maxInFlightRequests: 1,
      retry: {
        retries: 5
      }
    });

    await producer.connect();
    return producer;
  })();

  producerCache.set(cacheKey, producerPromise);
  return producerPromise;
};

export const publishMessage = async <TPayload>(
  message: ProducerMessage<TPayload>,
  kafka: KafkaLike = getKafka()
): Promise<void> => {
  const producer = await createProducer(kafka);

  await producer.send({
    topic: message.topic,
    acks: -1,
    messages: [
      {
        key: message.repository,
        value: serializeEnvelope({
          repository: message.repository,
          payload: message.payload
        }),
        headers: message.headers
      }
    ]
  });
};

const createCommitOffset = (message: ConsumerMessage): string => {
  const currentOffset = message.value ? Number.parseInt((message as { offset?: string }).offset ?? "0", 10) : 0;
  return String(currentOffset + 1);
};

export const createConsumer = async (
  groupId: string,
  topic: TopicName,
  handler: ConsumerHandler,
  kafka: KafkaLike = getKafka()
): Promise<Consumer> => {
  await ensureTopics(kafka);

  const consumer = kafka.consumer({
    groupId
  });

  await consumer.connect();
  await consumer.subscribe({
    topic,
    fromBeginning: false
  });

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic: receivedTopic, partition, message, heartbeat, pause }: EachMessagePayload) => {
      await handler({
        topic: receivedTopic,
        partition,
        message
      });

      await consumer.commitOffsets([
        {
          topic: receivedTopic,
          partition,
          offset: String(Number.parseInt(message.offset, 10) + 1)
        }
      ]);

      await heartbeat();
      pause();
    }
  });

  return consumer;
};
