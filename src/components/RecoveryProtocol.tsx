import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Clock, Zap, Coffee, Smile, ArrowRight, X } from 'lucide-react';
import { RecoveryProtocol as RecoveryProtocolType } from '../types/AntiBurnoutTypes';

interface RecoveryProtocolProps {
  isVisible: boolean;
  breakDuration: number; // minutes
  preFatigueScore: number;
  onRecoveryComplete: (protocol: RecoveryProtocolType) => void;
  onSkip: () => void;
}

const RecoveryProtocol: React.FC<RecoveryProtocolProps> = ({
  isVisible,
  breakDuration,
  preFatigueScore,
  onRecoveryComplete,
  onSkip,
}) => {
  const [breakStartTime] = useState(new Date());
  const [currentActivity, setCurrentActivity] = useState<string | null>(null);
  const [recoveryActivities, setRecoveryActivities] = useState<string[]>([]);
  const [energyLevel, setEnergyLevel] = useState<number>(1); // 1-5 scale
  const [focusLevel, setFocusLevel] = useState<number>(1); // 1-5 scale
  const [step, setStep] = useState<'activities' | 'assessment' | 'recommendations'>('activities');

  const suggestedActivities = [
    { id: 'hydrate', label: 'Drink water', icon: '💧', duration: 1 },
    { id: 'stretch', label: 'Light stretching', icon: '🤸‍♀️', duration: 3 },
    { id: 'walk', label: 'Short walk', icon: '🚶‍♀️', duration: 5 },
    { id: 'breathe', label: 'Deep breathing', icon: '🌬️', duration: 2 },
    { id: 'snack', label: 'Healthy snack', icon: '🍎', duration: 3 },
    { id: 'fresh_air', label: 'Get fresh air', icon: '🌿', duration: 4 },
    { id: 'eyes_rest', label: 'Rest your eyes', icon: '👁️', duration: 2 },
    { id: 'music', label: 'Listen to music', icon: '🎵', duration: 5 },
  ];

  const getRecommendedActivities = () => {
    // Recommend activities based on fatigue level and break duration
    const filtered = suggestedActivities.filter(activity => {
      if (breakDuration <= 5) return activity.duration <= 3;
      if (breakDuration <= 10) return activity.duration <= 5;
      return true;
    });

    // Prioritize based on fatigue score
    if (preFatigueScore > 80) {
      return filtered.filter(a => ['hydrate', 'breathe', 'eyes_rest', 'fresh_air'].includes(a.id));
    } else if (preFatigueScore > 60) {
      return filtered.filter(a => ['stretch', 'walk', 'hydrate', 'snack'].includes(a.id));
    }
    return filtered;
  };

  const toggleActivity = (activityId: string) => {
    setRecoveryActivities(prev => 
      prev.includes(activityId) 
        ? prev.filter(id => id !== activityId)
        : [...prev, activityId]
    );
  };

  const handleNext = () => {
    if (step === 'activities') {
      setStep('assessment');
    } else if (step === 'assessment') {
      setStep('recommendations');
    }
  };

  const handleComplete = () => {
    const endTime = new Date();
    const actualBreakDuration = (endTime.getTime() - breakStartTime.getTime()) / 1000 / 60;
    
    // Calculate recovery effectiveness based on activities and self-assessment
    const activityScore = (recoveryActivities.length / getRecommendedActivities().length) * 40;
    const energyScore = (energyLevel / 5) * 30;
    const focusScore = (focusLevel / 5) * 30;
    const effectiveness = Math.min(100, activityScore + energyScore + focusScore);

    const protocol: RecoveryProtocolType = {
      breakTaken: true,
      breakDuration: actualBreakDuration,
      breakEffectiveness: effectiveness,
      preBreakPerformance: {
        windowStart: 0,
        windowEnd: 0,
        averageResponseTime: 0,
        averageRating: 0,
        ratingDistribution: { '😞': 0, '😐': 0, '😊': 0, '😁': 0 },
        fatigueScore: preFatigueScore,
      },
      recoveryRecommendations: generateRecommendations(),
    };

    onRecoveryComplete(protocol);
  };

  const generateRecommendations = (): string[] => {
    const recommendations: string[] = [];
    
    if (energyLevel <= 2) {
      recommendations.push('Consider a longer break or lighter study session');
      recommendations.push('Focus on review cards rather than new content');
    } else if (energyLevel >= 4) {
      recommendations.push('Great energy! You can tackle challenging cards');
      recommendations.push('This is a good time for intensive learning');
    }

    if (focusLevel <= 2) {
      recommendations.push('Start with easier cards to rebuild focus');
      recommendations.push('Use shorter study intervals (10-15 minutes)');
    }

    if (recoveryActivities.includes('hydrate')) {
      recommendations.push('Hydration will help maintain cognitive performance');
    }

    if (recoveryActivities.includes('walk') || recoveryActivities.includes('stretch')) {
      recommendations.push('Physical activity will boost your mental clarity');
    }

    return recommendations;
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white dark:bg-neutral-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">
                  Recovery Protocol
                </h2>
                <p className="text-neutral-600 dark:text-neutral-400">
                  Optimize your {breakDuration}-minute break
                </p>
              </div>
            </div>
            <button
              onClick={onSkip}
              className="p-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {step === 'activities' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-3">
                  Recommended Activities
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                  Select activities you did or plan to do during your break:
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  {getRecommendedActivities().map((activity) => (
                    <motion.button
                      key={activity.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleActivity(activity.id)}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                        recoveryActivities.includes(activity.id)
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-neutral-200 dark:border-neutral-600 hover:border-primary-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{activity.icon}</span>
                        <div>
                          <p className="font-medium text-neutral-800 dark:text-neutral-200">
                            {activity.label}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            ~{activity.duration} min
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={onSkip}
                  className="px-6 py-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
                >
                  Skip Protocol
                </button>
                <button
                  onClick={handleNext}
                  className="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors font-medium flex items-center space-x-2"
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'assessment' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-4">
                  How are you feeling?
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                      Energy Level
                    </label>
                    <div className="flex space-x-2">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <button
                          key={level}
                          onClick={() => setEnergyLevel(level)}
                          className={`w-12 h-12 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                            energyLevel >= level
                              ? 'border-yellow-500 bg-yellow-100 dark:bg-yellow-900/30'
                              : 'border-neutral-300 dark:border-neutral-600'
                          }`}
                        >
                          <Zap className={`w-5 h-5 ${
                            energyLevel >= level ? 'text-yellow-600' : 'text-neutral-400'
                          }`} />
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {energyLevel === 1 ? 'Very tired' : 
                       energyLevel === 2 ? 'Tired' :
                       energyLevel === 3 ? 'Okay' :
                       energyLevel === 4 ? 'Good' : 'Energized'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                      Focus Level
                    </label>
                    <div className="flex space-x-2">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <button
                          key={level}
                          onClick={() => setFocusLevel(level)}
                          className={`w-12 h-12 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                            focusLevel >= level
                              ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/30'
                              : 'border-neutral-300 dark:border-neutral-600'
                          }`}
                        >
                          <Brain className={`w-5 h-5 ${
                            focusLevel >= level ? 'text-blue-600' : 'text-neutral-400'
                          }`} />
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {focusLevel === 1 ? 'Very distracted' : 
                       focusLevel === 2 ? 'Distracted' :
                       focusLevel === 3 ? 'Okay' :
                       focusLevel === 4 ? 'Focused' : 'Very focused'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setStep('activities')}
                  className="px-6 py-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  className="px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors font-medium flex items-center space-x-2"
                >
                  <span>Get Recommendations</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'recommendations' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-4">
                  Your Recovery Plan
                </h3>
                
                <div className="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl p-4 mb-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <Smile className="w-6 h-6 text-primary-600" />
                    <span className="font-medium text-primary-700 dark:text-primary-300">
                      Recovery Score: {Math.round((energyLevel + focusLevel) / 2 * 20)}%
                    </span>
                  </div>
                  <div className="text-sm text-primary-600 dark:text-primary-400">
                    Energy: {energyLevel}/5 • Focus: {focusLevel}/5
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-neutral-800 dark:text-neutral-200">
                    Recommendations for your next session:
                  </h4>
                  {generateRecommendations().map((rec, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                      <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0" />
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleComplete}
                  className="px-8 py-3 bg-success-500 text-white rounded-xl hover:bg-success-600 transition-colors font-medium flex items-center space-x-2"
                >
                  <Coffee className="w-5 h-5" />
                  <span>Start Studying</span>
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default RecoveryProtocol;