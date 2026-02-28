const Vendor = require('../Model/Vendor.model.js')
const bcrypt = require('bcryptjs')
const { signUpQueue, otpSendingQueue } = require('../Utils/ProducerQueue.js');
const jwt = require('jsonwebtoken');
const redis = require("../Utils/Redis.js"); // Redis connection for caching and BullMQ
const { otpGenerator } = require("../Utils/HelpingFunctions.js");


const signupVendor = async (req, res) => {
    const vendorDetails = req.body;
    try {
        const requiredDetails = ["name", "email", "password"];
        for (const i of requiredDetails) {
            if (!vendorDetails[i]) {
                return res.status(400).json({ error: "All fields must be filled." })
            }
        }

        const vendorAlreadyExist = await Vendor.findOne({ email: vendorDetails.email })

        if (vendorAlreadyExist) return res.status(400).json({ error: "This email is already with us." })

        const hashedPassword = await bcrypt.hash(vendorDetails.password, 10);

        vendorDetails.password = hashedPassword

        let vendor = await Vendor.create(vendorDetails);

        vendor = await Vendor.findOne(vendor._id).select("-password");

        await signUpQueue.add("email to vendor", {
            to: vendor.email,
            name: vendor.name
        })

        const token = jwt.sign({
            vendorId: vendor._id, email: vendor.email
        }, process.env.JWT_SECRET, {
            expiresIn: "7d"
        })

        res.status(201).json({ vendor, token })
    } catch (error) {
        res.status(500).json({ error: "Signup failed", details: error.message })
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

        // Exclude the password field from the returned vendor object
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

        // Store OTP in Redis with 10 minutes expiration
        const otpKey = `otp:${email}`;
        await redis.setex(otpKey, 600, generatedOtp); // 600 seconds = 10 minutes

        await otpSendingQueue.add("otp send to user", {
            to: email,
            otp: generatedOtp
        })
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

        // Retrieve OTP from Redis
        const otpKey = `otp:${email}`;
        const otpFromRedis = await redis.get(otpKey);

        if (!otpFromRedis)
            return res.status(400).json({ error: "OTP expired or not found. Please request a new OTP." });

        const matched = otpFromRedis === otp;
        if (!matched)
            return res.status(400).json({ error: "Your entered otp is wrong." });

        // Delete OTP from Redis after successful verification
        await redis.del(otpKey);

        res.status(200).json({ message: "OTP verified successfully" });
    } catch (error) {
        res
            .status(500)
            .json({ error: "Something went wrong.", details: error.message });
    }
};


const vendorDetails = async (req, res) => {
    const { email } = req.body;
    try {
        if (!email) return res.status(400).json({ error: "Fill all fields." });

        const cacheKey = `vendor:${email}`;
        const cachedVendor = await redis.get(cacheKey);

        if (cachedVendor) {
            return res.status(200).json({ vendorFound: JSON.parse(cachedVendor), fromCache: true })
        }

        const vendorFound = await Vendor.findOne({ email });

        if (!vendorFound) return res.status(400).jwt({ error: "Vendor not found." });

        await redis.setex(cacheKey, 3600, JSON.stringify(vendorFound));


        res.status(200).json({ vendorFound, fromCache: false })
    } catch (error) {
        res.status(500).json({ error: "Something went wrong.0 ", message: error.message })
    }
}

const updateVendor = async (req, res) => {
    const vendorData = req.body;
    try {
        if (!vendorData || !vendorData.email) {
            return res.status(400).json({ error: "Please fill all the fields." });
        }

        // Find the vendor using the provided email
        const vendorFound = await Vendor.findOne({ email: vendorData.email });
        if (!vendorFound) {
            return res.status(400).json({ error: "No vendor is associated with this email." });
        }

        // Update vendor's information
        const updatedVendor = await Vendor.findOneAndUpdate(
            { email: vendorData.email },
            { ...vendorData },  // Only update with fields from vendorData, not the whole req.body for safety
            { new: true, runValidators: true }
        ).select("-password");

        if (!updatedVendor) {
            return res.status(400).json({ error: "Vendor update failed." });
        }

        const cacheKey = `vendor:${vendorData.email}`;
        await redis.del(cacheKey);
        await redis.setex(cacheKey, 3600, JSON.stringify(updatedVendor));

        res.status(200).json({ updatedVendor });
    } catch (error) {
        res.status(500).json({ error: "Update Failed.", details: error.message });
    }
};


module.exports = {
    signupVendor, loginVendor, sendOtp, verifyOtp, vendorDetails, updateVendor
}