const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    type: { type: String, enum: ['Leak', 'Dry Stress', 'Over-Irrigation', 'General'], required: true },
    severity: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    field: { type: String, default: 'Sector A' },
    confidence: { type: Number, default: 0 },
    status: { type: String, enum: ['Active', 'Resolved'], default: 'Active' }
});

module.exports = mongoose.model('Alert', alertSchema);
