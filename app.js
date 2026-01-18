const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const morgan = require('morgan');
const connectDb = require('./DB/Database.js');
const userRoutes = require('./Router/User.router.js');

// Import workers to start processing jobs
require('./Utils/WorkerQueue.js');

// Connect to database
connectDb();

const app = express();

app.use(morgan('dev'));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Health Ok!');
});

app.use("/api/user",userRoutes)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});