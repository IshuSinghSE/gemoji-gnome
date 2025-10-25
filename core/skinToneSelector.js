/**
 * Skin Tone Selector
 * Handles skin tone variant selection for emojis
 *
 * @author     Ashu <ashu@example.local>
 * @copyright  2025
 * @license    GPL-3.0-only
 */

import St from 'gi://St';
import Clutter from 'gi://Clutter';

export class SkinToneSelector {
    #container;
    #onToneSelectedCallback;
    #currentEmoji;
    #visible;

    // Unicode skin tone modifiers
    static SKIN_TONES = [
        { name: 'Default', modifier: '', color: '#FFCC22' },
        { name: 'Light', modifier: '\u{1F3FB}', color: '#FADCBC' },
        { name: 'Medium-Light', modifier: '\u{1F3FC}', color: '#E5BE93' },
        { name: 'Medium', modifier: '\u{1F3FD}', color: '#C99667' },
        { name: 'Medium-Dark', modifier: '\u{1F3FE}', color: '#A16D4A' },
        { name: 'Dark', modifier: '\u{1F3FF}', color: '#61493F' }
    ];

    /**
     * @param {St.Widget} parentContainer - Parent container to add selector to
     * @param {Function} onToneSelectedCallback - Called when a skin tone variant is selected
     */
    constructor(parentContainer, onToneSelectedCallback) {
        console.log('[SkinToneSelector] Initializing...');
        this.#onToneSelectedCallback = onToneSelectedCallback;
        this.#currentEmoji = null;
        this.#visible = false;
        this.#buildSelector(parentContainer);
        console.log('[SkinToneSelector] Initialized successfully');
    }

    /**
     * Build the skin tone selector as inline buttons
     */
    #buildSelector(parentContainer) {
        console.log('[SkinToneSelector] Building selector, parent:', parentContainer);
        // Container for tone buttons
        this.#container = new St.BoxLayout({
            style_class: 'skin-tone-selector',
            vertical: false,
            visible: true,  // Make visible by default for testing
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.START,
        });

        // Create a button for each skin tone
        for (const tone of SkinToneSelector.SKIN_TONES) {
            const button = new St.Button({
                style_class: 'skin-tone-circle',
                can_focus: true,
                x_expand: false,
                y_expand: false,
            });

            // Create colored circle
            const circle = new St.Widget({
                style_class: 'skin-tone-color',
                style: `background-color: ${tone.color}; width: 28px; height: 28px; border-radius: 50%;`,
            });

            button.set_child(circle);
            button.set_accessible_name(`${tone.name} skin tone`);
            
            button.connect('clicked', () => {
                if (this.#currentEmoji && this.#onToneSelectedCallback) {
                    const variantEmoji = this.#applyTone(this.#currentEmoji.emoji, tone.modifier);
                    const variant = {
                        ...this.#currentEmoji,
                        emoji: variantEmoji,
                        description: `${this.#currentEmoji.description}${tone.modifier ? ' (' + tone.name + ')' : ''}`
                    };
                    this.#onToneSelectedCallback(variant);
                }
                this.hide();
            });

            this.#container.add_child(button);
        }

        parentContainer.add_child(this.#container);
        console.log('[SkinToneSelector] Built and added to parent');
    }

    /**
     * Show the skin tone selector for an emoji
     *
     * @param {object} emojiData - The emoji data object
     */
    show(emojiData) {
        console.log('[SkinToneSelector] show() called with:', emojiData);
        if (!emojiData || !emojiData.skin_tones) {
            console.log('[SkinToneSelector] No skin tones support, hiding');
            this.hide();
            return;
        }

        this.#currentEmoji = emojiData;
        this.#container.show();
        this.#visible = true;
        console.log('[SkinToneSelector] Showing selector');
    }

    /**
     * Apply skin tone modifier to emoji
     *
     * @param {string} emoji - Base emoji
     * @param {string} modifier - Skin tone modifier
     * @returns {string} - Emoji with skin tone applied
     */
    #applyTone(emoji, modifier) {
        if (!modifier) {
            return emoji;
        }

        // Remove any existing skin tone modifiers first
        let baseEmoji = emoji;
        for (const tone of SkinToneSelector.SKIN_TONES) {
            if (tone.modifier) {
                baseEmoji = baseEmoji.replace(tone.modifier, '');
            }
        }

        // Handle variation selector (U+FE0F) - insert modifier before it
        const variationSelector = '\uFE0F';
        if (baseEmoji.includes(variationSelector)) {
            return baseEmoji.replace(variationSelector, modifier + variationSelector);
        }

        // For most emojis, just append the modifier
        return baseEmoji + modifier;
    }

    /**
     * Hide the skin tone selector
     */
    hide() {
        if (this.#container) {
            this.#container.hide();
        }
        this.#currentEmoji = null;
        this.#visible = false;
    }

    /**
     * Check if the selector is currently visible
     *
     * @returns {boolean}
     */
    isVisible() {
        return this.#visible;
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.#container) {
            this.#container.destroy();
            this.#container = null;
        }
        this.#currentEmoji = null;
    }
}
