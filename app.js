const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Redis connection
const redis = new Redis(process.env.REDIS_URL);

// ChatGPT API endpoint (replace with actual endpoint)
const CHATGPT_API_URL = 'https://api.openai.com/v1/chat/completions';

app.post('/api/chat', async (req, res) => {
  const { message, userId, position } = req.body;

  try {
    // Check if user is within 20 studs
    if (position > 20) {
      return res.status(400).json({ error: 'User is too far away' });
    }

    // Get conversation history from PostgreSQL
    const history = await getConversationHistory(userId);

    // Send message to ChatGPT
    const chatGPTResponse = await sendToChatGPT(message, history);

    // Save conversation to PostgreSQL
    await saveConversation(userId, message, chatGPTResponse);

    // Cache frequently used data in Redis
    await cacheUserData(userId, { lastMessage: message, lastResponse: chatGPTResponse });

    res.json({ response: chatGPTResponse });
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ error: 'An error occurred while processing the chat' });
  }
});

async function getConversationHistory(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT message, response FROM conversations WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 5', [userId]);
    return result.rows;
  } finally {
    client.release();
  }
}

async function sendToChatGPT(message, history) {
  const conversation = history.map(h => ({ role: 'user', content: h.message })).concat([{ role: 'user', content: message }]);
  
  const response = await axios.post(CHATGPT_API_URL, {
    model: 'gpt-3.5-turbo',
    messages: conversation
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data.choices[0].message.content;
}

async function saveConversation(userId, message, response) {
  const client = await pool.connect();
  try {
    await client.query('INSERT INTO conversations (user_id, message, response) VALUES ($1, $2, $3)', [userId, message, response]);
  } finally {
    client.release();
  }
}

async function cacheUserData(userId, data) {
  await redis.hset(`user:${userId}`, data);
  await redis.expire(`user:${userId}`, 3600); // Expire after 1 hour
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
