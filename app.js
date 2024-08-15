const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

let messages = []; // Store received messages

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Endpoint to receive messages from Roblox
app.post('/roblox-message', async (req, res) => {
  const { message, user } = req.body;

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

    // Store the received message and reply
    messages.push({ user, message, reply });

    // Send the reply back to Roblox
    res.json({ reply });
  } catch (error) {
    console.error('Error communicating with ChatGPT:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to display all received messages
app.get('/roblox-messages', (req, res) => {
  res.send(`
    <h1>Messages Received from Roblox</h1>
    <ul>
      ${messages.map(msg => `<li><strong>${msg.user}</strong>: ${msg.message} <br> <em>Reply:</em> ${msg.reply}</li>`).join('')}
    </ul>
    <button onclick="window.location.href='/'">Go Back to Home</button>
  `);
});

// Basic route for testing with navigation button
app.get('/', (req, res) => {
  res.send(`
    <h1>Hello, world! Your app is running successfully. :3</h1>
    <button onclick="window.location.href='/roblox-messages'">View Roblox Messages</button>
  `);
});

// Set the port to the Heroku environment variable or default to 3000
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
