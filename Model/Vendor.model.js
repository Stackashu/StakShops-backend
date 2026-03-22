const mongoose = require("mongoose")

const vendorSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    dob: {
        type: Date,
        required: true
    },
    role: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        unique: true,
        trim: true
    },
    ShopType: {
        type: String,
        trim: true
    },
    password: {
        type: String,
        // select : false,
        required: true
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
        type: Date,
    },
    subscriptionEnd: {
        type: Date
    },
    vouchers: [{
        type: String,
    }],
    status: {
        type: String,
        enum: ['active', 'suspended', 'deleted'],
        default: 'active'
    },
    isVisibilityBoosted: {
        type: Boolean,
        default: true
    },
    trialEndDate: {
        type: Date,
        default: function () {
            const date = new Date();
            date.setMonth(date.getMonth() + 1); // 1 month free trial
            return date;
        }
    },
    currentSubscription: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription'
    },
    visibilityRadius: {
        type: Number,
        default: 300
    }
}, { timestamps: true })

module.exports = mongoose.model("Vendor", vendorSchema);