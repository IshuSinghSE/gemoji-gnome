/**
 * Emoji Renderer
 * Handles emoji grid rendering
 *
 * @author     Ashu <ashu@example.local>
 * @copyright  2025
 * @license    GPL-3.0-only
 */

import St from 'gi://St';
import { EMOJIS_PER_ROW } from './constants.js';

export class EmojiRenderer {
    #emojiGrid;
    #onEmojiSelectedCallback;
    #skinToneSelector;

    /**
     * @param {St.BoxLayout} emojiGrid
     * @param {Function} onEmojiSelectedCallback - Called when emoji is selected
     * @param {SkinToneSelector} skinToneSelector - Optional skin tone selector
     */
    constructor(emojiGrid, onEmojiSelectedCallback, skinToneSelector = null) {
        this.#emojiGrid = emojiGrid;
        this.#onEmojiSelectedCallback = onEmojiSelectedCallback;
        this.#skinToneSelector = skinToneSelector;
    }

    /**
     * Create an emoji button with skin tone support
     *
     * @param {object} item - Emoji data
     * @returns {St.Button} - Emoji button
     */
    #createEmojiButton(item) {
        const button = new St.Button({
            style_class: 'emoji-button',
            label: item.emoji,
            can_focus: true,
            x_expand: false,
            y_expand: false,
        });

        button.set_accessible_name(item.description ?? item.emoji);

        // For emojis with skin tones, show selector instead of direct selection
        if (item.skin_tones && this.#skinToneSelector) {
            button.connect('clicked', () => {
                // Show skin tone selector
                this.#skinToneSelector.show(item);
            });
            
            // Add visual indicator for skin tone support
            button.add_style_class_name('has-skin-tones');
        } else {
            // Regular click - select emoji directly
            button.connect('clicked', () => {
                if (this.#onEmojiSelectedCallback) {
                    this.#onEmojiSelectedCallback(item);
                }
            });
        }

        return button;
    }

    /**
     * Clear all emoji content
     */
    clear() {
        if (!this.#emojiGrid) {
            return;
        }

        const children = this.#emojiGrid.get_children();
        for (const child of children) {
            this.#emojiGrid.remove_child(child);
            child.destroy();
        }
    }

    /**
     * Render emojis in a grid layout
     *
     * @param {Array<object>} emojis
     */
    renderEmojis(emojis) {
        this.clear();

        if (!this.#emojiGrid) {
            return;
        }

        let currentRow = null;
        let emojiCount = 0;

        for (const item of emojis) {
            // Create a new row every EMOJIS_PER_ROW emojis
            if (emojiCount % EMOJIS_PER_ROW === 0) {
                currentRow = new St.BoxLayout({
                    vertical: false,
                    style_class: 'emoji-row',
                    x_expand: true,
                });
                this.#emojiGrid.add_child(currentRow);
            }

            const button = this.#createEmojiButton(item);
            currentRow.add_child(button);
            emojiCount++;
        }
        
        // Force the grid to show and queue a relayout
        this.#emojiGrid.show();
        this.#emojiGrid.queue_relayout();
    }

    /**
     * Render emojis grouped by category with headers
     *
     * @param {Array<object>} emojiData
     * @param {UsageTracker} usageTracker
     * @param {Function} registerSectionCallback - Called for each category header
     */
    renderEmojisByCategory(emojiData, usageTracker, registerSectionCallback) {
        this.clear();

        if (!this.#emojiGrid) {
            return;
        }

        // Get frequently used emojis
        const frequentlyUsed = usageTracker.getFrequentlyUsed(emojiData, 30);

        // Group emojis by category
        const categorizedEmojis = new Map();
        if (frequentlyUsed.length > 0) {
            categorizedEmojis.set('Frequently Used', frequentlyUsed);
        }

        for (const item of emojiData) {
            const category = item.category || 'Other';
            if (!categorizedEmojis.has(category)) {
                categorizedEmojis.set(category, []);
            }
            categorizedEmojis.get(category).push(item);
        }

        // Render each category
        for (const [category, emojis] of categorizedEmojis.entries()) {
            if (emojis.length === 0) {
                continue;
            }

            // Create category header
            const header = new St.Label({
                text: category,
                style_class: 'emoji-category-header',
                x_expand: true,
            });
            this.#emojiGrid.add_child(header);

            // Register section for scroll sync
            if (registerSectionCallback) {
                registerSectionCallback(category, header);
            }

            // Render emojis in rows
            let currentRow = null;
            let emojiCount = 0;

            for (const item of emojis) {
                if (emojiCount % EMOJIS_PER_ROW === 0) {
                    currentRow = new St.BoxLayout({
                        vertical: false,
                        style_class: 'emoji-row',
                        x_expand: true,
                    });
                    this.#emojiGrid.add_child(currentRow);
                }

                const button = this.#createEmojiButton(item);
                currentRow.add_child(button);
                emojiCount++;
            }
        }

        // Force relayout
        this.#emojiGrid.show();
        this.#emojiGrid.queue_relayout();
    }
}
