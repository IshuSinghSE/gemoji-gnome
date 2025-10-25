/**
 * Usage Tracker
 * Tracks frequently used emojis
 *
 * @author     Ashu <ashu@example.local>
 * @copyright  2025
 * @license    GPL-3.0-only
 */

import GLib from 'gi://GLib';

export class UsageTracker {
    #settings;
    #usageCount;

    /**
     * @param {Gio.Settings} settings
     */
    constructor(settings) {
        this.#settings = settings;
        this.#usageCount = new Map();
        this.loadUsageData();
    }

    /**
     * Load usage data from settings
     */
    loadUsageData() {
        try {
            const json = this.#settings.get_string('emoji-usage-counts');
            if (json) {
                const data = JSON.parse(json);
                this.#usageCount = new Map(Object.entries(data));
            }
        } catch (error) {
            log('emoji-picker: failed to load usage data');
            this.#usageCount = new Map();
        }
    }

    /**
     * Save usage data to settings
     */
    saveUsageData() {
        try {
            const obj = Object.fromEntries(this.#usageCount);
            const json = JSON.stringify(obj);
            this.#settings.set_string('emoji-usage-counts', json);
        } catch (error) {
            log('emoji-picker: failed to save usage data');
        }
    }

    /**
     * Get frequently used emojis
     *
     * @param {Array<object>} emojiData
     * @param {number} limit
     * @returns {Array<object>}
     */
    getFrequentlyUsed(emojiData, limit = 30) {
        if (this.#usageCount.size === 0) {
            return [];
        }

        const emojiMap = new Map();
        for (const entry of emojiData) {
            emojiMap.set(entry.emoji, entry);
        }

        const sortedEmojis = Array.from(this.#usageCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([emoji]) => emojiMap.get(emoji))
            .filter(entry => entry);

        return sortedEmojis;
    }

    /**
     * Track emoji usage
     *
     * @param {string} emoji
     */
    trackUsage(emoji) {
        const currentCount = this.#usageCount.get(emoji) || 0;
        this.#usageCount.set(emoji, currentCount + 1);
        
        // Debounce saves
        GLib.timeout_add(GLib.PRIORITY_LOW, 500, () => {
            this.saveUsageData();
            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Get usage count for an emoji
     *
     * @param {string} emoji
     * @returns {number}
     */
    getCount(emoji) {
        return this.#usageCount.get(emoji) || 0;
    }

    /**
     * Clear all usage data
     */
    clear() {
        this.#usageCount.clear();
        this.saveUsageData();
    }
}
