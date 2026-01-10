const express = require('express');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDb = require('./DB/Database.js');

dotenv.config();

// Connect to database
connectDb();

const app = express();

app.use(morgan('dev'));
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello, world!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});