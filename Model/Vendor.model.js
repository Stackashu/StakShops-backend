const mongoose = require("mongoose")

const vendorSchema = mongoose.Schema({
    name:{
        type: String,
        required : true,
        trim : true
    },
    dob:{
        type:Date,
        required: true
    },
    email:{
        type: String,
        required : true,
        lowercase : true,
        unique: true,
        trim : true
    },
    ShopType:{
        type:String,
        trim : true
    },
    password:{
        type: String,
        required: true
    },
    Address:{
        type:String,
    },
    subscriptionStart:{
        type: Date,
    },
    subscriptionEnd:{
        type: Date
    },
    vouchers: [{
        type: String,
        select: false
    }]
},{timestamps: true})

module.exports = mongoose.model("Vendor", vendorSchema);