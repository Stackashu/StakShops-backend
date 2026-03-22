const User = require("../Model/User.model.js");
const Transaction = require("../Model/Transaction.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const redis = require("../Utils/Redis.js"); 
const { signUpQueue, otpSendingQueue } = require("../Utils/ProducerQueue.js");
const { otpGenerator } = require("../Utils/HelpingFunctions.js");

const signUpUser = async (req, res) => {
  const userDetails = req.body;
  try {
    const requiredFields = ["name", "email", "password"];
    for (const field of requiredFields) {
      if (!userDetails[field]) {
        return res.status(400).json({ error: "All values must be filled." });
      }
    }

    const userAlreadyExist = await User.findOne({ email: userDetails.email });

    if (userAlreadyExist)
      return res
        .status(409)
        .json({ error: "User already exits with this email." });

    // Check if email is verified via OTP
    const verifiedKey = `verified_email:${userDetails.email}`;
    const isVerified = await redis.get(verifiedKey);
    if (!isVerified) {
      return res.status(400).json({ error: "Email not verified. Please verify your email via OTP first." });
    }

    const hashedPassword = await bcrypt.hash(userDetails.password, 10);

    userDetails.password = hashedPassword;

    let user = await User.create(userDetails);

    user = await User.findById(user._id).select("-password");

    // Clear verification flag after successful signup
    await redis.del(verifiedKey);

    await signUpQueue.add("email to user", {
      to: user.email,
      name: user.name
    });

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ user, token });
  } catch (error) {
    res.status(500).json({ error: "Signup Failed.", details: error.message });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ error: "All fields must be filled." });
    }

    const user = await User.findOne({ email: email });
    if (!user) {
      return res
        .status(400)
        .json({ error: "No user is associated with this email." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ error: "Maybe your Email or password is wrong" });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const userData = user.toObject();
    delete userData.password;

    res.status(200).json({ user: userData, token });
  } catch (error) {
    res.status(500).json({ error: "Login failed", details: error.message });
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

const userDetails = async (req, res) => {
  const email = req.user.email;

  try {
    if (!email)
      return res.status(401).json({ error: "Unauthorized. No email in token." });

    const cacheKey = `user:${email}`;
    const cachedUser = await redis.get(cacheKey);

    if (cachedUser) {
      return res.status(200).json({
        userFound: JSON.parse(cachedUser),
        fromCache: true
      });
    }

    const userFound = await User.findOne({ email }).select("-password");

    if (!userFound)
      return res.status(400).json({ error: "No user found with this email." });

    await redis.setex(cacheKey, 3600, JSON.stringify(userFound));

    res.status(200).json({
      userFound,
      fromCache: false
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "User fetching failed.", details: error.message });
  }
};

const updateUser = async (req, res) => {
  const userId = req.user.userId;
  const updateData = req.body;

  try {
    if (!updateData) {
      return res.status(400).json({ error: "No data provided for update." });
    }

    delete updateData.password;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const cacheKey = `user:${updatedUser.email}`;
    await redis.del(cacheKey);
    await redis.setex(cacheKey, 3600, JSON.stringify(updatedUser));

    res.status(200).json({ updatedUser });
  } catch (error) {
    res.status(500).json({ error: "Update Failed.", details: error.message });
  }
};

const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.userId;

  try {
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "All fields are required." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Incorrect old password." });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();

    res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    res.status(500).json({ error: "Password change failed.", details: error.message });
  }
};

const getUserTransactions = async (req, res) => {
  const userId = req.user.userId;
  try {
    const transactions = await Transaction.find({ buyerId: userId, buyerType: 'User' }).sort({ createdAt: -1 });
    res.status(200).json({ transactions });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch transactions.", details: error.message });
  }
};

module.exports = {
  signUpUser,
  loginUser,
  sendOtp,
  verifyOtp,
  userDetails,
  updateUser,
  changePassword,
  getUserTransactions
};
