const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Pool } = require('pg');
const Redis = require('redis');
const cookieParser = require('cookie-parser'); // Added cookie-parser

const app = express();

// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(cookieParser()); // Use cookie-parser for managing cookies
app.use(express.static('public')); // Serve static files from 'public' directory

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
  const theme = req.cookies.theme || 'light'; // Get the theme from cookies
  res.send(`
    <html>
      <head>
        <title>Home</title>
        <link rel="stylesheet" type="text/css" href="/styles.css">
      </head>
      <body class="${theme}">
        <h1>Welcome to My Chat App</h1>
        <a href="/roblox-messages"><button>Go to Roblox Messages</button></a>
        <button id="toggle-theme">Toggle Dark Mode</button>
        <script>
          document.getElementById('toggle-theme').onclick = function() {
            const currentTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
            document.cookie = 'theme=' + (currentTheme === 'dark' ? 'light' : 'dark') + '; path=/';
            location.reload();
          };
        </script>
      </body>
    </html>
  `);
});

// Route to display Roblox messages
app.get('/roblox-messages', async (req, res) => {
  const theme = req.cookies.theme || 'light'; // Get the theme from cookies
  try {
    // Retrieve messages from Redis
    redisClient.lRange('messages', 0, -1, (err, messages) => {
      if (err) {
        console.error('Error retrieving messages from Redis:', err);
        return res.status(500).send('Error retrieving messages.');
      }

      // Render messages on the page
      res.send(`
        <html>
          <head>
            <title>Roblox Messages</title>
            <link rel="stylesheet" type="text/css" href="/styles.css">
          </head>
          <body class="${theme}">
            <h1>Roblox Messages</h1>
            <a href="/"><button>Back to Home</button></a>
            <button id="toggle-theme">Toggle Dark Mode</button>
            <ul>
              ${messages.map(message => {
                const { user, message: msg, reply } = JSON.parse(message);
                return `<li><strong>${user}</strong>: ${msg} <br> <em>Reply: ${reply}</em></li>`;
              }).join('')}
            </ul>
            <script>
              document.getElementById('toggle-theme').onclick = function() {
                const currentTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
                document.cookie = 'theme=' + (currentTheme === 'dark' ? 'light' : 'dark') + '; path=/';
                location.reload();
              };
            </script>
          </body>
        </html>
      `);
    });
  } catch (error) {
    console.error('Error displaying messages:', error);
    res.status(500).send('Error displaying messages.');
  }
});

// Set the port to the Heroku environment variable or default to 3000
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
