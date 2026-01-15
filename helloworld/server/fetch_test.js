const http = require('http');

http.get('http://127.0.0.1:5001/api/crops/BARLEY?limit=1', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const parsed = JSON.parse(data);
            console.log('STATS:', JSON.stringify(parsed.stats, null, 2));
            console.log('DEBUG:', JSON.stringify(parsed._debug, null, 2));
        } catch (e) {
            console.log('RAW DATA:', data.substring(0, 200));
            console.error('PARSE ERROR:', e.message);
        }
    });
}).on('error', (err) => {
    console.error('FETCH ERROR:', err.message);
});
