const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const morgan = require('morgan');
const connectDb = require('./DB/Database.js');
const userRoutes = require('./Router/User.router.js');
const vendorRoutes = require("./Router/Vendor.router.js");
const subscriptionRoutes = require("./Router/Subscription.router.js");
const pinRoutes = require("./Router/Pin.router.js");
const cors = require("cors");


// Import workers to start processing jobs
require('./Utils/WorkerQueue.js');

// Connect to database
connectDb();

const app = express();
app.use(cors());

// app.use(morgan('dev'));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Health Ok!');
});

app.use("/api/user", userRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/pins", pinRoutes);

const http = require('http');
const { setupSocket } = require('./Utils/Socket.js');

const server = http.createServer(app);

// Setup Socket.io
setupSocket(server);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});