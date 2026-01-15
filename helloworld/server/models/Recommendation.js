const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    action: { type: String, required: true }, // e.g., "Irrigate"
    amount: { type: Number }, // L/m2
    duration: { type: Number }, // minutes
    recommendedTime: { type: String }, // e.g., "06:30 AM"
    reason: { type: String },
    savings: {
        amount: { type: Number }, // L
        percentage: { type: Number }
    }
});

module.exports = mongoose.model('Recommendation', recommendationSchema);
