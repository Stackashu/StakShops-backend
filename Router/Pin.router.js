const express = require("express");
const router = express.Router();
const { authentication } = require("../Middleware/Authorization");
const { createPin, getPinnedOrders, getActivePins, getPinById, getAllActivePins } = require("../Controller/Pin.controller");

// POST /api/pins - Use a pin and subtract count
router.post("/", authentication, createPin);

// GET /api/pins - Fetch user's pinned orders
router.get("/", authentication, getPinnedOrders);

// GET /api/pins/active - Fetch active pins from Redis for the current user
router.get("/active", authentication, getActivePins);

// GET /api/pins/map-active - Fetch ALL active pins from Redis for the map
router.get("/map-active", getAllActivePins);

// GET /api/pins/:id - Fetch single pin details
router.get("/:id", authentication, getPinById);

module.exports = router;
