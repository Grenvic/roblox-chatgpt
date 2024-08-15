const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const Redis = require('redis');
const { Pool } = require('pg');
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static('public')); // Serve static files from 'public'

// Redis client setup
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL
});
redisClient.on('error', (err) => console.error('Redis Client Error', err));

// PostgreSQL client setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Route to handle messages from Roblox
app.post('/roblox-message', async (req, res) => {
  const { message, user } = req.body;

  if (!message || !user) {
    return res.status(400).send('Invalid request. Message or user missing.');
  }

  try {
    // Store message in Redis
    await redisClient.rPush('messages', JSON.stringify({ message, user }));

    // Call ChatGPT API
    const response = await axios.post('https://api.openai.com/v1/completions', {
      model: 'gpt-4o-mini',
      prompt: message,
      max_tokens: 150
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const reply = response.data.choices[0].text.trim();

    // Store reply in Redis
    await redisClient.rPush('replies', JSON.stringify({ reply, user }));

    res.json({ reply });
  } catch (error) {
    console.error('Error communicating with ChatGPT:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route for homepage
app.get('/', (req, res) => {
  res.render('index');
});

// Route for Roblox messages page
app.get('/roblox-messages', (req, res) => {
  res.render('roblox-messages');
});

// Route for logs page
app.get('/logs', async (req, res) => {
  try {
    // Fetch logs from Redis or your logging mechanism
    const logs = await redisClient.lRange('logs', 0, -1);
    res.render('logs', { logs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
