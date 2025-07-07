import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  Plus, 
  BookOpen, 
  Search,
  Check
} from 'lucide-react';
import { useStudy } from '../contexts/StudyContext';

interface Deck {
  id: string;
  name: string;
  description: string;
  cardCount: number;
  dueCount: number;
  newCount: number;
  color: string;
  emoji: string;
  created: string;
  lastStudied: string | null;
}

interface DeckPickerProps {
  selectedDeckId: string | null;
  onDeckSelect: (deckId: string) => void;
  onCreateNewDeck: (deckName: string) => Promise<void>;
  placeholder?: string;
  className?: string;
}

const DeckPicker: React.FC<DeckPickerProps> = ({
  selectedDeckId,
  onDeckSelect,
  onCreateNewDeck,
  placeholder = "Select a deck...",
  className = ""
}) => {
  const { decks } = useStudy();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const selectedDeck = decks.find(deck => deck.id === selectedDeckId);
  
  const filteredDecks = decks.filter(deck =>
    deck.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateNewDeck = async () => {
    if (!newDeckName.trim() || isCreating) return;
    
    setIsCreating(true);
    try {
      await onCreateNewDeck(newDeckName.trim());
      setNewDeckName('');
      setShowCreateNew(false);
      setIsOpen(false);
      setSearchTerm('');
    } catch (error) {
      console.error('Failed to create deck:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeckSelect = (deckId: string) => {
    onDeckSelect(deckId);
    setIsOpen(false);
    setSearchTerm('');
    setShowCreateNew(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 flex items-center justify-between"
      >
        <div className="flex items-center space-x-3">
          {selectedDeck ? (
            <>
              <div className={`w-8 h-8 ${selectedDeck.color} rounded-lg flex items-center justify-center`}>
                <span className="text-sm">{selectedDeck.emoji}</span>
              </div>
              <div className="text-left">
                <p className="font-medium">{selectedDeck.name}</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {selectedDeck.cardCount} cards
                </p>
              </div>
            </>
          ) : (
            <>
              <BookOpen className="w-5 h-5 text-neutral-400" />
              <span className="text-neutral-500 dark:text-neutral-400">{placeholder}</span>
            </>
          )}
        </div>
        <ChevronDown 
          className={`w-5 h-5 text-neutral-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-xl shadow-xl z-50 max-h-80 overflow-hidden"
          >
            {/* Search Bar */}
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-600">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search decks..."
                  className="w-full pl-10 pr-4 py-2 border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
            </div>

            {/* Deck List */}
            <div className="max-h-48 overflow-y-auto">
              {filteredDecks.length > 0 ? (
                filteredDecks.map((deck) => (
                  <button
                    key={deck.id}
                    onClick={() => handleDeckSelect(deck.id)}
                    className="w-full p-3 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 ${deck.color} rounded-lg flex items-center justify-center`}>
                        <span className="text-sm">{deck.emoji}</span>
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">
                          {deck.name}
                        </p>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                          {deck.cardCount} cards • {deck.dueCount} due
                        </p>
                      </div>
                    </div>
                    {selectedDeckId === deck.id && (
                      <Check className="w-5 h-5 text-primary-500" />
                    )}
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-neutral-500 dark:text-neutral-400">
                  {searchTerm ? 'No decks found' : 'No decks available'}
                </div>
              )}
            </div>

            {/* Create New Deck Section */}
            <div className="border-t border-neutral-200 dark:border-neutral-600">
              {!showCreateNew ? (
                <button
                  onClick={() => setShowCreateNew(true)}
                  className="w-full p-3 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors flex items-center space-x-3 text-primary-600 dark:text-primary-400"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-medium">Create New Deck</span>
                </button>
              ) : (
                <div className="p-3 space-y-3">
                  <input
                    type="text"
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                    placeholder="Enter deck name..."
                    className="w-full p-2 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateNewDeck();
                      } else if (e.key === 'Escape') {
                        setShowCreateNew(false);
                        setNewDeckName('');
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleCreateNewDeck}
                      disabled={!newDeckName.trim() || isCreating}
                      className="flex-1 px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      {isCreating ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateNew(false);
                        setNewDeckName('');
                      }}
                      className="px-3 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false);
            setShowCreateNew(false);
            setNewDeckName('');
            setSearchTerm('');
          }}
        />
      )}
    </div>
  );
};

export default DeckPicker;