const User = require('../Model/User.model.js')
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken")
const {Queue} = require("bullmq");
const redisConnection = require('../Utils/Redis.js');

const signUpQueue = new Queue("email-queue",{
    connection : redisConnection
})



const signUpUser =  async ( req , res) => {
    const userDetails = req.body;
    try {
         const requiredFields = ['name' , 'email' , 'password']
        for (const field of requiredFields) {
            if (!userDetails[field]) {
                return res.status(400).json({ error: "All values must be filled." });
            }
        }
        
        const userAlreadyExist = await User.findOne({email : userDetails.email})

        if(userAlreadyExist) return res.status(409).json({ error : "User already exits with this email."})
        
        const hashedPassword = await bcrypt.hash(userDetails.password, 10);

        userDetails.password = hashedPassword;

        let user = await User.create(userDetails);

        user = await User.findById(user._id).select("-password");

        await signUpQueue.add("email to user" , {
            to : user.email,
            name : user.name
        })

        const token = jwt.sign(
            {userId : user._id , email : user.email },
            process.env.JWT_SECRET,
            {expiresIn : "7d"}
        )

        res.status(201).json({user , token});

    } catch (error) {
         res.status(500).json({error : "Signup Failed." , details : error.message})
    }
}

module.exports = {signUpUser}