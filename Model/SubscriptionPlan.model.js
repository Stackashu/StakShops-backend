const mongoose = require("mongoose");

const subscriptionPlanSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true
    },
    durationDays: {
        type: Number,
        required: true
    },
    visibilityRadius: {
        type: Number,
        required: true,
        default: 300 // default to base plan radius
    },
    features: [{
        type: String
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
