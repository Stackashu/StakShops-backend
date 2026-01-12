const mongoose = require('mongoose')

const dutyStartSchema = mongoose.Schema({
    startingTime :{
        type : Date ,
        required : true
    },
    endingTime : {
        type : Date ,
        required : true,
    },
    totalWorkingHours : {
        type: Number,
        required : true
    }
}, {timestamps : true})

module.exports = mongoose.model("DutyStart" , dutyStartSchema);