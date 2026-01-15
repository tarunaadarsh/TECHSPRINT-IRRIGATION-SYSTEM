const mongoose = require('mongoose');

const cropSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, required: true },
    idealMoistureRange: {
        min: { type: Number, required: true },
        max: { type: Number, required: true }
    },
    rootDepth: { type: Number, default: 30 }, // in cm
    growthStage: { type: String, enum: ['Seedling', 'Vegetative', 'Flowering', 'Harvest'], default: 'Vegetative' }
});

module.exports = mongoose.model('Crop', cropSchema);
