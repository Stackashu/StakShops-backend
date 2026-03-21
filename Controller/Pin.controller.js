const Pin = require("../Model/Pin.model");
const User = require("../Model/User.model");
const redis = require("../Utils/Redis");

const createPin = async (req, res) => {
    const { deliveryLocation, lat, lng, deliveredBy, shopType, item, expiryTime } = req.body;
    const userId = req.user.userId;
    const email = req.user.email;

    try {
        if (!deliveryLocation || !deliveredBy || !lat || !lng) {
            return res.status(400).json({ error: "Delivery location, lat/lng, and delivery vendor ID are required." });
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

        // 3. Calculate Expiry and TTL
        const now = new Date();
        const expiryAt = expiryTime ? new Date(expiryTime) : new Date(now.getTime() + 3 * 60 * 60 * 1000); // Default 3 hours
        const ttlSeconds = Math.max(1, Math.floor((expiryAt.getTime() - now.getTime()) / 1000));

        // 4. Create the Pin record in DB
        const newPin = await Pin.create({
            orderedBy: userId,
            deliveryLocation,
            lat,
            lng,
            deliveredBy,
            shopType,
            item,
            expiryAt
        });

        // 5. Store in Redis for active display
        // Key format: active_pin:userId:pinId
        const redisKey = `active_pin:${userId}:${newPin._id}`;
        const pinData = {
            id: newPin._id,
            lat,
            lng,
            item,
            shopType,
            deliveryLocation,
            expiryAt
        };
        await redis.setex(redisKey, ttlSeconds, JSON.stringify(pinData));

        // 6. Update User Profile Cache
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

const getPinnedOrders = async (req, res) => {
    const userId = req.user.userId || req.user.vendorId;

    try {
        const pins = await Pin.find({ orderedBy: userId })
            .populate('deliveredBy', 'name email phone address')
            .sort({ createdAt: -1 });

        res.status(200).json({
            message: "Pinned orders fetched successfully",
            pins
        });
    } catch (error) {
        console.error("Fetch pins error:", error);
        res.status(500).json({ error: "Failed to fetch pinned orders.", details: error.message });
    }
};

const getActivePins = async (req, res) => {
    const userId = req.user.userId;

    try {
        // Use SCAN to find keys for this user
        let cursor = '0';
        const match = `active_pin:${userId}:*`;
        const activePins = [];

        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', match, 'COUNT', 100);
            cursor = nextCursor;

            if (keys.length > 0) {
                const values = await redis.mget(...keys);
                values.forEach(v => {
                    if (v) activePins.push(JSON.parse(v));
                });
            }
        } while (cursor !== '0');

        res.status(200).json({
            message: "Active pins fetched from Redis",
            activePins
        });
    } catch (error) {
        console.error("Fetch active pins error:", error);
        res.status(500).json({ error: "Failed to fetch active pins.", details: error.message });
    }
};

const getPinById = async (req, res) => {
    const { id } = req.params;
    try {
        const pin = await Pin.findById(id).populate('deliveredBy', 'name email phone address');
        if (!pin) return res.status(404).json({ error: "Pin not found" });
        res.status(200).json({ pin });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch pin details.", details: error.message });
    }
};

const getAllActivePins = async (req, res) => {
    try {
        let cursor = '0';
        const match = `active_pin:*:*`;
        const activePins = [];

        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', match, 'COUNT', 100);
            cursor = nextCursor;

            if (keys.length > 0) {
                const values = await redis.mget(...keys);
                values.forEach(v => {
                    if (v) activePins.push(JSON.parse(v));
                });
            }
        } while (cursor !== '0');

        res.status(200).json({
            message: "All active pins fetched from Redis",
            activePins
        });
    } catch (error) {
        console.error("Fetch all active pins error:", error);
        res.status(500).json({ error: "Failed to fetch all active pins.", details: error.message });
    }
};

module.exports = { createPin, getPinnedOrders, getActivePins, getPinById, getAllActivePins };
