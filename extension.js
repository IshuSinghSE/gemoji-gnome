/**
 * Extension (Refactored)
 *
 * @author     Ashu <ashu@example.local>
 * @copyright  2025
 * @license    GPL-3.0-only
 */

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

// Import our modules
import { POPUP_WIDTH, POPUP_HEIGHT } from './core/constants.js';
import { loadEmojiData, collectCategories } from './core/emojiData.js';
import { UsageTracker } from './core/usageTracker.js';
import { KeybindingManager } from './core/keybindingManager.js';
import { SearchManager } from './core/searchManager.js';
import { CategoryManager } from './core/categoryManager.js';
import { EmojiRenderer } from './core/emojiRenderer.js';
import { ClipboardManager } from './core/clipboardManager.js';

/**
 * Extension entry point
 */
export default class EmojiPickerExtension extends Extension {
    /** @type {PanelMenu.Button|null} */
    #button = null;

    /** @type {St.Widget|null} */
    #popup = null;

    /** @type {Gio.Settings|null} */
    #settings = null;

    /** @type {number} */
    #settingsChangedId = 0;

    /** @type {Array<object>} */
    #emojiData = [];

    /** @type {St.Entry|null} */
    #searchEntry = null;

    /** @type {St.Widget|null} */
    #emojiGrid = null;

    /** @type {St.ScrollView|null} */
    #scrollView = null;

    /** @type {number} */
    #stageClickId = 0;

    // Module instances
    /** @type {UsageTracker|null} */
    #usageTracker = null;

    /** @type {KeybindingManager|null} */
    #keybindingManager = null;

    /** @type {SearchManager|null} */
    #searchManager = null;

    /** @type {CategoryManager|null} */
    #categoryManager = null;

    /** @type {EmojiRenderer|null} */
    #emojiRenderer = null;

    /** @type {ClipboardManager|null} */
    #clipboardManager = null;

    /**
     * Enable extension
     */
    enable() {
        this.#settings = this.getSettings();
        this.#emojiData = loadEmojiData(this.dir);

        // Initialize modules
        this.#usageTracker = new UsageTracker(this.#settings);
        this.#clipboardManager = new ClipboardManager(this.#settings);
        this.#keybindingManager = new KeybindingManager(
            this.#settings,
            'emoji-keybinding',
            () => this.#togglePopup()
        );

        // Create panel button if enabled
        if (this.#settings.get_boolean('show-indicator')) {
            this.#createPanelButton();
        }

        // Register keybinding if enabled
        if (this.#settings.get_boolean('use-keybind')) {
            this.#keybindingManager.register();
        }

        // Listen for settings changes
        this.#settingsChangedId = this.#settings.connect('changed', (settings, key) => {
            this.#onSettingsChanged(key);
        });
    }

    /**
     * Disable extension
     */
    disable() {
        // Disconnect settings
        if (this.#settingsChangedId && this.#settings) {
            this.#settings.disconnect(this.#settingsChangedId);
            this.#settingsChangedId = 0;
        }

        // Cleanup modules
        if (this.#searchManager) {
            this.#searchManager.destroy();
            this.#searchManager = null;
        }

        if (this.#keybindingManager) {
            this.#keybindingManager.unregister();
            this.#keybindingManager = null;
        }

        // Cleanup UI
        this.#destroyPopup();
        this.#removePanelButton();
        this.#disconnectStageMonitor();

        // Clear references
        this.#usageTracker = null;
        this.#clipboardManager = null;
        this.#categoryManager = null;
        this.#emojiRenderer = null;
        this.#settings = null;
        this.#emojiData = [];
    }

    /**
     * Create panel button
     */
    #createPanelButton() {
        if (this.#button) {
            return;
        }

        this.#button = new PanelMenu.Button(0.0, 'Emoji Picker', false);

        const icon = new St.Icon({
            icon_name: 'face-smile-symbolic',
            style_class: 'system-status-icon',
        });

        this.#button.add_child(icon);
        this.#button.connect('button-press-event', () => {
            this.#togglePopup();
            return Clutter.EVENT_STOP;
        });

        Main.panel.addToStatusArea('emoji-picker', this.#button);
    }

    /**
     * Remove panel button
     */
    #removePanelButton() {
        if (this.#button) {
            this.#button.destroy();
            this.#button = null;
        }
    }

    /**
     * Build popup UI
     */
    #buildPopup() {
        if (this.#popup) {
            return;
        }

        // Create main container
        const container = new St.BoxLayout({
            vertical: true,
            style_class: 'emoji-picker-popup',
            width: POPUP_WIDTH,
            height: POPUP_HEIGHT,
        });

        // Get categories
        const categories = collectCategories(this.#emojiData);

        // Create scroll view for emoji grid
        this.#scrollView = new St.ScrollView({
            style_class: 'emoji-scroll-view',
            hscrollbar_policy: St.PolicyType.NEVER,
            vscrollbar_policy: St.PolicyType.AUTOMATIC,
            overlay_scrollbars: true,
            x_expand: true,
            y_expand: true,
        });

        // Create emoji grid
        this.#emojiGrid = new St.BoxLayout({
            vertical: true,
            style_class: 'emoji-grid',
            x_expand: true,
        });

        this.#scrollView.add_actor(this.#emojiGrid);

        // Initialize category manager
        this.#categoryManager = new CategoryManager(this.#scrollView, (category) => {
            // Category changed callback (if needed)
        });

        // Create category tabs
        const categoryTabs = this.#categoryManager.buildCategoryTabs(categories, this.dir);

        // Create search entry
        this.#searchEntry = new St.Entry({
            style_class: 'emoji-search-entry',
            hint_text: 'Search emojis...',
            can_focus: true,
            x_expand: true,
        });

        // Initialize search manager
        this.#searchManager = new SearchManager(this.#searchEntry, (query) => {
            this.#applyFilter(query);
        });

        // Initialize emoji renderer
        this.#emojiRenderer = new EmojiRenderer(this.#emojiGrid, (item) => {
            this.#handleEmojiSelected(item);
        });

        // Build layout
        container.add_child(categoryTabs);
        container.add_child(this.#searchEntry);
        container.add_child(this.#scrollView);

        // Create popup
        this.#popup = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            reactive: true,
            can_focus: true,
            visible: false,
        });

        this.#popup.add_child(container);
        Main.layoutManager.addChrome(this.#popup);

        // Apply theme
        this.#applyTheme();

        // Initial render
        this.#renderEmojisByCategory();
    }

    /**
     * Destroy popup
     */
    #destroyPopup() {
        if (this.#popup) {
            Main.layoutManager.removeChrome(this.#popup);
            this.#popup.destroy();
            this.#popup = null;
        }

        this.#searchEntry = null;
        this.#emojiGrid = null;
        this.#scrollView = null;
        this.#categoryManager = null;
        this.#searchManager = null;
        this.#emojiRenderer = null;
    }

    /**
     * Apply filter based on search query
     *
     * @param {string} query
     */
    #applyFilter(query) {
        if (!this.#emojiRenderer || !this.#searchManager) {
            return;
        }

        if (query) {
            // Show filtered results
            const results = this.#searchManager.filterEmojis(query, this.#emojiData);
            this.#emojiRenderer.renderEmojis(results);
        } else {
            // Show all emojis by category
            this.#renderEmojisByCategory();
        }
    }

    /**
     * Render emojis grouped by category
     */
    #renderEmojisByCategory() {
        if (!this.#emojiRenderer || !this.#usageTracker || !this.#categoryManager) {
            return;
        }

        // Clear existing sections
        this.#categoryManager.clearSections();

        // Render with category headers
        this.#emojiRenderer.renderEmojisByCategory(
            this.#emojiData,
            this.#usageTracker,
            (category, section) => {
                this.#categoryManager.registerSection(category, section);
            }
        );
    }

    /**
     * Handle emoji selection
     *
     * @param {{emoji: string, description?: string}} item
     */
    #handleEmojiSelected(item) {
        // Copy to clipboard
        this.#clipboardManager.copyToClipboard(item.emoji);

        // Track usage
        this.#usageTracker.trackUsage(item.emoji);

        // Show toast
        const message = `${item.emoji} ${item.description || 'copied'}`;
        this.#clipboardManager.showToast(message);

        // Paste if enabled
        this.#clipboardManager.pasteEmoji();

        // Close popup
        this.#togglePopup(true);
    }

    /**
     * Handle settings changes
     *
     * @param {string} key
     */
    #onSettingsChanged(key) {
        if (key === 'show-indicator') {
            const showIndicator = this.#settings.get_boolean('show-indicator');
            if (showIndicator) {
                this.#createPanelButton();
            } else {
                this.#removePanelButton();
            }
        } else if (key === 'use-keybind') {
            if (this.#keybindingManager) {
                this.#keybindingManager.update();
            }
        } else if (key === 'use-custom-theme') {
            this.#applyTheme();
        }
    }

    /**
     * Toggle popup visibility
     *
     * @param {boolean} forceHide
     */
    #togglePopup(forceHide = false) {
        if (!this.#popup || forceHide) {
            if (this.#popup && this.#popup.visible) {
                this.#hidePopup();
            }
            return;
        }

        if (this.#popup.visible) {
            this.#hidePopup();
        } else {
            this.#showPopup();
        }
    }

    /**
     * Show popup
     */
    #showPopup() {
        if (!this.#popup) {
            this.#buildPopup();
        }

        this.#repositionPopup();
        this.#popup.opacity = 0;
        this.#popup.show();

        // Focus search
        if (this.#searchManager) {
            this.#searchManager.focus();
        }

        // Animate in
        this.#popup.ease({
            opacity: 255,
            duration: 120,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        this.#ensureStageMonitor();
    }

    /**
     * Hide popup
     */
    #hidePopup() {
        if (!this.#popup) {
            return;
        }

        // Clear search
        if (this.#searchManager) {
            this.#searchManager.clear();
        }

        // Animate out
        this.#popup.ease({
            opacity: 0,
            duration: 120,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                if (this.#popup) {
                    this.#popup.hide();
                    this.#popup.opacity = 255;
                }
            },
        });

        this.#disconnectStageMonitor();
    }

    /**
     * Reposition popup in center of screen
     */
    #repositionPopup() {
        if (!this.#popup) {
            return;
        }

        const monitor = Main.layoutManager.primaryMonitor;
        const x = monitor.x + Math.round((monitor.width - this.#popup.width) / 2);
        const y = monitor.y + Math.round((monitor.height - this.#popup.height) / 2);
        this.#popup.set_position(Math.max(monitor.x, x), Math.max(monitor.y, y));
    }

    /**
     * Monitor stage clicks to close popup
     */
    #ensureStageMonitor() {
        if (this.#stageClickId || !global.stage) {
            return;
        }

        this.#stageClickId = global.stage.connect('button-press-event', (_actor, event) => {
            const actor = typeof event.get_actor === 'function'
                ? event.get_actor()
                : event.get_source?.();

            if (actor && this.#popup && (actor === this.#popup || this.#popup.contains(actor))) {
                return Clutter.EVENT_PROPAGATE;
            }
            this.#togglePopup(true);
            return Clutter.EVENT_PROPAGATE;
        });
    }

    /**
     * Disconnect stage monitor
     */
    #disconnectStageMonitor() {
        if (this.#stageClickId && global.stage) {
            global.stage.disconnect(this.#stageClickId);
            this.#stageClickId = 0;
        }
    }

    /**
     * Apply theme
     */
    #applyTheme() {
        if (!this.#popup) {
            return;
        }

        this.#popup.remove_style_class_name('emoji-picker-custom-theme');
        this.#popup.remove_style_class_name('emoji-picker-native-theme');

        const useCustom = this.#settings?.get_boolean('use-custom-theme') ?? true;
        if (useCustom) {
            this.#popup.add_style_class_name('emoji-picker-custom-theme');
        } else {
            this.#popup.add_style_class_name('emoji-picker-native-theme');
        }
    }
}
