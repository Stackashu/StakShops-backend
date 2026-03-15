const Pin = require("../Model/Pin.model");
const User = require("../Model/User.model");
const redis = require("../Utils/Redis");

const createPin = async (req, res) => {
    const { deliveryLocation, deliveredBy, shopType } = req.body;
    const userId = req.user.userId;
    const email = req.user.email;

    try {
        if (!deliveryLocation || !deliveredBy) {
            return res.status(400).json({ error: "Delivery location and delivery vendor ID are required." });
        }

        // 1. Check if user has pins
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        if (user.pins <= 0) {
            return res.status(400).json({ error: "Insufficient pins. Please purchase more pins." });
        }

        // 2. Subtract 1 pin
        user.pins -= 1;
        await user.save();

        // 3. Create the Pin record
        const newPin = await Pin.create({
            orderedBy: userId,
            deliveryLocation,
            deliveredBy,
            shopType
        });

        // 4. Update Cache
        const cacheKey = `user:${email}`;
        const userWithoutPassword = user.toObject();
        delete userWithoutPassword.password;
        await redis.setex(cacheKey, 3600, JSON.stringify(userWithoutPassword));

        res.status(201).json({
            message: "Pin used successfully",
            pin: newPin,
            remainingPins: user.pins
        });
    } catch (error) {
        console.error("Pin creation error:", error);
        res.status(500).json({ error: "Failed to use pin.", details: error.message });
    }
};

module.exports = { createPin };
