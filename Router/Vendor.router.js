const Router = require("express")
const { authentication, optionalAuthentication } = require("../Middleware/Authorization")
const { signupVendor, vendorDetails, loginVendor, sendOtp, verifyOtp, updateVendor, changePassword, getVendorTransactions, getAllVendors, getNearbyVendors, getVendorStats } = require("../Controller/Vendor")
const routes = Router()

routes.get("/", authentication, vendorDetails)
routes.get("/stats", authentication, getVendorStats)
routes.post("/signup", signupVendor)
routes.post("/login", loginVendor)
routes.post("/sendOtp", sendOtp)
routes.post("/verifyOtp", verifyOtp)
routes.post("/updateVendor", authentication, updateVendor)
routes.post("/changePassword", authentication, changePassword);
routes.get("/transactions", authentication, getVendorTransactions);
routes.get("/all", getAllVendors);
routes.get("/nearby-vendors", optionalAuthentication, getNearbyVendors);
routes.post("/save-fcm-token", authentication, require("../Controller/User").saveFcmToken);

module.exports = routes