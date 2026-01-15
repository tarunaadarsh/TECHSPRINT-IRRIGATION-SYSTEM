const mongoose = require('mongoose');

const sensorDataSchema = new mongoose.Schema({
    cropId: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop' },
    timestamp: { type: Date, default: Date.now },
    soil: {
        moisture: { type: Number, required: true }, // %
        ph: { type: Number },
        temp: { type: Number }, // °C
        nitrogen: { type: Number }, // mg/kg
        phosphorus: { type: Number }, // mg/kg
        potassium: { type: Number }, // mg/kg
        soilType: { type: String }
    },
    weather: {
        temperature: { type: Number }, // °C
        humidity: { type: Number }, // %
        chanceOfRain: { type: Number }, // %
        windSpeed: { type: Number }, // km/h
        solarRadiation: { type: Number } // W/m2
    },
    cropType: { type: String },
    fertilizerName: { type: String },
    isSimulated: { type: Boolean, default: true }
});

module.exports = mongoose.model('SensorData', sensorDataSchema, 'sensordatas');
