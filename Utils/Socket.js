const { Server } = require("socket.io");
const redis = require("./Redis");

let io;

const setupSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*", // Adjust this for production
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        console.log("New client connected:", socket.id);

        // Handle user/vendor registration
        socket.on("register", async (data) => {
            const { userId, vendorId } = data;
            
            if (userId) {
                socket.userId = userId;
                await redis.sadd("online_users", userId);
                console.log(`[Socket] User ${userId} is online`);
            } else if (vendorId) {
                socket.vendorId = vendorId;
                await redis.sadd("online_vendors", vendorId);
                console.log(`[Socket] Vendor ${vendorId} is online`);
            }
        });

        // Vendor-specific Real-time Hosting
        socket.on("vendor_start_serving", async (data) => {
            const { vendorId, lat, lng } = data;
            if (!vendorId || !lat || !lng) return;
            
            socket.vendorId = vendorId;
            socket.isServing = true;
            
            // Add to active_vendors_geo
            await redis.geoadd('active_vendors_geo', lng, lat, vendorId);
            console.log(`[Socket] Vendor ${vendorId} STARTED serving at ${lat}, ${lng}`);
        });

        socket.on("vendor_update_location", async (data) => {
            const { vendorId, lat, lng } = data;
            if (!vendorId || !lat || !lng) return;
            
            await redis.geoadd('active_vendors_geo', lng, lat, vendorId);
            console.log(`[Socket] Vendor ${vendorId} UPDATED location to ${lat}, ${lng}`);
        });

        socket.on("vendor_stop_serving", async (data) => {
            const { vendorId } = data;
            if (!vendorId) return;
            
            socket.isServing = false;
            await redis.zrem('active_vendors_geo', vendorId);
            console.log(`[Socket] Vendor ${vendorId} STOPPED serving`);
        });

        socket.on("user_update_location", async (data) => {
            const { userId, lat, lng } = data;
            if (!userId || !lat || !lng) return;
            
            await redis.geoadd('active_users_geo', lng, lat, userId);
            console.log(`[Socket] User ${userId} UPDATED location to ${lat}, ${lng}`);
        });

        socket.on("disconnect", async () => {
            console.log("Client disconnected:", socket.id);
            
            if (socket.userId) {
                await redis.srem("online_users", socket.userId);
                await redis.zrem('active_users_geo', socket.userId);
                console.log(`[Socket] User ${socket.userId} went offline`);
            } else if (socket.vendorId) {
                await redis.srem("online_vendors", socket.vendorId);
                await redis.zrem('active_vendors_geo', socket.vendorId);
                console.log(`[Socket] Vendor ${socket.vendorId} went offline and stopped serving`);
            }
        });
    });

    return io;
};

const getIo = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

module.exports = { setupSocket, getIo };
