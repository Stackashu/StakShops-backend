const mongoose = require("mongoose");

// Enable timestamps in schema to automatically add createdAt and updatedAt
const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    dob: {
        type: Date
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    address: {
        type: String,
        trim: true
    },
    subscriptionStart: {
        type: Date
    },
    subscriptionEnd: {
        type: Date
    },
    pins: {
        type: Number,
        default: 2
    },
    profilePicture: {
        type: String,
        trim: true
    }
}, { timestamps: true }); // This adds createdAt and updatedAt automatically

module.exports = mongoose.model("User", userSchema);