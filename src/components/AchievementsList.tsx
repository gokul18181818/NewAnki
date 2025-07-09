import React, { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { Achievement, getUserAchievements, checkAndAwardAchievements } from '../lib/dynamicContent';

const AchievementsList: React.FC = () => {
  const { user } = useUser();
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    const loadAchievements = async () => {
      if (!user) return;
      // Ensure new achievements are awarded first
      await checkAndAwardAchievements(user.id);
      const fetched = await getUserAchievements(user.id);
      if (fetched) setAchievements(fetched);
    };
    loadAchievements();
  }, [user]);

  if (!achievements.length) return null;

  return (
    <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-accent-100 dark:border-neutral-700 shadow-lg mb-8">
      <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-4 flex items-center">
        <Award className="w-5 h-5 mr-2 text-accent-500" />
        Achievements
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {achievements.map((ach) => (
          <div key={ach.id} className="flex flex-col items-center text-center p-3 bg-accent-50 dark:bg-accent-900/20 rounded-xl">
            <span className="text-3xl mb-2">{ach.icon}</span>
            <p className="font-medium text-neutral-800 dark:text-neutral-200 truncate w-full" title={ach.title}>{ach.title}</p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2" title={ach.description}>{ach.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AchievementsList; 