const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const request = require('request'); // Import request for HTTP logging
const app = express();

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Function to send logs to Papertrail
function sendToPapertrail(message) {
  const token = process.env.PAPERTRAIL_API_TOKEN;
  const options = {
    url: 'https://logs.papertrailapp.com/' + token,
    method: 'POST',
    json: {
      message: message
    }
  };

  request(options, (error, response, body) => {
    if (error) {
      console.error('Error sending log to Papertrail:', error);
    } else {
      console.log('Log sent to Papertrail:', body);
    }
  });
}

// Endpoint to receive messages from Roblox
app.post('/roblox-message', async (req, res) => {
  const { message, user } = req.body;

  if (!message || !user) {
    return res.status(400).send('Invalid request. Message or user missing.');
  }

  try {
    // Log received message
    sendToPapertrail(`Received message from ${user}: ${message}`);

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
    sendToPapertrail(`Reply from ChatGPT: ${reply}`);

    // Send the reply back to Roblox
    res.json({ reply });
  } catch (error) {
    sendToPapertrail('Error communicating with ChatGPT: ' + error.message);
    res.status(500).send('Internal Server Error');
  }
});

// Basic route for testing
app.get('/', (req, res) => {
  res.send('<h1>Hello, world! Your app is running successfully. :3</h1><a href="/roblox-messages">Go to Roblox Messages</a>');
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
