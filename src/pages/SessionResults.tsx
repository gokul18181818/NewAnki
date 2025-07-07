import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowRight, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Target, 
  BarChart3,
  CheckCircle,
  AlertCircle,
  Flame,
  Trophy,
  RefreshCw
} from 'lucide-react';

interface SessionData {
  cardsStudied: number;
  timeSpent: string;
  performance: {
    '😞': number;
    '😐': number;
    '😊': number;
    '😁': number;
  };
  retentionRate: number;
  streak: number;
  tomorrowForecast: number;
  deckName: string;
  improvements: string[];
  weakestCards: string[];
  sessionMode?: string;
  cardsPerMinute?: number;
  totalTimeSeconds?: number;
  deckId?: string;
  sessionDate?: string;
}

const SessionResults: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get session data from navigation state or use mock data
  const sessionData: SessionData = location.state?.sessionData || {
    cardsStudied: 25,
    timeSpent: "12:34",
    performance: {
      '😞': 3,
      '😐': 5,
      '😊': 14,
      '😁': 3,
    },
    retentionRate: 85,
    streak: 8,
    tomorrowForecast: 18,
    deckName: "Spanish Vocabulary",
    improvements: [
      "Response time improved by 15%",
      "Accuracy up 8% from last session"
    ],
    weakestCards: [
      "Subjunctive mood conjugations",
      "Irregular verb 'ser' forms"
    ]
  };

  const totalCards = Object.values(sessionData.performance).reduce((sum, count) => sum + count, 0);
  const positiveRate = Math.round(((sessionData.performance['😊'] + sessionData.performance['😁']) / totalCards) * 100);

  const getRetentionStatus = () => {
    if (sessionData.retentionRate >= 85) return { color: 'success', icon: CheckCircle, message: 'Excellent!' };
    if (sessionData.retentionRate >= 70) return { color: 'warning', icon: Target, message: 'Good progress' };
    return { color: 'error', icon: AlertCircle, message: 'Keep practicing' };
  };

  const retentionStatus = getRetentionStatus();

  const performanceData = [
    { emoji: '😞', label: 'Again', count: sessionData.performance['😞'], percentage: Math.round((sessionData.performance['😞'] / totalCards) * 100), color: 'error' },
    { emoji: '😐', label: 'Hard', count: sessionData.performance['😐'], percentage: Math.round((sessionData.performance['😐'] / totalCards) * 100), color: 'warning' },
    { emoji: '😊', label: 'Good', count: sessionData.performance['😊'], percentage: Math.round((sessionData.performance['😊'] / totalCards) * 100), color: 'primary' },
    { emoji: '😁', label: 'Easy', count: sessionData.performance['😁'], percentage: Math.round((sessionData.performance['😁'] / totalCards) * 100), color: 'success' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-cream to-secondary-50 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 transition-colors duration-200">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 bg-gradient-to-r from-success-500 to-primary-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-neutral-800 dark:text-neutral-200 mb-2">
            Session Complete!
          </h1>
          <p className="text-xl text-neutral-600 dark:text-neutral-400">
            {sessionData.deckName}
            {sessionData.sessionMode && (
              <span className="ml-2 px-3 py-1 bg-secondary-100 dark:bg-secondary-900/30 text-secondary-700 dark:text-secondary-300 rounded-full text-sm">
                {sessionData.sessionMode}
              </span>
            )}
          </p>
        </motion.div>

        {/* Key Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-8 border border-primary-100 dark:border-neutral-700 shadow-lg mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-1">
                {sessionData.cardsStudied}
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                cards studied
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-secondary-600 dark:text-secondary-400 mb-1">
                {sessionData.timeSpent}
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                time spent
                {sessionData.cardsPerMinute && (
                  <div className="text-xs text-neutral-500 mt-1">
                    {sessionData.cardsPerMinute} cards/min
                  </div>
                )}
              </div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold text-${retentionStatus.color}-600 dark:text-${retentionStatus.color}-400 mb-1 flex items-center justify-center space-x-2`}>
                <span>{sessionData.retentionRate}%</span>
                <retentionStatus.icon className="w-6 h-6" />
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                retention rate
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-warning-600 dark:text-warning-400 mb-1 flex items-center justify-center space-x-2">
                <span>{sessionData.streak}</span>
                <Flame className="w-6 h-6" />
              </div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">
                day streak
              </div>
            </div>
          </div>

          <div className={`text-center p-4 bg-${retentionStatus.color}-50 dark:bg-${retentionStatus.color}-900/20 rounded-xl`}>
            <p className={`text-lg font-semibold text-${retentionStatus.color}-700 dark:text-${retentionStatus.color}-300`}>
              {retentionStatus.message}
            </p>
          </div>
        </motion.div>

        {/* Performance Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-8 border border-primary-100 dark:border-neutral-700 shadow-lg mb-8"
        >
          <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 mb-6 flex items-center">
            <BarChart3 className="w-6 h-6 mr-2 text-primary-500" />
            Performance Breakdown
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {performanceData.map((item, index) => (
              <motion.div
                key={item.emoji}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                className={`text-center p-4 bg-${item.color}-50 dark:bg-${item.color}-900/20 rounded-xl`}
              >
                <div className="text-3xl mb-2">{item.emoji}</div>
                <div className={`text-2xl font-bold text-${item.color}-600 dark:text-${item.color}-400 mb-1`}>
                  {item.count}
                </div>
                <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">
                  {item.label}
                </div>
                <div className={`text-xs font-medium text-${item.color}-700 dark:text-${item.color}-300`}>
                  ({item.percentage}%)
                </div>
              </motion.div>
            ))}
          </div>

          <div className="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                  Positive Response Rate
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  😊 + 😁 responses
                </p>
              </div>
              <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {positiveRate}%
              </div>
            </div>
          </div>
        </motion.div>

        {/* Insights & Forecast */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Session Insights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-primary-100 dark:border-neutral-700 shadow-lg"
          >
            <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-200 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-success-500" />
              Session Insights
            </h3>
            
            <div className="space-y-4">
              {sessionData.improvements.map((improvement, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-success-50 dark:bg-success-900/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-success-500 mt-0.5" />
                  <p className="text-sm text-success-700 dark:text-success-300">{improvement}</p>
                </div>
              ))}
              
              {sessionData.weakestCards.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Cards to review:
                  </p>
                  {sessionData.weakestCards.map((card, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg mb-2">
                      <AlertCircle className="w-5 h-5 text-warning-500 mt-0.5" />
                      <p className="text-sm text-warning-700 dark:text-warning-300">{card}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Tomorrow's Forecast */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-primary-100 dark:border-neutral-700 shadow-lg"
          >
            <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-200 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-primary-500" />
              Tomorrow's Forecast
            </h3>
            
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">
                {sessionData.tomorrowForecast}
              </div>
              <p className="text-neutral-600 dark:text-neutral-400">
                cards due tomorrow
              </p>
            </div>

            <div className="space-y-3">
              {(() => {
                // Calculate review vs new card split for tomorrow
                const reviewCards = Math.floor(sessionData.tomorrowForecast * 0.7);
                const newCards = sessionData.tomorrowForecast - reviewCards;
                
                return (
                  <>
                    <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                      <span className="text-sm text-primary-700 dark:text-primary-300">New cards</span>
                      <span className="font-semibold text-primary-600 dark:text-primary-400">{newCards}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-secondary-50 dark:bg-secondary-900/20 rounded-lg">
                      <span className="text-sm text-secondary-700 dark:text-secondary-300">Review cards</span>
                      <span className="font-semibold text-secondary-600 dark:text-secondary-400">{reviewCards}</span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="mt-4 p-3 bg-gradient-to-r from-success-50 to-primary-50 dark:from-success-900/20 dark:to-primary-900/20 rounded-lg">
              <p className="text-sm text-center text-neutral-700 dark:text-neutral-300">
                Perfect timing for a {Math.round(sessionData.tomorrowForecast * 0.6)}-minute session! 🎯
              </p>
            </div>
          </motion.div>
        </div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <button
            onClick={() => navigate('/dashboard')}
            className="group px-8 py-4 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg flex items-center justify-center space-x-2"
          >
            <span>Back to Dashboard</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button
            onClick={() => navigate(sessionData.deckId ? `/study/${sessionData.deckId}` : '/dashboard')}
            className="px-8 py-4 bg-secondary-500 text-white rounded-xl hover:bg-secondary-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg flex items-center justify-center space-x-2"
          >
            <RefreshCw className="w-5 h-5" />
            <span>{sessionData.deckId ? 'Study Again' : 'Back to Dashboard'}</span>
          </button>
          
          <button
            onClick={() => navigate('/progress')}
            className="px-8 py-4 bg-white dark:bg-neutral-800 text-primary-600 dark:text-primary-400 rounded-xl border-2 border-primary-200 dark:border-primary-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg flex items-center justify-center space-x-2"
          >
            <BarChart3 className="w-5 h-5" />
            <span>View Progress</span>
          </button>
        </motion.div>

        {/* Quick Stats Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-8 text-center"
        >
          <div className="inline-flex items-center space-x-6 px-6 py-3 bg-white/60 dark:bg-neutral-800/60 backdrop-blur-sm rounded-full border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-neutral-500" />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">{sessionData.timeSpent}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-neutral-500" />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">{sessionData.retentionRate}% accuracy</span>
            </div>
            <div className="flex items-center space-x-2">
              <Flame className="w-4 h-4 text-neutral-500" />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">{sessionData.streak} days</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SessionResults;