const Vendor = require('../Model/Vendor.model.js');
const User = require('../Model/User.model.js');
const Pin = require('../Model/Pin.model.js');
const Transaction = require("../Model/Transaction.model");
const bcrypt = require('bcryptjs');
const { signUpQueue, otpSendingQueue } = require('../Utils/ProducerQueue.js');
const jwt = require('jsonwebtoken');
const redis = require("../Utils/Redis.js"); 
const { otpGenerator } = require("../Utils/HelpingFunctions.js");

const signupVendor = async (req, res) => {
    const vendorDetails = req.body;
    try {
        const requiredDetails = ["name", "email", "password"];
        for (const i of requiredDetails) {
            if (!vendorDetails[i]) {
                return res.status(400).json({ error: "All fields must be filled." });
            }
        }

        const vendorAlreadyExist = await Vendor.findOne({ email: vendorDetails.email });

        if (vendorAlreadyExist) return res.status(400).json({ error: "This email is already with us." });

        // Check if email is verified via OTP
        const verifiedKey = `verified_email:${vendorDetails.email}`;
        const isVerified = await redis.get(verifiedKey);
        if (!isVerified) {
            return res.status(400).json({ error: "Email not verified. Please verify your email via OTP first." });
        }

        const hashedPassword = await bcrypt.hash(vendorDetails.password, 10);

        vendorDetails.password = hashedPassword;

        let vendor = await Vendor.create(vendorDetails);

        vendor = await Vendor.findById(vendor._id).select("-password");

        // Clear verification flag after successful signup
        await redis.del(verifiedKey);

        await signUpQueue.add("email to vendor", {
            to: vendor.email,
            name: vendor.name
        });

        const token = jwt.sign({
            vendorId: vendor._id, email: vendor.email
        }, process.env.JWT_SECRET, {
            expiresIn: "7d"
        });

        res.status(201).json({ vendor, token });
    } catch (error) {
        res.status(500).json({ error: "Signup failed", details: error.message });
    }
}

const loginVendor = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "All fields must be filled." });
        }

        const vendorFound = await Vendor.findOne({ email });

        if (!vendorFound) {
            return res.status(400).json({ error: "User not found with this email." });
        }

        const passwordMatched = await bcrypt.compare(password, vendorFound.password);

        if (!passwordMatched) {
            return res.status(400).json({ error: "Incorrect password." });
        }

        const { password: _, ...vendorWithoutPassword } = vendorFound.toObject();

        const token = jwt.sign(
            { vendorId: vendorFound._id, email: vendorFound.email },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(200).json({ vendor: vendorWithoutPassword, token });
    } catch (error) {
        res.status(500).json({ error: "Login failed.", details: error.message });
    }
};

const sendOtp = async (req, res) => {
    const { email } = req.body;
    try {
        if (!email)
            return res
                .status(400)
                .json({ error: "Please fill all the details first." });

        const generatedOtp = await otpGenerator();

        const otpKey = `otp:${email}`;
        await redis.setex(otpKey, 600, generatedOtp);

        await otpSendingQueue.add("otp send to user", {
            to: email,
            otp: generatedOtp
        });
        res.status(201).json({
            message: "OTP sent successfully",
        });
    } catch (error) {
        res
            .status(500)
            .json({ error: "Something went wrong.", details: error.message });
    }
};

const verifyOtp = async (req, res) => {
    const { email, otp } = req.body;

    try {
        if (!email || !otp)
            return res.status(400).json({ error: "Please fill alll the details." });

        const otpKey = `otp:${email}`;
        const otpFromRedis = await redis.get(otpKey);

        if (!otpFromRedis)
            return res.status(400).json({ error: "OTP expired or not found. Please request a new OTP." });

        const matched = otpFromRedis === otp;
        if (!matched)
            return res.status(400).json({ error: "Your entered otp is wrong." });

        await redis.del(otpKey);

        // Set a verification flag in Redis for 10 minutes
        const verifiedKey = `verified_email:${email}`;
        await redis.setex(verifiedKey, 600, "true");

        res.status(200).json({ message: "OTP verified successfully" });
    } catch (error) {
        res
            .status(500)
            .json({ error: "Something went wrong.", details: error.message });
    }
};

const vendorDetails = async (req, res) => {
    const email = req.user.email;
    try {
        if (!email) return res.status(401).json({ error: "Unauthorized. No email in token." });

        const cacheKey = `vendor:${email}`;
        const cachedVendor = await redis.get(cacheKey);

        if (cachedVendor) {
            return res.status(200).json({ vendorFound: JSON.parse(cachedVendor), fromCache: true });
        }

        const vendorFound = await Vendor.findOne({ email });

        if (!vendorFound) return res.status(400).json({ error: "Vendor not found." });

        await redis.setex(cacheKey, 3600, JSON.stringify(vendorFound));

        res.status(200).json({ vendorFound, fromCache: false });
    } catch (error) {
        res.status(500).json({ error: "Something went wrong. ", message: error.message });
    }
}

const updateVendor = async (req, res) => {
    const vendorId = req.user.vendorId;
    const vendorData = req.body;
    try {
        if (!vendorData) {
            return res.status(400).json({ error: "Please fill all the fields." });
        }

        delete vendorData.password;

        const updatedVendor = await Vendor.findByIdAndUpdate(
            vendorId,
            { $set: vendorData },
            { new: true, runValidators: true }
        ).select("-password");

        if (!updatedVendor) {
            return res.status(404).json({ error: "Vendor not found." });
        }

        const cacheKey = `vendor:${updatedVendor.email}`;
        await redis.del(cacheKey);
        await redis.setex(cacheKey, 3600, JSON.stringify(updatedVendor));

        res.status(200).json({ updatedVendor });
    } catch (error) {
        res.status(500).json({ error: "Update Failed.", details: error.message });
    }
};

const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const vendorId = req.user.vendorId;

    try {
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: "All fields are required." });
        }

        const vendor = await Vendor.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ error: "Vendor not found." });
        }

        const isMatch = await bcrypt.compare(oldPassword, vendor.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Incorrect old password." });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        vendor.password = hashedNewPassword;
        await vendor.save();

        res.status(200).json({ message: "Password changed successfully." });
    } catch (error) {
        res.status(500).json({ error: "Password change failed.", details: error.message });
    }
};

const getVendorTransactions = async (req, res) => {
    const vendorId = req.user.vendorId;
    try {
        const transactions = await Transaction.find({ buyerId: vendorId, buyerType: 'Vendor' }).sort({ createdAt: -1 });
        res.status(200).json({ transactions });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch transactions.", details: error.message });
    }
};

const getAllVendors = async (req, res) => {
    try {
        const vendors = await Vendor.find({ status: 'active' }).select('name ShopType lat lng address');
        res.status(200).json({ vendors });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch vendors.", details: error.message });
    }
};

const getNearbyVendors = async (req, res) => {
    const { lat, lng, radius } = req.query;
    
    if (!lat || !lng) {
        return res.status(400).json({ error: "Latitude and longitude are required." });
    }

    try {
        let searchRadius = radius;
        
        console.log(`[getNearbyVendors] req.user:`, req.user);

        if (!searchRadius) {
            // Try to get radius from authenticated user
            if (req.user && (req.user.userId || req.user.id)) {
                const searchId = req.user.userId || req.user.id;
                const user = await User.findById(searchId);
                console.log(`[getNearbyVendors] User found:`, !!user, user?.visibilityRadius);
                searchRadius = user ? user.visibilityRadius : 500;
            } else {
                console.log(`[getNearbyVendors] No authenticated user, using 500m default`);
                searchRadius = 500; // Default public radius
            }
        }

        console.log(`[getNearbyVendors] FINAL searchRadius: ${searchRadius}m at [${lat}, ${lng}]`);
        
        // Find vendor IDs within radius using GEORADIUS with WITHCOORD to get live locations
        const rawResults = await redis.georadius('active_vendors_geo', lng, lat, searchRadius, 'm', 'WITHCOORD');
        
        if (!rawResults || rawResults.length === 0) {
            return res.status(200).json({ vendors: [] });
        }

        // Create a map of live coordinates: { vendorId: { lat, lng } }
        const liveLocations = {};
        rawResults.forEach(([id, coords]) => {
            liveLocations[id] = {
                lng: parseFloat(coords[0]),
                lat: parseFloat(coords[1])
            };
        });

        const vendorIds = Object.keys(liveLocations);

        // Fetch details for these vendors from DB
        const dbVendors = await Vendor.find({ 
            _id: { $in: vendorIds },
            status: 'active'
        }).select('name ShopType address phone');

        // Merge live locations into vendor data
        const vendors = dbVendors.map(vendor => {
            const live = liveLocations[vendor._id.toString()];
            return {
                ...vendor.toObject(),
                lat: live ? live.lat : vendor.lat,
                lng: live ? live.lng : vendor.lng,
                isLive: !!live
            };
        });

        res.status(200).json({ 
            message: "Nearby live vendors fetched",
            count: vendors.length,
            vendors 
        });
    } catch (error) {
        console.error("Fetch nearby vendors error:", error);
        res.status(500).json({ error: "Failed to fetch nearby vendors.", details: error.message });
    }
};

const getVendorStats = async (req, res) => {
    const vendorId = req.user.vendorId;
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        // Count pins where this vendor was assigned today
        const completedToday = await Pin.countDocuments({
            deliveredBy: vendorId,
            createdAt: { $gte: startOfToday, $lte: endOfToday }
        });

        res.status(200).json({
            completedToday,
            message: "Vendor stats fetched successfully"
        });
    } catch (error) {
        console.error("Fetch vendor stats error:", error);
        res.status(500).json({ error: "Failed to fetch vendor stats.", details: error.message });
    }
};

module.exports = {
    signupVendor, loginVendor, sendOtp, verifyOtp, vendorDetails, updateVendor, changePassword, getVendorTransactions, getAllVendors, getNearbyVendors, getVendorStats
};
