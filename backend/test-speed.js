import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

async function testSpeed() {
    const filePath = 'd:/projects/al chatbot/backend/uploads/1775360409419-recording-1775360409356.webm';
    if (!fs.existsSync(filePath)) {
        console.error('Test file not found');
        return;
    }

    console.log('🚀 Testing optimized transcription speed...');
    const start = Date.now();

    try {
        const formData = new FormData();
        formData.append('audio', fs.createReadStream(filePath));
        formData.append('mode', 'singer');
        formData.append('language', 'auto');

        const response = await axios.post('http://localhost:5000/api/transcribe', formData, {
            headers: formData.getHeaders()
        });

        const end = Date.now();
        console.log('✅ Transcription Success!');
        console.log(`⏱️ Total Request Time: ${((end - start) / 1000).toFixed(2)}s`);
        console.log(`📝 Transcript Length: ${response.data.transcription.length} characters`);
    } catch (err) {
        console.error('❌ Request Failed:', err.response?.data || err.message);
    }
}

testSpeed();
