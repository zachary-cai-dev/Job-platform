import { Queue, type ConnectionOptions } from "bullmq";

export const SOURCE_FETCH_QUEUE_NAME = "source-fetch";

export function createSourceFetchQueue(connection: ConnectionOptions): Queue {
  return new Queue(SOURCE_FETCH_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });
}
