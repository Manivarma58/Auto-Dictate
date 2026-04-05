import dotenv from 'dotenv';
import { createClient } from '@deepgram/sdk';
dotenv.config();

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

async function testNova3() {
    console.log('Testing Nova-3...');
    try {
        const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
            { url: 'https://static.deepgram.com/examples/interview_speech-analytics.wav' },
            { model: 'nova-3', smart_format: true }
        );
        if (error) {
            console.error('Nova-3 Failed Error Object:', error);
            return;
        }
        console.log('Nova-3 Success:', result.results.channels[0].alternatives[0].transcript.substring(0, 50));
    } catch (err) {
        console.error('Nova-3 Exception:', err.message);
    }
}

testNova3();
