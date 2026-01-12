const { Router } = require("express")
const { signUpUser } = require("../Controller/User")
const routes = Router()

routes.post("/signup" , signUpUser)




module.exports = routes