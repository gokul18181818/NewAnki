/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line unused-imports/no-unused-imports
import { ArrowLeft, Calendar, TrendingUp, Target, Brain, Heart, Star, Trophy, Clock, MessageSquare } from 'lucide-react';
// Suppress unused icon import warnings (icons are referenced in JSX below)
void [ArrowLeft, Calendar, TrendingUp, Target, Brain, Heart, Star, Trophy, Clock, MessageSquare];
import { useUser } from '../contexts/UserContext';
import { useStudy } from '../contexts/StudyContext';
import { supabase } from '../lib/supabaseClient';
import { getPersonalizedTip, getUserAchievements, checkAndAwardAchievements, getRelativeTimeString, type Achievement } from '../lib/dynamicContent';

interface StudySession {
  id: string;
  user_id: string;
  deck_id: string;
  cards_studied: number;
  time_spent_seconds: number;
  performance_data: {
    '😞': number;
    '😐': number;
    '😊': number;
    '😁': number;
  };
  retention_rate: number;
  session_mode: string;
  session_date: string;
}

interface WeeklyData {
  date: string;
  cardsStudied: number;
  timeSpent: number;
  retentionRate: number;
  sessionsCount: number;
}

const Progress: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { studyStats, decks } = useStudy();
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [dynamicTip, setDynamicTip] = useState<string>('');

  // Fetch real study session data
  useEffect(() => {
    const fetchStudySessions = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('study_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('session_date', { ascending: false })
          .limit(100); // Get last 100 sessions

        if (error) {
          console.error('Failed to fetch study sessions:', error);
          return;
        }

        setStudySessions(data || []);
        
        // Load achievements and dynamic content
        const [userAchievements, newAchievements, tip] = await Promise.all([
          getUserAchievements(user.id),
          checkAndAwardAchievements(user.id),
          getPersonalizedTip(user.id)
        ]);
        
        setAchievements([...newAchievements, ...userAchievements]);
        setDynamicTip(tip.content);
        
      } catch (error) {
        console.error('Error fetching study sessions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudySessions();
  }, [user]);

  // Helper function to calculate best study time
  const calculateBestStudyTime = async (sessions: StudySession[]): Promise<string> => {
    if (!sessions.length) return '9:00 AM';
    
    // Group sessions by hour and calculate average retention
    const hourlyStats: { [hour: number]: { totalRetention: number; count: number } } = {};
    
    sessions.forEach(session => {
      const hour = new Date(session.session_date).getHours();
      if (!hourlyStats[hour]) {
        hourlyStats[hour] = { totalRetention: 0, count: 0 };
      }
      hourlyStats[hour].totalRetention += session.retention_rate;
      hourlyStats[hour].count += 1;
    });
    
    // Find hour with best average retention
    let bestHour = 9; // default
    let bestRetention = 0;
    
    Object.entries(hourlyStats).forEach(([hour, stats]) => {
      const avgRetention = stats.totalRetention / stats.count;
      if (avgRetention > bestRetention && stats.count >= 2) { // Need at least 2 sessions
        bestRetention = avgRetention;
        bestHour = parseInt(hour);
      }
    });
    
    // Format hour as readable time
    const period = bestHour < 12 ? 'AM' : 'PM';
    const displayHour = bestHour === 0 ? 12 : bestHour > 12 ? bestHour - 12 : bestHour;
    return `${displayHour}:00 ${period}`;
  };

  // Calculate real analytics
  const analytics = useMemo(() => {
    if (!studySessions.length) {
      return {
        monthlyStats: { studyDays: 0, totalCards: 0, newMastered: 0, streak: 0 },
        weeklyData: [],
        totalEmojis: { '😞': 0, '😐': 0, '😊': 0, '😁': 0 },
        insights: {
          bestTime: '9:00 AM',
          avgSession: 0,
          completionRate: 0,
          improvement: 0
        }
      };
    }

    // Calculate this month's stats
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthSessions = studySessions.filter(session => 
      new Date(session.session_date) >= monthStart
    );

    const studyDaysSet = new Set(
      monthSessions.map(session => 
        new Date(session.session_date).toDateString()
      )
    );

    const totalCards = monthSessions.reduce((sum, session) => 
      sum + session.cards_studied, 0
    );

    // Calculate streak (consecutive days)
    const sortedDates = Array.from(studyDaysSet).sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    );

    let streak = 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

    if (sortedDates.includes(today) || sortedDates.includes(yesterday)) {
      streak = 1;
      let checkDate = new Date(sortedDates[0]);
      
      for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(checkDate);
        prevDate.setDate(prevDate.getDate() - 1);
        
        if (sortedDates[i] === prevDate.toDateString()) {
          streak++;
          checkDate = new Date(sortedDates[i]);
        } else {
          break;
        }
      }
    }

    // Calculate weekly data for chart
    const weeklyData: WeeklyData[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      
      const daySessions = studySessions.filter(session => 
        new Date(session.session_date).toDateString() === dateStr
      );

      weeklyData.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        cardsStudied: daySessions.reduce((sum, s) => sum + s.cards_studied, 0),
        timeSpent: daySessions.reduce((sum, s) => sum + s.time_spent_seconds, 0),
        retentionRate: daySessions.length > 0 
          ? Math.round(daySessions.reduce((sum, s) => sum + s.retention_rate, 0) / daySessions.length)
          : 0,
        sessionsCount: daySessions.length
      });
    }

    // Aggregate emoji data
    const totalEmojis = studySessions.reduce((acc, session) => {
      Object.entries(session.performance_data).forEach(([emoji, count]) => {
        acc[emoji as keyof typeof acc] += count;
      });
      return acc;
    }, { '😞': 0, '😐': 0, '😊': 0, '😁': 0 });

    // Calculate insights
    const avgSessionTime = monthSessions.length > 0 
      ? Math.round(monthSessions.reduce((sum, s) => sum + s.time_spent_seconds, 0) / monthSessions.length / 60)
      : 0;

    const avgRetention = monthSessions.length > 0
      ? Math.round(monthSessions.reduce((sum, s) => sum + s.retention_rate, 0) / monthSessions.length)
      : 0;

    // Compare with previous week
    const thisWeekCards = weeklyData.slice(-7).reduce((sum, day) => sum + day.cardsStudied, 0);
    const lastWeekSessions = studySessions.filter(session => {
      const date = new Date(session.session_date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 14);
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);
      return date >= weekAgo && date < twoWeeksAgo;
    });
    const lastWeekCards = lastWeekSessions.reduce((sum, s) => sum + s.cards_studied, 0);
    const improvement = lastWeekCards > 0 ? Math.round(((thisWeekCards - lastWeekCards) / lastWeekCards) * 100) : 0;

    return {
      monthlyStats: {
        studyDays: studyDaysSet.size,
        totalCards,
        newMastered: Math.round(totalCards * 0.3), // Estimate based on cards studied
        streak
      },
      weeklyData,
      totalEmojis,
      insights: {
        bestTime: '9:00 AM', // Will be calculated separately
        avgSession: avgSessionTime,
        completionRate: avgRetention,
        improvement
      }
    };
  }, [studySessions]);

  // Separate effect for calculating best study time (async)
  const [bestStudyTime, setBestStudyTime] = useState('9:00 AM');
  useEffect(() => {
    const calculateTime = async () => {
      const time = await calculateBestStudyTime(studySessions);
      setBestStudyTime(time);
    };
    if (studySessions.length > 0) {
      calculateTime();
    }
  }, [studySessions]);

  const learningInsights = [
    {
      icon: Clock,
      title: 'Best study time',
      value: bestStudyTime,
      detail: `(${analytics.insights.completionRate}% retention)`,
      color: 'from-primary-500 to-primary-600',
    },
    {
      icon: TrendingUp,
      title: 'This week vs last',
      value: analytics.insights.improvement >= 0 ? `+${analytics.insights.improvement}%` : `${analytics.insights.improvement}%`,
      detail: 'improvement',
      color: analytics.insights.improvement >= 0 ? 'from-success-500 to-success-600' : 'from-warning-500 to-warning-600',
    },
    {
      icon: Target,
      title: 'Completion rate',
      value: `${analytics.insights.completionRate}%`,
      detail: 'this month',
      color: analytics.insights.completionRate >= 80 ? 'from-success-500 to-success-600' : 'from-warning-500 to-warning-600',
    },
    {
      icon: Heart,
      title: 'Avg session',
      value: `${analytics.insights.avgSession} min`,
      detail: 'this month',
      color: 'from-secondary-500 to-secondary-600',
    },
  ];


  const goals = useMemo(() => {
    const positiveEmojis = analytics.totalEmojis['😊'] + analytics.totalEmojis['😁'];
    const totalEmojis = Object.values(analytics.totalEmojis).reduce((a, b) => a + b, 0);
    const positivityRate = totalEmojis > 0 ? Math.round((positiveEmojis / totalEmojis) * 100) : 0;
    
    return [
      {
        title: 'Study 5 days/week',
        current: Math.min(analytics.monthlyStats.studyDays, 20), // Cap at reasonable number for weekly calculation
        target: 20, // Monthly target (5 days * 4 weeks)
        unit: ' days this month',
        status: analytics.monthlyStats.studyDays >= 20 ? 'completed' : analytics.monthlyStats.studyDays >= 15 ? 'in-progress' : 'needs-work',
      },
      {
        title: 'Study 200 cards this month',
        current: analytics.monthlyStats.totalCards,
        target: 200,
        unit: ' cards',
        status: analytics.monthlyStats.totalCards >= 200 ? 'completed' : analytics.monthlyStats.totalCards >= 100 ? 'in-progress' : 'needs-work',
      },
      {
        title: 'Maintain 😊 rate above 70%',
        current: positivityRate,
        target: 70,
        unit: '%',
        status: positivityRate >= 70 ? 'completed' : positivityRate >= 50 ? 'in-progress' : 'needs-work',
      },
    ];
  }, [analytics]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-cream to-secondary-50 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-lg text-neutral-600 dark:text-neutral-400">Loading your progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-cream to-secondary-50 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm border-b border-primary-100 dark:border-neutral-700 sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">Your Learning Journey</h1>
            </div>
            <div className="flex items-center space-x-2 text-primary-600 dark:text-primary-400">
              <TrendingUp className="w-5 h-5" />
              <span className="font-semibold">Progress Analytics</span>
              <button
                onClick={() => window.open('https://docs.google.com/forms/d/e/1FAIpQLSePXWmzk1cfOUsQE_djwZtEsxWqfXR8Cv_dbK_BkZyvhhf-0Q/viewform?usp=header', '_blank', 'noopener')}
                className="ml-4 p-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                title="Feedback"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Monthly Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-primary-100 dark:border-neutral-700 shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">This Month</h3>
              <Calendar className="w-6 h-6 text-primary-500" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-neutral-600 dark:text-neutral-400">Study days</span>
                <span className="font-bold text-primary-600 dark:text-primary-400">{analytics.monthlyStats.studyDays}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600 dark:text-neutral-400">Total cards</span>
                <span className="font-bold text-secondary-600 dark:text-secondary-400">{analytics.monthlyStats.totalCards}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600 dark:text-neutral-400">New mastered</span>
                <span className="font-bold text-success-600 dark:text-success-400">{analytics.monthlyStats.newMastered}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600 dark:text-neutral-400">Streak</span>
                <span className="font-bold text-warning-600 dark:text-warning-400">{analytics.monthlyStats.streak} days</span>
              </div>
            </div>
            <div className="mt-4 text-center">
              <div className="inline-flex items-center px-3 py-1 bg-success-50 dark:bg-success-900/20 rounded-full">
                <Trophy className="w-4 h-4 text-success-600 dark:text-success-400 mr-1" />
                <span className="text-sm font-medium text-success-700 dark:text-success-300">Amazing!</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-secondary-100 dark:border-neutral-700 shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">Emoji Breakdown</h3>
              <Heart className="w-6 h-6 text-secondary-500" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">😊</span>
                  <span className="text-neutral-600 dark:text-neutral-400">Happy</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                    <div 
                      className="bg-primary-500 h-2 rounded-full"
                      style={{ 
                        width: `${Object.values(analytics.totalEmojis).reduce((a, b) => a + b, 0) > 0 
                          ? (analytics.totalEmojis['😊'] / Object.values(analytics.totalEmojis).reduce((a, b) => a + b, 0)) * 100 
                          : 0}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-neutral-800 dark:text-neutral-300">{analytics.totalEmojis['😊']}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">😁</span>
                  <span className="text-neutral-600 dark:text-neutral-400">Very happy</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                    <div 
                      className="bg-success-500 h-2 rounded-full"
                      style={{ 
                        width: `${Object.values(analytics.totalEmojis).reduce((a, b) => a + b, 0) > 0 
                          ? (analytics.totalEmojis['😁'] / Object.values(analytics.totalEmojis).reduce((a, b) => a + b, 0)) * 100 
                          : 0}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-neutral-800 dark:text-neutral-300">{analytics.totalEmojis['😁']}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">😐</span>
                  <span className="text-neutral-600 dark:text-neutral-400">Neutral</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                    <div 
                      className="bg-warning-500 h-2 rounded-full"
                      style={{ 
                        width: `${Object.values(analytics.totalEmojis).reduce((a, b) => a + b, 0) > 0 
                          ? (analytics.totalEmojis['😐'] / Object.values(analytics.totalEmojis).reduce((a, b) => a + b, 0)) * 100 
                          : 0}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-neutral-800 dark:text-neutral-300">{analytics.totalEmojis['😐']}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">😞</span>
                  <span className="text-neutral-600 dark:text-neutral-400">Learning</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                    <div 
                      className="bg-error-500 h-2 rounded-full"
                      style={{ 
                        width: `${Object.values(analytics.totalEmojis).reduce((a, b) => a + b, 0) > 0 
                          ? (analytics.totalEmojis['😞'] / Object.values(analytics.totalEmojis).reduce((a, b) => a + b, 0)) * 100 
                          : 0}%` 
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium text-neutral-800 dark:text-neutral-300">{analytics.totalEmojis['😞']}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <div className="inline-flex items-center px-3 py-1 bg-success-50 dark:bg-success-900/20 rounded-full">
                <Star className="w-4 h-4 text-success-600 dark:text-success-400 mr-1" />
                <span className="text-sm font-medium text-success-700 dark:text-success-300">
                  Great positivity! 🌟
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="md:col-span-2 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-primary-100 dark:border-neutral-700 shadow-lg"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">Learning Insights</h3>
              <Brain className="w-6 h-6 text-primary-500" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {learningInsights.map((insight, index) => (
                <motion.div
                  key={insight.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="text-center p-4 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800 dark:to-neutral-700 rounded-xl"
                >
                  <div className={`w-12 h-12 bg-gradient-to-r ${insight.color} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                    <insight.icon className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">{insight.title}</p>
                  <p className="font-bold text-neutral-800 dark:text-neutral-200">{insight.value}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-500">{insight.detail}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center mr-3">
                  <span className="text-white font-bold">💡</span>
                </div>
                <div>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200">Pro Tip</p>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {dynamicTip || 'You learn 40% better with images! Try adding visuals to your cards.'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Goals & Achievements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Goals */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-primary-100 dark:border-neutral-700 shadow-lg"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">Goals & Achievements</h3>
              <Target className="w-6 h-6 text-primary-500" />
            </div>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-4">Current Goals:</h4>
                <div className="space-y-4">
                  {goals.map((goal, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-700 dark:text-neutral-300">{goal.title}</span>
                        <div className="flex items-center space-x-2">
                          {goal.status === 'completed' ? (
                            <span className="text-success-600 dark:text-success-400 font-medium">✅ Done! ({goal.current}/{goal.target})</span>
                          ) : goal.status === 'in-progress' ? (
                            <span className="text-warning-600 dark:text-warning-400 font-medium">⏳ ({goal.current}/{goal.target})</span>
                          ) : (
                            <span className="text-error-600 dark:text-error-400 font-medium">🎯 ({goal.current}/{goal.target}{goal.unit})</span>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            goal.status === 'completed' ? 'bg-success-500' :
                            goal.status === 'in-progress' ? 'bg-warning-500' : 'bg-error-500'
                          }`}
                          style={{ width: `${Math.min((goal.current / goal.target) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-4">Recent Achievements:</h4>
                <div className="space-y-3">
                  {achievements.length > 0 ? (
                    achievements.slice(0, 3).map((achievement, index) => (
                      <div key={achievement.id} className="flex items-start space-x-3 p-3 bg-gradient-to-r from-success-50 to-primary-50 dark:from-success-900/10 dark:to-primary-900/10 rounded-xl">
                        <div className="text-2xl">{achievement.icon}</div>
                        <div className="flex-1">
                          <p className="font-medium text-neutral-800 dark:text-neutral-200">{achievement.title}</p>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">{achievement.description}</p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                            {achievement.unlockedAt ? getRelativeTimeString(achievement.unlockedAt) : 'Recently earned'}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center p-6 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
                      <div className="text-4xl mb-2">🎯</div>
                      <p className="font-medium text-neutral-700 dark:text-neutral-300 mb-1">Start Your Journey!</p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">Complete study sessions to earn achievements</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Weekly Chart Placeholder */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-primary-100 dark:border-neutral-700 shadow-lg"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-neutral-800">Weekly Progress</h3>
              <TrendingUp className="w-6 h-6 text-success-500" />
            </div>
            
            <div className="h-64 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
                </div>
              ) : analytics.weeklyData.length > 0 ? (
                <div className="h-full flex items-end justify-between space-x-2">
                  {analytics.weeklyData.map((day, index) => {
                    const maxCards = Math.max(...analytics.weeklyData.map(d => d.cardsStudied), 1);
                    const height = Math.max((day.cardsStudied / maxCards) * 100, 5);
                    
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center space-y-2">
                        <div className="flex flex-col items-center space-y-1">
                          <div className="text-xs text-neutral-600 dark:text-neutral-400">
                            {day.cardsStudied}
                          </div>
                          <div 
                            className={`w-full rounded-t-lg transition-all duration-500 ${
                              day.cardsStudied > 0 
                                ? 'bg-gradient-to-t from-primary-500 to-primary-400' 
                                : 'bg-neutral-200 dark:bg-neutral-700'
                            }`}
                            style={{ height: `${height}%`, minHeight: '8px' }}
                          />
                        </div>
                        <div className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                          {day.date}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <TrendingUp className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-2">No Data Yet</p>
                    <p className="text-neutral-600 dark:text-neutral-400">
                      Start studying to see your progress here!
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{analytics.insights.completionRate}%</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Completion Rate</p>
              </div>
              <div className={`text-center p-3 rounded-xl ${
                analytics.insights.improvement >= 0 
                  ? 'bg-success-50 dark:bg-success-900/20' 
                  : 'bg-warning-50 dark:bg-warning-900/20'
              }`}>
                <p className={`text-2xl font-bold ${
                  analytics.insights.improvement >= 0 
                    ? 'text-success-600 dark:text-success-400' 
                    : 'text-warning-600 dark:text-warning-400'
                }`}>
                  {analytics.insights.improvement >= 0 ? '+' : ''}{analytics.insights.improvement}%
                </p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">vs Last Week</p>
              </div>
              <div className="text-center p-3 bg-secondary-50 dark:bg-secondary-900/20 rounded-xl">
                <p className="text-2xl font-bold text-secondary-600 dark:text-secondary-400">{analytics.insights.avgSession}min</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Avg Session</p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default Progress;