const User = require("../Model/User.model");
const Vendor = require("../Model/Vendor.model");

const checkStatus = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized. Please login first." });
        }

        const { id, role } = req.user;
        let account;

        if (role === 'vendor') {
            account = await Vendor.findById(id);
        } else {
            account = await User.findById(id);
        }

        if (!account) {
            return res.status(404).json({ error: "Account not found." });
        }

        if (account.status !== 'active') {
            return res.status(403).json({ 
                error: "Access Denied", 
                message: `Your account is currently ${account.status}. Please contact support.` 
            });
        }

        // Attach the full account object for convenience in subsequent controllers
        req.account = account;
        next();
    } catch (error) {
        console.error("Status check error:", error);
        return res.status(500).json({ error: "Internal Server Error during status check." });
    }
};

module.exports = { checkStatus };
