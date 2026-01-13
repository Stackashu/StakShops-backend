const { Router } = require("express")
const { signUpUser, loginUser, sendOtp, verifyOtp } = require("../Controller/User")
const routes = Router()

routes.post("/signup" , signUpUser)
routes.post("/login",loginUser)
routes.post("/sendOtp",sendOtp)
routes.post("/verifyOtp",verifyOtp)




module.exports = routes