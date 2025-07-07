import React, { useEffect, useState } from 'react';
import { useStudy } from '../contexts/StudyContext';
import { DeckConfig, DEFAULT_DECK_CONFIG } from '../types/SRSTypes';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

/**
 * DeckConfigPanel
 * ----------------------------------------------
 * A configurable panel that allows users to view and update advanced SRS deck settings.
 * This is an initial skeleton implementation – UI controls such as drag-and-drop
 * and sliders will be added in subsequent tasks.
 */
interface DeckConfigPanelProps {
  deckId: string;
  /**
   * Called whenever a config field is changed and successfully saved.
   */
  onConfigUpdate?: (config: DeckConfig) => void;
}

const DeckConfigPanel: React.FC<DeckConfigPanelProps> = ({ deckId, onConfigUpdate }) => {
  const { getDeckConfig, updateDeckConfig } = useStudy();

  const [config, setConfig] = useState<DeckConfig>({
    ...DEFAULT_DECK_CONFIG,
    deckId,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  // Preset configurations
  const PRESETS: { name: string; description: string; config: Partial<DeckConfig>; }[] = [
    {
      name: 'Balanced (Default)',
      description: '2 learning steps, 1-day graduating',
      config: {
        learningSteps: [1, 10],
        graduatingInterval: 1,
        easyInterval: 4,
        newCardsPerDay: 20,
      },
    },
    {
      name: 'Conservative',
      description: '3 learning steps, 3-day graduating',
      config: {
        learningSteps: [1, 10, 1440],
        graduatingInterval: 3,
        easyInterval: 5,
        newCardsPerDay: 15,
      },
    },
    {
      name: 'Aggressive',
      description: 'Single learning step, 30 new/day',
      config: {
        learningSteps: [10],
        graduatingInterval: 1,
        easyInterval: 4,
        newCardsPerDay: 30,
      },
    },
    {
      name: 'Language Learning',
      description: '4 learning steps optimized for vocab',
      config: {
        learningSteps: [1, 10, 60, 1440],
        graduatingInterval: 1,
        easyInterval: 4,
        newCardsPerDay: 25,
      },
    },
  ];

  /**
   * Fetch configuration on mount / deck change
   */
  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const cfg = await getDeckConfig(deckId);
        setConfig(cfg);
        setError(null);
      } catch (err) {
        console.error('Failed to load deck configuration', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    if (deckId) fetchConfig();
  }, [deckId, getDeckConfig]);

  /**
   * Generic handler for numeric inputs
   */
  const handleNumberChange = (key: keyof DeckConfig) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(prev => ({
      ...prev,
      [key]: Number(e.target.value),
    }));
  };

  /**
   * Drag-and-drop reordering of learning steps
   */
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;

    setConfig(prev => {
      const reordered = Array.from(prev.learningSteps);
      const [removed] = reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, removed);
      return { ...prev, learningSteps: reordered };
    });
  };

  const addLearningStep = () => {
    setConfig(prev => {
      const last = prev.learningSteps[prev.learningSteps.length - 1] ?? 1;
      return { ...prev, learningSteps: [...prev.learningSteps, last] };
    });
  };

  const removeLearningStep = (index: number) => {
    setConfig(prev => {
      if (prev.learningSteps.length <= 1) return prev; // must have at least one step
      const steps = prev.learningSteps.filter((_, i) => i !== index);
      return { ...prev, learningSteps: steps };
    });
  };

  const applyPreset = (presetConfig: Partial<DeckConfig>) => {
    setConfig(prev => ({ ...prev, ...presetConfig }));
  };

  /**
   * Saves updated configuration to Supabase.
   */
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDeckConfig(deckId, config);
      onConfigUpdate?.(config);
    } catch (err) {
      console.error('Failed to save deck configuration', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Range slider component (inline)
   */
  const RangeSlider: React.FC<{ label: string; min: number; max: number; value: number; onChange: (v: number) => void; step?: number; }> = ({ label, min, max, value, onChange, step = 1 }) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}: <span className="font-semibold">{value}d</span></label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading deck configuration…</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Learning Steps Editor – to be replaced with drag-and-drop list */}
      <section className="bg-white shadow rounded p-4">
        <h2 className="font-semibold mb-2 flex justify-between items-center">
          <span>Learning Steps (minutes)</span>
          <button
            type="button"
            onClick={addLearningStep}
            className="text-sm text-indigo-600 hover:underline"
          >
            + Add Step
          </button>
        </h2>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="learningSteps" direction="horizontal">
            {(provided: any) => (
              <div
                className="flex flex-wrap gap-2"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                {config.learningSteps.map((step, idx) => (
                  <Draggable key={idx.toString()} draggableId={idx.toString()} index={idx}>
                    {(dragProvided: any) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        className="relative"
                      >
                        <input
                          type="number"
                          value={step}
                          min={1}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            setConfig(prev => {
                              const steps = [...prev.learningSteps];
                              steps[idx] = value;
                              return { ...prev, learningSteps: steps };
                            });
                          }}
                          className="w-20 px-2 py-1 border rounded"
                        />
                        {config.learningSteps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLearningStep(idx)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </section>

      {/* Interval Settings */}
      <section className="bg-white shadow rounded p-4 grid gap-4 md:grid-cols-2">
        <RangeSlider
          label="Graduating Interval"
          min={1}
          max={7}
          value={config.graduatingInterval}
          onChange={(v) => setConfig(prev => ({ ...prev, graduatingInterval: v }))}
        />
        <RangeSlider
          label="Easy Interval"
          min={2}
          max={14}
          value={config.easyInterval}
          onChange={(v) => setConfig(prev => ({ ...prev, easyInterval: v }))}
        />
      </section>

      {/* Preset Configurations */}
      <section className="bg-white shadow rounded p-4 space-y-2">
        <h2 className="font-semibold mb-2">Presets</h2>
        {PRESETS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => applyPreset(p.config)}
            className="w-full flex justify-between items-center px-3 py-2 border rounded hover:bg-gray-50"
          >
            <span>{p.name}</span>
            <span className="text-xs text-gray-500">{p.description}</span>
          </button>
        ))}
      </section>

      {/* Daily Limits */}
      <section className="bg-white shadow rounded p-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">New Cards Per Day</label>
          <input
            type="number"
            min={5}
            max={50}
            value={config.newCardsPerDay}
            onChange={handleNumberChange('newCardsPerDay')}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Maximum Interval (days)</label>
          <input
            type="number"
            min={1}
            value={config.maximumInterval}
            onChange={handleNumberChange('maximumInterval')}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
      </section>

      {/* Ease Factor Controls */}
      <section className="bg-white shadow rounded p-4 grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium mb-1">Starting Ease</label>
          <input
            type="number"
            step={0.1}
            min={1.3}
            max={3.0}
            value={config.startingEase}
            onChange={handleNumberChange('startingEase')}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Easy Bonus</label>
          <input
            type="number"
            step={0.01}
            min={0}
            max={1}
            value={config.easyBonus}
            onChange={handleNumberChange('easyBonus')}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Hard Penalty</label>
          <input
            type="number"
            step={0.01}
            min={0}
            max={1}
            value={config.hardPenalty}
            onChange={handleNumberChange('hardPenalty')}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
      </section>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default DeckConfigPanel; 