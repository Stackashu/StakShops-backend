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

const sendSubscriptionMail = async (to, name, planName, radius) => {
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
      subject: `Subscription Activated: Welcome to ${planName}, ${name}!`,
      text: `Hi ${name},\n\nYour ${planName} subscription is now active! 🚀\n\nYour store is now visible to users within a ${radius}m radius. We're excited to help you grow your business!\n\nRegards,\nStalkShops Team`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Subscription Mail Sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Subscription Mail Error:", error.message);
    throw error;
  }
};

const sendPinPurchaseMail = async (to, name, pinCount) => {
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
      subject: `Pins Added Successfully!`,
      text: `Hi ${name},\n\nSuccess! ${pinCount} pins have been added to your account. You can now use them to mark your favorite locations.\n\nHappy Stalking!\n\nRegards,\nStalkShops Team`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Pin Purchase Mail Sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Pin Purchase Mail Error:", error.message);
    throw error;
  }
};

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

const subscriptionEmailWorker = new Worker("subscription-email-queue", async (job) => {
  try {
    const { type, to, name, planName, radius, pinCount } = job.data;
    if (type === 'subscription') {
      await sendSubscriptionMail(to, name, planName, radius);
    } else if (type === 'pin-purchase') {
      await sendPinPurchaseMail(to, name, pinCount);
    }
  } catch (error) {
    console.error("Subscription Worker Error:", error.message);
    throw error;
  }
}, {
  connection: redisConnection
});

module.exports = { signupEmailWorker, otpSentWorker, subscriptionEmailWorker };
