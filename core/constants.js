/**
 * Constants and Configuration
 *
 * @author     Ashu <ashu@example.local>
 * @copyright  2025
 * @license    GPL-3.0-only
 */

export const MAX_VISIBLE_EMOJIS = 360;
export const SEARCH_DEBOUNCE_MS = 120;
export const POPUP_WIDTH = 420;
export const POPUP_HEIGHT = 600;
export const EMOJIS_PER_ROW = 10;
export const CATEGORY_SCROLL_THRESHOLD = 30;
export const CATEGORY_SCROLL_DELAY = 50;

// Popup size presets - restricted to specific dimensions
export const POPUP_SIZE_MODES = {
    compact: {
        width: 360,
        height: 320,
        emojisPerRow: 7,
        label: 'Compact'
    },
    default: {
        width: 480,
        height: 360,
        emojisPerRow: 8,
        label: 'Default'
    },
    comfortable: {
        width: 600,
        height: 480,
        emojisPerRow: 14,
        label: 'Comfortable'
    }
};

// Custom size ranges (only used when mode is 'custom')
export const CUSTOM_SIZE_LIMITS = {
    minWidth: 300,
    maxWidth: 1280,
    minHeight: 300,
    maxHeight: 720
};

export const CATEGORIES = [
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

export const CATEGORY_ICONS = {
    'Frequently Used': 'emoji-recent-symbolic',
    'Smileys & Emotion': 'emoji-smileys-symbolic',
    'People & Body': 'emoji-body-symbolic',
    'Animals & Nature': 'emoji-nature-symbolic',
    'Food & Drink': 'emoji-food-symbolic',
    'Travel & Places': 'emoji-travel-symbolic',
    'Activities': 'emoji-activities-symbolic',
    'Objects': 'emoji-objects-symbolic',
    'Symbols': 'emoji-symbols-symbolic',
    'Flags': 'emoji-flags-symbolic'
};
