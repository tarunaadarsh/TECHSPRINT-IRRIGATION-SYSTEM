const fs = require('fs');
const path = require('path');
const SensorData = require('../models/SensorData');

/**
 * Simulation Engine
 * Updated to use the JSON dataset (csvjson.json).
 */
class SimulationEngine {
    constructor() {
        this.jsonPath = path.join(__dirname, '..', 'csvjson.json');
        this.data = [];
        this.currentIndex = 0;
        this.loadJSON();
    }

    loadJSON() {
        try {
            if (!fs.existsSync(this.jsonPath)) {
                console.warn(`⚠️ Warning: Dataset file not found at ${this.jsonPath}`);
                return;
            }
            const content = fs.readFileSync(this.jsonPath, 'utf8');
            this.data = JSON.parse(content);
            console.log(`✅ Loaded ${this.data.length} records from JSON.`);
        } catch (err) {
            console.error("❌ Error loading JSON dataset:", err);
        }
    }

    async step() {
        if (this.data.length === 0) return null;

        const row = this.data[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.data.length;

        const data = new SensorData({
            soil: {
                moisture: row["Moisture"],
                ph: 6.5,
                temp: row["Temparature"] - 2,
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
            cropType: row["Crop Type"],
            fertilizerName: row["Fertilizer Name"],
            isSimulated: true
        });

        // We don't save to DB here anymore as we rely on the seed script for history
        // But we return it for the local "live" view if needed
        return data;
    }

    setIrrigation(status) {
        this.isIrrigating = status;
    }
}

module.exports = new SimulationEngine();
