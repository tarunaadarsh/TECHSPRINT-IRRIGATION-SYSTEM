// Quick test script to verify routes are registered
const express = require('express');
const app = express();

// Load routes the same way index.js does
try {
    const cropsRouter = require('./routes/crops');
    app.use('/api/crops', cropsRouter);
    console.log('✅ Crop routes loaded');
} catch (error) {
    console.error('❌ Crop routes error:', error.message);
}

try {
    const chatbotRouter = require('./routes/chatbot');
    app.use('/api/chatbot', chatbotRouter);
    console.log('✅ Chatbot routes loaded');
} catch (error) {
    console.error('❌ Chatbot routes error:', error.message);
}

// List all routes
console.log('\n📋 Registered Routes:');
app._router.stack.forEach((middleware) => {
    if (middleware.route) {
        console.log(`   ${Object.keys(middleware.route.methods).join(',').toUpperCase()} ${middleware.route.path}`);
    } else if (middleware.name === 'router') {
        console.log(`   Router: ${middleware.regexp}`);
    }
});

console.log('\n✅ Route test complete');

