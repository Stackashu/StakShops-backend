const { Worker } = require("bullmq");
const nodemailer = require('nodemailer');
const redisConnection = require("./Redis.js")



const sendSignUpMail = async (to, name) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GOOGLE_GMAIL,
        pass: process.env.GOOGLE_PASS
      }
    });

    const mailOptions = {
      from: process.env.GOOGLE_GMAIL,
      to,
      subject: `Welcome to our service, ${name}! Your account has been created.`,
      text: `Hi ${name},\n\nWe are delighted to welcome you to StalkShops! We feel happy to provide our best services to you. Your account has been created successfully, and we look forward to supporting your journey with us.\n\nIf you have any questions or need assistance, please feel free to reach out.\n\nRegards,\nStalkShops`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(" signup Message sent", info.messageId);
    return info;
  } catch (error) {
    console.error("Mail error:", error.message);
    throw error;
  }
};

const sentOtpMail = async (to, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GOOGLE_GMAIL,
        pass: process.env.GOOGLE_PASS
      }
    });

    const mailOptions = {
      from: process.env.GOOGLE_GMAIL,
      to,
      subject: `Your OTP Code for StalkShops`,
      text: `Hi ,\n\nYour One-Time Password (OTP) for verifying your email is: ${otp}\n\nPlease enter this code in the app to complete your verification.\n\nIf you did not request this, you can safely ignore this email.\n\nRegards,\nStalkShops`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("otp Message sent", info.messageId);
    return info;
  } catch (error) {
    console.error("Mail error:", error.message);
    throw error;
  }
}
// Create a BullMQ worker to process email sending jobs
const signupEmailWorker = new Worker("signup-email-queue", async (job) => {
  try {
    console.log("Processing job id", job.id);
    const { to, name } = job.data;

    // Send the email
    const info = await sendSignUpMail(to, name);
    console.log("Email signup job complete:", info.messageId);
    return info;
  } catch (error) {
    console.error("Worker email processing error:", error.message);
    throw error;
  }
}, {
  connection: redisConnection
});

const otpSentWorker = new Worker("otp-email-queue", async (job) => {
  try {
    console.log("Processing job id", job.id);
    const { to, otp } = job.data;

    // Send the email
    const info = await sentOtpMail(to, otp);
    console.log("Email otp job complete:", info.messageId);
    return info;
  } catch (error) {
    console.error("Worker email processing error:", error.message);
    throw error;
  }
}, {
  connection: redisConnection
});



module.exports = { signupEmailWorker, otpSentWorker };
