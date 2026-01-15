const axios = require('axios');
require('dotenv').config();

// Test Gemini API directly
const API_KEY = process.env.GEMINI_API || 'AIzaSyD3DPnnd54Kb0JPC6T6y1E82zLrXVF-elo';
const CHAT_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

async function testGeminiAPI() {
    console.log('🧪 Testing Gemini API...');
    console.log('API Key:', API_KEY.substring(0, 10) + '...');
    console.log('Endpoint:', CHAT_API_URL.split('?')[0]);
    console.log('');

    try {
        const requestBody = {
            contents: [{
                parts: [{ text: 'Hello, can you help me with agriculture?' }]
            }]
        };

        console.log('📤 Sending test request...');
        const response = await axios.post(CHAT_API_URL, requestBody, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        const aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (aiResponse) {
            console.log('✅ SUCCESS! Gemini API is working!');
            console.log('Response:', aiResponse.substring(0, 100) + '...');
        } else {
            console.log('⚠️ Got response but no text:', JSON.stringify(response.data, null, 2));
        }
    } catch (error) {
        console.log('❌ ERROR! Gemini API failed:');
        console.log('');
        console.log('Error Message:', error.message);
        console.log('Error Code:', error.code);
        console.log('HTTP Status:', error.response?.status);
        console.log('HTTP Status Text:', error.response?.statusText);

        if (error.response?.data) {
            console.log('');
            console.log('API Error Details:');
            console.log(JSON.stringify(error.response.data, null, 2));
        }

        console.log('');
        console.log('🔍 Diagnosis:');
        if (error.response?.status === 400) {
            console.log('- The API key or request format may be invalid');
            console.log('- Check if the model name is correct: gemini-1.5-flash');
        } else if (error.response?.status === 403) {
            console.log('- The API key may be invalid or expired');
            console.log('- Check if the API key has the correct permissions');
        } else if (error.response?.status === 429) {
            console.log('- You have hit rate limits');
            console.log('- Wait a few minutes and try again');
        } else if (error.code === 'ENOTFOUND') {
            console.log('- Cannot reach the Gemini API server');
            console.log('- Check your internet connection');
        } else {
            console.log('- Unknown error, check the details above');
        }
    }
}

testGeminiAPI();
