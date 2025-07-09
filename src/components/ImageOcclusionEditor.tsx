import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Edit3, Move, Palette } from 'lucide-react';

interface Occlusion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  hint?: string;
  color?: string;
}

interface ImageOcclusionEditorProps {
  imageUrl: string;
  occlusions: Occlusion[];
  onOcclusionsChange: (occlusions: Occlusion[]) => void;
  className?: string;
}

const ImageOcclusionEditor: React.FC<ImageOcclusionEditorProps> = ({
  imageUrl,
  occlusions,
  onOcclusionsChange,
  className = ''
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedOcclusion, setSelectedOcclusion] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [currentColor, setCurrentColor] = useState('#3B82F6'); // Default blue
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDraw, setCurrentDraw] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Predefined color options
  const colorOptions = [
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#8B5CF6', // Purple
    '#F97316', // Orange
    '#06B6D4', // Cyan
    '#EC4899', // Pink
    '#6B7280', // Gray
    '#84CC16', // Lime
  ];

  const getRelativePosition = (e: React.MouseEvent) => {
    if (!imageRef.current || !containerRef.current) return { x: 0, y: 0 };
    
    const rect = imageRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editingLabel) return;
    
    const pos = getRelativePosition(e);
    setDragStart(pos);
    setIsDrawing(true);
    setCurrentDraw({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !dragStart) return;
    
    const pos = getRelativePosition(e);
    const width = Math.abs(pos.x - dragStart.x);
    const height = Math.abs(pos.y - dragStart.y);
    const x = Math.min(dragStart.x, pos.x);
    const y = Math.min(dragStart.y, pos.y);
    
    setCurrentDraw({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentDraw || currentDraw.width < 1 || currentDraw.height < 1) {
      setIsDrawing(false);
      setCurrentDraw(null);
      setDragStart(null);
      return;
    }
    
    const newOcclusion: Occlusion = {
      id: Date.now().toString(),
      x: currentDraw.x,
      y: currentDraw.y,
      width: currentDraw.width,
      height: currentDraw.height,
      label: `Label ${occlusions.length + 1}`,
      color: currentColor,
    };
    
    onOcclusionsChange([...occlusions, newOcclusion]);
    setIsDrawing(false);
    setCurrentDraw(null);
    setDragStart(null);
    setSelectedOcclusion(newOcclusion.id);
    setEditingLabel(newOcclusion.id);
  };

  const updateOcclusion = (id: string, updates: Partial<Occlusion>) => {
    onOcclusionsChange(occlusions.map(occ => 
      occ.id === id ? { ...occ, ...updates } : occ
    ));
  };

  const deleteOcclusion = (id: string) => {
    onOcclusionsChange(occlusions.filter(occ => occ.id !== id));
    setSelectedOcclusion(null);
    setEditingLabel(null);
  };

  const handleLabelSubmit = (id: string, label: string) => {
    if (label.trim()) {
      updateOcclusion(id, { label: label.trim() });
    }
    setEditingLabel(null);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
          Image Occlusion Editor
        </h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            {occlusions.length} occlusion{occlusions.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setSelectedOcclusion(null)}
            className="p-2 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
            title="Draw new occlusion"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Color Selection */}
      <div className="flex items-center space-x-4 p-4 bg-neutral-50 dark:bg-neutral-900 rounded-xl">
        <div className="flex items-center space-x-2">
          <Palette className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Occlusion Color:
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {colorOptions.map((color) => (
            <button
              key={color}
              onClick={() => setCurrentColor(color)}
              className={`w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                currentColor === color
                  ? 'border-neutral-800 dark:border-neutral-200 scale-110'
                  : 'border-neutral-300 dark:border-neutral-600 hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
              title={`Select ${color}`}
            />
          ))}
        </div>
      </div>

      <div className="bg-neutral-50 dark:bg-neutral-900 rounded-xl p-4 text-sm text-neutral-600 dark:text-neutral-400">
        <p>• Click and drag to create occlusion areas</p>
        <p>• Click on existing areas to edit labels</p>
        <p>• Use the X button to delete areas</p>
      </div>

      <div
        ref={containerRef}
        className="relative inline-block border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-xl overflow-hidden cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Occlusion editor"
          className="max-w-full h-auto block"
          draggable={false}
        />
        
        {/* Current drawing area */}
        {currentDraw && (
          <div
            className="absolute border-2"
            style={{
              left: `${currentDraw.x}%`,
              top: `${currentDraw.y}%`,
              width: `${currentDraw.width}%`,
              height: `${currentDraw.height}%`,
              borderColor: currentColor,
              backgroundColor: `${currentColor}33`, // 20% opacity
            }}
          />
        )}
        
        {/* Existing occlusions */}
        {occlusions.map((occlusion) => {
          const occlusionColor = occlusion.color || currentColor;
          return (
            <div
              key={occlusion.id}
              className={`absolute cursor-pointer transition-all duration-200 group border-2 ${
                selectedOcclusion === occlusion.id
                  ? 'ring-2 ring-neutral-800 dark:ring-neutral-200 ring-offset-2'
                  : 'hover:ring-1 hover:ring-neutral-500 hover:ring-offset-1'
              }`}
              style={{
                left: `${occlusion.x}%`,
                top: `${occlusion.y}%`,
                width: `${occlusion.width}%`,
                height: `${occlusion.height}%`,
                borderColor: occlusionColor,
                backgroundColor: `${occlusionColor}4D`, // 30% opacity
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedOcclusion(occlusion.id);
              }}
            >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-semibold text-white bg-black/70 px-2 py-1 rounded">
                {occlusion.label}
              </span>
            </div>
            
            {selectedOcclusion === occlusion.id && (
              <div className="absolute -top-8 -right-8 flex space-x-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowColorPicker(showColorPicker === occlusion.id ? null : occlusion.id);
                  }}
                  className="p-1 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                  title="Change color"
                >
                  <Palette className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingLabel(occlusion.id);
                  }}
                  className="p-1 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
                  title="Edit label"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteOcclusion(occlusion.id);
                  }}
                  className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                  title="Delete occlusion"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Color picker for individual occlusion */}
            {showColorPicker === occlusion.id && (
              <div className="absolute -top-12 left-0 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-lg p-2 shadow-lg z-10">
                <div className="grid grid-cols-5 gap-1">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateOcclusion(occlusion.id, { color });
                        setShowColorPicker(null);
                      }}
                      className={`w-6 h-6 rounded border-2 transition-all duration-200 ${
                        occlusion.color === color
                          ? 'border-neutral-800 dark:border-neutral-200'
                          : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-500'
                      }`}
                      style={{ backgroundColor: color }}
                      title={`Change to ${color}`}
                    />
                  ))}
                </div>
              </div>
            )}
            </div>
          );
        })}
      </div>

      {/* Label editing modal */}
      {editingLabel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-neutral-800 rounded-xl p-6 max-w-md mx-4"
          >
            <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-4">
              Edit Label
            </h3>
            <input
              type="text"
              defaultValue={occlusions.find(occ => occ.id === editingLabel)?.label || ''}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleLabelSubmit(editingLabel, e.currentTarget.value);
                } else if (e.key === 'Escape') {
                  setEditingLabel(null);
                }
              }}
              placeholder="Enter label text..."
              className="w-full p-3 border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
            />
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => setEditingLabel(null)}
                className="px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  const input = e.currentTarget.parentElement?.parentElement?.querySelector('input') as HTMLInputElement;
                  if (input) {
                    handleLabelSubmit(editingLabel, input.value);
                  }
                }}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Save
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Occlusion list */}
      {occlusions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Occlusions ({occlusions.length})
          </h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {occlusions.map((occlusion, index) => (
              <div
                key={occlusion.id}
                className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                  selectedOcclusion === occlusion.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {index + 1}.
                  </span>
                  <div 
                    className="w-4 h-4 rounded border border-neutral-300 dark:border-neutral-600"
                    style={{ backgroundColor: occlusion.color || currentColor }}
                    title={`Color: ${occlusion.color || currentColor}`}
                  />
                  <span className="text-sm text-neutral-800 dark:text-neutral-200">
                    {occlusion.label}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setSelectedOcclusion(occlusion.id)}
                    className="p-1 text-neutral-500 hover:text-primary-600 transition-colors"
                    title="Select"
                  >
                    <Move className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setEditingLabel(occlusion.id)}
                    className="p-1 text-neutral-500 hover:text-primary-600 transition-colors"
                    title="Edit"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => deleteOcclusion(occlusion.id)}
                    className="p-1 text-neutral-500 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageOcclusionEditor;