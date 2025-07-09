import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Lock } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 Login form submitted for:', formData.email);
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      
      console.log('🔍 Login response:', error ? 'Error occurred' : 'Success');
      
      if (error) {
        console.error('❌ Login error:', error);
        alert(error.message);
        setIsLoading(false);
        return;
      }
      
      console.log('✅ Login successful, navigating to dashboard...');
      navigate('/dashboard');
    } catch (err) {
      console.error('💥 Unexpected login error:', err);
      alert('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-cream to-secondary-50 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-primary-100 shadow-2xl">
        <h2 className="text-2xl font-bold text-center mb-6">Log In</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input type="email" placeholder="Email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required className="w-full pl-12 pr-4 py-3 bg-white/80 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input type="password" placeholder="Password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required className="w-full pl-12 pr-4 py-3 bg-white/80 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <button type="submit" disabled={isLoading} className="group w-full px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all flex items-center justify-center space-x-2 disabled:opacity-50">
            {isLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (<><span>Log In</span><ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>)}
          </button>
          <button
            type="button"
            className="w-full px-6 py-3 bg-white border border-neutral-200 text-neutral-700 rounded-xl hover:bg-neutral-50 transition-all duration-200 transform hover:scale-105 font-medium shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
            onClick={async () => {
              setIsLoading(true);
              const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/dashboard` } });
              if (error) alert(error.message);
              setIsLoading(false);
            }}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 256 262" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M255.9 133.5c0-11.4-1-23-2.9-34H130v64.3h72.6c-3.1 17-12.8 31.4-27.4 41v34h44.3c25.9-23.8 40.8-61.3 40.8-105.3z"/><path fill="#34A853" d="M130 261c36.7 0 67.9-12.1 90.5-32.8l-44.3-34c-12.3 8.3-28.2 13-46.1 13-35.4 0-65.4-23.8-76.1-55.9H9.2v35.1C30.5 231.5 77.1 261 130 261z"/><path fill="#FBBC04" d="M53.9 151.3c-2.9-8.7-4.6-17.9-4.6-27.3s1.7-18.6 4.6-27.3V61.6H9.2C3.3 73.3 0 94 0 113.9s3.3 40.6 9.2 52.3l44.7-14.9z"/><path fill="#EA4335" d="M130 51.3c20 0 37.9 6.9 52 18.3l39-39C196.4 11.1 165.3 0 130 0 77.1 0 30.5 29.5 9.2 72.2l44.7 34C64.6 75.1 94.6 51.3 130 51.3z"/></svg>
            <span>Continue with Google</span>
          </button>
        </form>
        <p className="text-center mt-4 text-neutral-600">Don't have an account? <button onClick={()=>navigate('/signup')} className="text-primary-600">Sign up</button></p>
      </motion.div>
    </div>
  );
};
export default Login; 