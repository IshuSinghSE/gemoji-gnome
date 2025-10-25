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
        .filter(entry => entry && entry.emoji)
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
    const categories = new Set();
    for (const entry of emojiData) {
        if (entry.category) {
            categories.add(entry.category);
        }
    }
    return ['Frequently Used', ...Array.from(categories)];
}
