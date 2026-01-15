const dns = require('dns');

console.log('🔍 Testing DNS Resolution for MongoDB...');
console.log('Hostname: _mongodb._tcp.cluster0.p4dn4.mongodb.net');

// 1. Try Default DNS
dns.resolveSrv('_mongodb._tcp.cluster0.p4dn4.mongodb.net', (err, addresses) => {
    if (err) {
        console.error('❌ Default DNS Failed:', err.code);

        // 2. Try Google DNS
        console.log('🔄 Attempting force-switch to Google DNS (8.8.8.8)...');
        try {
            dns.setServers(['8.8.8.8', '8.8.4.4']);
            dns.resolveSrv('_mongodb._tcp.cluster0.p4dn4.mongodb.net', (err2, addresses2) => {
                if (err2) {
                    console.error('❌ Google DNS also Failed:', err2.code);
                    console.log('\n⚠️ DIAGNOSIS: Your internet provider/Firewall is COMPLETELY blocking MongoDB.');
                } else {
                    console.log('✅ SUCCESS with Google DNS!');
                    console.log('Found records:', addresses2);
                    console.log('\n💡 FIX FOUND: I will inject this DNS patch into your server code.');
                }
            });
        } catch (e) {
            console.error('Error setting DNS:', e.message);
        }
    } else {
        console.log('✅ Default DNS worked (Unexpected based on your errors).');
        console.log(addresses);
    }
});
