/**
 * Popup Size Manager
 * Manages popup dimensions based on user preferences and size modes
 *
 * @author     Ashu <ashu@example.local>
 * @copyright  2025
 * @license    GPL-3.0-only
 */

import { POPUP_SIZE_MODES, CUSTOM_SIZE_LIMITS } from './constants.js';

export class PopupSizeManager {
    #settings;
    #onSizeChangeCallback;
    #currentMode;
    #settingsChangedId;

    /**
     * @param {Gio.Settings} settings - GSettings instance
     * @param {Function} onSizeChangeCallback - Called when size changes
     */
    constructor(settings, onSizeChangeCallback = null) {
        this.#settings = settings;
        this.#onSizeChangeCallback = onSizeChangeCallback;
        this.#currentMode = settings.get_string('popup-size-mode') || 'default';

        // Listen for settings changes
        this.#settingsChangedId = settings.connect('changed', (_, key) => {
            if (key === 'popup-size-mode' || key === 'popup-width' || key === 'popup-height') {
                this.#onSettingChanged();
            }
        });
    }

    /**
     * Handle settings change
     */
    #onSettingChanged() {
        const newMode = this.#settings.get_string('popup-size-mode') || 'default';
        if (newMode !== this.#currentMode) {
            this.#currentMode = newMode;
            if (this.#onSizeChangeCallback) {
                this.#onSizeChangeCallback(this.getDimensions());
            }
        }
    }

    /**
     * Get current popup dimensions
     * @returns {{width: number, height: number, emojisPerRow: number}}
     */
    getDimensions() {
        const mode = this.#settings.get_string('popup-size-mode') || 'default';

        if (mode === 'custom') {
            return {
                width: this.#settings.get_int('popup-width'),
                height: this.#settings.get_int('popup-height'),
                emojisPerRow: this.#calculateEmojisPerRow(this.#settings.get_int('popup-width'))
            };
        }

        const preset = POPUP_SIZE_MODES[mode] || POPUP_SIZE_MODES.default;
        return {
            width: preset.width,
            height: preset.height,
            emojisPerRow: preset.emojisPerRow
        };
    }

    /**
     * Calculate emojis per row based on width
     * @param {number} width - Popup width in pixels
     * @returns {number} - Number of emojis per row
     */
    #calculateEmojisPerRow(width) {
        // Approximate: 40px per emoji button + 4px gap
        const emojiButtonWidth = 44;
        const containerPadding = 16;
        const availableWidth = width - containerPadding;
        return Math.max(6, Math.floor(availableWidth / emojiButtonWidth));
    }

    /**
     * Get all available size modes
     * @returns {Array<{mode: string, label: string, dimensions: object}>}
     */
    getAvailableModes() {
        const modes = [];
        
        for (const [key, preset] of Object.entries(POPUP_SIZE_MODES)) {
            modes.push({
                mode: key,
                label: preset.label,
                width: preset.width,
                height: preset.height,
                emojisPerRow: preset.emojisPerRow
            });
        }

        modes.push({
            mode: 'custom',
            label: 'Custom',
            width: this.#settings.get_int('popup-width'),
            height: this.#settings.get_int('popup-height'),
            emojisPerRow: this.#calculateEmojisPerRow(this.#settings.get_int('popup-width'))
        });

        return modes;
    }

    /**
     * Set size mode
     * @param {string} mode - Size mode (compact, default, comfortable, custom)
     */
    setMode(mode) {
        if (POPUP_SIZE_MODES[mode] || mode === 'custom') {
            this.#settings.set_string('popup-size-mode', mode);
        }
    }

    /**
     * Set custom dimensions
     * @param {number} width - Width in pixels
     * @param {number} height - Height in pixels
     */
    setCustomDimensions(width, height) {
        const w = Math.max(CUSTOM_SIZE_LIMITS.minWidth, Math.min(CUSTOM_SIZE_LIMITS.maxWidth, width));
        const h = Math.max(CUSTOM_SIZE_LIMITS.minHeight, Math.min(CUSTOM_SIZE_LIMITS.maxHeight, height));

        this.#settings.set_int('popup-width', w);
        this.#settings.set_int('popup-height', h);

        if (this.#settings.get_string('popup-size-mode') !== 'custom') {
            this.setMode('custom');
        }
    }

    /**
     * Get current mode
     * @returns {string}
     */
    getCurrentMode() {
        return this.#settings.get_string('popup-size-mode') || 'default';
    }

    /**
     * Get size limits for custom mode
     * @returns {{minWidth: number, maxWidth: number, minHeight: number, maxHeight: number}}
     */
    getCustomLimits() {
        return { ...CUSTOM_SIZE_LIMITS };
    }

    /**
     * Check if current mode is custom
     * @returns {boolean}
     */
    isCustomMode() {
        return this.getCurrentMode() === 'custom';
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.#settingsChangedId && this.#settings) {
            this.#settings.disconnect(this.#settingsChangedId);
            this.#settingsChangedId = 0;
        }
        this.#settings = null;
        this.#onSizeChangeCallback = null;
    }
}
