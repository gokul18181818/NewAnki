import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useStudy } from '../contexts/StudyContext';
import { ArrowLeft, Trash2, Pencil } from 'lucide-react';

interface Card {
  id: string;
  front: string;
  back: string;
}

interface EditableCard extends Card {
  isEditing?: boolean;
  editFront?: string;
  editBack?: string;
}

const DeckDetails: React.FC = () => {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const { decks, removeDeck } = useStudy();
  const deck = decks.find(d => d.id === deckId);
  const [cards, setCards] = useState<EditableCard[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(deck?.name ?? '');
  const [description, setDescription] = useState(deck?.description ?? '');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  useEffect(() => {
    const loadCards = async () => {
      if (!deckId) return;
      const { data } = await supabase.from('cards').select('id,front,back').eq('deck_id', deckId);
      setCards(((data as any[]) ?? []).map(c=>({...c,isEditing:false})));
    };
    loadCards();
  }, [deckId]);

  const handleSave = async () => {
    if (!deckId) return;
    await supabase.from('decks').update({ name, description }).eq('id', deckId);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!deckId) return;
    if (!confirm('Delete this deck and all its cards?')) return;
    await supabase.from('decks').delete().eq('id', deckId);
    removeDeck(deckId);
    navigate('/dashboard');
  };

  const startEditCard = (c: EditableCard) => {
    setCards(prev=>prev.map(card=> card.id===c.id ? {...card, isEditing:true, editFront:card.front, editBack:card.back} : card));
    setEditingCardId(c.id);
  };

  const cancelEditCard = (id:string) => {
    setCards(prev=>prev.map(card=> card.id===id ? {...card,isEditing:false} : card));
    setEditingCardId(null);
  };

  const saveCard = async (id:string) => {
    const card = cards.find(c=>c.id===id);
    if(!card) return;
    await supabase.from('cards').update({front:card.editFront, back:card.editBack}).eq('id',id);
    setCards(prev=>prev.map(c=> c.id===id ? {...c, front:c.editFront!, back:c.editBack!, isEditing:false} : c));
    setEditingCardId(null);
  };

  const deleteCard = async (id:string) => {
    if(!confirm('Delete this card?')) return;
    await supabase.from('cards').delete().eq('id',id);
    setCards(prev=>prev.filter(c=>c.id!==id));
  };

  return (
    <div className="max-w-5xl mx-auto p-4">
      <button onClick={()=>navigate('/dashboard')} className="mb-4 flex items-center text-primary-600"><ArrowLeft className="w-4 h-4 mr-1"/>Back</button>

      <div className="relative mb-10">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary-500/10 to-secondary-500/10 blur-xl" aria-hidden="true"></div>
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 p-6 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-md border border-neutral-200 dark:border-neutral-700 rounded-3xl shadow-lg">
          <div>
            <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100 mb-1">{deck?.name}</h1>
            {deck?.description && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-prose">{deck.description}</p>
            )}
          </div>
          <div className="flex space-x-3">
            <button onClick={()=>setEditing(true)} title="Edit deck" className="p-3 rounded-full bg-primary-500 text-white hover:bg-primary-600 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-primary-400">
              <Pencil className="w-4 h-4"/>
            </button>
            <button onClick={handleDelete} title="Delete deck" className="p-3 rounded-full bg-error-600 text-white hover:bg-error-700 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-error-400">
              <Trash2 className="w-4 h-4"/>
            </button>
          </div>
        </div>
      </div>

      <hr className="border-neutral-200 dark:border-neutral-700 mb-6" />

      <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center">
        Cards
        <span className="ml-3 text-xs font-semibold bg-primary-500/15 text-primary-600 rounded-full px-2 py-0.5">
          {cards.length}
        </span>
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map(c=> (
          <div key={c.id} className="group relative p-5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl shadow transition-all hover:shadow-lg hover:-translate-y-1 hover:border-primary-300 dark:hover:border-primary-500">
            {c.isEditing ? (
              <div className="space-y-2">
                <textarea value={c.editFront} onChange={e=>setCards(prev=>prev.map(card=>card.id===c.id?{...card,editFront:e.target.value}:card))} className="w-full px-2 py-1 border rounded" rows={2}/>
                <textarea value={c.editBack} onChange={e=>setCards(prev=>prev.map(card=>card.id===c.id?{...card,editBack:e.target.value}:card))} className="w-full px-2 py-1 border rounded" rows={2}/>
                <div className="flex space-x-2">
                  <button onClick={()=>saveCard(c.id)} className="px-3 py-1 bg-primary-500 hover:bg-primary-600 text-white rounded text-sm">Save</button>
                  <button onClick={()=>cancelEditCard(c.id)} className="px-3 py-1 bg-neutral-300 dark:bg-neutral-600 text-neutral-800 dark:text-neutral-200 rounded text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <p className="font-medium text-neutral-800 dark:text-neutral-100 mb-1 break-words">{c.front}</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 break-words">{c.back}</p>
                <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={()=>startEditCard(c)} className="p-1 text-neutral-500 hover:text-primary-600 focus:outline-none"><Pencil className="w-4 h-4"/></button>
                  <button onClick={()=>deleteCard(c.id)} className="p-1 text-neutral-500 hover:text-error-600 focus:outline-none"><Trash2 className="w-4 h-4"/></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeckDetails; 