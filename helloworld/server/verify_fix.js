const DataSynthesisService = require('./services/dataSynthesis');

// Mock data
const mockLatestData = {
    cropType: 'Rice',
    weather: { temperature: 30, humidity: 60 },
    soil: { moisture: 50 },
    isSimulated: true
};

try {
    console.log('Testing generateSyntheticData...');
    const result = DataSynthesisService.generateSyntheticData(mockLatestData, 'Rice');
    console.log('✅ Success! Result:', JSON.stringify(result, null, 2));

    console.log('\nTesting with unknown crop...');
    const result2 = DataSynthesisService.generateSyntheticData(null, 'Unknown');
    console.log('✅ Success! Result:', JSON.stringify(result2, null, 2));

    console.log('\nVerification complete. No ReferenceErrors found.');
} catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
}
