const mongoose = require('mongoose')

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
    deliveredBy:{
        type: mongoose.Schema.Types.ObjectId,
        ref : 'Vendor',
        required: true
    },
    shopType :{
        type : String,
    },
},{timestamps: true})

module.exports = mongoose.model('Pin' , pinSchema);