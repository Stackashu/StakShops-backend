const { Worker } = require("bullmq");
const nodemailer = require('nodemailer');
const redisConnection = require("./Redis.js")



const sendMail = async (to, name) => {
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
    console.log("Message sent", info.messageId);
    return info;
  } catch (error) {
    console.error("Mail error:", error.message);
    throw error;
  }
};

// Create a BullMQ worker to process email sending jobs
const worker = new Worker("email-queue", async (job) => {
  try {
    console.log("Processing job id", job.id);
    const { to, subject, text } = job.data;
    
    // Send the email
    const info = await sendMail(to,  name);
    console.log("Email job complete:", info.messageId);
    return info;
  } catch (error) {
    console.error("Worker email processing error:", error.message);
    throw error;
  }
} ,{
    connection: redisConnection
  } );

module.exports = { sendMail, worker };
