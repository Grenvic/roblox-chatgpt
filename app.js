const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Pool } = require('pg');
const Redis = require('redis');

const app = express();

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Initialize PostgreSQL and Redis clients
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Ensure SSL is configured properly
});

const redisClient = Redis.createClient({
  url: process.env.REDIS_URL
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

// Endpoint to receive messages from Roblox
app.post('/roblox-message', async (req, res) => {
  const { message, user } = req.body; // Extract message and user from request body

  if (!message || !user) {
    return res.status(400).send('Invalid request. Message or user missing.');
  }

  try {
    // Log received message
    console.log(`Received message from ${user}: ${message}`);

    // Call ChatGPT API with the received message
    const response = await axios.post('https://api.openai.com/v1/completions', {
      model: 'gpt-4o-mini', // Replace with your model
      prompt: message,
      max_tokens: 150
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const reply = response.data.choices[0].text.trim();

    // Log the reply from ChatGPT
    console.log(`Reply from ChatGPT: ${reply}`);

    // Store received message and reply in Redis
    redisClient.lPush('messages', JSON.stringify({ user, message, reply }));

    // Store the message and reply in PostgreSQL
    await pool.query('INSERT INTO messages(user, message, reply) VALUES($1, $2, $3)', [user, message, reply]);

    // Send the reply back to Roblox
    res.json({ reply });
  } catch (error) {
    console.error('Error communicating with ChatGPT:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Basic route for testing
app.get('/', (req, res) => {
  res.send('Hello, world! Your app is running successfully. :3');
});

// Remove the logs route
// app.get('/logs', (req, res) => {
//   res.send('Logs page');
// });

// Set the port to the Heroku environment variable or default to 3000
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
