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
                console.log(`User ${userId} is online`);
            } else if (vendorId) {
                socket.vendorId = vendorId;
                await redis.sadd("online_vendors", vendorId);
                console.log(`Vendor ${vendorId} is online`);
            }
        });

        socket.on("disconnect", async () => {
            console.log("Client disconnected:", socket.id);
            
            if (socket.userId) {
                await redis.srem("online_users", socket.userId);
                console.log(`User ${socket.userId} went offline`);
            } else if (socket.vendorId) {
                await redis.srem("online_vendors", socket.vendorId);
                console.log(`Vendor ${socket.vendorId} went offline`);
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
