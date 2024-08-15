const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// Replace with your OpenAI API key
const OPENAI_API_KEY = 'sk-34HgDp7tAostdejXm9AE9kD65lBIBBzt536Zeb7P8rT3BlbkFJHjwJpIetofCWRf2IqrvbYRMWnfFBkRLk3PzIl0ZTgA';

app.post('/chat', async(req, res) => {
    const { message } = req.body;
    if (message && message.startsWith('gpt')) {
        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo', // or use 'gpt-4' if you have access
                messages: [{ role: 'user', content: message.slice(4).trim() }],
            }, {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            });

            res.json({ reply: response.data.choices[0].message.content });
        } catch (error) {
            res.status(500).json({ error: 'Error contacting ChatGPT' });
        }
    } else {
        res.status(400).json({ error: 'Invalid message format' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});