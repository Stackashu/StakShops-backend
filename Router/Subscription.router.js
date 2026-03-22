const express = require("express");
const router = express.Router();
const { authentication } = require("../Middleware/Authorization");
const { checkStatus } = require("../Middleware/CheckStatus");
const { seedPlans, createOrder, verifyPayment, getSubscriptionPlans, getPinPackages } = require("../Controller/Subscription.controller");

// Admin/System Route to seed plans
router.post("/seed", seedPlans);

// Public/Open Routes to fetch options
router.get("/plans", getSubscriptionPlans);
router.get("/packages", getPinPackages);

// Protected Routes
router.use(authentication);
router.use(checkStatus); // Every request checked for account cutoff

router.post("/create-order", createOrder); // Initialize Razorpay payment
router.post("/verify-payment", verifyPayment); // Verify signature and grant benefits

module.exports = router;
