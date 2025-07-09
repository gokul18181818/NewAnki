import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Brain, Sparkles, Heart, Calendar, ArrowRight } from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
      },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-cream to-secondary-50 overflow-hidden">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 px-4 py-6"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
              StudyBuddy
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/login')}
              className="text-neutral-600 hover:text-primary-600 transition-colors font-medium"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="px-6 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-medium shadow-lg hover:shadow-xl"
            >
              Sign Up
            </button>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative px-4 py-16 text-center"
      >
        <div className="max-w-4xl mx-auto">
          <motion.div variants={itemVariants} className="mb-6">
            <div className="inline-flex items-center space-x-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 border border-primary-200 shadow-lg">
              <Sparkles className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-medium text-primary-700">AI-Powered Learning</span>
            </div>
          </motion.div>

          <motion.h2
            variants={itemVariants}
            className="text-5xl md:text-6xl font-bold text-neutral-800 mb-6 leading-tight"
          >
            Smart flashcards that
            <br />
            <span className="bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
              adapt to you
            </span>
            <motion.span
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className="inline-block ml-2"
            >
              🧠
            </motion.span>
          </motion.h2>

          <motion.p
            variants={itemVariants}
            className="text-xl text-neutral-600 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Transform your study routine with AI that creates cards from your PDFs,
            provides emoji feedback, and prevents burnout with intelligent scheduling.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button
              onClick={() => navigate('/signup')}
              className="group px-8 py-4 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
            >
              <span>Start Free</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => navigate('/import')}
              className="px-8 py-4 bg-white text-primary-600 rounded-xl border-2 border-primary-200 hover:border-primary-300 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg hover:shadow-xl"
            >
              Import from Anki
            </button>
          </motion.div>

          {/* Feature Grid */}
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto"
          >
            <motion.div
              variants={itemVariants}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-primary-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-800 mb-2">AI Creates Cards</h3>
              <p className="text-neutral-600 text-sm">
                Upload PDFs and watch AI instantly extract key concepts into perfect flashcards
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-secondary-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <div className="w-12 h-12 bg-gradient-to-r from-secondary-500 to-secondary-600 rounded-xl flex items-center justify-center mb-4">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-800 mb-2">Emoji Feedback</h3>
              <p className="text-neutral-600 text-sm">
                Rate cards with emotions, not numbers. Makes studying feel natural and enjoyable
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-accent-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <div className="w-12 h-12 bg-gradient-to-r from-accent-500 to-accent-600 rounded-xl flex items-center justify-center mb-4">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-800 mb-2">Smart Scheduling</h3>
              <p className="text-neutral-600 text-sm">
                Never burn out with intelligent break suggestions and adaptive review timing
              </p>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-success-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <div className="w-12 h-12 bg-gradient-to-r from-success-500 to-success-600 rounded-xl flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-800 mb-2">Import & Improve</h3>
              <p className="text-neutral-600 text-sm">
                Bring your Anki decks and watch them get enhanced with AI improvements
              </p>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>


      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-primary-200 to-secondary-200 rounded-full blur-3xl opacity-20"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-accent-200 to-success-200 rounded-full blur-3xl opacity-20"></div>
      </div>
    </div>
  );
};

export default LandingPage;