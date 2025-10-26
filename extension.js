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
import { POPUP_WIDTH, POPUP_HEIGHT, POPUP_SIZE_MODES } from './core/constants.js';
import { loadEmojiData, collectCategories } from './core/emojiData.js';
import { UsageTracker } from './core/usageTracker.js';
import { KeybindingManager } from './core/keybindingManager.js';
import { SearchManager } from './core/searchManager.js';
import { CategoryManager } from './core/categoryManager.js';
import { EmojiRenderer } from './core/emojiRenderer.js';
import { ClipboardManager } from './core/clipboardManager.js';
import { PopupSizeManager } from './core/popupSizeManager.js';

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

    /** @type {PopupSizeManager|null} */
    #popupSizeManager = null;

    /**
     * Get popup dimensions based on size mode
     * @returns {{width: number, height: number}}
     */
    #getPopupDimensions() {
        if (this.#popupSizeManager) {
            const dims = this.#popupSizeManager.getDimensions();
            return {
                width: dims.width,
                height: dims.height
            };
        }
        
        // Fallback if manager not initialized
        const sizeMode = this.#settings.get_string('popup-size-mode') || 'default';
        if (sizeMode === 'custom') {
            return {
                width: this.#settings.get_int('popup-width'),
                height: this.#settings.get_int('popup-height')
            };
        }
        
        const preset = POPUP_SIZE_MODES[sizeMode] || POPUP_SIZE_MODES.default;
        return {
            width: preset.width,
            height: preset.height
        };
    }

    /**
     * Enable extension
     */
    enable() {
        this.#settings = this.getSettings();
        this.#emojiData = loadEmojiData(this.dir);

        // Initialize modules
        this.#usageTracker = new UsageTracker(this.#settings);
        this.#clipboardManager = new ClipboardManager(this.#settings);
        this.#popupSizeManager = new PopupSizeManager(
            this.#settings,
            (dimensions) => this.#onPopupSizeChange(dimensions)
        );
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

        if (this.#popupSizeManager) {
            this.#popupSizeManager.destroy();
            this.#popupSizeManager = null;
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

        // Direct click handler fallback in case menu events are not firing
        this.#button.connect('button-press-event', (_actor, event) => {
            try {
                log('emoji-picker: panel button clicked (button-press-event)');
                this.#togglePopup();
            } catch (e) {
                log(`emoji-picker: error in panel click handler: ${e}`);
            }
            return Clutter.EVENT_STOP;
        });

        // Use the menu property to detect when button is clicked (existing behavior)
        if (this.#button.menu) {
            this.#button.menu.connect('open-state-changed', (menu, open) => {
                if (open) {
                    log('emoji-picker: Menu opened, showing popup');
                    menu.close(false);  // Close the menu immediately
                    this.#togglePopup();
                }
            });
        }

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
        log('emoji-picker: Starting #buildPopup');
        if (this.#popup) {
            log('emoji-picker: Popup already exists');
            return;
        }

        log('emoji-picker: Creating popup container');
        // Get dimensions based on size mode
        const dimensions = this.#getPopupDimensions();
        
        // Create main container
        const container = new St.BoxLayout({
            vertical: true,
            style_class: 'emoji-picker-popup',
            width: dimensions.width,
            height: dimensions.height,
        });

        // Add drag handle header with buttons
        const headerBox = new St.BoxLayout({
            style_class: 'emoji-picker-header',
            x_expand: true,
        });

        // Left: Native menu button
        const menuButton = new St.Button({
            style_class: 'titlebutton',
            reactive: true,
            can_focus: true,
            track_hover: true,
        });
        // Use symbolic icon name so Shell can recolor it for the current theme
        const menuIcon = new St.Icon({
            icon_name: 'open-menu-symbolic',
            icon_size: 16,
            style_class: 'system-status-icon',
        });
        menuButton.set_child(menuIcon);
        menuButton.connect('clicked', () => {
            log('emoji-picker: Menu button clicked');
            // TODO: Show menu/help options
        });

        // Spacer to help center the drag handle
        const leftSpacer = new St.Widget({ x_expand: true });

        // Center drag handle with bar indicator
        const dragHandle = new St.Widget({
            style_class: 'emoji-picker-drag-handle',
            reactive: true,
            track_hover: true,
        });

        const rightSpacer = new St.Widget({ x_expand: true });

        // Right: Native close button
        const closeButton = new St.Button({
            style_class: 'titlebutton',
            reactive: true,
            can_focus: true,
            track_hover: true,
        });
        // Use symbolic icon name so Shell can recolor it for the current theme
        const closeIcon = new St.Icon({
            icon_name: 'window-close-symbolic',
            icon_size: 16,
            style_class: 'system-status-icon',
        });
        closeButton.set_child(closeIcon);
        closeButton.connect('clicked', () => {
            log('emoji-picker: Close button clicked');
            this.#togglePopup(true);
        });

        headerBox.add_child(menuButton);
        headerBox.add_child(leftSpacer);
        headerBox.add_child(dragHandle);
        headerBox.add_child(rightSpacer);
        headerBox.add_child(closeButton);

        container.add_child(headerBox);

        // Get categories
        const categories = collectCategories(this.#emojiData);
        log(`emoji-picker: Categories for tabs: ${JSON.stringify(categories)}`);

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

        // Apply layout class based on emojis per row
        this.#emojiGrid.add_style_class_name(`emoji-layout-${dimensions.emojisPerRow}`);

        this.#scrollView.set_child(this.#emojiGrid);

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

        // Initialize emoji renderer with dynamic emojis per row
        const popupDims = this.#getPopupDimensions();
        this.#emojiRenderer = new EmojiRenderer(
            this.#emojiGrid,
            (item) => {
                this.#handleEmojiSelected(item);
            },
            popupDims.emojisPerRow
        );

    // Build layout: search bar first, then category tabs, then the scrollable grid
    container.add_child(this.#searchEntry);
    container.add_child(categoryTabs);
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

        // Add drag functionality to the handle
        this.#setupDragHandle(dragHandle);

        // Apply theme
        this.#applyTheme();

        // Initial render
        this.#renderEmojisByCategory();
    }

    /**
     * Setup drag functionality for the handle
     * @param {St.Widget} dragHandle - The drag handle widget
     */
    #setupDragHandle(dragHandle) {
        // Use stage-level listeners so dragging continues even if the cursor leaves the handle
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let popupStartX = 0;
        let popupStartY = 0;
        let stageMotionId = 0;
        let stageReleaseId = 0;

        const beginDrag = (x, y) => {
            startX = x;
            startY = y;
            [popupStartX, popupStartY] = this.#popup.get_position();
            dragging = true;
            dragHandle.add_style_class_name('dragging');

            // Connect stage motion and release so we continue to receive events
            if (global.stage && !stageMotionId) {
                stageMotionId = global.stage.connect('motion-event', (_actor, event) => {
                    const [cx, cy] = event.get_coords ? event.get_coords() : global.get_pointer();
                    const deltaX = cx - startX;
                    const deltaY = cy - startY;
                    this.#popup.set_position(popupStartX + deltaX, popupStartY + deltaY);
                    return Clutter.EVENT_STOP;
                });
            }

            if (global.stage && !stageReleaseId) {
                stageReleaseId = global.stage.connect('button-release-event', () => {
                    endDrag();
                    return Clutter.EVENT_STOP;
                });
            }
        };

        const endDrag = () => {
            dragging = false;
            if (stageMotionId && global.stage) {
                try { global.stage.disconnect(stageMotionId); } catch (e) {}
                stageMotionId = 0;
            }
            if (stageReleaseId && global.stage) {
                try { global.stage.disconnect(stageReleaseId); } catch (e) {}
                stageReleaseId = 0;
            }
            try { dragHandle.remove_style_class_name('dragging'); } catch (e) {}
        };

        dragHandle.connect('button-press-event', (_actor, event) => {
            if (event.get_button() !== 1) return Clutter.EVENT_PROPAGATE;

            const [x, y] = event.get_coords ? event.get_coords() : global.get_pointer();
            beginDrag(x, y);

            return Clutter.EVENT_STOP;
        });

        // Also support touch / gesture release on the handle itself as a fallback
        dragHandle.connect('button-release-event', () => {
            endDrag();
            return Clutter.EVENT_STOP;
        });
    }

    /**
     * Handle drag motion
     */
    #onDragMotion(startX, startY, popupStartX, popupStartY) {
        const [currentX, currentY] = global.get_pointer();
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;

        this.#popup.set_position(
            popupStartX + deltaX,
            popupStartY + deltaY
        );

        return true;
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
     * Handle popup size change
     * When user changes size mode, rebuild the popup
     *
     * @param {{width: number, height: number}} dimensions
     */
    #onPopupSizeChange(dimensions) {
        log(`emoji-picker: Popup size changed to ${dimensions.width}x${dimensions.height}, emojis per row: ${dimensions.emojisPerRow}`);
        if (this.#popup) {
            this.#destroyPopup();
            this.#buildPopup();
            
            // Apply the appropriate emoji layout CSS class based on emojis per row
            const layoutClass = `emoji-layout-${dimensions.emojisPerRow}`;
            this.#emojiGrid.add_style_class_name(layoutClass);
        }
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
        log(`emoji-picker: #togglePopup called, forceHide=${forceHide}, popup=${this.#popup ? 'exists' : 'null'}`);
        
        // Handle forceHide
        if (forceHide) {
            if (this.#popup && this.#popup.visible) {
                log('emoji-picker: Hiding popup (forced)');
                this.#hidePopup();
            }
            return;
        }

        // If popup doesn't exist or is hidden, show it
        if (!this.#popup || !this.#popup.visible) {
            log('emoji-picker: Showing popup');
            this.#showPopup();
        } else {
            log('emoji-picker: Popup is visible, hiding');
            this.#hidePopup();
        }
    }

    /**
     * Show popup
     */
    #showPopup() {
        log('emoji-picker: #showPopup called');
        if (!this.#popup) {
            log('emoji-picker: Building popup...');
            this.#buildPopup();
        }

        log('emoji-picker: Showing popup');
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

        // Note: Stage monitor disabled - popup only closes via close button
        // this.#ensureStageMonitor();
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
