const jwt = require("jsonwebtoken");

const authentication = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: "Access Denied. No Authorization header provided" });
        }

        const [scheme, token] = authHeader.split(" ");

        if (!token || scheme !== "Bearer") {
            return res.status(401).json({ error: "Access denied. Invalid token format." });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // attach user info to req if desired
        next();
    } catch (error) {
        return res.status(401).json({ error: "Invalid token", message: error.message });
    }
};

module.exports = { authentication };