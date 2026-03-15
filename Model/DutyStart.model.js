const mongoose = require('mongoose')

const itemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    isLeft: {
        type: Boolean,
        default: true  
    }
})

const dutyStartSchema = new mongoose.Schema({
    startingTime: {
        type: Date,
        required: true
    },
    endingTime: {
        type: Date,
        required: true
    },
    items: [itemSchema],

    totalWorkingHours: {
        type: Number,
        required: true
    }
}, { timestamps: true })

module.exports = mongoose.model("VendorDuty", dutyStartSchema)