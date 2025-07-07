import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Heart, BookOpen, GraduationCap, Award, Globe, FileText, Sparkles, Upload, Calendar } from 'lucide-react';

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState('');
  const [customGoal, setCustomGoal] = useState('');

  const goals = [
    { id: 'medical', label: 'Medical School', icon: Heart, color: 'from-red-500 to-red-600' },
    { id: 'languages', label: 'Languages', icon: Globe, color: 'from-blue-500 to-blue-600' },
    { id: 'professional', label: 'Professional', icon: Award, color: 'from-purple-500 to-purple-600' },
    { id: 'academic', label: 'Academic', icon: GraduationCap, color: 'from-green-500 to-green-600' },
    { id: 'certification', label: 'Certification', icon: BookOpen, color: 'from-yellow-500 to-yellow-600' },
  ];

  const steps = [
    {
      title: 'What are you studying?',
      subtitle: 'Tell me what you\'re learning so I can help! 📚',
      component: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {goals.map((goal) => (
              <motion.button
                key={goal.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedGoal(goal.id)}
                className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                  selectedGoal === goal.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-neutral-200 bg-white hover:border-primary-300'
                }`}
              >
                <div className={`w-12 h-12 bg-gradient-to-r ${goal.color} rounded-xl flex items-center justify-center mb-3 mx-auto`}>
                  <goal.icon className="w-6 h-6 text-white" />
                </div>
                <p className="font-medium text-neutral-800">{goal.label}</p>
              </motion.button>
            ))}
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Other: Enter your study goal"
              value={customGoal}
              onChange={(e) => {
                setCustomGoal(e.target.value);
                setSelectedGoal('custom');
              }}
              className="w-full p-4 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
            />
            <FileText className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
          </div>
        </div>
      ),
    },
    {
      title: 'How would you like to start?',
      subtitle: 'Choose your preferred way to begin 🚀',
      component: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/import')}
              className="p-8 bg-white rounded-xl border-2 border-primary-200 hover:border-primary-300 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-800 mb-2">Import from Anki</h3>
              <p className="text-neutral-600 text-sm mb-4">
                Upload your existing .apkg files and I'll enhance them with AI improvements
              </p>
              <div className="bg-primary-50 rounded-lg p-3">
                <p className="text-primary-700 font-medium text-sm">Upload .apkg</p>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/create')}
              className="p-8 bg-white rounded-xl border-2 border-secondary-200 hover:border-secondary-300 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <div className="w-16 h-16 bg-gradient-to-r from-secondary-500 to-secondary-600 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-neutral-800 mb-2">Create new cards</h3>
              <p className="text-neutral-600 text-sm mb-4">
                Start fresh with AI-powered card creation from PDFs, text, or manual input
              </p>
              <div className="bg-secondary-50 rounded-lg p-3">
                <p className="text-secondary-700 font-medium text-sm">Start fresh</p>
              </div>
            </motion.button>
          </div>

          <div className="text-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              I can do both later! Skip to dashboard
            </button>
          </div>
        </div>
      ),
    },
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-cream to-secondary-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-4xl"
      >
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-primary-100 shadow-2xl">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm text-neutral-600 mb-2">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>{Math.round(((currentStep + 1) / steps.length) * 100)}% complete</span>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                transition={{ duration: 0.5 }}
                className="bg-gradient-to-r from-primary-500 to-secondary-500 h-2 rounded-full"
              />
            </div>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <h2 className="text-3xl font-bold text-neutral-800 mb-2">
                {steps[currentStep].title}
              </h2>
              <p className="text-neutral-600 mb-8 text-lg">
                {steps[currentStep].subtitle}
              </p>
              
              {steps[currentStep].component}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                currentStep === 0
                  ? 'text-neutral-400 cursor-not-allowed'
                  : 'text-neutral-600 hover:text-primary-600 hover:bg-primary-50'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>

            <div className="flex space-x-2">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full transition-all duration-200 ${
                    index === currentStep
                      ? 'bg-primary-500 w-8'
                      : index < currentStep
                      ? 'bg-primary-300'
                      : 'bg-neutral-200'
                  }`}
                />
              ))}
            </div>

            {currentStep < steps.length - 1 ? (
              <button
                onClick={nextStep}
                disabled={currentStep === 0 && !selectedGoal}
                className={`group flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  currentStep === 0 && !selectedGoal
                    ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                    : 'bg-primary-500 text-white hover:bg-primary-600 transform hover:scale-105'
                }`}
              >
                <span>Continue</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <button
                onClick={() => navigate('/dashboard')}
                className="group flex items-center space-x-2 px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-medium"
              >
                <span>Skip for now</span>
                <Calendar className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Onboarding;