const { Queue } = require("bullmq");
const redis = require("../Utils/Redis.js"); // Redis connection for caching and BullMQ

const signUpQueue = new Queue("signup-email-queue", {
  connection: redis
});

const otpSendingQueue = new Queue("otp-email-queue", {
  connection: redis
});

module.exports = { signUpQueue, otpSendingQueue };