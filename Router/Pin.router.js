const express = require("express");
const router = express.Router();
const { authentication } = require("../Middleware/Authorization");
const { createPin } = require("../Controller/Pin.controller");

// POST /api/pins - Use a pin and subtract count
router.post("/", authentication, createPin);

module.exports = router;
