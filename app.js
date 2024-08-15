const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Basic route for testing
app.get('/', (req, res) => {
  res.send('Hello, world! Your app is running successfully.');
});

// Example route using axios
app.post('/data', async (req, res) => {
  try {
    const response = await axios.post('https://api.example.com/data', req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).send('Error fetching data');
  }
});

// Set the port to the Heroku environment variable or default to 3000
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
