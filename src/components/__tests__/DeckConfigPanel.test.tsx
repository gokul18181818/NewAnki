/// <reference types="vitest" />

// @ts-nocheck

import { render, screen, fireEvent } from '@testing-library/react';
import DeckConfigPanel from '../DeckConfigPanel';
import React from 'react';
import { StudyProvider } from '../../contexts/StudyContext';
import { DEFAULT_DECK_CONFIG } from '../../types/SRSTypes';
import { describe, it, expect, vi } from 'vitest';

// Mock StudyContext methods used by DeckConfigPanel
vi.mock('../../contexts/StudyContext', async (importOriginal: any) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    useStudy: () => ({
      getDeckConfig: vi.fn().mockResolvedValue(DEFAULT_DECK_CONFIG),
      updateDeckConfig: vi.fn().mockResolvedValue(undefined),
    }),
  };
});

describe('DeckConfigPanel', () => {
  it('applies preset configuration on click', async () => {
    render(
      <StudyProvider>
        <DeckConfigPanel deckId="deck-123" />
      </StudyProvider>
    );

    // Wait until loading finishes
    expect(await screen.findByText(/Learning Steps/i)).toBeInTheDocument();

    const aggressiveBtn = screen.getByRole('button', { name: /Aggressive/i });
    fireEvent.click(aggressiveBtn);

    // New cards per day should update to 30
    const newCardsInput = screen.getByLabelText(/New Cards Per Day/i) as HTMLInputElement;
    expect(newCardsInput.value).toBe('30');
  });
}); 