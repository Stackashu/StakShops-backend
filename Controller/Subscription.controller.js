const SubscriptionPlan = require("../Model/SubscriptionPlan.model");
const PinPackage = require("../Model/PinPackage.model");
const Transaction = require("../Model/Transaction.model");
const Subscription = require("../Model/Subscription.model");
const Vendor = require("../Model/Vendor.model");
const User = require("../Model/User.model");
const razorpay = require("../Utils/Razorpay");
const crypto = require("crypto");
const { subscriptionQueue } = require("../Utils/ProducerQueue");

// Create Razorpay Order
const createOrder = async (req, res) => {
    const { itemId, itemType } = req.body; // itemId: planId or packageId
    const buyerId = req.user.id;
    const buyerType = req.user.role === 'vendor' ? 'Vendor' : 'User';

    try {
        let item;
        if (itemType === 'Subscription') {
            item = await SubscriptionPlan.findById(itemId);
        } else {
            item = await PinPackage.findById(itemId);
        }

        if (!item) return res.status(404).json({ error: "Item not found" });

        const options = {
            amount: item.price * 100, // amount in the smallest currency unit (paise for INR)
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        // Save pending transaction
        await Transaction.create({
            razorpayOrderId: order.id,
            buyerType,
            buyerId,
            itemType,
            itemId,
            amount: item.price,
            status: 'pending'
        });

        res.status(201).json(order);
    } catch (error) {
        console.error("Order creation error:", error);
        res.status(500).json({ error: "Failed to create order" });
    }
};

// Verify Razorpay Payment
const verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    try {
        // 1. Verify Signature
        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({ error: "Invalid payment signature" });
        }

        // 2. Anti-Cheat: Find and check transaction
        const transaction = await Transaction.findOne({ razorpayOrderId: razorpay_order_id });
        if (!transaction) return res.status(404).json({ error: "Transaction not found" });
        if (transaction.status === 'completed') {
            return res.status(400).json({ error: "Payment already processed" });
        }

        // 3. Grant Benefits
        if (transaction.itemType === 'Subscription') {
            const plan = await SubscriptionPlan.findById(transaction.itemId);
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + plan.durationDays);

            const subscription = await Subscription.create({
                vendorId: transaction.buyerId,
                planId: plan._id,
                startDate,
                endDate
            });

            await Vendor.findByIdAndUpdate(transaction.buyerId, {
                currentSubscription: subscription._id,
                subscriptionStart: startDate,
                subscriptionEnd: endDate
            });

            // Queue notification email
            const vendor = await Vendor.findById(transaction.buyerId);
            await subscriptionQueue.add("subscription-email", {
                type: 'subscription',
                to: vendor.email,
                name: vendor.name,
                planName: plan.name,
                radius: plan.visibilityRadius
            });
        } else {
            const pkg = await PinPackage.findById(transaction.itemId);
            const user = await User.findById(transaction.buyerId);
            user.pins = (user.pins || 0) + pkg.pinCount;
            await user.save();

            // Queue notification email
            await subscriptionQueue.add("pin-purchase-email", {
                type: 'pin-purchase',
                to: user.email,
                name: user.name,
                pinCount: pkg.pinCount
            });
        }

        // 4. Finalize Transaction
        transaction.status = 'completed';
        transaction.razorpayPaymentId = razorpay_payment_id;
        transaction.razorpaySignature = razorpay_signature;
        await transaction.save();

        res.status(200).json({ message: "Payment verified and benefits granted!" });
    } catch (error) {
        console.error("Verification error:", error);
        res.status(500).json({ error: "Internal Server Error during verification" });
    }
};

// Admin: Seed Plans
const seedPlans = async (req, res) => {
    try {
        const plans = [
            { name: 'Bronze', price: 1, durationDays: 30, visibilityRadius: 300, features: ['300m Visibility'] },
            { name: 'Silver', price: 149, durationDays: 30, visibilityRadius: 500, features: ['500m Visibility', 'Medium Boost'] },
            { name: 'Gold', price: 199, durationDays: 30, visibilityRadius: 1200, features: ['1200m Visibility', 'High Boost'] }
        ];
        await SubscriptionPlan.deleteMany({});
        await SubscriptionPlan.insertMany(plans);

        const packages = [
            { name: 'Mini', price: 10, pinCount: 5 },
            { name: 'Standard', price: 25, pinCount: 15 }
        ];
        await PinPackage.deleteMany({});
        await PinPackage.insertMany(packages);

        res.status(201).json({ message: "Seeded successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { createOrder, verifyPayment, seedPlans };
