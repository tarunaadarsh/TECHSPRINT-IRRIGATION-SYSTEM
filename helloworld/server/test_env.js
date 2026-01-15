require('dotenv').config({ path: '.env.test', override: true });

const MONGO_URI = process.env.MONGO_URI;

console.log('=====================================');
console.log('🔍 ENVIRONMENT DIAGNOSTICS');
console.log('=====================================');
console.log('');
console.log('MONGO_URI exists:', !!MONGO_URI);
console.log('MONGO_URI type:', typeof MONGO_URI);
console.log('MONGO_URI length:', MONGO_URI ? MONGO_URI.length : 0);
console.log('');
console.log('First 50 chars:', MONGO_URI ? MONGO_URI.substring(0, 50) : 'N/A');
console.log('');
console.log('Full URI (for debugging):');
console.log(MONGO_URI);
console.log('');
console.log('=====================================');

// Test connection
const mongoose = require('mongoose');

async function test() {
    try {
        console.log('⏳ Attempting MongoDB connection...');
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 10000
        });
        console.log('✅ SUCCESS! Connected to MongoDB');
        console.log('✅ Database:', mongoose.connection.name);
        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.log('❌ CONNECTION FAILED');
        console.log('Error code:', err.code);
        console.log('Error message:', err.message);
        process.exit(1);
    }
}

test();
