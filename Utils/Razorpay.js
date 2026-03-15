const Razorpay = require("razorpay");

let razorpayInstance;

try {
    razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
} catch (error) {
    console.error("Failed to initialize Razorpay:", error.message);
}

module.exports = razorpayInstance;
