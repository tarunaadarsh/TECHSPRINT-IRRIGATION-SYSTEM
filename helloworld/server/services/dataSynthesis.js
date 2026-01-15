const SensorData = require('../models/SensorData');

// Data Synthesis Service - Simulates sensor data every 15 minutes
class DataSynthesisService {
    constructor() {
        this.interval = null;
        this.isRunning = false;
    }

    /**
     * Start synthesizing sensor data every 2 minutes for ALL crop types
     */
    async start(cropType = null) {
        if (this.isRunning) {
            console.log('Data synthesis already running');
            return;
        }

        this.isRunning = true;
        console.log(`🔄 Starting data synthesis (every 2 min) for all crops`);

        // Generate initial data for all crops
        await this.generateForAllCrops();

        // Schedule every 2 minutes (120000ms) for dynamic updates
        this.interval = setInterval(async () => {
            await this.generateForAllCrops();
        }, 2 * 60 * 1000); // 2 minutes
    }

    /**
     * Generate synthetic data for ALL crop types in the database
     */
    async generateForAllCrops() {
        try {
            // Get all unique crop types from database
            const cropTypes = await SensorData.distinct('cropType');
            
            if (cropTypes.length === 0) {
                // If no crops in DB, generate for default crops
                const defaultCrops = ['Wheat', 'Rice', 'Maize', 'Tomato', 'Sugarcane'];
                for (const crop of defaultCrops) {
                    await this.generateAndSave(crop);
                }
            } else {
                // Generate data for each crop type
                for (const cropType of cropTypes) {
                    await this.generateAndSave(cropType);
                }
            }
            
            console.log(`✅ Generated synthetic data for ${cropTypes.length || 5} crop types`);
        } catch (error) {
            console.error('Error generating data for all crops:', error);
        }
    }

    /**
     * Stop data synthesis
     */
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            this.isRunning = false;
            console.log('⏹️  Data synthesis stopped');
        }
    }

    /**
     * Generate synthetic sensor data based on realistic patterns
     */
    async generateAndSave(cropType = null) {
        try {
            // Get latest data to maintain continuity
            const query = cropType ? { cropType } : {};
            const latest = await SensorData.findOne(query).sort({ timestamp: -1 });

            // Generate realistic sensor readings
            const syntheticData = this.generateSyntheticData(latest, cropType);

            // Save to database
            const newData = new SensorData(syntheticData);
            await newData.save();

            console.log(`✅ Generated synthetic data: ${syntheticData.cropType} - Temp: ${syntheticData.weather.temperature}°C, Moisture: ${syntheticData.soil.moisture}%`);
            
            return syntheticData;
        } catch (error) {
            console.error('Data synthesis error:', error);
        }
    }

    /**
     * Generate realistic synthetic sensor data
     */
    generateSyntheticData(latestData, cropType = null) {
        const now = new Date();
        
        // Base values from latest data or defaults
        const baseTemp = latestData?.weather?.temperature || 25;
        const baseHumidity = latestData?.weather?.humidity || 50;
        const baseMoisture = latestData?.soil?.moisture || 40;
        const baseCrop = cropType || latestData?.cropType || 'Wheat';
        const baseSoilType = this.getBaseSoilType(baseCrop);
        const baseFertilizer = this.getBaseFertilizer(baseCrop);

        // Realistic variations (simulate natural changes over 2 minutes)
        // More variation to make updates visible
        const tempVariation = (Math.random() - 0.5) * 6; // ±3°C
        const humidityVariation = (Math.random() - 0.5) * 15; // ±7.5%
        const moistureVariation = (Math.random() - 0.5) * 8; // ±4% (more visible changes)

        // Time-based variations (cooler at night, warmer during day)
        const hour = now.getHours();
        const timeFactor = hour >= 6 && hour <= 18 ? 1 : -1; // Day vs night
        const tempTimeVariation = timeFactor * (Math.random() * 4);
        
        // Gradual moisture decrease (simulating evaporation) or increase (if recently irrigated)
        const moistureTrend = Math.random() > 0.3 ? -1 : 1; // 70% chance of decrease
        const moistureChange = moistureTrend * (Math.random() * 2); // Gradual change

        // Calculate new moisture with trend
        const newMoisture = Math.max(20, Math.min(80, baseMoisture + moistureVariation + moistureChange));
        
        return {
            cropType: baseCrop,
            timestamp: now,
            soil: {
                moisture: parseFloat(newMoisture.toFixed(2)),
                pH: parseFloat((6.5 + (Math.random() - 0.5) * 1).toFixed(2)), // 6.0-7.0
                temperature: parseFloat((baseTemp - 2 + (Math.random() * 4)).toFixed(2)),
                soilType: baseSoilType,
                nitrogen: parseFloat((30 + Math.random() * 30).toFixed(2)), // 30-60
                phosphorus: parseFloat((15 + Math.random() * 20).toFixed(2)), // 15-35
                potassium: parseFloat((25 + Math.random() * 25).toFixed(2)) // 25-50
            },
            weather: {
                temperature: parseFloat(Math.max(15, Math.min(35, baseTemp + tempVariation + tempTimeVariation)).toFixed(2)),
                humidity: parseFloat(Math.max(30, Math.min(90, baseHumidity + humidityVariation)).toFixed(2)),
                chanceOfRain: parseFloat((Math.random() * 30).toFixed(2)), // 0-30%
                windSpeed: parseFloat((5 + Math.random() * 10).toFixed(2)), // 5-15 km/h
                solarRadiation: hour >= 6 && hour <= 18 ? parseFloat((400 + Math.random() * 600).toFixed(2)) : 0
            },
            fertilizerName: baseFertilizer,
            isSimulated: true
        };
    }

    /**
     * Generate data for specific crop type
     */
    async generateForCrop(cropType) {
        return await this.generateAndSave(cropType);
    }

    /**
     * Get base soil type for a crop
     */
    getBaseSoilType(cropType) {
        const soilMap = {
            rice: "clay",
            wheat: "loam",
            maize: "sandy loam",
            cotton: "black",
            sugarcane: "alluvial",
            default: "loam"
        };
        const crop = cropType ? cropType.toLowerCase() : 'default';
        return soilMap[crop] || soilMap.default;
    }

    /**
     * Get base fertilizer for a crop
     */
    getBaseFertilizer(cropType) {
        const fertilizerMap = {
            rice: "Urea",
            wheat: "DAP",
            maize: "NPK",
            cotton: "Urea",
            sugarcane: "MOP",
            default: "NPK"
        };
        const crop = cropType ? cropType.toLowerCase() : 'default';
        return fertilizerMap[crop] || fertilizerMap.default;
    }
}

module.exports = new DataSynthesisService();

