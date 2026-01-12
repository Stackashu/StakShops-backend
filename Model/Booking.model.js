const mongoose = require("mongoose")

const bookingSchmea = mongoose.Schema({
    orderedBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
        required : true
    },
    deliveredBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "Vendor",
        required : true
    },
    deliveryLocation : {
        type : mongoose.Schema.Types.ObjectId,
        required : true
    },
    shopType : {
        type : mongoose.Schema.Types.ObjectId,
    }
})

module.exports = mongoose.model("Booking" , bookingSchmea);