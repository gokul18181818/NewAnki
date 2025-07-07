import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useStudy } from '../contexts/StudyContext';
import { useUser } from '../contexts/UserContext';
import { uploadFile } from '../lib/uploadFile';
import { useDropzone } from 'react-dropzone';
import { 
  FileText, 
  Type, 
  Edit, 
  ArrowRight,
  Save,
  Eye,
  Brain,
} from 'lucide-react';
import CardTypeSelector from '../components/CardTypeSelector';
import DeckPicker from '../components/DeckPicker';
import { CardType } from '../types/CardTypes';

type CreationMethod = 'pdf' | 'text' | 'manual';

const CreateCards: React.FC = () => {
  const navigate = useNavigate();
  const { decks, addDeck, addCard } = useStudy();
  const { user } = useUser();
  const [selectedMethod, setSelectedMethod] = useState<CreationMethod | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<any[]>([]);
  const [targetDeckId, setTargetDeckId] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [textSource, setTextSource] = useState('');
  const [manualCardData, setManualCardData] = useState({
    type: 'basic' as CardType,
    front: '',
    back: '',
    tags: '',
    hint: '',
    // Cloze-specific
    clozeText: '',
    // Type-in specific
    question: '',
    answer: '',
    acceptableAnswers: '',
    caseSensitive: false,
    // Multiple choice specific
    mcQuestion: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    explanation: '',
    // Audio specific
    audioQuestion: '',
    audioAnswer: '',
    transcript: '',
  });
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const creationMethods = [
    {
      id: 'pdf' as CreationMethod,
      title: 'From PDF',
      subtitle: 'Upload and I\'ll extract key concepts',
      icon: FileText,
      color: 'from-primary-500 to-primary-600',
      description: 'Upload PDF and I\'ll extract key concepts',
      buttonText: 'Upload PDF',
    },
    {
      id: 'text' as CreationMethod,
      title: 'From Text',
      subtitle: 'Paste content and I\'ll make cards for you',
      icon: Type,
      color: 'from-secondary-500 to-secondary-600',
      description: 'Paste content and I\'ll make cards for you',
      buttonText: 'Paste Text',
    },
    {
      id: 'manual' as CreationMethod,
      title: 'Manual',
      subtitle: 'Create cards one by one (traditional)',
      icon: Edit,
      color: 'from-accent-500 to-accent-600',
      description: 'Create cards one by one (traditional)',
      buttonText: 'Start Manual',
    },
  ];

  const handleMethodSelect = (method: CreationMethod) => {
    setSelectedMethod(method);
    // For 'pdf', user will upload a file; for 'text', user will paste content.
  };

  const handleDeckSelect = (deckId: string) => {
    setSelectedDeckId(deckId);
  };

  const handleCreateNewDeck = async (deckName: string) => {
    try {
      const newDeck = await addDeck({
        name: deckName,
        description: 'Created during card generation',
        cardCount: 0,
        dueCount: 0,
        newCount: 0,
        color: 'bg-primary-100',
        emoji: '📚',
        created: new Date().toISOString(),
        lastStudied: null,
      });
      setSelectedDeckId(newDeck.id);
    } catch (error) {
      console.error('Failed to create deck:', error);
      throw error;
    }
  };

  const generateCardsFromAI = async (type: 'text' | 'pdf', source: string) => {
    if (!user) {
      console.error('User not logged in');
      return;
    }
    
    let deckId: string;
    
    if (selectedDeckId) {
      deckId = selectedDeckId;
    } else if (!decks.length) {
      // Create a default deck if none exist
      try {
        const newDeck = await addDeck({
          name: 'My First Deck',
          description: 'Generated from AI',
          cardCount: 0,
          dueCount: 0,
          newCount: 0,
          color: 'bg-blue-100',
          emoji: '📘',
          created: new Date().toISOString(),
          lastStudied: null,
        });
        deckId = newDeck.id;
        setSelectedDeckId(deckId);
      } catch (error) {
        console.error('Failed to create default deck:', error);
        setIsGenerating(false);
        return;
      }
    } else {
      deckId = decks[0].id;
      setSelectedDeckId(deckId);
    }

    // Remember the deck so we can save cards later
    setTargetDeckId(deckId);

    setIsGenerating(true);

    const { data, error } = await supabase.functions.invoke('generate_cards', {
      body: { type, source, deck_id: deckId },
    });

    setIsGenerating(false);

    if (error) {
      console.error(error);
      return;
    }

    const cards = (data as any).cards as { id: string; front: string; back: string }[];
    const mapped = cards.map((c) => ({ ...c, status: 'good' }));
    setGeneratedCards(mapped as any);
    // stay on current method so UI can decide what to show
  };

  const handleAcceptAll = async () => {
    if (!targetDeckId) {
      console.error('No deck selected for saving cards');
      return;
    }

    // Persist each generated card
    await Promise.all(
      generatedCards.map((c) =>
        addCard({
          deckId: targetDeckId,
          front: c.front,
          back: c.back,
          tags: [],
          difficulty: 0,
          lastStudied: null,
          nextDue: new Date().toISOString(),
          interval: 1,
          easeFactor: 2.5,
          reviewCount: 0,
        })
      )
    );

    navigate('/dashboard');
  };

  const handleReviewEach = async () => {
    if (!targetDeckId) {
      console.error('No deck selected for saving cards');
      return;
    }

    // Save cards first so the study session can pull them
    await Promise.all(
      generatedCards.map((c) =>
        addCard({
          deckId: targetDeckId,
          front: c.front,
          back: c.back,
          tags: [],
          difficulty: 0,
          lastStudied: null,
          nextDue: new Date().toISOString(),
          interval: 1,
          easeFactor: 2.5,
          reviewCount: 0,
        })
      )
    );

    navigate(`/study/${targetDeckId}`);
  };

  const handleSaveCard = async () => {
    if (!user) {
      console.error('User not logged in');
      return;
    }

    if (!selectedDeckId) {
      alert('Please select a deck first');
      return;
    }

    const targetDeck = decks.find(d => d.id === selectedDeckId);
    if (!targetDeck) {
      console.error('Selected deck not found');
      return;
    }

    // Validate card data based on type
    let front = '';
    let back = '';
    
    switch (manualCardData.type) {
      case 'basic':
        if (!manualCardData.front || !manualCardData.back) {
          alert('Please fill in both front and back for basic cards');
          return;
        }
        front = manualCardData.front;
        back = manualCardData.back;
        break;
        
      case 'multiple-choice':
        if (!manualCardData.mcQuestion || !manualCardData.options.some(opt => opt.trim())) {
          alert('Please fill in the question and at least one option for multiple choice cards');
          return;
        }
        // Store multiple choice data in front/back format for compatibility
        front = manualCardData.mcQuestion;
        back = JSON.stringify({
          options: manualCardData.options,
          correctAnswer: manualCardData.correctAnswer,
          explanation: manualCardData.explanation
        });
        break;
        
      case 'cloze':
        if (!manualCardData.clozeText) {
          alert('Please fill in the cloze text');
          return;
        }
        front = manualCardData.clozeText;
        back = 'Cloze card'; // Will be processed by renderer
        break;
        
      case 'type-in':
        if (!manualCardData.question || !manualCardData.answer) {
          alert('Please fill in both question and answer for type-in cards');
          return;
        }
        front = manualCardData.question;
        back = JSON.stringify({
          answer: manualCardData.answer,
          acceptableAnswers: manualCardData.acceptableAnswers.split(',').map(a => a.trim()).filter(Boolean),
          caseSensitive: manualCardData.caseSensitive
        });
        break;
        
      default:
        if (!manualCardData.front || !manualCardData.back) {
          alert('Please fill in both front and back');
          return;
        }
        front = manualCardData.front;
        back = manualCardData.back;
    }

    await addCard({
      deckId: selectedDeckId,
      type: manualCardData.type,
      front,
      back,
      tags: manualCardData.tags ? manualCardData.tags.split(',').map(t=>t.trim()).filter(Boolean) : [],
      difficulty: 0,
      lastStudied: null,
      nextDue: new Date().toISOString(),
      interval: 1,
      easeFactor: 2.5,
      reviewCount: 0,
    });

    navigate('/dashboard');
  };

  const handleSaveAndStudy = async () => {
    if (!user) {
      console.error('User not logged in');
      return;
    }

    if (!selectedDeckId) {
      alert('Please select a deck first');
      return;
    }

    const targetDeck = decks.find(d => d.id === selectedDeckId);
    if (!targetDeck) {
      console.error('Selected deck not found');
      return;
    }

    // Validate card data based on type
    let front = '';
    let back = '';
    
    switch (manualCardData.type) {
      case 'basic':
        if (!manualCardData.front || !manualCardData.back) {
          alert('Please fill in both front and back for basic cards');
          return;
        }
        front = manualCardData.front;
        back = manualCardData.back;
        break;
        
      case 'multiple-choice':
        if (!manualCardData.mcQuestion || !manualCardData.options.some(opt => opt.trim())) {
          alert('Please fill in the question and at least one option for multiple choice cards');
          return;
        }
        // Store multiple choice data in front/back format for compatibility
        front = manualCardData.mcQuestion;
        back = JSON.stringify({
          options: manualCardData.options,
          correctAnswer: manualCardData.correctAnswer,
          explanation: manualCardData.explanation
        });
        break;
        
      case 'cloze':
        if (!manualCardData.clozeText) {
          alert('Please fill in the cloze text');
          return;
        }
        front = manualCardData.clozeText;
        back = 'Cloze card'; // Will be processed by renderer
        break;
        
      case 'type-in':
        if (!manualCardData.question || !manualCardData.answer) {
          alert('Please fill in both question and answer for type-in cards');
          return;
        }
        front = manualCardData.question;
        back = JSON.stringify({
          answer: manualCardData.answer,
          acceptableAnswers: manualCardData.acceptableAnswers.split(',').map(a => a.trim()).filter(Boolean),
          caseSensitive: manualCardData.caseSensitive
        });
        break;
        
      default:
        if (!manualCardData.front || !manualCardData.back) {
          alert('Please fill in both front and back');
          return;
        }
        front = manualCardData.front;
        back = manualCardData.back;
    }

    // Save the card first
    await addCard({
      deckId: selectedDeckId,
      type: manualCardData.type,
      front,
      back,
      tags: manualCardData.tags ? manualCardData.tags.split(',').map(t=>t.trim()).filter(Boolean) : [],
      difficulty: 0,
      lastStudied: null,
      nextDue: new Date().toISOString(),
      interval: 1,
      easeFactor: 2.5,
      reviewCount: 0,
    });

    // Then navigate to study the deck
    navigate(`/study/${selectedDeckId}`);
  };

  const handlePdfChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) {
      alert('Please sign in first');
      return;
    }

    try {
      const signedUrl = await uploadFile('pdfs', file, user.id);
      await generateCardsFromAI('pdf', signedUrl);
    } catch (err) {
      console.error(err);
    }
  };

  const renderBasicCardForm = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Front
        </label>
        <textarea
          value={manualCardData.front}
          onChange={(e) => setManualCardData(prev => ({ ...prev, front: e.target.value }))}
          placeholder="What is the Spanish word for hello?"
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Back
        </label>
        <textarea
          value={manualCardData.back}
          onChange={(e) => setManualCardData(prev => ({ ...prev, back: e.target.value }))}
          placeholder="Hola"
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
          rows={3}
        />
        <div className="mt-2 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
          <div className="flex items-start space-x-2">
            <Brain className="w-5 h-5 text-primary-600 dark:text-primary-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-primary-700 dark:text-primary-300">AI Suggestion</p>
              <p className="text-sm text-primary-600 dark:text-primary-400">Add pronunciation and usage example?</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderClozeCardForm = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Cloze Text
        </label>
        <textarea
          value={manualCardData.clozeText}
          onChange={(e) => setManualCardData(prev => ({ ...prev, clozeText: e.target.value }))}
          placeholder="The capital of {{c1::France}} is {{c2::Paris}}"
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
          rows={4}
        />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
          Use {'{{c1::text}}'} for cloze deletions. Multiple clozes: {'{{c1::first}}'}, {'{{c2::second}}'}
        </p>
      </div>
    </div>
  );

  const renderTypeInCardForm = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Question
        </label>
        <textarea
          value={manualCardData.question}
          onChange={(e) => setManualCardData(prev => ({ ...prev, question: e.target.value }))}
          placeholder="What is the Spanish word for 'goodbye'?"
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
          rows={2}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Correct Answer
        </label>
        <input
          type="text"
          value={manualCardData.answer}
          onChange={(e) => setManualCardData(prev => ({ ...prev, answer: e.target.value }))}
          placeholder="adiós"
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Acceptable Answers (optional)
        </label>
        <input
          type="text"
          value={manualCardData.acceptableAnswers}
          onChange={(e) => setManualCardData(prev => ({ ...prev, acceptableAnswers: e.target.value }))}
          placeholder="adios, goodbye"
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
        />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Separate multiple answers with commas
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="caseSensitive"
          checked={manualCardData.caseSensitive}
          onChange={(e) => setManualCardData(prev => ({ ...prev, caseSensitive: e.target.checked }))}
          className="w-4 h-4 text-primary-600 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 rounded focus:ring-primary-500"
        />
        <label htmlFor="caseSensitive" className="text-sm text-neutral-700 dark:text-neutral-300">
          Case sensitive
        </label>
      </div>
    </div>
  );

  const renderMultipleChoiceForm = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Question
        </label>
        <textarea
          value={manualCardData.mcQuestion}
          onChange={(e) => setManualCardData(prev => ({ ...prev, mcQuestion: e.target.value }))}
          placeholder="Which of these means 'please' in Spanish?"
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
          rows={2}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Options
        </label>
        <div className="space-y-3">
          {manualCardData.options.map((option, index) => (
            <div key={index} className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-neutral-100 dark:bg-neutral-700 rounded-full flex items-center justify-center text-sm font-medium text-neutral-600 dark:text-neutral-400">
                {String.fromCharCode(65 + index)}
              </div>
              <input
                type="text"
                value={option}
                onChange={(e) => {
                  const newOptions = [...manualCardData.options];
                  newOptions[index] = e.target.value;
                  setManualCardData(prev => ({ ...prev, options: newOptions }));
                }}
                placeholder={`Option ${String.fromCharCode(65 + index)}`}
                className="flex-1 p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
              />
              <input
                type="radio"
                name="correctAnswer"
                checked={manualCardData.correctAnswer === index}
                onChange={() => setManualCardData(prev => ({ ...prev, correctAnswer: index }))}
                className="w-4 h-4 text-primary-600 bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 focus:ring-primary-500"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Explanation (optional)
        </label>
        <textarea
          value={manualCardData.explanation}
          onChange={(e) => setManualCardData(prev => ({ ...prev, explanation: e.target.value }))}
          placeholder="Explain why this is the correct answer..."
          className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
          rows={2}
        />
      </div>
    </div>
  );

  const renderCardTypeForm = () => {
    switch (manualCardData.type) {
      case 'basic':
        return renderBasicCardForm();
      case 'cloze':
        return renderClozeCardForm();
      case 'type-in':
        return renderTypeInCardForm();
      case 'multiple-choice':
        return renderMultipleChoiceForm();
      default:
        return renderBasicCardForm();
    }
  };

  const renderMethodSelection = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="text-center"
    >
      <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-200 mb-2">
        Create New Cards
        <span className="ml-2">✨</span>
      </h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-8 text-lg">
        How would you like to create cards?
      </p>

      {/* Deck Selection */}
      <div className="max-w-md mx-auto mb-8">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2 text-center">
          First, choose where to save your cards:
        </label>
        <DeckPicker
          selectedDeckId={selectedDeckId}
          onDeckSelect={handleDeckSelect}
          onCreateNewDeck={handleCreateNewDeck}
          placeholder="Select a deck for your cards..."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {creationMethods.map((method) => (
          <motion.button
            key={method.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleMethodSelect(method.id)}
            disabled={!selectedDeckId}
            className={`p-8 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl border border-primary-100 dark:border-neutral-700 shadow-lg hover:shadow-xl transition-all duration-300 text-left ${
              !selectedDeckId ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <div className={`w-16 h-16 bg-gradient-to-r ${method.color} rounded-2xl flex items-center justify-center mb-6`}>
              <method.icon className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-3">{method.title}</h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">{method.description}</p>
            <div className="bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-lg p-3">
              <p className="text-primary-700 dark:text-primary-300 font-medium">{method.buttonText}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );

  const renderAIGeneration = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="text-center"
    >
      <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-200 mb-2">
        {selectedMethod === 'pdf' ? '📄 Creating cards from your PDF...' : '📝 Creating cards from your text...'}
      </h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-8 text-lg">
        Please wait while I analyze your content
      </p>

      {/* Removed hard-coded progress stats – you can wire real metrics later if desired */}
    </motion.div>
  );

  const renderGeneratedCards = () => {
    const selectedDeck = decks.find(deck => deck.id === selectedDeckId);
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-200 mb-2">
            Cards Generated!
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 text-lg">
            Preview and edit your AI-generated flashcards
          </p>
          {selectedDeck && (
            <div className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
              <div className={`w-6 h-6 ${selectedDeck.color} rounded-lg flex items-center justify-center`}>
                <span className="text-sm">{selectedDeck.emoji}</span>
              </div>
              <span className="text-primary-700 dark:text-primary-300 font-medium">
                Saving to: {selectedDeck.name}
              </span>
            </div>
          )}
        </div>

      <div className="space-y-6 max-w-4xl mx-auto">
        {generatedCards.map((card, index) => (
          <motion.div
            key={card.id ?? index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-primary-100 dark:border-neutral-700 shadow-lg"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Question</label>
                  <textarea
                    value={card.front}
                    onChange={(e) => {
                      const updatedCards = [...generatedCards];
                      updatedCards[index].front = e.target.value;
                      setGeneratedCards(updatedCards);
                    }}
                    className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                    rows={2}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Answer</label>
                  <textarea
                    value={card.back}
                    onChange={(e) => {
                      const updatedCards = [...generatedCards];
                      updatedCards[index].back = e.target.value;
                      setGeneratedCards(updatedCards);
                    }}
                    className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button className="px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors">
                Delete
              </button>
              <button className="px-4 py-2 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors">
                Edit
              </button>
              <button className="px-4 py-2 bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400 rounded-lg hover:bg-success-200 dark:hover:bg-success-900/50 transition-colors">
                Good as-is
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="text-center mt-8">
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleAcceptAll}
            className="group px-8 py-4 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg flex items-center justify-center space-x-2"
          >
            <span>Accept All {generatedCards.length}</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={handleReviewEach}
            className="px-8 py-4 bg-secondary-500 text-white rounded-xl hover:bg-secondary-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg"
          >
            Review Each
          </button>
          <button className="px-8 py-4 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors font-semibold">
            Regenerate
          </button>
        </div>
      </div>
    </motion.div>
    );
  };

  const renderManualCreation = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="max-w-5xl mx-auto"
    >
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-200 mb-2">
          Create a New Card
          <span className="ml-2">✏️</span>
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 text-lg">
          Design your flashcard with all the details
        </p>
      </div>

      <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-10 border border-primary-100 dark:border-neutral-700 shadow-lg space-y-8">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Deck
            </label>
            <DeckPicker
              selectedDeckId={selectedDeckId}
              onDeckSelect={handleDeckSelect}
              onCreateNewDeck={handleCreateNewDeck}
              placeholder="Select a deck for your cards..."
            />
          </div>

          <CardTypeSelector
            selectedType={manualCardData.type}
            onTypeChange={(type) => setManualCardData(prev => ({ ...prev, type }))}
          />

          {renderCardTypeForm()}

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Tags
            </label>
            <input
              type="text"
              value={manualCardData.tags}
              onChange={(e) => setManualCardData(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="#vocabulary #greetings"
              className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Hint (optional)
            </label>
            <input
              type="text"
              value={manualCardData.hint}
              onChange={(e) => setManualCardData(prev => ({ ...prev, hint: e.target.value }))}
              placeholder="Additional context or memory aid..."
              className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleSaveCard}
              className="group px-8 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg flex items-center justify-center space-x-2"
            >
              <Save className="w-5 h-5" />
              <span>Save & Next</span>
            </button>
            <button
              onClick={handleSaveAndStudy}
              className="px-8 py-3 bg-secondary-500 text-white rounded-xl hover:bg-secondary-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg flex items-center justify-center space-x-2"
            >
              <Save className="w-5 h-5" />
              <span>Save & Study</span>
            </button>
            <button className="px-8 py-3 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors font-semibold flex items-center justify-center space-x-2">
              <Eye className="w-5 h-5" />
              <span>Preview</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderPdfFlow = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
      <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-200 mb-4 text-center">Select a PDF to generate flashcards</h2>
      <div className="text-center">
        <input
          type="file"
          accept="application/pdf"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !user) { alert('Please sign in'); return; }
            try {
              const signed = await uploadFile('pdfs', file, user.id);
              console.log('PDF signed URL', signed);
              alert('PDF uploaded, generating cards…');
              await generateCardsFromAI('pdf', signed);
            } catch (err) {
              console.error(err);
              alert('Upload or generation failed');
            }
          }}
          className="mx-auto text-sm"
        />
      </div>
      {isGenerating && (
        <p className="text-center mt-4 text-primary-600">Processing PDF… this may take up to a minute depending on size.</p>
      )}
    </motion.div>
  );

  // NEW: Text paste flow
  const renderTextFlow = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
      <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-200 mb-4 text-center">Paste text to generate flashcards</h2>
      <textarea
        value={textSource}
        onChange={(e) => setTextSource(e.target.value)}
        placeholder="Paste any article, notes, or study material here..."
        rows={10}
        className="w-full p-4 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 mb-4"
      />
      <div className="text-center">
        <button
          onClick={() => generateCardsFromAI('text', textSource)}
          disabled={!textSource.trim() || isGenerating}
          className={`px-8 py-4 rounded-xl font-semibold shadow-lg transition-all duration-200 transform ${textSource.trim() && !isGenerating ? 'bg-primary-500 hover:bg-primary-600 text-white hover:scale-105' : 'bg-neutral-300 text-neutral-600 cursor-not-allowed'}`}
        >
          {isGenerating ? 'Generating…' : 'Generate Cards'}
        </button>
      </div>
      {isGenerating && (
        <p className="text-center mt-4 text-primary-600">Processing text… this may take a few seconds.</p>
      )}
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-cream to-secondary-50 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 transition-colors duration-200 p-4">
      <div className="max-w-6xl mx-auto pt-8">
        <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-8 border border-primary-100 dark:border-neutral-700 shadow-2xl">
          <input
            type="file"
            accept="application/pdf"
            hidden
            ref={fileInputRef}
            onChange={handlePdfChosen}
          />
          <AnimatePresence mode="wait">
            {!selectedMethod && renderMethodSelection()}
            {selectedMethod === 'pdf' && !isGenerating && generatedCards.length === 0 && renderPdfFlow()}
            {selectedMethod === 'pdf' && isGenerating && renderAIGeneration()}
            {selectedMethod === 'pdf' && !isGenerating && generatedCards.length > 0 && renderGeneratedCards()}
            {selectedMethod === 'text' && !isGenerating && generatedCards.length === 0 && renderTextFlow()}
            {selectedMethod === 'text' && isGenerating && renderAIGeneration()}
            {selectedMethod === 'text' && !isGenerating && generatedCards.length > 0 && renderGeneratedCards()}
            {selectedMethod === 'manual' && renderManualCreation()}
          </AnimatePresence>

          {selectedMethod && (
            <div className="text-center mt-8">
              <button
                onClick={() => {
                  setSelectedMethod(null);
                  setIsGenerating(false);
                  setGeneratedCards([]);
                  setTargetDeckId(null);
                }}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
              >
                ← Back to creation methods
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateCards;