/**
 * Extension
 *
 * @author     Ashu <ashu@example.local>
 * @copyright  2025
 * @license    GPL-3.0-only
 */

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const MAX_VISIBLE_EMOJIS = 360;
const SEARCH_DEBOUNCE_MS = 120;
const POPUP_WIDTH = 420;

const CATEGORY_EMOJI = {
    'Smileys & Emotion': '😀',
    'People & Body': '🧑',
    'Animals & Nature': '🦊',
    'Food & Drink': '🍜',
    'Travel & Places': '🛫',
    'Activities': '⚽',
    'Objects': '💡',
    'Symbols': '🔣',
    'Flags': '🏳️',
};

/**
 * Extension entry point
 */
export default class EmojiPickerExtension extends Extension {
    /**
     * Panel button
     *
     * @type {PanelMenu.Button|null}
     */
    #button = null;

    /**
     * Popup actor containing the picker UI
     *
     * @type {St.Widget|null}
     */
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

    /** @type {Map<string, St.Button>} */
    #categoryButtons = new Map();

    /** @type {string} */
    #currentCategory = 'All';

    /** @type {number} */
    #searchTimeoutId = 0;

    /** @type {number} */
    #stageClickId = 0;

    /** @type {St.Clipboard|null} */
    #clipboard = null;

    /**
     * Enable extension
     *
     * @returns {void}
     */
    enable() {
        this.#settings = this.getSettings();
        this.#clipboard = St.Clipboard.get_default();
        this.#emojiData = this.#loadEmojiData();

        // Create panel button
        this.#button = new PanelMenu.Button(0.0, this.metadata.uuid);
        const icon = new St.Icon({
            icon_name: 'face-smile-symbolic',
            style_class: 'system-status-icon',
        });
        this.#button.add_child(icon);
        this.#button.connect('button-press-event', () => {
            this.#togglePopup();
            return Clutter.EVENT_STOP;
        });

        this.#popup = this.#buildPopup();
        this.#popup.hide();
        Main.layoutManager.addChrome(this.#popup, {
            affectsStruts: false,
            affectsInputRegion: true,
        });

        this.#settingsChangedId = this.#settings.connect('changed::use-custom-theme', () => this.#applyTheme());
        this.#applyTheme();

        // Add button to panel
        Main.panel.addToStatusArea(this.metadata.uuid, this.#button, 1, 'right');

        try {
            this.#registerKeybinding();
        } catch (error) {
            logError(error, 'emoji-picker: failed to register keybinding');
        }
        this.#queueFilter(true);
    }

    /**
     * Disable extension
     *
     * @returns {void}
     */
    disable() {
        this.#unregisterKeybinding();

        if (this.#settings && this.#settingsChangedId) {
            this.#settings.disconnect(this.#settingsChangedId);
            this.#settingsChangedId = 0;
        }
        this.#settings = null;

        if (this.#popup) {
            this.#disconnectStageMonitor();
            Main.layoutManager.removeChrome(this.#popup);
            this.#popup.destroy();
            this.#popup = null;
        }

        if (this.#button) {
            this.#button.destroy();
            this.#button = null;
        }

        if (this.#searchTimeoutId) {
            GLib.source_remove(this.#searchTimeoutId);
            this.#searchTimeoutId = 0;
        }

        this.#emojiData = [];
        this.#categoryButtons.clear();
        this.#searchEntry = null;
        this.#emojiGrid = null;
        this.#clipboard = null;
    }

    /**
     * Register global keybinding
     *
     * @returns {void}
     */
    #registerKeybinding() {
        if (!this.#settings) {
            return;
        }

        const handler = () => this.#togglePopup();
        const actionModeAll = Shell.ActionMode?.ALL ??
            ((Shell.ActionMode?.NORMAL ?? 0) | (Shell.ActionMode?.OVERVIEW ?? 0));

        if (Main.wm.addKeybinding.length >= 5 && actionModeAll !== undefined) {
            Main.wm.addKeybinding(
                'emoji-keybinding',
                this.#settings,
                Meta.KeyBindingFlags.NONE,
                actionModeAll,
                handler
            );
            return;
        }

        if (global.display?.add_keybinding) {
            global.display.add_keybinding(
                'emoji-keybinding',
                this.#settings,
                Meta.KeyBindingFlags.NONE,
                handler
            );
            return;
        }

        // Fallback for very old shells where addKeybinding expects 4 arguments.
        Main.wm.addKeybinding(
            'emoji-keybinding',
            this.#settings,
            Meta.KeyBindingFlags.NONE,
            handler
        );
    }

    /**
     * Remove keybinding if present
     *
     * @returns {void}
     */
    #unregisterKeybinding() {
        if (global.display?.remove_keybinding) {
            global.display.remove_keybinding('emoji-keybinding');
        }
        Main.wm.removeKeybinding('emoji-keybinding');
    }

    /**
     * Build popup actor
     *
     * @returns {St.Widget}
     */
    #buildPopup() {
        const popup = new St.BoxLayout({
            vertical: true,
            style_class: 'emoji-picker-base emoji-picker-popup',
            reactive: true,
            can_focus: true,
            x_expand: false,
            y_expand: false,
        });

        popup.set_pivot_point(0.5, 0.0);
        popup.set_width(POPUP_WIDTH);

        popup.connect('key-press-event', (_actor, event) => {
            if (event.get_key_symbol() === Clutter.KEY_Escape) {
                this.#togglePopup(true);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        // Search entry
        this.#searchEntry = new St.Entry({
            style_class: 'search-entry',
            can_focus: true,
            x_expand: true,
        });

        const searchText = this.#searchEntry.get_clutter_text?.() ?? null;
        if (searchText) {
            if (typeof searchText.set_placeholder_text === 'function') {
                searchText.set_placeholder_text('Search emojis');
            } else if (searchText.hint_text !== undefined) {
                searchText.hint_text = 'Search emojis';
            }

            if (typeof searchText.connect === 'function') {
                searchText.connect('text-changed', () => this.#queueFilter());
            }
        } else {
            // Fallback: watch notify::text on the entry if the clutter text is not accessible
            this.#searchEntry.connect?.('notify::text', () => this.#queueFilter());
        }

        popup.add_child(this.#searchEntry);

        // Category strip
        const categories = this.#collectCategories();
        popup.add_child(this.#buildCategoryBar(categories));

        // Emoji grid inside scroll view
        const scrollView = new St.ScrollView({
            style_class: 'emoji-scroll',
            overlay_scrollbars: true,
        });
        scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);

        const flowLayout = new Clutter.FlowLayout();
        flowLayout.set_column_spacing(6);
        flowLayout.set_row_spacing(6);

        this.#emojiGrid = new St.Widget({
            layout_manager: flowLayout,
            style_class: 'emoji-grid',
            x_expand: true,
            y_expand: false,
        });

        scrollView.add_child(this.#emojiGrid);
        popup.add_child(scrollView);

        return popup;
    }

    /**
     * Build horizontal category bar
     *
     * @param {string[]} categories
     * @returns {St.Widget}
     */
    #buildCategoryBar(categories) {
        const scroll = new St.ScrollView({
            style_class: 'emoji-category-scroll',
            overlay_scrollbars: false,
        });
        scroll.set_policy(St.PolicyType.AUTOMATIC, St.PolicyType.NEVER);

        const box = new St.BoxLayout({
            style_class: 'emoji-category-bar',
            x_expand: true,
        });

        this.#categoryButtons.clear();

        for (const category of categories) {
            const button = new St.Button({
                style_class: 'emoji-category-button',
                label: this.#labelForCategory(category),
                can_focus: true,
                x_align: Clutter.ActorAlign.CENTER,
            });
            if (typeof button.set_tooltip_text === 'function') {
                button.set_tooltip_text(category);
            }
            button.connect('clicked', () => this.#setCategory(category));

            this.#categoryButtons.set(category, button);
            box.add_child(button);
        }

        this.#setCategory('All', { skipRefilter: true });
        scroll.add_child(box);
        return scroll;
    }

    /**
     * Update selected category
     *
     * @param {string} category
     * @param {{skipRefilter?: boolean}} [options]
     * @returns {void}
     */
    #setCategory(category, options = {}) {
        this.#currentCategory = category;
        this.#updateCategoryStates();
        if (!options.skipRefilter) {
            this.#queueFilter(true);
        }
    }

    /**
     * Highlight active category button
     *
     * @returns {void}
     */
    #updateCategoryStates() {
        for (const [category, button] of this.#categoryButtons) {
            if (category === this.#currentCategory) {
                button.add_style_class_name('active');
            } else {
                button.remove_style_class_name('active');
            }
        }
    }

    /**
     * Debounce filter requests
     *
     * @param {boolean} [immediate]
     * @returns {void}
     */
    #queueFilter(immediate = false) {
        if (this.#searchTimeoutId) {
            GLib.source_remove(this.#searchTimeoutId);
            this.#searchTimeoutId = 0;
        }

        if (immediate) {
            this.#applyFilter();
            return;
        }

        this.#searchTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SEARCH_DEBOUNCE_MS, () => {
            this.#searchTimeoutId = 0;
            this.#applyFilter();
            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Apply search + category filter
     *
     * @returns {void}
     */
    #applyFilter() {
        if (!this.#emojiGrid) {
            return;
        }

        const query = this.#searchEntry
            ? this.#searchEntry.get_clutter_text().get_text().trim().toLowerCase()
            : '';

        const category = this.#currentCategory;
        const results = [];

        for (const item of this.#emojiData) {
            if (category !== 'All' && item.category !== category) {
                continue;
            }

            if (query) {
                const fields = [
                    item.emoji,
                    item.description,
                    ...(item.aliases || []),
                    ...(item.tags || []),
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();

                if (!fields.includes(query)) {
                    continue;
                }
            }

            results.push(item);
            if (results.length >= MAX_VISIBLE_EMOJIS) {
                break;
            }
        }

        this.#renderEmojis(results);
    }

    /**
     * Render emoji buttons
     *
     * @param {Array<object>} results
     * @returns {void}
     */
    #renderEmojis(results) {
        if (!this.#emojiGrid) {
            return;
        }

        for (const child of this.#emojiGrid.get_children()) {
            child.destroy();
        }

        for (const item of results) {
            const label = new St.Label({
                text: item.emoji,
                y_align: Clutter.ActorAlign.CENTER,
                x_align: Clutter.ActorAlign.CENTER,
            });

            const button = new St.Button({
                style_class: 'emoji-button',
                can_focus: true,
                child: label,
                x_expand: false,
            });

            button.set_accessible_name(item.description ?? item.emoji);
            button.connect('clicked', () => this.#handleEmojiSelected(item));

            this.#emojiGrid.add_child(button);
        }
    }

    /**
     * Handle emoji selection (copy + toast)
     *
     * @param {{emoji: string, description?: string}} item
     * @returns {void}
     */
    #handleEmojiSelected(item) {
        if (this.#clipboard) {
            this.#clipboard.set_text(St.ClipboardType.CLIPBOARD, item.emoji);
            this.#clipboard.set_text(St.ClipboardType.PRIMARY, item.emoji);
        }

        Main.notify('Emoji Picker', `${item.emoji} copied to clipboard`);
        this.#togglePopup(true);
    }

    /**
     * Toggle popup visibility
     *
     * @returns {void}
     */
    #togglePopup(forceHide = false) {
        if (!this.#popup) {
            return;
        }

        const shouldShow = !forceHide && !this.#popup.visible;
        if (shouldShow) {
            this.#openPopup();
        } else if (this.#popup.visible) {
            this.#closePopup();
        }
    }

    /**
     * Open popup
     *
     * @returns {void}
     */
    #openPopup() {
        this.#queueFilter(true);
        this.#popup.opacity = 0;
        this.#popup.show();
        this.#popup.ease({
            opacity: 255,
            duration: 150,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this.#repositionPopup();
            this.#searchEntry?.grab_key_focus();
            return GLib.SOURCE_REMOVE;
        });

        this.#ensureStageMonitor();
    }

    /**
     * Close popup
     *
     * @returns {void}
     */
    #closePopup() {
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
     * Keep popup centered in the primary monitor
     *
     * @returns {void}
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
     * Monitor stage clicks to close popup when clicking outside
     *
     * @returns {void}
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
     * Disconnect outside-click monitor
     *
     * @returns {void}
     */
    #disconnectStageMonitor() {
        if (this.#stageClickId && global.stage) {
            global.stage.disconnect(this.#stageClickId);
            this.#stageClickId = 0;
        }
    }

    /**
     * Load emoji dataset from disk (emoji.json) or fallback data
     *
     * @returns {Array<object>}
     */
    #loadEmojiData() {
        const file = this.dir.get_child('emoji.json');
        if (file && file.query_exists(null)) {
            try {
                return this.#loadEmojiJson(file);
            } catch (error) {
                logError(error, 'emoji-picker: failed to parse emoji.json');
            }
        }

        log('emoji-picker: using built-in fallback emoji list');
        return this.#fallbackEmojiData();
    }

    /**
     * Parse emoji.json file
     *
     * @param {Gio.File} file
     * @returns {Array<object>}
     */
    #loadEmojiJson(file) {
        const [success, bytes] = file.load_contents(null);
        if (!success) {
            return this.#fallbackEmojiData();
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
    #fallbackEmojiData() {
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
     * Build category list including "All"
     *
     * @returns {string[]}
     */
    #collectCategories() {
        const set = new Set(['All']);
        for (const item of this.#emojiData) {
            if (item.category) {
                set.add(item.category);
            }
        }
        return Array.from(set);
    }

    /**
     * Resolve display label for category button
     *
     * @param {string} category
     * @returns {string}
     */
    #labelForCategory(category) {
        if (category === 'All') {
            return '★';
        }
        return CATEGORY_EMOJI[category] ?? category[0] ?? '?';
    }

    /**
     * Apply theme style based on preference
     *
     * @returns {void}
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
