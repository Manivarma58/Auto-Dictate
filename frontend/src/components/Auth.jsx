import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Mail, Lock, Chrome, Facebook, Apple, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const Auth = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthSuccess(data.user);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Check your email for the confirmation link!');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900/60 backdrop-blur-3xl p-10 rounded-[3rem] shadow-2xl border border-slate-800 w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-slate-400 text-lg font-medium">
            {isLogin ? 'Login to access your neural history' : 'Join the intelligence frontier today'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4 mb-8">
          <div className="relative">
            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" size={24} />
            <input 
              type="email" 
              placeholder="Email Address" 
              className="w-full pl-16 pr-6 py-5 bg-slate-950/40 border border-slate-800 rounded-2xl text-white focus:outline-none focus:border-primary transition-all text-xl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" size={24} />
            <input 
              type="password" 
              placeholder="Password" 
              className="w-full pl-16 pr-6 py-5 bg-slate-950/40 border border-slate-800 rounded-2xl text-white focus:outline-none focus:border-primary transition-all text-xl"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-5 bg-primary text-slate-900 font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 shadow-[0_0_30px_rgba(34,211,238,0.2)] text-2xl"
          >
            {loading ? <Loader2 className="animate-spin" size={28} /> : (
              <>
                {isLogin ? 'Sign In' : 'Sign Up'}
                <ArrowRight size={28} />
              </>
            )}
          </button>
        </form>

        <div className="relative mb-10 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <span className="relative px-6 bg-slate-900 text-slate-500 text-sm font-black uppercase tracking-widest">Neural Connect</span>
        </div>

        <div className="flex justify-center">
          <button 
            onClick={() => handleSocialLogin('google')}
            className="flex items-center justify-center p-5 border border-slate-800 rounded-2xl hover:bg-slate-800 transition-all hover:border-primary shadow-xl w-full max-w-[140px]"
            title="Secure Login with Google"
          >
            <Chrome className="text-primary" size={32} />
          </button>
        </div>

        <p className="text-center mt-8 text-gray-500">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="ml-2 text-primary font-bold hover:underline"
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
