const User = require("../Model/User.model.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const redis = require("../Utils/Redis.js"); // Redis connection for caching and BullMQ
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

    const hashedPassword = await bcrypt.hash(userDetails.password, 10);

    userDetails.password = hashedPassword;

    let user = await User.create(userDetails);

    user = await User.findById(user._id).select("-password");

    // Here to Add Queue for mailing
    await signUpQueue.add("email to user", {
      to: user.email,
      name: user.name
    })

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

    // Hide the password field in the response
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

const userDetails = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email)
      return res.status(400).json({ error: "Please Enter all fields." });

    // Try to get user from Redis cache first
    const cacheKey = `user:${email}`;
    const cachedUser = await redis.get(cacheKey);

    if (cachedUser) {
      // User found in cache
      return res.status(200).json({
        userFound: JSON.parse(cachedUser),
        fromCache: true
      });
    }

    // If not in cache, fetch from database
    const userFound = await User.findOne({ email }).select("-password");

    if (!userFound)
      return res.status(400).json({ error: "No user found with this email." });

    // Store user in Redis cache for 1 hour (3600 seconds)
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
  const { userData } = req.body;
  try {
    if (!userData)
      return res.status(400).json({ error: "Please all the fields" });

    const userFound = await User.findOne({ email: userData.email });
    if (!userFound)
      return res
        .status(400)
        .json({ error: "No user is asssociated with this email." });

    const updatedUser = await User.findOneAndUpdate(
      { email: userData.email },
      { ...req.body },
      { new: true, runValidators: true }
    ).select("-password");

    // Invalidate cache after update
    const cacheKey = `user:${userData.email}`;
    await redis.del(cacheKey);

    // Optionally, update cache with new data
    await redis.setex(cacheKey, 3600, JSON.stringify(updatedUser));

    res.status(201).json({ updatedUser });
  } catch (error) {
    res.status(500).json({ error: "Update Failed.", details: error.message });
  }
};

module.exports = {
  signUpUser,
  loginUser,
  sendOtp,
  verifyOtp,
  userDetails,
  updateUser,
};
