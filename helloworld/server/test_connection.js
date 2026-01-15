const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function testConnection() {
    console.log('🔍 Testing MongoDB Connection...\n');
    console.log('📋 Connection Details:');
    
    if (!MONGO_URI) {
        console.error('❌ MONGO_URI not found in .env file');
        process.exit(1);
    }
    
    // Parse and display (without showing full password)
    const uriParts = MONGO_URI.match(/mongodb\+srv:\/\/([^:]+):(.+)@([^/]+)\/([^?]+)/);
    if (uriParts) {
        console.log(`   Username: ${uriParts[1]}`);
        console.log(`   Password: ${'*'.repeat(10)} (hidden)`);
        console.log(`   Cluster: ${uriParts[3]}`);
        console.log(`   Database: ${uriParts[4]}`);
    }
    
    console.log('\n⏳ Attempting connection...\n');
    
    try {
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        
        console.log('✅ SUCCESS! Connected to MongoDB Atlas');
        console.log(`✅ Database: ${mongoose.connection.name}`);
        console.log(`✅ Host: ${mongoose.connection.host}`);
        
        // Test write permissions
        const testCollection = mongoose.connection.collection('connection_test');
        await testCollection.insertOne({ test: true, timestamp: new Date() });
        console.log('✅ Write permission confirmed');
        
        await testCollection.deleteOne({ test: true });
        console.log('✅ Delete permission confirmed');
        
        console.log('\n🎉 All checks passed! Your MongoDB connection is working properly.');
        
        await mongoose.connection.close();
        process.exit(0);
        
    } catch (err) {
        console.error('\n❌ CONNECTION FAILED\n');
        
        if (err.message.includes('bad auth')) {
            console.error('🔐 AUTHENTICATION ERROR DETECTED\n');
            console.error('Possible causes:');
            console.error('  1. ⚠️  Username or password is incorrect in MongoDB Atlas');
            console.error('  2. ⚠️  Password contains special characters not properly encoded');
            console.error('  3. ⚠️  Database user doesn\'t exist or was deleted\n');
            console.error('Solutions:');
            console.error('  → Go to MongoDB Atlas → Database Access');
            console.error('  → Verify username: swarnakrishna2007_db_user exists');
            console.error('  → Try resetting the password and update .env');
            console.error('  → If password has special chars, ensure URL encoding:\n');
            console.error('     @ → %40    # → %23    ! → %21');
            console.error('     $ → %24    % → %25    & → %26\n');
        } else if (err.message.includes('ENOTFOUND') || err.message.includes('network')) {
            console.error('🌐 NETWORK ERROR DETECTED\n');
            console.error('Possible causes:');
            console.error('  1. ⚠️  Your IP address is not whitelisted in MongoDB Atlas');
            console.error('  2. ⚠️  Network/firewall blocking connection');
            console.error('  3. ⚠️  Cluster is paused or unavailable\n');
            console.error('Solutions:');
            console.error('  → Go to MongoDB Atlas → Network Access');
            console.error('  → Add IP Address: 0.0.0.0/0 (allows all IPs for testing)');
            console.error('  → Or add your specific IP address');
            console.error('  → Check that cluster is running in Atlas dashboard\n');
        } else {
            console.error('Full error details:');
            console.error(err);
        }
        
        process.exit(1);
    }
}

testConnection();
