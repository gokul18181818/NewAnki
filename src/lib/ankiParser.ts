import JSZip from 'jszip';
// sql.js does not have perfect TypeScript typings; treat as any
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import initSqlJs from 'sql.js';

export interface AnkiCard {
  deckId: number;
  front: string;
  back: string;
  frontImages?: string[];
  backImages?: string[];
  media?: Record<string, string>; // filename -> base64 data
}

export interface AnkiDeck {
  name: string;
  cards: AnkiCard[];
}

export type ParsedDeck = AnkiDeck;

export async function parseApkg(file: File): Promise<AnkiDeck[]> {
  try {
    console.log('Starting Anki file parsing...');
    
    // Initialize SQL.js
    const SQL = await initSqlJs({
      locateFile: (file) => `https://sql.js.org/dist/${file}`
    });

    // Extract .apkg file
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);
    
    // Extract media files
    const mediaFiles: Record<string, string> = {};
    const mediaMapping: Record<string, string> = {};
    
    // Check for media file mapping (maps numbers to filenames)
    const mediaEntry = zipContent.file('media');
    if (mediaEntry) {
      try {
        const mediaJson = await mediaEntry.async('text');
        const mediaData = JSON.parse(mediaJson);
        Object.assign(mediaMapping, mediaData);
        console.log('Found media mapping:', mediaData);
      } catch (error) {
        console.warn('Could not parse media file:', error);
      }
    }
    
    // Extract actual media files (usually numbered: 0, 1, 2, etc.)
    for (const [filename, zipEntry] of Object.entries(zipContent.files)) {
      if (!zipEntry.dir && /^\d+$/.test(filename)) {
        try {
          const fileData = await zipEntry.async('base64');
          const actualFilename = mediaMapping[filename] || filename;
          mediaFiles[actualFilename] = fileData;
          console.log(`Extracted media file: ${filename} -> ${actualFilename}`);
        } catch (error) {
          console.warn(`Failed to extract media file ${filename}:`, error);
        }
      }
    }
    
    console.log(`Extracted ${Object.keys(mediaFiles).length} media files`);

    // Look for collection database files in order of preference
    let dbBuffer: ArrayBuffer | null = null;
    const dbFiles = ['collection.anki21b', 'collection.anki21', 'collection.anki2'];
    
    for (const dbFile of dbFiles) {
      const dbEntry = zipContent.file(dbFile);
      if (dbEntry) {
        console.log(`Found collection file: ${dbFile}`);
        dbBuffer = await dbEntry.async('arraybuffer');
        break;
      }
    }

    if (!dbBuffer) {
      throw new Error('No valid collection database found in .apkg file');
    }

    // Open database
    const db = new SQL.Database(new Uint8Array(dbBuffer));

    // Check if database is valid
    try {
      const testQuery = db.exec('SELECT name FROM sqlite_master WHERE type="table"');
      if (testQuery.length === 0) {
        throw new Error('Database appears to be empty or corrupted');
      }
    } catch (error) {
      throw new Error('This file appears to be corrupted or from an unsupported Anki version');
    }

    // Get collection metadata - try different approaches for different versions
    let decksJson: Record<string, any> = {};
    
    try {
      // Try modern format first (Anki 2.1.50+)
      const colRes = db.exec('SELECT decks, ver FROM col');
      if (colRes.length > 0 && colRes[0].values.length > 0) {
        const version = colRes[0].values[0][1] as number;
        console.log(`Anki collection version: ${version}`);
        
        if (version >= 50) {
          console.log('Detected modern Anki format (2.1.50+)');
        }
        
        decksJson = JSON.parse(colRes[0].values[0][0] as string) as Record<string, any>;
      }
    } catch (error) {
      // Fallback to legacy format
      try {
        const colRes = db.exec('SELECT decks FROM col');
        if (colRes.length > 0) {
          decksJson = JSON.parse(colRes[0].values[0][0] as string) as Record<string, any>;
          console.log('Using legacy Anki format parser');
        }
      } catch (legacyError) {
        throw new Error('Unable to parse collection metadata. This file may be from an unsupported Anki version or corrupted.');
      }
    }

    // Build deck map
    const deckMap: Record<number, AnkiDeck> = Object.keys(decksJson).reduce((acc, deckId) => {
      const deck = decksJson[deckId];
      if (deck && typeof deck === 'object' && deck.name) {
        acc[parseInt(deckId)] = {
          name: deck.name,
          cards: []
        };
      }
      return acc;
    }, {} as Record<number, AnkiDeck>);

    console.log(`Found ${Object.keys(deckMap).length} deck(s)`);

    // Get cards and notes with enhanced error handling
    let cardNoteRows: any[] = [];
    
    try {
      // Check for actual card data first
      const cardCountQuery = db.exec('SELECT COUNT(*) FROM cards');
      const noteCountQuery = db.exec('SELECT COUNT(*) FROM notes');
      
      const cardCount = cardCountQuery[0]?.values[0]?.[0] || 0;
      const noteCount = noteCountQuery[0]?.values[0]?.[0] || 0;
      
      console.log(`Database contains ${cardCount} cards and ${noteCount} notes`);
      
      if (cardCount === 0 || noteCount === 0) {
        throw new Error('This .apkg file appears to be empty or is a placeholder file. Please export a deck that contains actual cards.');
      }

      // Try comprehensive query that works with most versions
      cardNoteRows = db.exec(`
        SELECT 
          c.id as card_id, 
          c.did as deck_id, 
          n.flds as fields,
          n.mid as model_id
        FROM cards c
        JOIN notes n ON n.id = c.nid
        WHERE c.did IN (${Object.keys(deckMap).join(',')})
      `);
    } catch (error) {
      console.log('Primary query failed, trying fallback:', error);
      // Fallback to simpler query
      try {
        cardNoteRows = db.exec(`
          SELECT c.did as deck_id, n.flds as fields
          FROM cards c
          JOIN notes n ON n.id = c.nid
        `);
      } catch (fallbackError) {
        throw new Error('Unable to read cards from database. The database schema may be incompatible.');
      }
    }

    let totalCards = 0;
    
    if (cardNoteRows.length > 0) {
      const [cols, rows] = [cardNoteRows[0].columns, cardNoteRows[0].values];
      const deckIdIdx = cols.indexOf('deck_id');
      const fieldsIdx = cols.indexOf('fields');

      if (deckIdIdx === -1 || fieldsIdx === -1) {
        throw new Error('Database schema incompatible: missing required columns');
      }

      console.log(`Found ${rows.length} raw cards in database`);
      
      rows.forEach((row: unknown[]) => {
        try {
          const r = row;
          const deckId = r[deckIdIdx] as number;
          const flds = r[fieldsIdx] as string;
          
          console.log('Raw field data:', flds);
          
          // Try multiple field separators
          let parts: string[];
          if (flds.includes('\u001f')) {
            parts = flds.split('\u001f'); // Standard field separator (ASCII 31)
            console.log('Used \\u001f separator, parts:', parts.length);
          } else if (flds.includes('\x1f')) {
            parts = flds.split('\x1f'); // Alternative separator
            console.log('Used \\x1f separator, parts:', parts.length);
          } else if (flds.includes('\t')) {
            parts = flds.split('\t'); // Tab separator
            console.log('Used tab separator, parts:', parts.length);
          } else {
            // Try to find natural break points in the text
            // Look for patterns like question/answer boundaries
            let front = '';
            let back = '';
            
            // Try to split on common patterns for Q&A format
            const patterns = [
              /\n\n+/,           // Double newlines
              /(?:\r?\n){2,}/,   // Multiple line breaks
              /\?\s*(?=[A-D]\.\s)/,  // Question mark followed by "A. ", "B. ", etc.
              /\?\s*(?=Answer)/i,    // Question mark followed by "Answer"
              /\?\s*(?=Explanation)/i, // Question mark followed by "Explanation"
              /(?<=\?)\s*(?=[A-D]\.\s)/,  // After question mark, before options
              /Answer[:\s]/i,    // "Answer:" or "Answer "
              /Explanation[:\s]/i, // "Explanation:" or "Explanation "
            ];
            
            let splitFound = false;
            for (const pattern of patterns) {
              const matches = flds.split(pattern);
              if (matches.length >= 2) {
                front = matches[0].trim();
                back = matches.slice(1).join(' ').trim();
                console.log(`Split using pattern ${pattern}, front length: ${front.length}, back length: ${back.length}`);
                splitFound = true;
                break;
              }
            }
            
            if (!splitFound) {
              // Fallback: split roughly in half if text is long enough
              if (flds.length > 100) {
                const midPoint = Math.floor(flds.length / 2);
                const breakPoint = flds.indexOf(' ', midPoint);
                if (breakPoint !== -1) {
                  front = flds.substring(0, breakPoint).trim();
                  back = flds.substring(breakPoint).trim();
                  console.log('Split at midpoint');
                } else {
                  front = flds.trim();
                  back = '';
                }
              } else {
                front = flds.trim();
                back = '';
              }
            }
            
            parts = [front, back];
          }
          
          console.log('Parts after splitting:', parts.map((p, i) => `${i}: "${p.substring(0, 100)}..."`));
          
          // Extract front and back, handling various card formats
          let front = parts[0] || '';
          let back = parts[1] || '';
          
          // Extract images from HTML
          const extractImages = (html: string): string[] => {
            const images: string[] = [];
            const imgRegex = /<img[^>]+src=['"]((?:(?!['"])[^>])*?)['"][^>]*>/gi;
            let match;
            while ((match = imgRegex.exec(html)) !== null) {
              images.push(match[1]);
            }
            return images;
          };
          
          const frontImages = extractImages(front);
          const backImages = extractImages(back);
          
          // Replace image references with placeholders but keep track of them
          const replaceImages = (html: string): string => {
            return html.replace(/<img[^>]+src=['"]((?:(?!['"])[^>])*?)['"][^>]*>/gi, (match, src) => {
              return `[IMAGE: ${src}]`;
            });
          };
          
          front = replaceImages(front);
          back = replaceImages(back);
          
          // Format multiple choice questions better
          const formatContent = (content: string): string => {
            let formatted = content;
            
            // Convert HTML line breaks to actual line breaks
            formatted = formatted.replace(/<br\s*\/?>/gi, '\n');
            
            // Fix concatenated answer options by adding line breaks before each option
            // This handles cases like "A. ConstructionB. Civil ServiceC. Financial"
            formatted = formatted.replace(/([A-D])\.\s*([^A-Z\n]*?)(?=[A-D]\.|$)/g, '\n$1. $2');
            
            // Also handle the pattern where options run together without spaces
            formatted = formatted.replace(/([a-z])([A-D])\./g, '$1\n$2.');
            
            // Add line breaks before common sections
            formatted = formatted.replace(/(Answer|Explanation|Hint):/gi, '\n\n$1:');
            
            // Remove other HTML tags
            formatted = formatted.replace(/<[^>]*>/g, '');
            
            // Clean up whitespace but preserve structure
            formatted = formatted.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
            
            return formatted;
          };
          
          front = formatContent(front);
          back = formatContent(back);
          
          // Skip truly empty cards
          if (!front && !back) {
            return;
          }
          
          const card: AnkiCard = { 
            deckId, 
            front, 
            back,
            frontImages: frontImages.length > 0 ? frontImages : undefined,
            backImages: backImages.length > 0 ? backImages : undefined,
            media: Object.keys(mediaFiles).length > 0 ? mediaFiles : undefined
          };
          
          if (frontImages.length > 0 || backImages.length > 0) {
            console.log(`Card with images - Front: ${frontImages.join(', ')}, Back: ${backImages.join(', ')}`);
          }
          
          if (deckMap[deckId]) {
            deckMap[deckId].cards.push(card);
            totalCards++;
          }
        } catch (cardError) {
          console.warn('Skipping malformed card:', cardError);
        }
      });
    }

    db.close();

    console.log(`Successfully parsed ${totalCards} cards from ${Object.keys(deckMap).length} deck(s)`);
    
    const result = Object.values(deckMap).filter(deck => deck.cards.length > 0);
    
    if (result.length === 0) {
      throw new Error('No cards found in any deck. The file may be empty or corrupted.');
    }

    return result;
    
  } catch (error) {
    console.error('Error parsing Anki file:', error);
    throw new Error(`Failed to parse Anki file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}