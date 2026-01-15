const axios = require('axios');

async function testLocalChatbot() {
    console.log('🧪 Testing Local Chatbot Backend...\n');

    try {
        const response = await axios.post('http://localhost:5001/api/chatbot', {
            message: 'which crop is best',
            context: {}
        }, {
            timeout: 10000,
            validateStatus: () => true // Accept all status codes
        });

        console.log('📊 Response Status:', response.status);
        console.log('📄 Response Data:', JSON.stringify(response.data, null, 2));

        if (response.status === 200 && response.data.response) {
            console.log('\n✅ SUCCESS! Chatbot is working!');
            console.log('💬 Response:', response.data.response);
        } else {
            console.log('\n❌ FAILED! Got response but no message');
        }
    } catch (error) {
        console.log('❌ ERROR!');
        console.log('Message:', error.message);
        console.log('Code:', error.code);

        if (error.code === 'ECONNREFUSED') {
            console.log('\n🔍 Diagnosis: Backend server is NOT running!');
            console.log('👉 Start it with: cd c:\\Users\\SWARNABALA\\Downloads\\agri\\agri\\server && node index.js');
        }
    }
}

testLocalChatbot();
