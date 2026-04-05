import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { createClient } from '@deepgram/sdk';
import translatePkg from 'google-translate-api-next';
const translate = typeof translatePkg === 'function' ? translatePkg : (translatePkg.translate || translatePkg.default);
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import Transcription from './models/Transcription.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autodictate')
  .then(() => console.log('✅ Connected to MongoDB (Auto Dictate Hub)'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Initialize Deepgram
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './uploads';
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 } 
});

// 1. Transcription + Translation Route
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const { user_id, language, target_language, mode = 'normal' } = req.body; 
    if (!req.file) return res.status(400).json({ error: 'No audio file' });

    console.log(`🎙️ Incoming Audio: ${req.file.originalname} (Source: ${language || 'Auto'}, Target: ${target_language}, Mode: ${mode})`);

    const audioStream = fs.createReadStream(req.file.path);
    const target = target_language && target_language.toLowerCase();

    // Deepgram STT Configuration 
    const options = {
      model: mode === 'singer' ? 'nova-3' : 'nova-2',
      smart_format: true,
      punctuate: true,
      paragraphs: true,
      utterances: true,
      filler_words: mode === 'singer' ? false : true,
      diarize: mode === 'singer' ? true : false,
      multichannel: true // Process all audio channels (crucial for stereo music)
    };

    // If the user picked a specific language, USE IT. Otherwise, detect it.
    if (language && language !== 'auto') {
      options.language = language;
      console.log(`🌍 Using Explicit Language: ${language}`);
    } else {
      options.detect_language = true;
      console.log(`🌍 Using Auto-Language Detection...`);
    }

    // --- TRANSCRIPTION CORE: PARALLEL OPTIMIZATION ---
    let transcriptionResult = null;
    let transcript = "";
    let words = [];
    
    // Read file as Buffer so we can reuse it for parallel passes
    let audioBuffer;
    try {
        audioBuffer = fs.readFileSync(req.file.path);
    } catch (fsErr) {
        console.error('❌ File Read Error:', fsErr.message);
        return res.status(500).json({ error: 'File read failed', details: fsErr.message });
    }

    if (mode === 'singer') {
        console.log(`📡 SINGER MODE: Processing Parallel Models (Nova-3 + Whisper-Large)...`);
        const startTime = Date.now();

        // RUN MODELS IN PARALLEL FOR SPEED
        const [novaResult, whisperResult] = await Promise.allSettled([
            deepgram.listen.prerecorded.transcribeFile(audioBuffer, { ...options, model: 'nova-3' }),
            deepgram.listen.prerecorded.transcribeFile(audioBuffer, { ...options, model: 'whisper-large', diarize: false })
        ]);

        const nResult = novaResult.status === 'fulfilled' ? novaResult.value.result : null;
        const wResult = whisperResult.status === 'fulfilled' ? whisperResult.value.result : null;

        const nTranscript = nResult?.results?.channels[0]?.alternatives[0]?.transcript || "";
        const wTranscript = wResult?.results?.channels[0]?.alternatives[0]?.transcript || "";
        
        const nLang = nResult?.metadata?.detected_language || "unknown";
        const wLang = wResult?.metadata?.detected_language || "unknown";

        console.log(`🌍 Model Sync: Nova-3 detected [${nLang}], Whisper-Large detected [${wLang}]`);

        // VERSION 1.2 OPTIMIZED SELECTION
        const wIsNonEnglish = wLang !== 'en' && wLang !== 'unknown';
        const nIsNonEnglish = nLang !== 'en' && nLang !== 'unknown';

        // LOGIC: Highly prioritize non-English transcripts (like Hindi) when detected by Whisper.
        // Whisper is much more accurate at detecting the actual spoken language in music than Nova-3.
        if (wIsNonEnglish && wTranscript.length > 5) {
            console.log(`💎 [v1.2] Choosing Whisper-Large (Confirmed ${wLang} detection)`);
            transcriptionResult = wResult;
            transcript = wTranscript;
            words = wResult?.results?.channels[0]?.alternatives[0]?.words || [];
        } else if (wTranscript.length > nTranscript.length * 1.2) {
            console.log(`💎 [v1.2] Choosing Whisper-Large (Higher lyric density)`);
            transcriptionResult = wResult;
            transcript = wTranscript;
            words = wResult?.results?.channels[0]?.alternatives[0]?.words || [];
        } else {
            console.log(`💎 [v1.2] Choosing Nova-3 (Default Precision)`);
            transcriptionResult = nResult || wResult;
            transcript = nTranscript || wTranscript;
            words = (nResult?.results?.channels[0]?.alternatives[0]?.words) || (wResult?.results?.channels[0]?.alternatives[0]?.words) || [];
        }

        console.log(`⏱️ Parallel Extraction Took: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);

    } else {
        // NORMAL MODE: FAST SINGLE PASS WITH OPTIONAL LIGHT FALLBACK
        try {
            console.log(`📡 Sending to Deepgram (Normal Mode - Model: ${options.model})...`);
            const { result, error } = await deepgram.listen.prerecorded.transcribeFile(audioBuffer, options);
            
            if (!error && result?.results?.channels[0]?.alternatives[0]?.transcript) {
                transcriptionResult = result;
                transcript = result.results.channels[0].alternatives[0].transcript;
                words = result.results.channels[0].alternatives[0].words;
            } else if (mode !== 'singer') {
                // Light fallback for normal mode if first pass failed
                console.warn('🔄 Normal Mode Fallback (Base)...');
                const { result: fbResult } = await deepgram.listen.prerecorded.transcribeFile(audioBuffer, { ...options, model: 'base' });
                if (fbResult) {
                    transcriptionResult = fbResult;
                    transcript = fbResult.results.channels[0].alternatives[0].transcript || "";
                    words = fbResult.results.channels[0].alternatives[0].words || [];
                }
            }
        } catch (err) {
            console.error('❌ Normal Mode Transcription Exception:', err.message);
        }
    }

    if (!transcriptionResult || (!transcript && words.length === 0)) {
        return res.status(500).json({ 
            error: 'AI Transcription Service Overloaded', 
            details: 'Deepgram failed to process this audio track. The background noise may be too dense or the audio is silent.' 
        });
    }


    const detectedLanguage = transcriptionResult?.metadata?.detected_language || 'en';

    // ELITE LYRIC RECOVERY & FORMATTING (Singer Mode Focus)
    if (mode === 'singer' || !transcript || transcript.trim() === '') {
       if (words && words.length > 0) {
          console.log(`💎 Elite Recovery: Assembling & Formatting ${words.length} words...`);
          
          let assembledTranscript = [];
          let lastWordEnd = words[0].end;

          words.forEach((w, i) => {
             // If there's a gap of more than 1.2 seconds, it's a new line in singer mode
             if (i > 0 && (w.start - lastWordEnd) > 1.2) {
                assembledTranscript.push('\n');
             }
             assembledTranscript.push(w.punctuated_word || w.word);
             lastWordEnd = w.end;
          });

          // Join with spaces but handle newlines correctly
          transcript = assembledTranscript.join(' ').replace(/ \n /g, '\n').replace(/\n /g, '\n');
       }
    }
    
    if (!transcript || transcript.trim() === '') {
       console.warn('⚠️ Final attempt returned no text transcription.');
       // We still save the record if logged in but skip translation
       let savedRecord = null;
       if (user_id) {
         savedRecord = await Transcription.create({
           user_id,
           file_name: req.file.originalname,
           transcript: "[No lyrics or speech detected. This often happens if the background music is too loud or the vocals are unclear.]",
           translated_text: null,
           source_language: detectedLanguage,
           target_language: target === 'none' ? null : target,
           duration: transcriptionResult?.metadata?.duration?.toString() || "0",
           audio_url: `/uploads/${req.file.filename}`,
           mode
         });
       }

       return res.json({
         success: true,
         transcription: "",
         translatedText: null,
         duration: transcriptionResult?.metadata?.duration || 0,
         id: savedRecord?._id || null
       });
    }

    console.log(`✅ Transcription Result: "${transcript.substring(0, 50)}..."`);
    console.log(`🌍 Detected Lang: ${detectedLanguage}`);

    // Voice Translation Logic (SKIP IF NO TRANSCRIPT)
    let translatedText = null;
    
    if (target && target !== 'none' && transcript.trim()) {
       console.log(`🌍 Translating [auto-detect] to [${target}]...`);
       try {
         // Attempt 1: Auto-detection
         const translationResult = await translate(transcript, { from: 'auto', to: target });
         translatedText = translationResult.text;
         console.log('✅ Translation Complete.');
       } catch (transError) {
         console.warn('⚠️ Auto-Detection failed, retrying with explicit code:', detectedLanguage);
         try {
           const fromCode = detectedLanguage.split('-')[0];
           const translationResult = await translate(transcript, { from: fromCode, to: target });
           translatedText = translationResult.text;
         } catch (fallbackError) {
           console.error('❌ Translation Error:', fallbackError.message);
           translatedText = `[Translation Service Error: ${fallbackError.message}]`;
         }
       }
    }

    // Save to MongoDB
    let savedRecord = null;
    if (user_id) {
       savedRecord = await Transcription.create({
         user_id,
         file_name: req.file.originalname,
         transcript,
         translated_text: translatedText,
         source_language: detectedLanguage,
         target_language: target === 'none' ? null : target,
         duration: transcriptionResult?.metadata?.duration?.toString() || "0",
         audio_url: `/uploads/${req.file.filename}`,
         mode
       });
    }

    // fs.unlinkSync(req.file.path); // NO LONGER DELETING

    res.json({
      success: true,
      transcription: transcript,
      translatedText,
      duration: transcriptionResult?.metadata?.duration || 0,
      id: savedRecord ? savedRecord._id : null
    });

  } catch (err) {
    console.error('❌ Server Error:', err.message);
    const logMsg = `[${new Date().toISOString()}] Error: ${err.message}\nStack: ${err.stack}\n---\n`;
    fs.appendFileSync('debug.log', logMsg);
    res.status(500).json({ error: 'Transcription failed', details: err.message });
  }
});

// 2. YouTube Transcription Route
app.post('/api/transcribe-youtube', async (req, res) => {
  try {
    const { url, user_id, language, target_language, mode = 'singer' } = req.body;
    if (!url) return res.status(400).json({ error: 'YouTube URL is required' });

    console.log(`📺 YouTube Request: ${url} (Lang: ${language}, Mode: ${mode})`);

    // Import yt-dlp-exec (User must run: npm install yt-dlp-exec)
    let youtubedl;
    try {
        const module = await import('youtube-dl-exec');
        youtubedl = module.default;
    } catch (e) {
        console.error('❌ youtube-dl-exec not found. Please run: npm install youtube-dl-exec');
        return res.status(500).json({ error: 'Server environment not ready for YouTube extraction. Missing dependency.' });
    }

    const tempFileName = `yt-${Date.now()}.mp3`;
    const tempFilePath = path.join('./uploads', tempFileName);

    try {
        console.log('📡 Downloading YouTube Audio (Attempting raw stream to avoid ffmpeg)...');
        // We avoid 'extractAudio: true' because it almost always requires ffmpeg for conversion.
        // Instead, we just grab the best audio stream directly.
        await youtubedl(url, {
            format: 'bestaudio',
            output: path.join('./uploads', `yt-${Date.now()}.%(ext)s`), 
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: ['referer:youtube.com', 'user-agent:googlebot']
        });
    } catch (ytError) {
        console.error('❌ YouTube Error (Likely missing ffmpeg):', ytError.message);
        if (ytError.message.includes('ffmpeg not found')) {
            return res.status(500).json({ 
                error: 'FFmpeg Missing on Server', 
                details: 'YouTube extraction requires FFmpeg. Please install it on your computer and add it to your PATH.' 
            });
        }
        return res.status(500).json({ error: 'Failed to extract audio from YouTube', details: ytError.message });
    }

    // Find the latest yt- file that was just created since we don't know the extension
    const files = fs.readdirSync('./uploads')
        .filter(f => f.startsWith('yt-'))
        .map(f => ({ name: f, time: fs.statSync(path.join('./uploads', f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
        return res.status(500).json({ error: 'Audio file not created after download' });
    }

    const latestFile = path.join('./uploads', files[0].name);
    const audioBuffer = fs.readFileSync(latestFile);

    const target = target_language && target_language.toLowerCase();
    
    // Use the same refined logic as the upload route
    const options = {
      model: mode === 'singer' ? 'nova-3' : 'nova-2',
      smart_format: true,
      punctuate: true,
      paragraphs: true,
      utterances: true,
      multichannel: true
    };

    if (language && language !== 'auto') {
      options.language = language;
    } else {
      options.detect_language = true;
    }

    let transcriptionResult = null;
    let transcript = "";
    let words = [];

    if (mode === 'singer') {
        const [nResult, wResult] = await Promise.allSettled([
            deepgram.listen.prerecorded.transcribeFile(audioBuffer, { ...options, model: 'nova-3' }),
            deepgram.listen.prerecorded.transcribeFile(audioBuffer, { ...options, model: 'whisper-large', diarize: false })
        ]);

        const nr = nResult.status === 'fulfilled' ? nResult.value.result : null;
        const wr = wResult.status === 'fulfilled' ? wResult.value.result : null;

        const nt = nr?.results?.channels[0]?.alternatives[0]?.transcript || "";
        const wt = wr?.results?.channels[0]?.alternatives[0]?.transcript || "";
        const nL = nr?.metadata?.detected_language || "unknown";
        const wL = wr?.metadata?.detected_language || "unknown";

        if ((wL !== 'en' && wL !== 'unknown' && wt.length > 10) || wt.length > nt.length * 1.3) {
            transcriptionResult = wr;
            transcript = wt;
            words = wr?.results?.channels[0]?.alternatives[0]?.words || [];
        } else {
            transcriptionResult = nr;
            transcript = nt;
            words = nr?.results?.channels[0]?.alternatives[0]?.words || [];
        }
    } else {
        const { result } = await deepgram.listen.prerecorded.transcribeFile(audioBuffer, options);
        transcriptionResult = result;
        transcript = result?.results?.channels[0]?.alternatives[0]?.transcript || "";
        words = result?.results?.channels[0]?.alternatives[0]?.words || [];
    }

    if (!transcript) {
        return res.status(500).json({ error: 'Transcription failed for YouTube audio' });
    }

    // Handle Formatting (Singer Mode)
    if (mode === 'singer' && words.length > 0) {
        let assembled = [];
        let lastEnd = words[0].end;
        words.forEach((w, i) => {
            if (i > 0 && (w.start - lastEnd) > 1.2) assembled.push('\n');
            assembled.push(w.punctuated_word || w.word);
            lastEnd = w.end;
        });
        transcript = assembled.join(' ').replace(/ \n /g, '\n').replace(/\n /g, '\n');
    }

    // Translation Logic
    let translatedText = null;
    if (target && target !== 'none' && transcript.trim()) {
       try {
         const translationResult = await translate(transcript, { from: 'auto', to: target });
         translatedText = translationResult.text;
       } catch (e) { console.error('Translation failed'); }
    }

    // Save Record
    let savedRecord = null;
    if (user_id) {
       savedRecord = await Transcription.create({
         user_id,
         file_name: `YouTube: ${url.substring(0, 30)}...`,
         transcript,
         translated_text: translatedText,
         source_language: transcriptionResult?.metadata?.detected_language || 'unknown',
         target_language: target === 'none' ? null : target,
         duration: transcriptionResult?.metadata?.duration?.toString() || "0",
         audio_url: `/uploads/${tempFileName}`, // Keep for playback if desired
         mode
       });
    }

    res.json({
      success: true,
      transcription: transcript,
      translatedText,
      duration: transcriptionResult?.metadata?.duration || 0,
      id: savedRecord ? savedRecord._id : null
    });

  } catch (err) {
    console.error('❌ YouTube Route Error:', err.message);
    res.status(500).json({ error: 'YouTube processing failed', details: err.message });
  }
});

// 3. History Route
app.get('/api/history', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'User ID required' });

    const history = await Transcription.find({ user_id }).sort({ created_at: -1 });
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Auto Dictate Server on http://localhost:${PORT}`));

