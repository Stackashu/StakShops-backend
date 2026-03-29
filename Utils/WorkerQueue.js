const { Worker } = require("bullmq");
const nodemailer = require('nodemailer');
const IORedis = require("ioredis");
const fs = require("fs");
const path = require("path");

// ─────────────────────────────────────────────────────────
// BullMQ Workers MUST each have their own dedicated Redis
// connection. Sharing one causes jobs to never be processed.
// ─────────────────────────────────────────────────────────
const makeWorkerConnection = () => new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  tls: { rejectUnauthorized: false },
});

// ─────────────────────────────────────────────────────────
// Shared transporter factory
// ─────────────────────────────────────────────────────────
const createTransporter = () => nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GOOGLE_GMAIL,
    pass: process.env.GOOGLE_PASS,
  },
});

// ─────────────────────────────────────────────────────────
// Logo — read once at module load, embed as base64 CID
// ─────────────────────────────────────────────────────────
const LOGO_PATH = path.join(__dirname, "../media/mylogo.png");
const LOGO_BASE64 = fs.existsSync(LOGO_PATH)
  ? fs.readFileSync(LOGO_PATH).toString("base64")
  : null;

const logoAttachment = LOGO_BASE64
  ? [{
      filename: "mylogo.png",
      content: LOGO_BASE64,
      encoding: "base64",
      cid: "stalkshops-logo",
    }]
  : [];

// ─────────────────────────────────────────────────────────
// Shared HTML shell — wraps every email in the same branded
// header / footer layout.
//
// Parameters:
//   accentColor  — hex for the header bar & highlights
//   bodyContent  — inner HTML injected between header & footer
// ─────────────────────────────────────────────────────────
const buildEmailHtml = ({ accentColor = "#fd3131", bodyContent }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Stalk Shops</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:32px 0;">
    <tr>
      <td align="center">
        <!-- Email card -->
        <table width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;
                      overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- ── Header ── -->
          <tr>
            <td style="background-color:${accentColor};padding:28px 40px;text-align:center;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    ${LOGO_BASE64
                      ? `<img src="cid:stalkshops-logo"
                              alt="Stalk Shops Logo"
                              width="56" height="56"
                              style="display:inline-block;border-radius:12px;margin-bottom:12px;" /><br/>`
                      : ""}
                    <span style="font-size:26px;font-weight:900;color:#ffffff;
                                 letter-spacing:4px;font-family:'Segoe UI',Arial,sans-serif;">
                      STALK SHOPS
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="padding:40px 40px 32px 40px;color:#1a1a1a;font-size:15px;line-height:1.7;">
              ${bodyContent}
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background-color:#f9f9f9;border-top:1px solid #ececec;
                       padding:24px 40px;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#999;line-height:1.5;">
                This email was sent by <strong style="color:#fd3131;">Stalk Shops</strong>.
              </p>
              <p style="margin:0;font-size:12px;color:#bbb;">
                © ${new Date().getFullYear()} Stalk Shops. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Email card -->
      </td>
    </tr>
  </table>

</body>
</html>
`;

// ─────────────────────────────────────────────────────────
//  Helper: styled OTP box
// ─────────────────────────────────────────────────────────
const otpBox = (otp) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
    <tr>
      <td align="center">
        <div style="display:inline-block;background:#fff5f5;border:2px dashed #fd3131;
                    border-radius:12px;padding:18px 40px;">
          <span style="font-size:36px;font-weight:900;letter-spacing:10px;
                       color:#fd3131;font-family:'Courier New',monospace;">
            ${otp}
          </span>
        </div>
      </td>
    </tr>
  </table>
`;

// ─────────────────────────────────────────────────────────
//  Helper: info pill row
// ─────────────────────────────────────────────────────────
const infoPill = (label, value) => `
  <tr>
    <td style="padding:8px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:#f4f4f4;border-radius:8px;padding:12px 16px;">
            <span style="font-size:12px;color:#999;text-transform:uppercase;
                         letter-spacing:1px;font-weight:700;">${label}</span><br/>
            <span style="font-size:15px;color:#1a1a1a;font-weight:600;">${value}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
`;

// ─────────────────────────────────────────────────────────
//  Helper: CTA button
// ─────────────────────────────────────────────────────────
const ctaButton = (label, color = "#fd3131") => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
    <tr>
      <td align="center">
        <div style="display:inline-block;background:${color};border-radius:50px;
                    padding:14px 40px;">
          <span style="font-size:15px;font-weight:700;color:#ffffff;letter-spacing:1px;">
            ${label}
          </span>
        </div>
      </td>
    </tr>
  </table>
`;

// ─────────────────────────────────────────────────────────
//  1. Welcome / Sign-up email
// ─────────────────────────────────────────────────────────
const sendSignUpMail = async (to, name) => {
  const html = buildEmailHtml({
    accentColor: "#fd3131",
    bodyContent: `
      <h2 style="margin:0 0 8px 0;font-size:24px;font-weight:800;color:#1a1a1a;">
        Welcome aboard, ${name}! 🎉
      </h2>
      <p style="margin:0 0 20px 0;color:#555;">
        We're absolutely delighted to have you join the <strong>Stalk Shops</strong> family.
        Your account has been created successfully and you're all set to start exploring.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoPill("Account", to)}
        ${infoPill("Status", "✅ Active & Ready")}
      </table>

      <p style="margin:24px 0 0 0;color:#555;">
        With Stalk Shops you can discover nearby vendors, pin your favourite spots,
        and manage your orders — all in one place.
      </p>

      ${ctaButton("Open Stalk Shops →")}

      <p style="margin:32px 0 0 0;font-size:13px;color:#aaa;">
        If you didn't create this account, please ignore this email or contact our support team.
      </p>
    `,
  });

  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: `"Stalk Shops" <${process.env.GOOGLE_GMAIL}>`,
    to,
    subject: `Welcome to Stalk Shops, ${name}! 🎉`,
    text: `Hi ${name},\n\nWelcome to Stalk Shops! Your account is ready.\n\nRegards,\nStalk Shops Team`,
    html,
    attachments: logoAttachment,
  });

  console.log("[Mail] Signup email sent:", info.messageId);
  return info;
};

// ─────────────────────────────────────────────────────────
//  2. OTP email
// ─────────────────────────────────────────────────────────
const sentOtpMail = async (to, otp) => {
  const html = buildEmailHtml({
    accentColor: "#1a1a1a",
    bodyContent: `
      <h2 style="margin:0 0 8px 0;font-size:24px;font-weight:800;color:#1a1a1a;">
        Verify Your Email 🔐
      </h2>
      <p style="margin:0 0 4px 0;color:#555;">
        Use the One-Time Password below to complete your email verification.
        This code is valid for <strong>10 minutes</strong>.
      </p>

      ${otpBox(otp)}

      <p style="margin:0;color:#555;font-size:14px;">
        Enter this code in the Stalk Shops app to proceed. Do <strong>not</strong> share
        this code with anyone — our team will never ask for it.
      </p>

      <p style="margin:28px 0 0 0;color:#aaa;font-size:13px;">
        Didn't request this? You can safely ignore this email.
        Someone may have entered your address by mistake.
      </p>
    `,
  });

  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: `"Stalk Shops" <${process.env.GOOGLE_GMAIL}>`,
    to,
    subject: `Your Stalk Shops OTP: ${otp}`,
    text: `Your OTP is: ${otp}\n\nValid for 10 minutes. Do not share this code.\n\nRegards,\nStalk Shops`,
    html,
    attachments: logoAttachment,
  });

  console.log("[Mail] OTP email sent:", info.messageId);
  return info;
};

// ─────────────────────────────────────────────────────────
//  3. Subscription activation email
// ─────────────────────────────────────────────────────────
const sendSubscriptionMail = async (to, name, planName, radius) => {
  const html = buildEmailHtml({
    accentColor: "#fd3131",
    bodyContent: `
      <h2 style="margin:0 0 8px 0;font-size:24px;font-weight:800;color:#1a1a1a;">
        Subscription Activated! 🚀
      </h2>
      <p style="margin:0 0 20px 0;color:#555;">
        Hey <strong>${name}</strong>, your plan is now live and customers can already discover you.
        Here's a quick summary of what you've unlocked:
      </p>

      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoPill("Plan", planName)}
        ${infoPill("Visibility Radius", `${radius} metres around your location`)}
        ${infoPill("Status", "✅ Active")}
      </table>

      <p style="margin:24px 0 0 0;color:#555;">
        Users within your radius can now see your shop on the map in real time.
        Make sure you're serving to get the most out of your subscription!
      </p>

      ${ctaButton("Go to Vendor Dashboard →")}

      <p style="margin:32px 0 0 0;font-size:13px;color:#aaa;">
        Questions? Reply to this email and we'll be happy to help.
      </p>
    `,
  });

  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: `"Stalk Shops" <${process.env.GOOGLE_GMAIL}>`,
    to,
    subject: `🚀 ${planName} Subscription Activated — Welcome, ${name}!`,
    text: `Hi ${name},\n\nYour ${planName} subscription is active. Visibility radius: ${radius}m.\n\nRegards,\nStalk Shops Team`,
    html,
    attachments: logoAttachment,
  });

  console.log("[Mail] Subscription email sent:", info.messageId);
  return info;
};

// ─────────────────────────────────────────────────────────
//  4. Pin purchase email
// ─────────────────────────────────────────────────────────
const sendPinPurchaseMail = async (to, name, pinCount) => {
  const html = buildEmailHtml({
    accentColor: "#fd3131",
    bodyContent: `
      <h2 style="margin:0 0 8px 0;font-size:24px;font-weight:800;color:#1a1a1a;">
        Pins Added to Your Account 📍
      </h2>
      <p style="margin:0 0 20px 0;color:#555;">
        Great news, <strong>${name}</strong>! Your pin purchase was successful.
        Your new pins are ready to use right now.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:4px;">
        ${infoPill("Pins Added", `📍 ${pinCount} pin${pinCount !== 1 ? "s" : ""}`)}
        ${infoPill("Account", to)}
      </table>

      <p style="margin:24px 0 0 0;color:#555;">
        Use your pins to drop location orders and connect with nearby vendors instantly.
        Happy Stalking! 🎯
      </p>

      ${ctaButton("Start Pinning →")}

      <p style="margin:32px 0 0 0;font-size:13px;color:#aaa;">
        If you did not make this purchase, please contact our support team immediately.
      </p>
    `,
  });

  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: `"Stalk Shops" <${process.env.GOOGLE_GMAIL}>`,
    to,
    subject: `📍 ${pinCount} Pin${pinCount !== 1 ? "s" : ""} Added to Your Stalk Shops Account!`,
    text: `Hi ${name},\n\n${pinCount} pin(s) have been added to your account.\n\nHappy Stalking!\nStalk Shops Team`,
    html,
    attachments: logoAttachment,
  });

  console.log("[Mail] Pin purchase email sent:", info.messageId);
  return info;
};

// ─────────────────────────────────────────────────────────
//  BullMQ Workers
// ─────────────────────────────────────────────────────────
const signupEmailWorker = new Worker("signup-email-queue", async (job) => {
  console.log("[Worker] Processing signup job:", job.id);
  const { to, name } = job.data;
  const info = await sendSignUpMail(to, name);
  console.log("[Worker] Signup job done:", info.messageId);
  return info;
}, { connection: makeWorkerConnection() });

const otpSentWorker = new Worker("otp-email-queue", async (job) => {
  console.log("[Worker] Processing OTP job:", job.id);
  const { to, otp } = job.data;
  const info = await sentOtpMail(to, otp);
  console.log("[Worker] OTP job done:", info.messageId);
  return info;
}, { connection: makeWorkerConnection() });

const subscriptionEmailWorker = new Worker("subscription-email-queue", async (job) => {
  console.log("[Worker] Processing subscription job:", job.id);
  const { type, to, name, planName, radius, pinCount } = job.data;
  if (type === "subscription") {
    await sendSubscriptionMail(to, name, planName, radius);
  } else if (type === "pin-purchase") {
    await sendPinPurchaseMail(to, name, pinCount);
  }
}, { connection: makeWorkerConnection() });

// ─────────────────────────────────────────────────────────
//  Verify mailer on startup
// ─────────────────────────────────────────────────────────
createTransporter().verify((error) => {
  if (error) {
    console.error("[Mail] Connection error:", error.message);
  } else {
    console.log("[Mail] ✅ Mailer is ready — HTML email system active.");
  }
});

// Verify mailer connection on startup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GOOGLE_GMAIL,
    pass: process.env.GOOGLE_PASS
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.error("Mailer Connection Error:", error);
  } else {
    console.log("Mailer is ready to take our messages");
  }
});

module.exports = { signupEmailWorker, otpSentWorker, subscriptionEmailWorker };
