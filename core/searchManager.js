/**
 * Search Manager
 * Handles emoji search and filtering
 *
 * @author     Ashu <ashu@example.local>
 * @copyright  2025
 * @license    GPL-3.0-only
 */

import GLib from 'gi://GLib';
import { MAX_VISIBLE_EMOJIS, SEARCH_DEBOUNCE_MS } from './constants.js';

export class SearchManager {
    #searchEntry;
    #searchTimeoutId;
    #onSearchCallback;

    /**
     * @param {St.Entry} searchEntry
     * @param {Function} onSearchCallback - Called when search should be performed
     */
    constructor(searchEntry, onSearchCallback) {
        this.#searchEntry = searchEntry;
        this.#onSearchCallback = onSearchCallback;
        this.#searchTimeoutId = 0;

        this.#setupSearchEntry();
    }

    /**
     * Setup search entry event handlers
     */
    #setupSearchEntry() {
        if (!this.#searchEntry) {
            return;
        }

        // Use notify::text instead of text-changed for GNOME 48+
        const clutterText = this.#searchEntry.get_clutter_text();
        if (clutterText) {
            clutterText.connect('text-changed', () => this.queueFilter());
        }
        
        this.#searchEntry.connect('key-press-event', (actor, event) => {
            const symbol = event.get_key_symbol();
            if (symbol === 65307) { // Escape
                this.#searchEntry.set_text('');
                return true;
            }
            return false;
        });
    }

    /**
     * Queue a search filter with debouncing
     *
     * @param {boolean} immediate - Whether to execute immediately
     */
    queueFilter(immediate = false) {
        if (this.#searchTimeoutId) {
            GLib.source_remove(this.#searchTimeoutId);
            this.#searchTimeoutId = 0;
        }

        if (immediate) {
            this.#onSearchCallback(this.getQuery());
            return;
        }

        this.#searchTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SEARCH_DEBOUNCE_MS, () => {
            this.#searchTimeoutId = 0;
            this.#onSearchCallback(this.getQuery());
            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Get current search query
     *
     * @returns {string}
     */
    getQuery() {
        if (!this.#searchEntry) {
            return '';
        }

        const readText = actor => {
            if (!actor) {
                return '';
            }
            try {
                if (typeof actor.get_text === 'function') {
                    const value = actor.get_text();
                    if (typeof value === 'string') {
                        return value;
                    }
                }
            } catch (error) {
                // Ignore and fall back to other properties
            }

            if (actor.text !== undefined) {
                return String(actor.text);
            }

            return '';
        };

        let raw = '';

        if (typeof this.#searchEntry.get_text === 'function') {
            try {
                const value = this.#searchEntry.get_text();
                if (typeof value === 'string') {
                    raw = value;
                }
            } catch (error) {
                // Ignore and fall back to other accessors
            }
        }

        if (!raw) {
            raw = readText(this.#searchEntry.get_clutter_text?.());
        }

        if (!raw && this.#searchEntry.text !== undefined) {
            raw = String(this.#searchEntry.text);
        }

        return raw.trim().toLowerCase();
    }

    /**
     * Filter emoji data based on query
     *
     * @param {string} query
     * @param {Array<object>} emojiData
     * @returns {Array<object>}
     */
    filterEmojis(query, emojiData) {
        if (!query) {
            return emojiData;
        }

        const results = [];
        for (const item of emojiData) {
            const fields = [
                item.emoji,
                item.description,
                ...(item.aliases || []),
                ...(item.tags || []),
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            if (fields.includes(query)) {
                results.push(item);
                if (results.length >= MAX_VISIBLE_EMOJIS) {
                    break;
                }
            }
        }
        return results;
    }

    /**
     * Clear search query
     */
    clear() {
        if (this.#searchEntry) {
            this.#searchEntry.set_text('');
        }
    }

    /**
     * Focus search entry
     */
    focus() {
        if (this.#searchEntry) {
            this.#searchEntry.grab_key_focus();
        }
    }

    /**
     * Clean up
     */
    destroy() {
        if (this.#searchTimeoutId) {
            GLib.source_remove(this.#searchTimeoutId);
            this.#searchTimeoutId = 0;
        }
    }
}
