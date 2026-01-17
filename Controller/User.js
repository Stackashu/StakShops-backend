const User = require("../Model/User.model.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Queue, asyncSend, tryCatch } = require("bullmq");
const redisConnection = require("../Utils/Redis.js");
const { otpGenerator } = require("../Utils/HelpingFunctions.js");

const signUpQueue = new Queue("email-queue",{
    connection : redisConnection
})

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
    // await signUpQueue.add("email to user" , {
    //     to : user.email,
    //     name : user.name
    // })

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

    //Here use redis to store the otp for verifying it

    res.status(201).json({ generatedOtp });
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

    // HERE SEARCH FOR THE OTP IN REDIS TO COMPARE IT THEN MOVE FURTHER
    const otpFromRedis = "000000";
    const matched = otpFromRedis == otp;
    if (!matched)
      return res.status(400).json({ error: "Your entered otp is wrong." });

    res.status(200).json({ message: "Successfully matched" });
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

    const userFound = User.findOne({ email }).select("-password");

    if (!userFound)
      return res.status(400).json({ error: "No user found with this email." });

    res.status(200).json({ userFound });
  } catch (error) {
    res
      .status(500)
      .json({ error: "User fetching failes.", details: error.message });
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
      { email },
      { ...req.body },
      { new: true, runValidators: true }
    );

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
