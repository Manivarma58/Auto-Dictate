import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { Mic, Upload, History as HistoryIcon, Home as HomeIcon, Settings, LogOut, ChevronRight, Play, CheckCircle, AlertCircle, User, Loader2, Square, Radio, Globe, Languages, Info, Music, Volume2, Download, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { supabase } from './lib/supabaseClient';
import Auth from './components/Auth';

// Base API URL
const API_BASE_URL = 'http://localhost:5000';


const Navbar = ({ session, onLogout }) => (
  <nav className="bg-slate-950/80 backdrop-blur-2xl text-white p-6 sticky top-0 z-50 border-b border-slate-800 shadow-xl">
    <div className="container mx-auto flex justify-between items-center px-4">
      <Link to="/" className="flex items-center space-x-3 group outline-none">
        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center transform group-hover:rotate-12 transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)]">
          <Mic className="text-slate-900 w-7 h-7" />
        </div>
        <span className="text-3xl font-black tracking-tighter text-white">Auto <span className="text-primary italic">Dictate.</span></span>
      </Link>
      <div className="flex items-center space-x-12 font-bold text-lg">
        <Link to="/" className="hover:text-primary transition-all flex items-center gap-2 px-2 py-1"><HomeIcon size={16} /> Home</Link>
        <Link to="/transcribe" className="hover:text-primary transition-all flex items-center gap-2 px-2 py-1"><Mic size={16} /> Transcribe</Link>
        <Link to="/history" className="hover:text-primary transition-all flex items-center gap-2 px-2 py-1"><HistoryIcon size={16} /> History</Link>
        {session ? (
          <button onClick={onLogout} className="flex items-center gap-2 px-6 py-2 bg-slate-900 border border-slate-700 hover:border-primary text-white rounded-xl transition-all shadow-md">
            Logout <span className="opacity-50 text-xs font-black">@SYSTEM</span>
          </button>
        ) : (
          <Link to="/auth" className="btn-primary !px-8 !py-3 !text-lg">Login</Link>
        )}
      </div>
    </div>
  </nav>
);


const Home = ({ session }) => {
  const [recentRecords, setRecentRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) return;
    const fetchRecent = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/history?user_id=${session.user.id}`);
        setRecentRecords(response.data.history.slice(0, 3));
      } catch (err) {
        console.error('Home Fetch Error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecent();
  }, [session]);

  return (
    <div className="container mx-auto px-4 py-32 text-center">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
        <h1 className="text-9xl font-black mb-8 tracking-tighter leading-none text-white drop-shadow-2xl">
          TRANSFORM <br /> <span className="text-primary italic">VOICE IN TO</span> <br /> INTELLIGENCE
        </h1>
        <p className="text-3xl text-slate-400 mb-16 font-medium max-w-4xl mx-auto leading-relaxed">
          The ultimate high-fidelity transcription engine. Precision speech-to-text powered by <span className="text-white font-bold underline decoration-primary underline-offset-8">Neural AI</span> for modern professionals.
        </p>
        <div className="flex justify-center gap-8 items-center mb-32">
          <Link to="/transcribe" className="btn-primary !px-16 !py-6 !text-3xl flex items-center gap-4">Initialize Studio <ArrowRight size={32} /></Link>
          {session && <Link to="/history" className="px-12 py-5 border-4 border-slate-700 text-white rounded-2xl font-bold hover:border-primary hover:bg-primary hover:text-slate-900 transition-all text-xl">My Archive</Link>}
        </div>
      </motion.div>

      {recentRecords.length > 0 && (
        <div className="grid md:grid-cols-3 gap-8 text-left">
           {recentRecords.slice(0, 3).map((item) => (
             <div key={item.id} className="glass-container p-8 group hover:scale-[1.02] transition-all border border-slate-800">
               <div className="flex items-center gap-4 mb-4 text-primary opacity-60 group-hover:opacity-100 transition-opacity">
                 <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                 <span className="text-xs font-black uppercase tracking-widest italic">NEURAL DETECTED</span>
               </div>
               <h4 className="text-2xl font-black text-white mb-4 line-clamp-1">{item.filename}</h4>
               <p className="text-slate-400 text-lg line-clamp-3 leading-relaxed italic">"{item.transcription}"</p>
             </div>
           ))}
        </div>
      )}
    </div>
  );
};

const Transcribe = ({ session }) => {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); 
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [language, setLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('none');
  const [mode, setMode] = useState('normal'); 
  const [youtubeUrl, setYoutubeUrl] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const languages = [
    { code: 'auto', name: 'Auto-Detect (Universal)' },
    { code: 'en', name: 'English (United States)' },
    { code: 'en-IN', name: 'English (India)' },
    { code: 'hi', name: 'Hindi (हिंदी)' },
    { code: 'es', name: 'Spanish (Español)' },
    { code: 'fr', name: 'French (Français)' },
    { code: 'de', name: 'German (Deutsch)' },
    { code: 'it', name: 'Italian (Italiano)' }
  ];

  const targetLanguages = [
    { code: 'none', name: 'No Translation' },
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'Hindi (हिंदी)' },
    { code: 'es', name: 'Spanish (Español)' },
    { code: 'fr', name: 'French (Français)' },
    { code: 'de', name: 'German (Deutsch)' },
    { code: 'it', name: 'Italian (Italiano)' },
    { code: 'te', name: 'Telugu (తెలుగు)' },
    { code: 'ta', name: 'Tamil (தமிழ்)' },
    { code: 'bn', name: 'Bengali (বাংলা)' },
    { code: 'mr', name: 'Marathi (मराठी)' }
  ];

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setYoutubeUrl('');
    setTranscription('');
    setTranslatedText('');
    setStatus('idle');
    setIsAutoDetecting(true);
    const songKeywords = ['song', 'track', 'music', 'lyrics', 'singer', 'mp3', 'm4a', 'wav', 'flac', 'remix', 'cover', 'instrumental'];
    const fileNameLower = selectedFile.name.toLowerCase();
    const isSong = songKeywords.some(keyword => fileNameLower.includes(keyword));
    setTimeout(() => {
      if (isSong) setMode('singer');
      else setMode('normal');
      setIsAutoDetecting(false);
      handleSubmit(selectedFile, isSong ? 'singer' : 'normal');
    }, 800);
  };

  const startRecording = async () => {
    try {
      const audioConstraints = mode === 'singer' ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        const recordedFile = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm;codecs=opus' });
        setFile(recordedFile);
        setYoutubeUrl('');
        setIsRecording(false);
        setRecordingTime(0);
        clearInterval(timerRef.current);
        handleSubmit(recordedFile);
      };
      mediaRecorder.start(100);
      setIsRecording(true);
      setStatus('recording');
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) { console.error('Microphone Error:', err); alert('Microphone Error'); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) { mediaRecorderRef.current.stop(); mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop()); } };

  const handleYoutubeSubmit = async () => {
    if (!youtubeUrl) return;
    setStatus('uploading');
    setUploadProgress(10);
    try {
        const response = await axios.post(`${API_BASE_URL}/api/transcribe-youtube`, { url: youtubeUrl, language, target_language: targetLanguage, mode, user_id: session?.user?.id });
        if (response.data.transcription === '') setStatus('empty');
        else { setTranscription(response.data.transcription); setTranslatedText(response.data.translatedText); setStatus('success'); }
    } catch (err) { console.error('YouTube Error:', err); setStatus('error'); }
  };

  const handleSubmit = async (overrideFile = null, overrideMode = null) => {
    const targetFile = overrideFile || file;
    const targetMode = overrideMode || mode;
    
    if (!targetFile && !youtubeUrl) {
      alert("Please upload a file, start recording, or provide a YouTube link first!");
      return;
    }

    if (youtubeUrl && !targetFile) { handleYoutubeSubmit(); return; }
    setStatus('uploading');
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('audio', targetFile);
      formData.append('language', language);
      formData.append('target_language', targetLanguage);
      formData.append('mode', targetMode);
      if (session) formData.append('user_id', session.user.id);
      const response = await axios.post(`${API_BASE_URL}/api/transcribe`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, onUploadProgress: (p) => setUploadProgress(Math.round((p.loaded * 100) / p.total)) });
      if (response.data.transcription === '') setStatus('empty');
      else { setTranscription(response.data.transcription); setTranslatedText(response.data.translatedText); setStatus('success'); }
    } catch (err) { console.error('Transcription Error:', err); setStatus('error'); }
  };

  return (
    <div className="container mx-auto px-4 py-32 min-h-screen relative text-slate-100">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-container overflow-hidden transition-all duration-500 border border-slate-800 shadow-2xl">
          <div className={`${mode === 'singer' ? 'bg-primary/5' : 'bg-slate-900/60'} p-16 text-white text-center relative overflow-hidden border-b border-slate-800`}>
            {mode === 'singer' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.05, y: 0 }} className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <Music size={400} className="text-primary" />
              </motion.div>
            )}
            <h2 className="text-6xl font-black mb-4 flex items-center justify-center gap-6 tracking-tighter text-white drop-shadow-lg">
              {mode === 'singer' ? <Music className="animate-pulse text-primary" size={48} /> : <Mic className="text-primary" size={48} />}
              {mode === 'singer' ? 'Singer Studio' : 'Transcription Studio'}
            </h2>
            <p className="text-2xl text-slate-400 font-medium">{mode === 'singer' ? 'Convert your songs to lyrics with absolute precision.' : 'Initiate neural capture or record your voice live.'}</p>
          </div>
          
          <div className="p-16 text-center">
            <div className="flex justify-center mb-16">
                <div className="bg-slate-900 p-2 rounded-3xl flex gap-2 border border-slate-800 shadow-inner">
                   <button onClick={() => setMode('normal')} className={`px-12 py-5 rounded-2xl font-black transition-all text-xl ${mode === 'normal' ? 'bg-primary text-slate-900 shadow-[0_0_20px_rgba(34,211,238,0.3)]' : 'text-slate-500 hover:text-primary'}`}>Normal Mode</button>
                   <button onClick={() => setMode('singer')} className={`px-12 py-5 rounded-2xl font-black transition-all text-xl flex items-center gap-3 ${mode === 'singer' ? 'bg-primary text-slate-900 shadow-[0_0_20px_rgba(34,211,238,0.3)]' : 'text-slate-500 hover:text-primary'}`}><Music size={24} /> Singer Mode</button>
                </div>
            </div>

            <div className="glass-container p-16 mb-12 border border-slate-800 group relative overflow-hidden shadow-2xl bg-slate-950/40">
                <div className="w-24 h-24 bg-slate-900 rounded-[2rem] flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform shadow-md"><Play size={48} className="text-primary fill-primary/10" /></div>
                <h3 className="text-4xl font-black text-white mb-10 tracking-tighter">Transcribe <span className="text-primary italic">YouTube</span> Link</h3>
                <div className="flex flex-col md:flex-row gap-6 max-w-3xl mx-auto shadow-xl">
                    <input type="text" placeholder="Paste YouTube Link..." value={youtubeUrl} onChange={(e) => { setYoutubeUrl(e.target.value); if (e.target.value) setFile(null); }} className="flex-grow !text-xl !p-6 !bg-slate-900/60 !border-slate-800 !text-white" />
                    {youtubeUrl && status !== 'uploading' && <button onClick={handleSubmit} className="btn-primary !px-12 flex items-center justify-center gap-3"><Play size={24} /> Convert</button>}
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-10 mb-16">
              <div onClick={() => document.getElementById('fileInput').click()} className={`glass-container border-4 border-dashed border-slate-800 p-20 flex flex-col items-center justify-center cursor-pointer relative group ${file ? 'border-primary bg-primary/5' : 'hover:border-primary/20 hover:bg-slate-900/20'}`}>
                {isAutoDetecting && <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center z-10"><Loader2 className="animate-spin text-primary" size={48}/><span className="text-white font-black mt-4 uppercase tracking-widest text-xs">AI NEURAL ANALYSIS...</span></div>}
                <div className="w-28 h-28 bg-slate-900 rounded-[3rem] flex items-center justify-center mb-10 group-hover:scale-110 transition-transform shadow-md">{mode === 'singer' ? <Music size={56} className="text-primary" /> : <Upload size={56} className="text-primary" />}</div>
                <h3 className="text-3xl font-black text-white mb-4 line-clamp-1">{file ? file.name.slice(0, 20) : "Select Audio / Video"}</h3>
                <p className="text-xl text-slate-500 font-medium italic">MP3, M4A, WAV, MP4 (Max: 150MB)</p>
                <input id="fileInput" type="file" accept="audio/*,video/*" className="hidden" onChange={handleFileChange} />
              </div>

              <div className={`glass-container p-20 flex flex-col items-center justify-center border-4 border-dashed transition-all relative group ${isRecording ? 'border-red-500 bg-red-950/20' : 'border-slate-800 hover:border-primary/40 hover:bg-slate-900/20'}`}>
                <div className={`w-28 h-28 rounded-[3rem] flex items-center justify-center mb-10 shadow-md transition-all ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-900 text-primary group-hover:scale-110'}`}>{mode === 'singer' ? <Volume2 size={56} /> : <Mic size={56} />}</div>
                <h3 className="text-3xl font-black text-white mb-6">{isRecording ? formatTime(recordingTime) : 'Neural Live Record'}</h3>
                {isRecording ? <button onClick={stopRecording} className="bg-red-600 text-white px-16 py-5 rounded-[2rem] font-black hover:bg-red-700 transition-all flex items-center gap-4 text-2xl shadow-xl whitespace-nowrap"><Square size={28} fill="white" /> Stop Capture</button> : <button onClick={startRecording} className="btn-primary !px-16 !py-5 !text-2xl flex items-center justify-center gap-4 whitespace-nowrap"><Radio size={28} className="animate-pulse" /> Start Now</button>}
              </div>
            </div>

            <div className="max-w-2xl mx-auto mb-16 grid md:grid-cols-2 gap-8">
               <div className="space-y-4">
                  <label className="flex items-center gap-2 text-gray-600 font-bold mb-2 justify-center"><Globe size={18}/> Source</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-white border border-gray-200 p-5 rounded-2xl text-accent font-bold outline-none focus:border-primary">
                    {languages.map(l => <option key={l.code} value={l.code} className="bg-white">{l.name}</option>)}
                  </select>
               </div>
               <div className="space-y-4">
                  <label className="flex items-center gap-2 text-gray-600 font-bold mb-2 justify-center"><Languages size={18}/> Target</label>
                  <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className="w-full bg-white border border-gray-200 p-5 rounded-2xl text-accent font-bold outline-none focus:border-primary">
                    {targetLanguages.map(l => <option key={l.code} value={l.code} className="bg-white">{l.name}</option>)}
                  </select>
               </div>
            </div>

            {!isRecording && (
                <button onClick={() => handleSubmit()} disabled={status === 'uploading'} className="w-full btn-primary !py-7 !text-3xl !rounded-[2.5rem] flex items-center justify-center gap-6 shadow-xl whitespace-nowrap">
                  {status === 'uploading' ? <div className="flex items-center gap-6">Processing: {uploadProgress}% <Loader2 className="animate-spin" size={32} /></div> : <span className="flex items-center gap-6">{mode === 'singer' ? 'Extract Lyrics' : 'Transcribe Track'} <Play size={36} fill="black" /></span>}
                </button>
            )}

            <AnimatePresence>
              {status === 'empty' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-12 p-10 bg-red-50 rounded-[2rem] border border-red-200 text-xl font-black flex items-center gap-4 justify-center text-red-600"><AlertCircle size={32}/> No actionable speech or lyrics detected in this track.</motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <AnimatePresence>
          {status === 'success' && (
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="mt-16 grid md:grid-cols-2 gap-10">
              <div className="glass-container p-12 flex flex-col h-full border border-gray-100 shadow-xl bg-white/80">
                 <h3 className="text-3xl font-black text-accent mb-8 border-b border-gray-100 pb-6 flex items-center gap-4 text-accent"><CheckCircle className="text-primary" size={40}/> {mode === 'singer' ? 'Studio Lyrics' : 'Raw Transcript'}</h3>
                 <div className={`flex-grow bg-gray-50 p-10 rounded-[2.5rem] text-2xl leading-relaxed text-gray-700 h-[500px] overflow-y-auto whitespace-pre-wrap ${mode === 'singer' ? 'font-mono text-center italic' : ''} shadow-inner border border-gray-100`}>{transcription}</div>
              </div>
              {translatedText && (
                <div className="glass-container p-12 flex flex-col h-full border border-gray-100 shadow-xl bg-white/80">
                   <h3 className="text-3xl font-black text-accent mb-8 border-b border-gray-100 pb-6 flex items-center gap-4 text-accent"><Languages className="text-primary" size={40}/> Translation</h3>
                   <div className="flex-grow bg-gray-50 p-10 rounded-[2.5rem] text-2xl leading-relaxed text-gray-700 h-[500px] overflow-y-auto italic shadow-inner border border-gray-100">{translatedText}</div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const HistoryPage = ({ session }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (!session) return;
    const fetchHistory = async () => {
       try {
         const response = await axios.get(`${API_BASE_URL}/api/history?user_id=${session.user.id}`);
         setData(response.data.history);
       } catch (err) {
         console.error('History Fetch Error:', err);
       } finally {
         setLoading(false);
       }
    };
    fetchHistory();
  }, [session]);

  if (!session) return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-container text-center p-16 rounded-[4rem] max-w-lg">
        <HistoryIcon size={64} className="mx-auto text-primary/30 mb-8" />
        <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">Login Required</h2>
        <p className="text-xl text-gray-400 mb-8 font-medium">Sign in to view and manage your transcription history in MongoDB.</p>
        <Link to="/auth" className="btn-primary inline-block">Go to Login</Link>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-20 min-h-screen relative text-accent">
      <h1 className="text-7xl font-black text-accent mb-6 tracking-tighter text-left">Voice <span className="text-primary italic">Library.</span></h1>
      <p className="text-2xl text-gray-600 mb-20 text-left font-medium">Your intelligence archive.</p>

      {loading ? <div className="flex justify-center p-20"><Loader2 size={64} className="animate-spin text-primary" /></div> : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
          {data.length > 0 ? data.map(item => (
            <motion.div key={item._id} whileHover={{ y: -10 }} className="glass-container p-12 rounded-[3rem] relative group overflow-hidden text-left shadow-xl bg-white/80 border border-gray-100">
              <div className="flex justify-between items-start mb-8">
                 <div className={`p-5 rounded-2xl ${item.mode === 'singer' ? 'bg-primary text-black' : 'bg-gray-100 text-gray-900'}`}>
                    {item.mode === 'singer' ? <Music size={32}/> : <Mic size={32}/>}
                 </div>
                 <span className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">{new Date(item.created_at).toLocaleDateString()}</span>
              </div>
              <h3 className="text-3xl font-black text-accent mb-6 truncate tracking-tight">{item.file_name}</h3>
              {item.translated_text ? (
                <div className="space-y-4 mb-8">
                  <p className="text-primary font-black uppercase text-xs tracking-widest">Translated Preview:</p>
                  <p className="text-gray-600 line-clamp-3 leading-relaxed italic text-lg">{item.translated_text}</p>
                </div>
              ) : (
                <p className="text-gray-600 line-clamp-4 leading-relaxed text-lg mb-8">{item.transcript}</p>
              )}
              <div className="pt-8 border-t border-gray-100 flex justify-between items-center text-primary font-black text-xl">
                 <span className="text-gray-900">{Number(item.duration).toFixed(1)}s</span>
                 <button onClick={() => setSelectedItem(item)} className="underline cursor-pointer hover:text-accent transition-colors flex items-center gap-2">Details <ChevronRight size={20}/></button>
              </div>
            </motion.div>
          )) : (
            <div className="col-span-full py-40 text-center text-gray-400 italic text-3xl font-black border-4 border-dashed border-gray-100 rounded-[5rem] bg-gray-50">Start speaking. Your recordings will appear here.</div>
          )}
        </div>
      )}

      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 backdrop-blur-[100px] bg-black/20">
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 40 }} className="glass-container rounded-[4rem] w-full max-w-6xl overflow-hidden shadow-2xl border border-gray-100 bg-white">
              <div className="p-12 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                 <div className="flex items-center gap-8">
                   <div className={`p-6 rounded-3xl ${selectedItem.mode === 'singer' ? 'bg-primary text-black' : 'bg-gray-200 text-accent'}`}>{selectedItem.mode === 'singer' ? <Music size={40}/> : <Mic size={40}/>}</div>
                   <div>
                     <h2 className="text-4xl font-black text-accent tracking-tighter">{selectedItem.file_name}</h2>
                     <p className="text-xl text-gray-500 font-medium">{selectedItem.mode === 'singer' ? 'Singer' : 'Normal'} • {new Date(selectedItem.created_at).toLocaleString()}</p>
                   </div>
                 </div>
                 <button onClick={() => setSelectedItem(null)} className="p-4 bg-gray-100 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all"><Square size={32}/></button>
              </div>
              
              <div className="p-12 bg-primary/5 flex flex-col items-center border-b border-gray-100">
                 <p className="text-accent font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-4 text-sm"><Volume2 size={20}/> Studio Audio Playback</p>
                 {selectedItem.audio_url ? <audio controls src={`${API_BASE_URL}${selectedItem.audio_url}`} className="w-full max-w-3xl h-16 rounded-full shadow-lg" /> : <div className="text-gray-500 italic text-xl">Audio archive unavailable.</div>}
              </div>

              <div className="p-16 grid md:grid-cols-2 gap-16 max-h-[45vh] overflow-y-auto custom-scrollbar">
                 <div className="text-left">
                    <h3 className="text-2xl font-black text-accent mb-8 flex items-center gap-3 border-b border-gray-100 pb-4">Original {selectedItem.mode === 'singer' ? 'Lyrics' : 'Transcript'}</h3>
                    <div className="bg-gray-50 p-10 rounded-[3rem] text-xl leading-relaxed text-gray-700 min-h-[350px] shadow-inner border border-gray-100">{selectedItem.transcript}</div>
                 </div>
                 <div className="text-left">
                    <h3 className="text-2xl font-black text-accent mb-8 flex items-center gap-3 border-b border-gray-100 pb-4">Translated Version</h3>
                    <div className="bg-gray-50 p-10 rounded-[3rem] text-xl leading-relaxed text-gray-700 min-h-[350px] italic shadow-inner border border-gray-100">{selectedItem.translated_text || "Deep translation not requested."}</div>
                 </div>
              </div>

              <div className="p-12 bg-gray-50 text-center flex justify-center gap-8">
                 {selectedItem.audio_url && <a href={`${API_BASE_URL}${selectedItem.audio_url}`} download className="btn-primary !px-12 !py-5 flex items-center gap-4"><Download size={24}/> Export Audio</a>}
                 <button onClick={() => setSelectedItem(null)} className="btn-secondary !px-12 !py-5 border border-gray-200">Return to Archive</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

function App() {
  const [session, setSession] = useState(null);
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);
  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/'); };
  return (
    <div className="relative min-h-screen bg-midnight overflow-x-hidden flex flex-col">
      <Navbar session={session} onLogout={handleLogout} />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home session={session} />} />
          <Route path="/auth" element={<Auth onAuthSuccess={() => navigate('/transcribe')} />} />
          <Route path="/transcribe" element={<Transcribe session={session} />} />
          <Route path="/history" element={<HistoryPage session={session} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
