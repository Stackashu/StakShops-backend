const mongoose = require('mongoose')

//This is for the User the Location he will put an Pin
const pinSchema = mongoose.Schema({
    orderedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    deliveryLocation:{
        type: String,
        required: true
    },
    lat: {
        type: Number,
        required: true
    },
    lng: {
        type: Number,
        required: true
    },
    deliveredBy:{
        type: mongoose.Schema.Types.ObjectId,
        ref : 'Vendor',
        required: true
    },
    item: {
        type: String,
    },
    shopType :{
        type : String,
    },
    expiryAt: {
        type: Date,
    },
    status: {
        type: String,
        enum: ['pinned', 'confirmed'],
        default: 'pinned'
    },
    confirmedAt: {
        type: Date
    }
},{timestamps: true})

module.exports = mongoose.model('Pin' , pinSchema);