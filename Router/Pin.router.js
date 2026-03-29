const express = require("express");
const router = express.Router();
const { authentication, optionalAuthentication } = require("../Middleware/Authorization");
const { createPin, getPinnedOrders, getActivePins, getPinById, getAllActivePins, getNearbyPins } = require("../Controller/Pin.controller");


// POST /api/pins - Use a pin and subtract count
router.post("/", authentication, createPin);

// GET /api/pins - Fetch user's pinned orders
router.get("/", authentication, getPinnedOrders);

// GET /api/pins/active - Fetch active pins from Redis for the current user
router.get("/active", authentication, getActivePins);

// GET /api/pins/map-active - Fetch ALL active pins from Redis for the map (Restricted to user's own pins)
router.get("/map-active", authentication, getAllActivePins);

// GET /api/pins/nearby - Fetch nearby pins (Dynamic radius)
router.get("/nearby", optionalAuthentication, getNearbyPins);

// GET /api/pins/:id - Fetch single pin details
router.get("/:id", authentication, getPinById);

// POST /api/pins/confirm/:id - Vendor confirms a pinned order
router.post("/confirm/:id", authentication, require("../Controller/Pin.controller").confirmPin);

module.exports = router;
