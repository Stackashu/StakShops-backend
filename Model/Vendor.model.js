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
    }
},{timestamps: true})