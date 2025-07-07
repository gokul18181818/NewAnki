import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Brain, Activity, AlertTriangle, CheckCircle, Clock, TrendingUp, Zap } from 'lucide-react';
import { AntiBurnoutEngine } from '../lib/antiBurnoutEngine';
import { ResponseTimeData, FatigueIndicators, SmartBreakSuggestion } from '../types/AntiBurnoutTypes';
import { EmojiRating } from '../contexts/StudyContext';

const AntiBurnoutDemo: React.FC = () => {
  const [engine] = useState(() => new AntiBurnoutEngine());
  const [fatigueIndicators, setFatigueIndicators] = useState<FatigueIndicators>({
    responseTimeSlowing: false,
    performanceDeclining: false,
    hesitationIncreasing: false,
    consistencyDecreasing: false,
    overallFatigueScore: 0,
  });
  const [breakSuggestion, setBreakSuggestion] = useState<SmartBreakSuggestion | null>(null);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [cardCount, setCardCount] = useState(0);

  // Simulate a study session with increasing fatigue
  const simulateStudySession = async () => {
    setSimulationRunning(true);
    setCardCount(0);
    engine.reset();

    // Simulate 20 cards with progressive fatigue
    for (let i = 0; i < 20; i++) {
      // Simulate response times that slow down as fatigue increases
      const baseFatigue = (i / 20) * 100; // Linear fatigue increase
      const baseResponseTime = 3000 + (baseFatigue * 50); // Slower responses as fatigue increases
      const variation = Math.random() * 1000; // Natural variation
      
      const timeToShowAnswer = baseResponseTime + variation;
      const timeToRate = 1000 + (Math.random() * 2000);
      const totalTime = timeToShowAnswer + timeToRate;

      // Performance degrades with fatigue
      let rating: EmojiRating;
      const performanceRandom = Math.random();
      if (baseFatigue < 30) {
        // Good performance when not fatigued
        rating = performanceRandom > 0.3 ? (performanceRandom > 0.7 ? '😁' : '😊') : '😐';
      } else if (baseFatigue < 60) {
        // Moderate performance
        rating = performanceRandom > 0.2 ? (performanceRandom > 0.6 ? '😊' : '😐') : '😞';
      } else {
        // Poor performance when fatigued
        rating = performanceRandom > 0.4 ? '😞' : (performanceRandom > 0.7 ? '😐' : '😊');
      }

      const responseData: ResponseTimeData = {
        cardId: `sim-card-${i}`,
        timeToShowAnswer,
        timeToRate,
        totalTime,
        timestamp: new Date(),
        rating,
        difficulty: Math.random() * 5,
      };

      engine.addResponseData(responseData);
      setCardCount(i + 1);

      // Update indicators every few cards
      if (i % 3 === 0) {
        const indicators = engine.getFatigueIndicators();
        setFatigueIndicators(indicators);

        const suggestion = engine.getBreakSuggestion();
        if (suggestion.triggered) {
          setBreakSuggestion(suggestion);
        }
      }

      // Simulate time between cards
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setSimulationRunning(false);
  };

  const resetDemo = () => {
    engine.reset();
    setFatigueIndicators({
      responseTimeSlowing: false,
      performanceDeclining: false,
      hesitationIncreasing: false,
      consistencyDecreasing: false,
      overallFatigueScore: 0,
    });
    setBreakSuggestion(null);
    setCardCount(0);
  };

  const getFatigueColor = (score: number) => {
    if (score > 75) return 'text-error-600 dark:text-error-400';
    if (score > 50) return 'text-warning-600 dark:text-warning-400';
    return 'text-success-600 dark:text-success-400';
  };

  const getFatigueBackground = (score: number) => {
    if (score > 75) return 'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800';
    if (score > 50) return 'bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800';
    return 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-200 mb-4 flex items-center justify-center space-x-3">
          <Brain className="w-8 h-8 text-primary-500" />
          <span>Anti-Burnout Intelligence Demo</span>
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 text-lg">
          Watch how our AI detects fatigue patterns and suggests optimal break timing
        </p>
      </motion.div>

      {/* Control Panel */}
      <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-primary-100 dark:border-neutral-700 shadow-lg">
        <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-4">
          Simulation Control
        </h2>
        <div className="flex space-x-4">
          <button
            onClick={simulateStudySession}
            disabled={simulationRunning}
            className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
              simulationRunning
                ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 cursor-not-allowed'
                : 'bg-primary-500 text-white hover:bg-primary-600 transform hover:scale-105'
            }`}
          >
            <Activity className="w-5 h-5" />
            <span>{simulationRunning ? 'Simulating...' : 'Start Simulation'}</span>
          </button>
          <button
            onClick={resetDemo}
            className="px-6 py-3 bg-secondary-500 text-white rounded-xl hover:bg-secondary-600 transition-all duration-200 transform hover:scale-105 font-medium"
          >
            Reset Demo
          </button>
        </div>
        {simulationRunning && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400 mb-2">
              <span>Cards simulated: {cardCount}/20</span>
              <span>{Math.round((cardCount / 20) * 100)}% complete</span>
            </div>
            <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(cardCount / 20) * 100}%` }}
                transition={{ duration: 0.3 }}
                className="bg-gradient-to-r from-primary-500 to-secondary-500 h-2 rounded-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Fatigue Indicators Dashboard */}
      <div className={`rounded-2xl p-6 border shadow-lg transition-all duration-500 ${getFatigueBackground(fatigueIndicators.overallFatigueScore)}`}>
        <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-6 flex items-center">
          <Brain className="w-6 h-6 mr-2 text-primary-500" />
          Real-time Fatigue Analysis
        </h2>

        {/* Overall Fatigue Score */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-medium text-neutral-800 dark:text-neutral-200">
              Overall Fatigue Score
            </span>
            <span className={`text-2xl font-bold ${getFatigueColor(fatigueIndicators.overallFatigueScore)}`}>
              {Math.round(fatigueIndicators.overallFatigueScore)}%
            </span>
          </div>
          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${fatigueIndicators.overallFatigueScore}%` }}
              transition={{ duration: 0.5 }}
              className={`h-4 rounded-full transition-all duration-500 ${
                fatigueIndicators.overallFatigueScore > 75 ? 'bg-error-500' :
                fatigueIndicators.overallFatigueScore > 50 ? 'bg-warning-500' :
                'bg-success-500'
              }`}
            />
          </div>
        </div>

        {/* Individual Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`p-4 rounded-xl border ${
            fatigueIndicators.responseTimeSlowing 
              ? 'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800' 
              : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-600'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              <Clock className={`w-5 h-5 ${fatigueIndicators.responseTimeSlowing ? 'text-error-600' : 'text-neutral-500'}`} />
              <span className="font-medium text-neutral-800 dark:text-neutral-200">Response Time</span>
            </div>
            <p className={`text-sm ${fatigueIndicators.responseTimeSlowing ? 'text-error-600 dark:text-error-400' : 'text-neutral-600 dark:text-neutral-400'}`}>
              {fatigueIndicators.responseTimeSlowing ? 'Slowing down' : 'Normal'}
            </p>
          </div>

          <div className={`p-4 rounded-xl border ${
            fatigueIndicators.performanceDeclining 
              ? 'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800' 
              : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-600'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className={`w-5 h-5 ${fatigueIndicators.performanceDeclining ? 'text-error-600' : 'text-neutral-500'}`} />
              <span className="font-medium text-neutral-800 dark:text-neutral-200">Performance</span>
            </div>
            <p className={`text-sm ${fatigueIndicators.performanceDeclining ? 'text-error-600 dark:text-error-400' : 'text-neutral-600 dark:text-neutral-400'}`}>
              {fatigueIndicators.performanceDeclining ? 'Declining' : 'Stable'}
            </p>
          </div>

          <div className={`p-4 rounded-xl border ${
            fatigueIndicators.hesitationIncreasing 
              ? 'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800' 
              : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-600'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className={`w-5 h-5 ${fatigueIndicators.hesitationIncreasing ? 'text-error-600' : 'text-neutral-500'}`} />
              <span className="font-medium text-neutral-800 dark:text-neutral-200">Hesitation</span>
            </div>
            <p className={`text-sm ${fatigueIndicators.hesitationIncreasing ? 'text-error-600 dark:text-error-400' : 'text-neutral-600 dark:text-neutral-400'}`}>
              {fatigueIndicators.hesitationIncreasing ? 'Increasing' : 'Normal'}
            </p>
          </div>

          <div className={`p-4 rounded-xl border ${
            fatigueIndicators.consistencyDecreasing 
              ? 'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800' 
              : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-600'
          }`}>
            <div className="flex items-center space-x-2 mb-2">
              <Zap className={`w-5 h-5 ${fatigueIndicators.consistencyDecreasing ? 'text-error-600' : 'text-neutral-500'}`} />
              <span className="font-medium text-neutral-800 dark:text-neutral-200">Consistency</span>
            </div>
            <p className={`text-sm ${fatigueIndicators.consistencyDecreasing ? 'text-error-600 dark:text-error-400' : 'text-neutral-600 dark:text-neutral-400'}`}>
              {fatigueIndicators.consistencyDecreasing ? 'Decreasing' : 'Good'}
            </p>
          </div>
        </div>
      </div>

      {/* Smart Break Suggestion */}
      {breakSuggestion && breakSuggestion.triggered && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-warning-50 to-error-50 dark:from-warning-900/20 dark:to-error-900/20 rounded-2xl p-6 border border-warning-200 dark:border-warning-800 shadow-lg"
        >
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-warning-500 to-error-500 rounded-2xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-warning-800 dark:text-warning-200 mb-2">
                Smart Break Suggestion Triggered!
              </h3>
              <p className="text-warning-700 dark:text-warning-300 mb-4">
                {breakSuggestion.message}
              </p>
              
              <div className="bg-white/50 dark:bg-neutral-800/50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">Trigger:</span>
                    <p className="text-neutral-600 dark:text-neutral-400">{breakSuggestion.trigger.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">Confidence:</span>
                    <p className="text-neutral-600 dark:text-neutral-400">{breakSuggestion.confidence}%</p>
                  </div>
                  <div className="md:col-span-2">
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">Benefits:</span>
                    <ul className="text-neutral-600 dark:text-neutral-400 list-disc list-inside">
                      {breakSuggestion.benefits.map((benefit, index) => (
                        <li key={index}>{benefit}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-success-600" />
                <span className="text-sm font-medium text-success-700 dark:text-success-300">
                  This is exactly when a real break would be suggested to the user!
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* System Status */}
      <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-primary-100 dark:border-neutral-700 shadow-lg">
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-4">
          System Status
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="font-medium text-neutral-800 dark:text-neutral-200">Cards Analyzed:</span>
            <p className="text-neutral-600 dark:text-neutral-400">{cardCount}</p>
          </div>
          <div>
            <span className="font-medium text-neutral-800 dark:text-neutral-200">Engine Status:</span>
            <p className="text-neutral-600 dark:text-neutral-400">
              {simulationRunning ? 'Analyzing...' : 'Ready'}
            </p>
          </div>
          <div>
            <span className="font-medium text-neutral-800 dark:text-neutral-200">Break Triggered:</span>
            <p className={`${breakSuggestion?.triggered ? 'text-warning-600' : 'text-success-600'}`}>
              {breakSuggestion?.triggered ? 'Yes' : 'No'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AntiBurnoutDemo;