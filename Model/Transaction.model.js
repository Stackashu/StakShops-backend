const mongoose = require("mongoose");

const transactionSchema = mongoose.Schema({
    razorpayOrderId: {
        type: String,
        required: true,
        unique: true // Anti-cheat: prevents duplicate orders processing
    },
    razorpayPaymentId: {
        type: String
    },
    razorpaySignature: {
        type: String
    },
    buyerType: {
        type: String,
        enum: ['User', 'Vendor'],
        required: true
    },
    buyerId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'buyerType'
    },
    itemType: {
        type: String,
        enum: ['Subscription', 'PinPackage'],
        required: true
    },
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'itemType'
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    }
}, { timestamps: true });

module.exports = mongoose.model("Transaction", transactionSchema);
