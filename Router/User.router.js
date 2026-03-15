const { Router } = require("express");
const {signUpUser,loginUser,sendOtp,verifyOtp,userDetails, updateUser, changePassword, getUserTransactions} = require("../Controller/User");
const { authentication } = require("../Middleware/Authorization");
const routes = Router();

routes.get("/", authentication, userDetails);
routes.post("/signup", signUpUser);
routes.post("/login", loginUser);
routes.post("/sendOtp", sendOtp);
routes.post("/verifyOtp", verifyOtp);
routes.post("/updateUser" , authentication , updateUser)
routes.post("/changePassword", authentication, changePassword);
routes.get("/transactions", authentication, getUserTransactions);

module.exports = routes;
