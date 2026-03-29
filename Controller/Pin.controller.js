const Pin = require("../Model/Pin.model");
const User = require("../Model/User.model");
const Vendor = require("../Model/Vendor.model");
const redis = require("../Utils/Redis");
const firebase = require("../Utils/Firebase");
const { generateFunnyMessage } = require("../Utils/Gemini");

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

        // 6. Add to Redis Geo set for nearby search
        // We use the same key as the member name so we can fetch the data easily
        await redis.geoadd('active_pins_geo', lng, lat, redisKey);
        // Note: We'll cleanup geo members during nearby search if they are expired

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
        const pin = await Pin.findById(id)
            .populate('orderedBy', 'name phone email')
            .populate('deliveredBy', 'name email phone address');
            
        if (!pin) return res.status(404).json({ error: "Pin not found" });
        res.status(200).json({ pin });
    } catch (error) {
        console.error("Get Pin Details error:", error);
        res.status(500).json({ error: "Failed to fetch pin details.", details: error.message });
    }
};

const getAllActivePins = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: "Unauthorized. No user found in request." });
    }
    const userId = req.user.userId || req.user.vendorId;

    try {
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
            message: "All active pins fetched from Redis for the user",
            activePins
        });
    } catch (error) {
        console.error("Fetch all active pins error:", error);
        res.status(500).json({ error: "Failed to fetch all active pins.", details: error.message });
    }
};

const getNearbyPins = async (req, res) => {
    const { lat, lng, radius } = req.query; // Radius in meters
    
    if (!lat || !lng) {
        return res.status(400).json({ error: "Latitude and longitude are required." });
    }

    try {
        // Fetch user/vendor to get their visibilityRadius
        const requesterId = req.user.userId || req.user.vendorId || req.user.id;
        const isVendor = !!req.user.vendorId;
        let requester;
        
        console.log(`[getNearbyPins] req.user:`, req.user);

        if (isVendor) {
            requester = await Vendor.findById(requesterId);
        } else {
            requester = await User.findById(requesterId);
        }

        const searchRadius = radius || (requester ? requester.visibilityRadius : 500) || 500;
        console.log(`[getNearbyPins] FINAL searchRadius: ${searchRadius}m for ${isVendor ? 'Vendor' : 'User'} ${requesterId}`);
        
        // Find pins within radius
        const nearbyKeys = await redis.georadius('active_pins_geo', lng, lat, searchRadius, 'm');
        
        const activePins = [];
        const expiredKeys = [];

        if (nearbyKeys.length > 0) {
            const values = await redis.mget(...nearbyKeys);
            
            values.forEach((v, index) => {
                if (v) {
                    activePins.push(JSON.parse(v));
                } else {
                    // Key has expired in Redis but still exists in GEO set
                    expiredKeys.push(nearbyKeys[index]);
                }
            });

            // Cleanup expired keys from Geo set (lazy cleanup)
            if (expiredKeys.length > 0) {
                await redis.zrem('active_pins_geo', ...expiredKeys);
            }
        }

        // 2. Find Users within radius
        const nearbyUsers = await redis.georadius('active_users_geo', lng, lat, searchRadius, 'm');

        res.status(200).json({
            message: "Nearby pins and users fetched successfully",
            count: activePins.length,
            userCount: nearbyUsers.length,
            activePins
        });
    } catch (error) {
        console.error("Fetch nearby pins error:", error);
        res.status(500).json({ error: "Failed to fetch nearby pins.", details: error.message });
    }
};

const confirmPin = async (req, res) => {
    const { id } = req.params; // Pin ID
    const vendorId = req.user.vendorId; // Confirming vendor

    try {
        const pin = await Pin.findById(id).populate('orderedBy');
        if (!pin) return res.status(404).json({ error: "Pin not found." });

        if (pin.status === 'confirmed') {
            return res.status(400).json({ error: "This pin has already been confirmed." });
        }

        // 1. Update Pin status and vendor
        pin.status = 'confirmed';
        pin.confirmedAt = new Date();
        pin.deliveredBy = vendorId;
        await pin.save();

        // 2. Clear Redis cache for the pin (active pins list will show it as confirmed or we can just leave it)
        // Usually we'd update redis, but here for simplicity let's assume it's "claimed"
        // await redis.del(`active_pin:${pin.orderedBy._id}:${pin._id}`);

        // 3. Send Push Notification
        const user = pin.orderedBy;
        if (user && user.fcmToken) {
            console.log(`[Notification] Sending funny message to User: ${user.name}`);
            
            // Generate witty message via AI
            const funnyMessage = await generateFunnyMessage(pin.item || "Order");

            console.log("\n--------------------------------------");
            console.log("Generated AI Notification Message:");
            console.log(`Item: ${pin.item || "Order"}`);
            console.log(`Message: ${funnyMessage}`);
            console.log(`User ID: ${user._id}`);
            console.log(`Token Found: ${user.fcmToken.slice(0, 15)}...`);
            console.log("--------------------------------------\n");

            const messagePayload = {
                notification: {
                    title: "Stalk Shops",
                    body: funnyMessage,
                },
                data: {
                    pinId: id,
                    item: pin.item || "Order",
                    status: "confirmed"
                },
                token: user.fcmToken
            };

            const response = await firebase.messaging().send(messagePayload);
            console.log(`[Notification] Successfully sent! MessageID: ${response}`);
        } else {
            console.log(`[Notification] ❌ No FCM token for user ${user?._id || 'unknown'}`);
        }

        res.status(200).json({ 
            message: "Order confirmed and notification sent!",
            pin 
        });
    } catch (error) {
        console.error("Confirm pin error:", error);
        res.status(500).json({ error: "Failed to confirm pin.", details: error.message });
    }
};

module.exports = { createPin, getPinnedOrders, getActivePins, getPinById, getAllActivePins, getNearbyPins, confirmPin };
