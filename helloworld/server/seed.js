require('dotenv').config({ override: true });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Crop = require('./models/Crop');
const SensorData = require('./models/SensorData');

const MONGO_URI = process.env.MONGO_URI;

console.log('🔍 DEBUG: MONGO_URI loaded from .env:');
console.log('   ', MONGO_URI ? MONGO_URI.substring(0, 30) + '...' : '❌ NOT FOUND');

const seed = async () => {
    try {
        console.log('----------------------------------------------------');
        console.log('JSON DATABASE IMPORT ENGINE STARTING...');
        console.log('----------------------------------------------------');

        if (!MONGO_URI) {
            console.error('❌ ERROR: MONGO_URI is not defined in .env');
            process.exit(1);
        }

        await mongoose.connect(MONGO_URI);
        console.log(`✅ CONNECTED TO ATLAS: ${mongoose.connection.name}`);

        const jsonPath = path.join(__dirname, 'csvjson.json');
        if (!fs.existsSync(jsonPath)) {
            console.error(`❌ ERROR: JSON file not found at ${jsonPath}`);
            process.exit(1);
        }

        console.log('Cleaning existing data...');
        await SensorData.deleteMany({});
        await Crop.deleteMany({});

        console.log('Reading JSON dataset...');
        const rawData = fs.readFileSync(jsonPath, 'utf8');
        const jsonData = JSON.parse(rawData);

        console.log(`📊 Total records to import: ${jsonData.length}`);

        const sensorRecords = [];
        const uniqueCrops = new Set();
        let successCount = 0;

        for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];

            // Mapping JSON keys to Schema
            const cropType = row["Crop Type"]?.trim();
            uniqueCrops.add(cropType);

            sensorRecords.push({
                soil: {
                    moisture: row["Moisture"],
                    ph: 6.5,
                    temp: row["Temparature"] - 2, // Estimated soil temp
                    nitrogen: row["Nitrogen"],
                    phosphorus: row["Phosphorous"],
                    potassium: row["Potassium"],
                    soilType: row["Soil Type"]
                },
                weather: {
                    temperature: row["Temparature"],
                    humidity: row["Humidity"],
                    chanceOfRain: 0,
                    windSpeed: 0,
                    solarRadiation: 400
                },
                cropType: cropType,
                fertilizerName: row["Fertilizer Name"],
                isSimulated: false,
                timestamp: new Date(Date.now() - (jsonData.length - i) * 60000)
            });

            // Batch insert every 500 records
            if (sensorRecords.length >= 500) {
                await SensorData.insertMany(sensorRecords);
                successCount += sensorRecords.length;
                console.log(`🚀 IMPORT PROGRESS: ${successCount} / ${jsonData.length} records stored...`);
                sensorRecords.length = 0;
            }
        }

        // Final batch
        if (sensorRecords.length > 0) {
            await SensorData.insertMany(sensorRecords);
            successCount += sensorRecords.length;
        }

        // Create Crop definitions with crop-specific moisture ranges
        const cropMoistureRanges = {
            'Rice': { min: 40, max: 70 },
            'Wheat': { min: 30, max: 50 },
            'Maize': { min: 35, max: 60 },
            'Tomato': { min: 35, max: 60 },
            'Cotton': { min: 40, max: 65 },
            'Sugarcane': { min: 45, max: 70 },
            'Tobacco': { min: 30, max: 55 }
        };

        const cropEntries = Array.from(uniqueCrops).map(name => {
            const range = cropMoistureRanges[name] || { min: 30, max: 60 };
            return {
                name: name,
                type: 'General',
                idealMoistureRange: range,
                rootDepth: name === 'Sugarcane' ? 60 : name === 'Cotton' ? 50 : 30
            };
        });
        await Crop.insertMany(cropEntries);

        console.log('----------------------------------------------------');
        console.log(`🎉 JSON IMPORT COMPLETE!`);
        console.log(`📈 Sensor Records: ${successCount}`);
        console.log(`🌿 Crop Types: ${cropEntries.length}`);
        console.log('----------------------------------------------------');

        process.exit(0);
    } catch (err) {
        console.error('❌ CRITICAL JSON IMPORT ERROR:');
        console.error(err);
        process.exit(1);
    }
};

seed();
