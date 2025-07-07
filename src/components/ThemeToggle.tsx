import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Smartphone } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  variant?: 'button' | 'dropdown';
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'button', className = '' }) => {
  const { theme, effectiveTheme, setTheme, toggleTheme } = useTheme();

  if (variant === 'button') {
    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleTheme}
        className={`p-2 rounded-xl bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-200 shadow-lg hover:shadow-xl ${className}`}
        title={`Switch to ${effectiveTheme === 'light' ? 'dark' : 'light'} mode`}
      >
        <motion.div
          initial={false}
          animate={{ rotate: effectiveTheme === 'dark' ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {effectiveTheme === 'light' ? (
            <Sun className="w-5 h-5 text-warning-500" />
          ) : (
            <Moon className="w-5 h-5 text-primary-400" />
          )}
        </motion.div>
      </motion.button>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Theme
      </label>
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'light', label: 'Light', icon: Sun },
          { id: 'dark', label: 'Dark', icon: Moon },
          { id: 'auto', label: 'Auto', icon: Smartphone },
        ].map((themeOption) => (
          <button
            key={themeOption.id}
            onClick={() => setTheme(themeOption.id as any)}
            className={`p-3 rounded-xl border-2 transition-all duration-200 ${
              theme === themeOption.id
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-neutral-200 dark:border-neutral-700 hover:border-primary-300 dark:hover:border-primary-600 bg-white dark:bg-neutral-800'
            }`}
          >
            <themeOption.icon className="w-6 h-6 mx-auto mb-1 text-neutral-600 dark:text-neutral-400" />
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {themeOption.label}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ThemeToggle;