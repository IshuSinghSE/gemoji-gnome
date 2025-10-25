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
const POPUP_HEIGHT = 600;

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

    /** @type {Clutter.GridLayout|null} */
    #gridLayout = null;

    /** @type {Map<string, St.Button>} */
    #categoryButtons = new Map();

    /** @type {string} */
    #currentCategory = 'Smileys & Emotion';

    /** @type {Map<string, number>} */
    #emojiUsageCount = new Map();

    /** @type {Map<string, St.Widget>} */
    #categorySections = new Map();

    /** @type {St.ScrollView|null} */
    #scrollView = null;

    /** @type {St.Adjustment|null} */
    #scrollAdjustment = null;

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
        this.#loadUsageData();

        // Create panel button (only if show-indicator is true)
        if (this.#settings.get_boolean('show-indicator')) {
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

            // Add button to panel
            Main.panel.addToStatusArea(this.metadata.uuid, this.#button, 1, 'right');
        }

        this.#popup = this.#buildPopup();
        this.#popup.hide();
        Main.layoutManager.addChrome(this.#popup, {
            affectsStruts: false,
            affectsInputRegion: true,
        });

        this.#settingsChangedId = this.#settings.connect('changed', (settings, key) => this.#onSettingsChanged(key));
        this.#applyTheme();

        // Register keybinding only if use-keybind is true
        if (this.#settings.get_boolean('use-keybind')) {
            try {
                this.#registerKeybinding();
            } catch (error) {
                logError(error, 'emoji-picker: failed to register keybinding');
            }
        }
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
        this.#searchEntry = null;
        this.#emojiGrid = null;
        this.#gridLayout = null;
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
    popup.set_size(POPUP_WIDTH, POPUP_HEIGHT);

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
        }

        if (!searchText || typeof searchText.connect !== 'function') {
            if (typeof this.#searchEntry.connect === 'function') {
                this.#searchEntry.connect('notify::text', () => this.#queueFilter());
                this.#searchEntry.connect('text-changed', () => this.#queueFilter());
            }
        }

        // Category tabs at top
        const categories = this.#collectCategories();
        popup.add_child(this.#buildCategoryTabs(categories));

        popup.add_child(this.#searchEntry);

        // Emoji grid inside scroll view
        this.#scrollView = new St.ScrollView({
            style_class: 'emoji-scroll',
            overlay_scrollbars: true,
        });
        this.#scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);

        // Defer attaching scroll listeners until the actor is realized.
        // Different GNOME Shell versions expose the vertical scrollbar differently,
        // so try several accessors and fall back to a generic scroll-event.
        GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            try {
                let vScroll = null;

                if (this.#scrollView && typeof this.#scrollView.get_vscroll_bar === 'function') {
                    vScroll = this.#scrollView.get_vscroll_bar();
                } else if (this.#scrollView && typeof this.#scrollView.get_vscrollbar === 'function') {
                    vScroll = this.#scrollView.get_vscrollbar();
                } else if (this.#scrollView && this.#scrollView.vscroll_bar) {
                    vScroll = this.#scrollView.vscroll_bar;
                } else if (this.#scrollView && this.#scrollView.vscroll) {
                    vScroll = this.#scrollView.vscroll;
                }

                if (vScroll && typeof vScroll.get_adjustment === 'function') {
                    this.#scrollAdjustment = vScroll.get_adjustment();
                    if (this.#scrollAdjustment && typeof this.#scrollAdjustment.connect === 'function') {
                        this.#scrollAdjustment.connect('notify::value', () => this.#onScroll());
                    }
                } else if (this.#scrollView && typeof this.#scrollView.connect === 'function') {
                    // Fallback: connect to scroll-event if scrollbar API isn't available
                    try {
                        this.#scrollView.connect('scroll-event', () => {
                            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                                this.#onScroll();
                                return GLib.SOURCE_REMOVE;
                            });
                            return Clutter.EVENT_PROPAGATE;
                        });
                    } catch (e) {
                        log(`emoji-picker: failed to attach scroll-event: ${e}`);
                    }
                }
            } catch (e) {
                log(`emoji-picker: error initializing scroll listener: ${e}`);
            }

            return GLib.SOURCE_REMOVE;
        });

        // Use a vertical BoxLayout to hold rows of emojis
        this.#emojiGrid = new St.BoxLayout({
            vertical: true,
            style_class: 'emoji-grid',
        });

        // Use add_child for newer GNOME Shell, with fallback to add_actor
        if (typeof this.#scrollView.add_child === 'function') {
            this.#scrollView.add_child(this.#emojiGrid);
        } else if (typeof this.#scrollView.add_actor === 'function') {
            this.#scrollView.add_actor(this.#emojiGrid);
        }
        
        popup.add_child(this.#scrollView);
        return popup;
    }

    /**
     * Build category tabs (like EmojiMart)
     *
     * @param {string[]} categories
     * @returns {St.Widget}
     */
    #buildCategoryTabs(categories) {
        const tabBar = new St.BoxLayout({
            style_class: 'emoji-category-tabs',
            x_expand: true,
        });

        this.#categoryButtons.clear();

        // Add "Frequently Used" tab first
        const frequentIcon = new St.Icon({
            icon_name: this.#getCategoryIconName('Frequently Used'),
            icon_size: 18,
            style_class: 'emoji-category-icon',
        });
        const frequentButton = new St.Button({
            style_class: 'emoji-category-tab',
            child: frequentIcon,
            can_focus: true,
        });
        
        if (typeof frequentButton.set_tooltip_text === 'function') {
            frequentButton.set_tooltip_text('Frequently Used');
        }
        
        frequentButton.connect('clicked', () => this.#setCategory('Frequently Used'));
        this.#categoryButtons.set('Frequently Used', frequentButton);
        tabBar.add_child(frequentButton);

        for (const category of categories) {
            const icon = new St.Icon({
                icon_name: this.#getCategoryIconName(category),
                icon_size: 18,
                style_class: 'emoji-category-icon',
            });
            const button = new St.Button({
                style_class: 'emoji-category-tab',
                child: icon,
                can_focus: true,
            });
            
            if (typeof button.set_tooltip_text === 'function') {
                button.set_tooltip_text(category);
            }
            
            button.connect('clicked', () => this.#setCategory(category));
            this.#categoryButtons.set(category, button);
            tabBar.add_child(button);
        }

        this.#updateCategoryStates();
        return tabBar;
    }

    /**
     * Get icon file name for category
     *
     * @param {string} category
     * @returns {string}
     */
    #getCategoryIconName(category) {
        const iconNames = {
            'Frequently Used': 'emoji-recent-symbolic',
            'Smileys & Emotion': 'emoji-people-symbolic',
            'People & Body': 'emoji-body-symbolic',
            'Animals & Nature': 'emoji-nature-symbolic',
            'Food & Drink': 'emoji-food-symbolic',
            'Travel & Places': 'emoji-travel-symbolic',
            'Activities': 'emoji-activities-symbolic',
            'Objects': 'emoji-objects-symbolic',
            'Symbols': 'emoji-symbols-symbolic',
            'Flags': 'emoji-flags-symbolic',
        };
        return iconNames[category] || 'emoji-recent-symbolic';
    }

    /**
     * Set active category
     *
     * @param {string} category
     * @returns {void}
     */
    #setCategory(category) {
        this.#currentCategory = category;
        this.#updateCategoryStates();
        
        // Scroll to the category section after a small delay to ensure layout is ready
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            const section = this.#categorySections.get(category);
            if (section && this.#scrollView && this.#scrollAdjustment) {
                try {
                    // Get the position of the category header relative to the grid
                    const allocation = section.get_allocation_box();
                    const sectionY = allocation.y1;
                    
                    // Scroll to that position
                    this.#scrollAdjustment.set_value(Math.max(0, sectionY - 10));
                } catch (e) {
                    log(`emoji-picker: error scrolling to category: ${e}`);
                }
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Handle scroll events to update active category
     *
     * @returns {void}
     */
    #onScroll() {
        if (!this.#scrollView || !this.#emojiGrid || !this.#scrollAdjustment) {
            return;
        }

        const scrollY = this.#scrollAdjustment.get_value();

        // Find which category section is currently visible at the top
        let activeCategory = null;
        let minDistance = Infinity;

        for (const [category, section] of this.#categorySections.entries()) {
            const allocation = section.get_allocation_box();
            const sectionY = allocation.y1;
            
            // Check if this section is at or above the current scroll position
            if (sectionY <= scrollY + 50) {
                const distance = scrollY - sectionY;
                if (distance >= 0 && distance < minDistance) {
                    minDistance = distance;
                    activeCategory = category;
                }
            }
        }

        if (activeCategory && activeCategory !== this.#currentCategory) {
            this.#currentCategory = activeCategory;
            this.#updateCategoryStates();
        }
    }

    /**
     * Update category button states
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
     * Load usage data from persistent storage
     *
     * @returns {void}
     */
    #loadUsageData() {
        try {
            const usageJson = this.#settings.get_string('emoji-usage-counts');
            if (usageJson) {
                const usageObj = JSON.parse(usageJson);
                this.#emojiUsageCount = new Map(Object.entries(usageObj));
            }
        } catch (e) {
            log(`Failed to load emoji usage data: ${e}`);
            this.#emojiUsageCount = new Map();
        }
    }

    /**
     * Save usage data to persistent storage
     *
     * @returns {void}
     */
    #saveUsageData() {
        try {
            const usageObj = Object.fromEntries(this.#emojiUsageCount);
            const usageJson = JSON.stringify(usageObj);
            this.#settings.set_string('emoji-usage-counts', usageJson);
        } catch (e) {
            log(`Failed to save emoji usage data: ${e}`);
        }
    }

    /**
     * Get frequently used emojis sorted by usage count
     *
     * @returns {Array<{emoji: string, description: string, category: string, aliases: string[], tags: string[]}>}
     */
    #getFrequentlyUsed() {
        // Sort emojis by usage count
        const sortedEntries = Array.from(this.#emojiUsageCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30); // Top 30 most used

        // Map emoji strings back to full emoji objects
        const frequentEmojis = [];
        for (const [emojiChar, count] of sortedEntries) {
            const emojiObj = this.#emojiData.find(e => e.emoji === emojiChar);
            if (emojiObj) {
                frequentEmojis.push(emojiObj);
            }
        }

        return frequentEmojis;
    }

    /**
     * Track emoji usage
     *
     * @param {string} emoji
     * @returns {void}
     */
    #trackEmojiUsage(emoji) {
        const currentCount = this.#emojiUsageCount.get(emoji) || 0;
        this.#emojiUsageCount.set(emoji, currentCount + 1);
        this.#saveUsageData();
    }

    /**
     * Collect unique categories from emoji data
     *
     * @returns {string[]}
     */
    #collectCategories() {
        const categories = new Set();
        for (const item of this.#emojiData) {
            if (item.category) {
                categories.add(item.category);
            }
        }
        return Array.from(categories);
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

        const query = this.#getSearchQuery();

        // If searching, show filtered results without category headers
        if (query) {
            const results = [];
            for (const item of this.#emojiData) {
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
            this.#renderEmojis(results);
            return;
        }

        // If not searching, show all emojis grouped by category with headers
        this.#renderEmojisByCategory();
    }

    /**
     * Render emojis grouped by category with headers (like EmojiMart)
     *
     * @returns {void}
     */
    #renderEmojisByCategory() {
        if (!this.#emojiGrid) {
            return;
        }

        // Clear existing content
        const children = this.#emojiGrid.get_children();
        for (const child of children) {
            this.#emojiGrid.remove_child(child);
            child.destroy();
        }

        // Clear category section references
        this.#categorySections.clear();

        const EMOJIS_PER_ROW = 10;

        // Group emojis by category
        const categorizedEmojis = new Map();
        
        // Add frequently used first
        const frequentEmojis = this.#getFrequentlyUsed();
        if (frequentEmojis.length > 0) {
            categorizedEmojis.set('Frequently Used', frequentEmojis);
        }

        // Group other emojis by their category
        for (const item of this.#emojiData) {
            const category = item.category || 'Other';
            if (!categorizedEmojis.has(category)) {
                categorizedEmojis.set(category, []);
            }
            categorizedEmojis.get(category).push(item);
        }

        // Render each category with header
        for (const [category, emojis] of categorizedEmojis.entries()) {
            if (emojis.length === 0) continue;

            // Add category header
            const header = new St.Label({
                text: category,
                style_class: 'emoji-category-header',
                x_expand: true,
            });
            this.#emojiGrid.add_child(header);
            
            // Store reference to this category section
            this.#categorySections.set(category, header);

            // Add emojis in rows
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

                const button = new St.Button({
                    style_class: 'emoji-button',
                    label: item.emoji,
                    can_focus: true,
                    x_expand: false,
                    y_expand: false,
                });

                button.set_accessible_name(item.description ?? item.emoji);
                button.connect('clicked', () => this.#handleEmojiSelected(item));

                currentRow.add_child(button);
                emojiCount++;
            }
        }

        this.#emojiGrid.show();
        this.#emojiGrid.queue_relayout();
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

        // Properly remove all children first
        const children = this.#emojiGrid.get_children();
        for (const child of children) {
            this.#emojiGrid.remove_child(child);
            child.destroy();
        }

        const EMOJIS_PER_ROW = 10;
        let currentRow = null;
        let emojiCount = 0;

        for (const item of results) {
            // Create a new row every EMOJIS_PER_ROW emojis
            if (emojiCount % EMOJIS_PER_ROW === 0) {
                currentRow = new St.BoxLayout({
                    vertical: false,
                    style_class: 'emoji-row',
                    x_expand: true,
                });
                this.#emojiGrid.add_child(currentRow);
            }

            const button = new St.Button({
                style_class: 'emoji-button',
                label: item.emoji,
                can_focus: true,
                x_expand: false,
                y_expand: false,
            });

            button.set_accessible_name(item.description ?? item.emoji);
            button.connect('clicked', () => this.#handleEmojiSelected(item));

            currentRow.add_child(button);
            emojiCount++;
        }
        
        // Force the grid to show and queue a relayout
        this.#emojiGrid.show();
        this.#emojiGrid.queue_relayout();
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

        // Track usage
        this.#trackEmojiUsage(item.emoji);

        // Paste on select if enabled
        if (this.#settings && this.#settings.get_boolean('paste-on-select')) {
            this.#pasteEmoji();
        }

        Main.notify('Emoji Picker', `${item.emoji} copied to clipboard`);
        this.#togglePopup(true);
    }

    /**
     * Paste emoji at cursor position
     *
     * @returns {void}
     */
    #pasteEmoji() {
        try {
            // Use a small delay to allow the window to be focused
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                try {
                    // Method 1: Try using xdotool (most reliable)
                    try {
                        GLib.spawn_command_line_async('xdotool key --clearmodifiers ctrl+v');
                        return GLib.SOURCE_REMOVE;
                    } catch (e) {
                        // xdotool not available, try virtual keyboard
                    }

                    // Method 2: Virtual keyboard device
                    const seat = Clutter.get_default_backend().get_default_seat();
                    if (seat && typeof seat.create_virtual_device === 'function') {
                        const virtualDevice = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
                        
                        // Small delay between key events
                        const delay = 20;
                        
                        // Press Control
                        virtualDevice.notify_key(
                            Clutter.get_current_event_time(),
                            Clutter.KEY_Control_L,
                            Clutter.KeyState.PRESSED
                        );
                        
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
                            // Press V
                            virtualDevice.notify_key(
                                Clutter.get_current_event_time(),
                                Clutter.KEY_v,
                                Clutter.KeyState.PRESSED
                            );
                            
                            GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
                                // Release V
                                virtualDevice.notify_key(
                                    Clutter.get_current_event_time(),
                                    Clutter.KEY_v,
                                    Clutter.KeyState.RELEASED
                                );
                                
                                GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
                                    // Release Control
                                    virtualDevice.notify_key(
                                        Clutter.get_current_event_time(),
                                        Clutter.KEY_Control_L,
                                        Clutter.KeyState.RELEASED
                                    );
                                    return GLib.SOURCE_REMOVE;
                                });
                                return GLib.SOURCE_REMOVE;
                            });
                            return GLib.SOURCE_REMOVE;
                        });
                    }
                } catch (e) {
                    log(`emoji-picker: failed to paste emoji: ${e}`);
                }
                return GLib.SOURCE_REMOVE;
            });
        } catch (e) {
            log(`emoji-picker: failed to setup paste: ${e}`);
        }
    }

    /**
     * Handle settings changes
     *
     * @param {string} key - The settings key that changed
     * @returns {void}
     */
    #onSettingsChanged(key) {
        // Handle show-indicator changes
        if (key === 'show-indicator') {
            const showIndicator = this.#settings.get_boolean('show-indicator');
            if (showIndicator && !this.#button) {
                // Create and add button
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
                Main.panel.addToStatusArea(this.metadata.uuid, this.#button, 1, 'right');
            } else if (!showIndicator && this.#button) {
                // Remove button
                this.#button.destroy();
                this.#button = null;
            }
        }
        
        // Handle use-keybind changes
        if (key === 'use-keybind') {
            const useKeybind = this.#settings.get_boolean('use-keybind');
            if (useKeybind) {
                try {
                    this.#registerKeybinding();
                } catch (error) {
                    logError(error, 'emoji-picker: failed to register keybinding');
                }
            } else {
                this.#unregisterKeybinding();
            }
        }

        // Handle theme changes
        if (key === 'use-custom-theme') {
            this.#applyTheme();
        }

        // Handle keybinding changes
        if (key === 'emoji-keybinding') {
            this.#unregisterKeybinding();
            if (this.#settings.get_boolean('use-keybind')) {
                try {
                    this.#registerKeybinding();
                } catch (error) {
                    logError(error, 'emoji-picker: failed to register keybinding');
                }
            }
        }
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
        Main.notify('Debug', 'Opening popup, queuing filter');
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
            const entry = this.#searchEntry;
            if (entry) {
                if (typeof entry.grab_key_focus === 'function') {
                    entry.grab_key_focus();
                } else if (typeof entry.grab_focus === 'function') {
                    entry.grab_focus();
                } else {
                    const textActor = entry.get_clutter_text?.();
                    textActor?.grab_key_focus?.();
                }
            }
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
     * Resolve search entry text with compatibility fallbacks
     *
     * @returns {string}
     */
    #getSearchQuery() {
        const entry = this.#searchEntry;
        if (!entry) {
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

        if (typeof entry.get_text === 'function') {
            try {
                const value = entry.get_text();
                if (typeof value === 'string') {
                    raw = value;
                }
            } catch (error) {
                // Ignore and fall back to other accessors
            }
        }

        if (!raw) {
            raw = readText(entry.get_clutter_text?.());
        }

        if (!raw && entry.text !== undefined) {
            raw = String(entry.text);
        }

        return raw.trim().toLowerCase();
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
