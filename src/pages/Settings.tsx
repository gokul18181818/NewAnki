import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  User,
  Bell,
  Palette,
  CreditCard,
  Save,
  Check,
  Clock,
  Volume2,
  Sparkles
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import ThemeToggle from '../components/ThemeToggle';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { user, updatePreferences } = useUser();
  const [activeTab, setActiveTab] = useState('profile');
  const [settings, setSettings] = useState({
    name: user?.name || '',
    email: user?.email || '',
    studyGoal: user?.studyGoal || '',
    timeZone: 'EST',
    showProgressPopups: user?.preferences?.showProgressPopups ?? true,
    smartBreakSuggestions: user?.preferences?.smartBreakSuggestions ?? true,
    emojiCelebrations: user?.preferences?.emojiCelebrations ?? true,
    soundEffects: user?.preferences?.soundEffects ?? false,
    dailyReminders: user?.preferences?.dailyReminders ?? true,
    reminderTime: user?.preferences?.reminderTime ?? '09:00',
    sessionLength: user?.preferences?.sessionLength ?? 'auto',
    customSessionLength: user?.preferences?.customSessionLength ?? 25,
    newCardsPerDay: user?.preferences?.newCardsPerDay ?? 20,
    maxDailyCards: user?.preferences?.maxDailyCards ?? 200,
    breakInterval: user?.preferences?.breakInterval ?? 25,
    breakDuration: user?.preferences?.breakDuration ?? 15,
    adaptiveBreaks: user?.preferences?.adaptiveBreaks ?? true,
    fontSize: user?.preferences?.fontSize ?? 16,
    animations: user?.preferences?.animations ?? true,
  });

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'study', label: 'Study', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
  ];

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Update settings when user preferences change (e.g., after loading from Supabase)
  useEffect(() => {
    if (user?.preferences) {
      setSettings(prev => ({
        ...prev,
        showProgressPopups: user.preferences?.showProgressPopups ?? prev.showProgressPopups,
        smartBreakSuggestions: user.preferences?.smartBreakSuggestions ?? prev.smartBreakSuggestions,
        emojiCelebrations: user.preferences?.emojiCelebrations ?? prev.emojiCelebrations,
        soundEffects: user.preferences?.soundEffects ?? prev.soundEffects,
        dailyReminders: user.preferences?.dailyReminders ?? prev.dailyReminders,
        reminderTime: user.preferences?.reminderTime ?? prev.reminderTime,
        sessionLength: user.preferences?.sessionLength ?? prev.sessionLength,
        customSessionLength: user.preferences?.customSessionLength ?? prev.customSessionLength,
        newCardsPerDay: user.preferences?.newCardsPerDay ?? prev.newCardsPerDay,
        maxDailyCards: user.preferences?.maxDailyCards ?? prev.maxDailyCards,
        breakInterval: user.preferences?.breakInterval ?? prev.breakInterval,
        breakDuration: user.preferences?.breakDuration ?? prev.breakDuration,
        adaptiveBreaks: user.preferences?.adaptiveBreaks ?? prev.adaptiveBreaks,
        fontSize: user.preferences?.fontSize ?? prev.fontSize,
        animations: user.preferences?.animations ?? prev.animations,
      }));
    }
  }, [user?.preferences]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      await updatePreferences({
        showProgressPopups: settings.showProgressPopups,
        smartBreakSuggestions: settings.smartBreakSuggestions,
        emojiCelebrations: settings.emojiCelebrations,
        soundEffects: settings.soundEffects,
        dailyReminders: settings.dailyReminders,
        reminderTime: settings.reminderTime,
        sessionLength: settings.sessionLength,
        customSessionLength: settings.customSessionLength,
        newCardsPerDay: settings.newCardsPerDay,
        maxDailyCards: settings.maxDailyCards,
        breakInterval: settings.breakInterval,
        breakDuration: settings.breakDuration,
        adaptiveBreaks: settings.adaptiveBreaks,
        fontSize: settings.fontSize,
        animations: settings.animations,
      });
      
      setSaveMessage('Settings saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveMessage('Failed to save settings. Please try again.');
      
      // Clear error message after 5 seconds
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const renderProfileTab = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Name
        </label>
        <input
          type="text"
          value={settings.name}
          onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Email
        </label>
        <input
          type="email"
          value={settings.email}
          onChange={(e) => setSettings(prev => ({ ...prev, email: e.target.value }))}
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Study Goal
        </label>
        <select
          value={settings.studyGoal}
          onChange={(e) => setSettings(prev => ({ ...prev, studyGoal: e.target.value }))}
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
        >
          <option value="Medical School">Medical School</option>
          <option value="Languages">Languages</option>
          <option value="Professional">Professional</option>
          <option value="Academic">Academic</option>
          <option value="Certification">Certification</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Time Zone
        </label>
        <select
          value={settings.timeZone}
          onChange={(e) => setSettings(prev => ({ ...prev, timeZone: e.target.value }))}
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
        >
          <option value="EST">EST (Eastern)</option>
          <option value="CST">CST (Central)</option>
          <option value="MST">MST (Mountain)</option>
          <option value="PST">PST (Pacific)</option>
        </select>
      </div>
    </div>
  );

  const renderStudyTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-4">Study Preferences</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Sparkles className="w-5 h-5 text-primary-500" />
              <div>
                <p className="font-medium text-neutral-800 dark:text-neutral-200">Show progress pop-ups</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Get real-time celebrations and encouragement</p>
              </div>
            </div>
            <button
              onClick={() => setSettings(prev => ({ ...prev, showProgressPopups: !prev.showProgressPopups }))}
              className={`w-12 h-6 rounded-full transition-all duration-200 ${
                settings.showProgressPopups ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                settings.showProgressPopups ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-secondary-500" />
              <div>
                <p className="font-medium text-neutral-800 dark:text-neutral-200">Smart break suggestions</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Get notified when it's time for a break</p>
              </div>
            </div>
            <button
              onClick={() => setSettings(prev => ({ ...prev, smartBreakSuggestions: !prev.smartBreakSuggestions }))}
              className={`w-12 h-6 rounded-full transition-all duration-200 ${
                settings.smartBreakSuggestions ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                settings.smartBreakSuggestions ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-xl">😊</span>
              <div>
                <p className="font-medium text-neutral-800 dark:text-neutral-200">Emoji celebrations</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Celebrate achievements with fun animations</p>
              </div>
            </div>
            <button
              onClick={() => setSettings(prev => ({ ...prev, emojiCelebrations: !prev.emojiCelebrations }))}
              className={`w-12 h-6 rounded-full transition-all duration-200 ${
                settings.emojiCelebrations ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                settings.emojiCelebrations ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Volume2 className="w-5 h-5 text-accent-500" />
              <div>
                <p className="font-medium text-neutral-800 dark:text-neutral-200">Sound effects</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Play sounds for interactions and achievements</p>
              </div>
            </div>
            <button
              onClick={() => setSettings(prev => ({ ...prev, soundEffects: !prev.soundEffects }))}
              className={`w-12 h-6 rounded-full transition-all duration-200 ${
                settings.soundEffects ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                settings.soundEffects ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bell className="w-5 h-5 text-warning-500" />
              <div>
                <p className="font-medium text-neutral-800 dark:text-neutral-200">Daily study reminders</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Get reminded to study at your preferred time</p>
              </div>
            </div>
            <button
              onClick={() => setSettings(prev => ({ ...prev, dailyReminders: !prev.dailyReminders }))}
              className={`w-12 h-6 rounded-full transition-all duration-200 ${
                settings.dailyReminders ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                settings.dailyReminders ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Reminder time
        </label>
        <select
          value={settings.reminderTime}
          onChange={(e) => setSettings(prev => ({ ...prev, reminderTime: e.target.value }))}
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
        >
          <option value="07:00">7:00 AM</option>
          <option value="08:00">8:00 AM</option>
          <option value="09:00">9:00 AM</option>
          <option value="10:00">10:00 AM</option>
          <option value="18:00">6:00 PM</option>
          <option value="19:00">7:00 PM</option>
          <option value="20:00">8:00 PM</option>
        </select>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-4">Study Limits</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              New cards per day
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="1"
                max="100"
                value={settings.newCardsPerDay}
                onChange={(e) => {
                  const value = Math.max(1, Math.min(100, parseInt(e.target.value) || 1));
                  setSettings(prev => ({ ...prev, newCardsPerDay: value }));
                }}
                className="w-24 p-2 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
              />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">cards (1-100)</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Maximum daily cards
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="50"
                max="500"
                value={settings.maxDailyCards}
                onChange={(e) => {
                  const value = Math.max(50, Math.min(500, parseInt(e.target.value) || 50));
                  setSettings(prev => ({ ...prev, maxDailyCards: value }));
                }}
                className="w-24 p-2 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
              />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">cards (50-500)</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Session length
        </label>
        <div className="space-y-3">
          <div className="flex space-x-4">
            {['auto', '15', '30', '45', 'custom'].map(length => (
              <button
                key={length}
                onClick={() => setSettings(prev => ({ ...prev, sessionLength: length }))}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  settings.sessionLength === length
                    ? 'bg-primary-500 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                }`}
              >
                {length === 'auto' ? 'Auto' : length === 'custom' ? 'Custom' : `${length} min`}
              </button>
            ))}
          </div>
          
          {settings.sessionLength === 'custom' && (
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="5"
                max="120"
                value={settings.customSessionLength}
                onChange={(e) => {
                  const value = Math.max(5, Math.min(120, parseInt(e.target.value) || 5));
                  setSettings(prev => ({ ...prev, customSessionLength: value }));
                }}
                className="w-24 p-2 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
              />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">minutes (5-120)</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-4">Break Management</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-primary-500" />
              <div>
                <p className="font-medium text-neutral-800 dark:text-neutral-200">Adaptive break timing</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Automatically adjust break timing based on performance</p>
              </div>
            </div>
            <button
              onClick={() => setSettings(prev => ({ ...prev, adaptiveBreaks: !prev.adaptiveBreaks }))}
              className={`w-12 h-6 rounded-full transition-all duration-200 ${
                settings.adaptiveBreaks ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
                settings.adaptiveBreaks ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Break interval (minutes)
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="10"
                max="60"
                value={settings.breakInterval}
                onChange={(e) => {
                  const value = Math.max(10, Math.min(60, parseInt(e.target.value) || 10));
                  setSettings(prev => ({ ...prev, breakInterval: value }));
                }}
                disabled={settings.adaptiveBreaks}
                className={`w-24 p-2 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 ${
                  settings.adaptiveBreaks ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {settings.adaptiveBreaks ? 'minutes (adaptive)' : 'minutes (10-60)'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Break duration (minutes)
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="5"
                max="30"
                value={settings.breakDuration}
                onChange={(e) => {
                  const value = Math.max(5, Math.min(30, parseInt(e.target.value) || 5));
                  setSettings(prev => ({ ...prev, breakDuration: value }));
                }}
                className="w-24 p-2 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
              />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">minutes (5-30)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAppearanceTab = () => (
    <div className="space-y-6">
      <ThemeToggle variant="dropdown" />
      
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Font size
        </label>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">A</span>
          <input
            type="range"
            min="12"
            max="20"
            value={settings.fontSize}
            onChange={(e) => setSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
            className="flex-1"
          />
          <span className="text-lg text-neutral-600 dark:text-neutral-400">A</span>
          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200 min-w-16">
            {settings.fontSize}px
          </span>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-neutral-800 dark:text-neutral-200">Animations</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Enable smooth transitions and effects</p>
        </div>
        <button
          onClick={() => setSettings(prev => ({ ...prev, animations: !prev.animations }))}
          className={`w-12 h-6 rounded-full transition-all duration-200 ${
            settings.animations ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
          }`}
        >
          <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
            settings.animations ? 'translate-x-6' : 'translate-x-0.5'
          }`} />
        </button>
      </div>
    </div>
  );

  const renderSubscriptionTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-2">Current Plan</h3>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Free (487/500 cards used)
        </p>
        <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mb-4">
          <div 
            className="bg-primary-500 h-2 rounded-full"
            style={{ width: '97.4%' }}
          />
        </div>
        <button className="w-full px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg">
          Upgrade to Premium - $7.99/month
        </button>
      </div>
      
      <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 border border-primary-200 dark:border-neutral-700">
        <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-4">Premium Features</h4>
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Check className="w-5 h-5 text-success-500" />
            <span className="text-neutral-700 dark:text-neutral-300">Unlimited cards</span>
          </div>
          <div className="flex items-center space-x-3">
            <Check className="w-5 h-5 text-success-500" />
            <span className="text-neutral-700 dark:text-neutral-300">Advanced AI features</span>
          </div>
          <div className="flex items-center space-x-3">
            <Check className="w-5 h-5 text-success-500" />
            <span className="text-neutral-700 dark:text-neutral-300">Priority support</span>
          </div>
          <div className="flex items-center space-x-3">
            <Check className="w-5 h-5 text-success-500" />
            <span className="text-neutral-700 dark:text-neutral-300">Custom themes</span>
          </div>
          <div className="flex items-center space-x-3">
            <Check className="w-5 h-5 text-success-500" />
            <span className="text-neutral-700 dark:text-neutral-300">Detailed analytics</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-cream to-secondary-50 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 transition-colors duration-200">
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
              <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-200">Settings</h1>
            </div>
            <div className="flex flex-col items-end space-y-2">
              {saveMessage && (
                <div className={`text-sm font-medium ${
                  saveMessage.includes('Failed') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                }`}>
                  {saveMessage}
                </div>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium shadow-lg transition-all duration-200 ${
                  isSaving 
                    ? 'bg-neutral-400 cursor-not-allowed' 
                    : 'bg-primary-500 hover:bg-primary-600 transform hover:scale-105'
                } text-white`}
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Tabs */}
          <div className="lg:col-span-1">
            <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-4 border border-primary-100 dark:border-neutral-700 shadow-lg">
              <nav className="space-y-2">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-primary-500 text-white shadow-lg'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-300'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-8 border border-primary-100 dark:border-neutral-700 shadow-lg"
            >
              {activeTab === 'profile' && renderProfileTab()}
              {activeTab === 'study' && renderStudyTab()}
              {activeTab === 'appearance' && renderAppearanceTab()}
              {activeTab === 'subscription' && renderSubscriptionTab()}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;