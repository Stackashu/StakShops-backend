const Router = require("express")
const { authentication } = require("../Middleware/Authorization")
const { signupVendor, vendorDetails, loginVendor, sendOtp, verifyOtp, updateVendor } = require("../Controller/Vendor")
const routes = Router()

routes.get("/", authentication, vendorDetails)
routes.post("/signup", signupVendor)
routes.post("/login", loginVendor)
routes.post("/sendOtp", sendOtp)
routes.post("/verifyOtp", verifyOtp)
routes.post("/updateVendor", authentication, updateVendor)
module.exports = routes