const IORedis = require("ioredis");

// Validate REDIS_URL is set
if (!process.env.REDIS_URL) {
  console.error("Error: REDIS_URL environment variable is not set. Please set it in your .env file.");
  throw new Error("REDIS_URL environment variable is required");
}

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // REQUIRED for BullMQ
  tls: {
    rejectUnauthorized: false, // REQUIRED for Upstash
  },
});

connection.on("connect", () => {
  console.log("Connected to Upstash Redis");
});

connection.on("error", (err) => {
  console.error("Redis error:", err);
});

module.exports = connection;
