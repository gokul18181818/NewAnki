import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Brain, ArrowRight, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const SignUp: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: { data: { name: formData.name } },
    });

    setIsLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    navigate('/dashboard');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-cream to-secondary-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-primary-100 shadow-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-neutral-800 mb-2">
              Welcome to StudyBuddy!
              <motion.span
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                className="inline-block ml-2"
              >
                🌟
              </motion.span>
            </h1>
            <p className="text-neutral-600">Let's get you started in 30 seconds</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="text"
                  name="name"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3 bg-white/80 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3 bg-white/80 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-12 pr-12 py-3 bg-white/80 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <button
                type="submit"
                disabled={isLoading}
                className="group w-full px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
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
            </div>
          </form>

          <div className="text-center mt-6">
            <p className="text-neutral-600">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/')}
                className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
              >
                Back to Home
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SignUp;