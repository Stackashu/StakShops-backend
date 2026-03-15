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
    role: {
        type: String,
        required: true
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
        required: true,
        // select : false
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        required: true,
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
        default: 3
    },
    profilePicture: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['active', 'suspended', 'deleted'],
        default: 'active'
    },
    trialEndDate: {
        type: Date,
        default: function () {
            const date = new Date();
            date.setMonth(date.getMonth() + 1); // 1 month trial
            return date;
        }
    },
    vouchers: [{
        type: String,
    }]
}, { timestamps: true }); // This adds createdAt and updatedAt automatically

module.exports = mongoose.model("User", userSchema);