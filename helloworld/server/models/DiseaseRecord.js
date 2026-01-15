const mongoose = require('mongoose');

const diseaseRecordSchema = new mongoose.Schema({
    cropId: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop' },
    timestamp: { type: Date, default: Date.now },
    imagePath: { type: String },
    diseaseName: { type: String, required: true },
    confidence: { type: Number }, // Percentage
    severity: { type: String, enum: ['Mild', 'Moderate', 'Severe'], default: 'Mild' },
    treatment: { type: String },
    yieldImpact: { type: Number }, // Projected % loss
});

module.exports = mongoose.model('DiseaseRecord', diseaseRecordSchema);
