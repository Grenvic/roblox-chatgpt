const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const request = require('request');
const redis = require('redis');
const { Client } = require('pg');
const app = express();

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Setup Papertrail logging
const papertrailToken = process.env.PAPERTRAIL_API_TOKEN;
const papertrailURL = `https://logs.papertrailapp.com/${papertrailToken}`;

function sendToPapertrail(message) {
  request.post({
    url: papertrailURL,
    json: { message: message }
  }, (error, response, body) => {
    if (error) {
      console.error('Error sending log to Papertrail:', error);
    } else {
      console.log('Log sent to Papertrail:', body);
    }
  });
}

// Setup Redis
const redisClient = redis.createClient({
  url: process.env.REDISTOGO_URL
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

// Setup PostgreSQL
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL
});

pgClient.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch((err) => console.error('PostgreSQL connection error:', err));

// Endpoint to receive messages from Roblox
app.post('/roblox-message', async (req, res) => {
  const { message, user } = req.body;

  if (!message || !user) {
    return res.status(400).send('Invalid request. Message or user missing.');
  }

  try {
    // Log received message
    sendToPapertrail(`Received message from ${user}: ${message}`);

    // Store message in Redis
    redisClient.set(`message:${user}`, message);

    // Call ChatGPT API with the received message
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

    // Log the reply from ChatGPT
    sendToPapertrail(`Reply from ChatGPT: ${reply}`);

    // Store reply in PostgreSQL
    await pgClient.query('INSERT INTO messages(user, message, reply) VALUES($1, $2, $3)', [user, message, reply]);

    // Send the reply back to Roblox
    res.json({ reply });
  } catch (error) {
    sendToPapertrail('Error communicating with ChatGPT: ' + error.message);
    res.status(500).send('Internal Server Error');
  }
});

// Basic route for testing
app.get('/', (req, res) => {
  res.send('<h1>Hello, world! Your app is running successfully. :3</h1><a href="/roblox-messages">Go to Roblox Messages</a><br><a href="/logs">Go to Logs</a>');
});

// Roblox Messages page route
app.get('/roblox-messages', async (req, res) => {
  redisClient.keys('message:*', (err, keys) => {
    if (err) {
      return res.status(500).send('Error retrieving messages from Redis');
    }

    const messages = keys.map(key => {
      return new Promise((resolve, reject) => {
        redisClient.get(key, (err, value) => {
          if (err) reject(err);
          resolve({ key, value });
        });
      });
    });

    Promise.all(messages).then(results => {
      res.send('<h1>Roblox Messages</h1><ul>' + results.map(r => `<li>${r.key}: ${r.value}</li>`).join('') + '<br><a href="/">Go back to Home</a></ul>');
    }).catch(() => {
      res.status(500).send('Error retrieving messages from Redis');
    });
  });
});

// Logs page route
app.get('/logs', (req, res) => {
  res.send('<h1>Logs Page</h1><a href="/">Go back to Home</a>');
});

// Set the port to the Heroku environment variable or default to 3000
const port = process.env.PORT || 3000;
app.listen(port, () => {
  sendToPapertrail(`Server running on port ${port}`);
});
