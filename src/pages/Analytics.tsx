import React from 'react';
import { useStudy } from '../contexts/StudyContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AdvancedAnalytics from '../components/AdvancedAnalytics';

const AnalyticsPage: React.FC = () => {
  const { decks } = useStudy();
  const navigate = useNavigate();

  if (!decks.length) {
    return <div className="p-4">No decks available.</div>;
  }

  // For now, show analytics for the first deck (can be enhanced later)
  const deckId = decks[0].id;
  const deckName = decks[0].name;

  return (
    <div className="min-h-screen bg-cream dark:bg-neutral-900 transition-colors duration-200">
      <header className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-neutral-600 dark:text-neutral-400 hover:text-primary-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">Analytics – {deckName}</h1>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AdvancedAnalytics deckId={deckId} />
      </main>
    </div>
  );
};

export default AnalyticsPage; 