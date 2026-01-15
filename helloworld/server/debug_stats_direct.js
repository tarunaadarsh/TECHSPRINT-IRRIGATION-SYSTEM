const mongoose = require('mongoose');
require('dotenv').config();

const SensorData = mongoose.model('SensorData', new mongoose.Schema({
    cropType: String,
    soil: Object,
    weather: Object,
    timestamp: Date
}, { collection: 'sensordatas' }));

const calculateAvg = (arr, path) => {
    if (!arr || arr.length === 0) {
        console.log(`⚠️ No data for path ${path}`);
        return 0;
    }

    const values = arr.map((d, i) => {
        const val = path.split('.').reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : undefined, d);
        let num = 0;

        if (typeof val === 'string') {
            num = parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
        } else {
            num = Number(val) || 0;
        }

        if (i === 0) console.log(`🔍 Path ${path} sample: Raw=${val}, Parsed=${num}`);
        return num;
    }).filter(v => !isNaN(v));

    const avg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
    console.log(`📊 Path ${path} result: Count=${values.length}, Average=${avg}`);
    return avg;
};

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('Connected to DB');
    const cropType = 'BARLEY';
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const cropData = await SensorData.find({
        cropType: { $regex: new RegExp(`^${cropType}$`, 'i') },
        // timestamp: { $gte: cutoffTime } // Comment out to see if it's a time window issue
    })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();

    console.log(`Found ${cropData.length} records for ${cropType}`);

    if (cropData.length > 0) {
        console.log('Example record timestamp:', cropData[0].timestamp);
        console.log('Cutoff time:', cutoffTime);

        calculateAvg(cropData, 'soil.moisture');
        calculateAvg(cropData, 'weather.temperature');
        calculateAvg(cropData, 'soil.nitrogen');
    }

    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
