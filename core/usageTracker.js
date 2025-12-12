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
    #timeoutIds = new Set();

    /**
     * @param {Gio.Settings} settings
     */
    constructor(settings) {
        this.#settings = settings;
        this.#usageCount = new Map();
        this.loadUsageData();
    }

    /**
     * Add a timeout and track it
     * @param {number} interval
     * @param {Function} callback
     * @returns {number}
     */
    #addTimeout(interval, callback) {
        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, interval, () => {
            const result = callback();
            if (result === GLib.SOURCE_REMOVE) {
                this.#timeoutIds.delete(id);
            }
            return result;
        });
        this.#timeoutIds.add(id);
        return id;
    }

    /**
     * Load usage data from settings
     */
    loadUsageData() {
        const json = this.#settings.get_string('emoji-usage-counts');
        if (json) {
            try {
                const data = JSON.parse(json);
                this.#usageCount = new Map(Object.entries(data));
            } catch (error) {
                console.log('emoji-picker: failed to load usage data' + error);
                this.#usageCount = new Map();
            }
        } else {
             this.#usageCount = new Map();
        }
    }

    /**
     * Save usage data to settings
     */
    saveUsageData() {
        // No try-catch needed here as JSON.stringify on simple object shouldn't fail
        // and set_string shouldn't typically throw unless connection is broken
        const obj = Object.fromEntries(this.#usageCount);
        const json = JSON.stringify(obj);
        this.#settings.set_string('emoji-usage-counts', json);
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
        this.#addTimeout(500, () => {
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

    /**
     * Destroy manager
     */
    destroy() {
        // Clear all timeouts
        for (const id of this.#timeoutIds) {
            if (id) {
                GLib.source_remove(id);
            }
        }
        this.#timeoutIds.clear();
        this.#settings = null;
    }
}
