import mongoose from 'mongoose';

const transcriptionSchema = new mongoose.Schema({
  user_id: { type: String, required: true },
  file_name: { type: String, required: true },
  transcript: { type: String, default: "" },
  translated_text: { type: String, default: null },
  source_language: { type: String, default: 'auto' },
  target_language: { type: String, default: null },
  duration: { type: String, required: true },
  audio_url: { type: String, default: null },
  mode: { type: String, default: 'normal' },
  created_at: { type: Date, default: Date.now }
});

const Transcription = mongoose.model('Transcription', transcriptionSchema);

export default Transcription;
