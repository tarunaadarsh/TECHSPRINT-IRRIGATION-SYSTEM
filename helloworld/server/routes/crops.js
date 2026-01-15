const express = require('express');
const router = express.Router();
const SensorData = require('../models/SensorData');
const Crop = require('../models/Crop');

// Get All Crop Types with Summary
router.get('/', async (req, res) => {
    try {
        // Check database connection
        if (require('mongoose').connection.readyState !== 1) {
            return res.status(503).json({
                error: "Database not connected",
                message: "MongoDB connection is not available. Please check your database connection."
            });
        }

        const rawCropTypes = await SensorData.distinct('cropType') || [];
        const cropTypes = [...new Set(rawCropTypes.filter(ct => ct && ct.trim()).map(ct => ct.trim()))];

        if (cropTypes.length === 0) {
            return res.json([]);
        }

        const cropSummaries = await Promise.all(cropTypes.map(async (cropType) => {
            try {
                // Use case-insensitive search for count and latest
                const query = { cropType: { $regex: new RegExp(`^\\s*${cropType}\\s*$`, 'i') } };
                const latest = await SensorData.findOne(query).sort({ timestamp: -1 }).lean();
                const count = await SensorData.countDocuments(query);
                const cropConfig = await Crop.findOne({ name: { $regex: new RegExp(`^\\s*${cropType}\\s*$`, 'i') } }).lean();

                return {
                    cropType: cropType,
                    crop: cropConfig || null,
                    recordCount: count || 0,
                    latestData: latest || null,
                    lastUpdate: latest?.timestamp || null
                };
            } catch (err) {
                console.error(`Error processing crop ${cropType}:`, err);
                return null;
            }
        }));

        res.json(cropSummaries.filter(c => c !== null));
    } catch (err) {
        console.error('Crops API error:', err);
        res.status(500).json({ error: "Failed to fetch crops.", details: err.message });
    }
});

// Get Data Segregated by Crop Type
router.get('/:cropType', async (req, res) => {
    try {
        // Check database connection
        if (require('mongoose').connection.readyState !== 1) {
            return res.status(503).json({
                error: "Database not connected",
                message: "MongoDB connection is not available. Please check your database connection."
            });
        }

        const { cropType } = req.params;

        if (!cropType) {
            return res.status(400).json({ error: "Crop type is required." });
        }

        const limit = parseInt(req.query.limit) || 100;
        const hours = parseInt(req.query.hours) || 24;

        const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

        const cropData = await SensorData.find({
            cropType: { $regex: new RegExp(`^${cropType}$`, 'i') },
            timestamp: { $gte: cutoffTime }
        })
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        console.log(`📊 Stats Calculation for ${cropType}: ${cropData.length} records found`);

        if (cropData.length === 0) {
            return res.json({
                cropType,
                crop: null,
                data: [],
                stats: {
                    totalRecords: 0,
                    avgMoisture: 0,
                    avgTemperature: 0,
                    avgNitrogen: 0,
                    avgPhosphorus: 0,
                    avgPotassium: 0
                }
            });
        }

        // Simplified statistics calculation
        const getVal = (obj, path) => {
            if (!obj) return undefined;
            if (path === 'soil.moisture') return obj.soil?.moisture;
            if (path === 'weather.temperature') return obj.weather?.temperature;
            if (path === 'soil.nitrogen') return obj.soil?.nitrogen;
            if (path === 'soil.phosphorus') return obj.soil?.phosphorus;
            if (path === 'soil.potassium') return obj.soil?.potassium;
            return undefined;
        };

        const stats = {
            totalRecords: cropData.length,
            avgMoisture: 0,
            avgTemperature: 0,
            avgNitrogen: 0,
            avgPhosphorus: 0,
            avgPotassium: 0
        };

        if (cropData.length > 0) {
            let sumM = 0, sumT = 0, sumN = 0, sumP = 0, sumK = 0;
            let countM = 0, countT = 0, countN = 0, countP = 0, countK = 0;

            cropData.forEach(d => {
                // Extremely robust value extraction
                const getFloat = (val) => {
                    if (val === undefined || val === null) return NaN;
                    if (typeof val === 'number') return val;
                    if (typeof val === 'string') return parseFloat(val.replace(/[^\d.-]/g, ''));
                    return NaN;
                };

                const m = getFloat(d.soil?.moisture);
                if (!isNaN(m)) { sumM += m; countM++; }

                const t = getFloat(d.weather?.temperature);
                if (!isNaN(t)) { sumT += t; countT++; }

                const n = getFloat(d.soil?.nitrogen);
                if (!isNaN(n)) { sumN += n; countN++; }

                const p = getFloat(d.soil?.phosphorus);
                if (!isNaN(p)) { sumP += p; countP++; }

                const k = getFloat(d.soil?.potassium);
                if (!isNaN(k)) { sumK += k; countK++; }
            });

            stats.avgMoisture = countM > 0 ? sumM / countM : 0;
            stats.avgTemperature = countT > 0 ? sumT / countT : 0;
            stats.avgNitrogen = countN > 0 ? sumN / countN : 0;
            stats.avgPhosphorus = countP > 0 ? sumP / countP : 0;
            stats.avgPotassium = countK > 0 ? sumK / countK : 0;

            console.log(`✅ Calculated stats for ${cropType}: counts=[M:${countM}, T:${countT}, N:${countN}]`);
        }

        res.json({
            cropType,
            crop: await Crop.findOne({ name: { $regex: new RegExp(`^\\s*${cropType}\\s*$`, 'i') } }).lean() || await Crop.findOne().lean(),
            data: cropData.reverse(),
            stats,
            _debug: {
                count: cropData.length,
                firstRecord: cropData[0] ? {
                    soil: cropData[0].soil,
                    weather: cropData[0].weather,
                    cropType: cropData[0].cropType
                } : null
            }
        });
    } catch (err) {
        console.error('Crop data API error:', err);
        res.status(500).json({ error: "Failed to fetch crop data.", details: err.message });
    }
});

module.exports = router;

