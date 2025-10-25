/**
 * Emoji Data Loader
 *
 * @author     Ashu <ashu@example.local>
 * @copyright  2025
 * @license    GPL-3.0-only
 */

/**
 * Load emoji dataset from file or use fallback
 *
 * @param {Gio.File} directory - Extension directory
 * @returns {Array<object>}
 */
export function loadEmojiData(directory) {
    const file = directory.get_child('data').get_child('emoji.json');
    if (file && file.query_exists(null)) {
        try {
            return loadEmojiJson(file);
        } catch (error) {
            logError(error, 'emoji-picker: failed to parse emoji.json');
        }
    }

    log('emoji-picker: using built-in fallback emoji list');
    return getFallbackEmojiData();
}

/**
 * Parse emoji.json file
 *
 * @param {Gio.File} file
 * @returns {Array<object>}
 */
function loadEmojiJson(file) {
    const [success, bytes] = file.load_contents(null);
    if (!success) {
        return getFallbackEmojiData();
    }

    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(bytes);
    const data = JSON.parse(text);

    return data
        .filter(entry => {
            if (!entry || !entry.emoji) return false;
            
            // Filter out problematic characters
            const emoji = entry.emoji;
            
            // Skip if it's just a variation selector or combining character
            if (emoji.length === 1 && emoji.charCodeAt(0) >= 0xFE00 && emoji.charCodeAt(0) <= 0xFE0F) {
                return false;
            }
            
            // Skip zero-width joiner by itself
            if (emoji === '\u200D') return false;
            
            // Skip replacement character
            if (emoji === '\uFFFD' || emoji.includes('\uFFFD')) return false;
            
            return true;
        })
        .map(entry => ({
            emoji: entry.emoji,
            description: entry.description ?? '',
            category: entry.category ?? 'Other',
            aliases: entry.aliases ?? [],
            tags: entry.tags ?? [],
        }));
}

/**
 * Provide minimal fallback dataset
 *
 * @returns {Array<object>}
 */
function getFallbackEmojiData() {
    return [
        {
            emoji: '😀',
            description: 'grinning face',
            category: 'Smileys & Emotion',
            aliases: ['grinning'],
            tags: ['smile', 'happy'],
        },
        {
            emoji: '😂',
            description: 'face with tears of joy',
            category: 'Smileys & Emotion',
            aliases: ['joy'],
            tags: ['funny', 'haha'],
        },
        {
            emoji: '❤️',
            description: 'red heart',
            category: 'Symbols',
            aliases: ['heart'],
            tags: ['love'],
        },
        {
            emoji: '👍',
            description: 'thumbs up',
            category: 'People & Body',
            aliases: ['+1'],
            tags: ['approve', 'affirmative'],
        },
        {
            emoji: '🔥',
            description: 'fire',
            category: 'Travel & Places',
            aliases: ['fire'],
            tags: ['lit'],
        },
    ];
}

/**
 * Collect unique categories from emoji data
 *
 * @param {Array<object>} emojiData
 * @returns {Array<string>}
 */
export function collectCategories(emojiData) {
    // Predefined order for categories
    const orderedCategories = [
        'Frequently Used',
        'Smileys & Emotion',
        'People & Body',
        'Animals & Nature',
        'Food & Drink',
        'Travel & Places',
        'Activities',
        'Objects',
        'Symbols',
        'Flags'
    ];
    
    // Collect actual categories from data
    const categoriesInData = new Set();
    for (const entry of emojiData) {
        if (entry.category) {
            categoriesInData.add(entry.category);
        }
    }
    
    // Return only categories that exist in data, in predefined order
    return orderedCategories.filter(cat => 
        cat === 'Frequently Used' || categoriesInData.has(cat)
    );
}
