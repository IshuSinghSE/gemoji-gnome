/**
 * Category Manager
 * Handles category navigation and scroll synchronization
 *
 * @author     Ashu <ashu@example.local>
 * @copyright  2025
 * @license    GPL-3.0-only
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import { CATEGORY_ICONS, CATEGORY_SCROLL_THRESHOLD, CATEGORY_SCROLL_DELAY } from './constants.js';

export class CategoryManager {
    #categoryButtons;
    #categorySections;
    #currentCategory;
    #scrollView;
    #scrollAdjustment;
    #onCategoryChangeCallback;
    #programmaticScroll; // Flag to prevent scroll listener during programmatic scroll

    /**
     * @param {St.ScrollView} scrollView
     * @param {Function} onCategoryChangeCallback - Called when category changes
     */
    constructor(scrollView, onCategoryChangeCallback) {
        this.#scrollView = scrollView;
        this.#onCategoryChangeCallback = onCategoryChangeCallback;
        this.#categoryButtons = new Map();
        this.#categorySections = new Map();
        this.#currentCategory = 'Frequently Used';
        this.#scrollAdjustment = null;
        this.#programmaticScroll = false;

        this.#setupScrollListener();
    }

    /**
     * Setup scroll listener for category synchronization
     */
    #setupScrollListener() {
        if (!this.#scrollView) {
            return;
        }

        // Wait for the widget to be realized before connecting
        this.#scrollView.connect('notify::realized', () => {
            if (this.#scrollView.vadjustment) {
                this.#scrollAdjustment = this.#scrollView.vadjustment;
                this.#scrollAdjustment.connect('notify::value', () => this.#onScroll());
                log('emoji-picker: Connected to vadjustment');
            } else if (this.#scrollView && typeof this.#scrollView.get_vscroll_bar === 'function') {
                const vScroll = this.#scrollView.get_vscroll_bar();
                if (vScroll) {
                    this.#scrollAdjustment = vScroll.get_adjustment();
                    if (this.#scrollAdjustment) {
                        this.#scrollAdjustment.connect('notify::value', () => this.#onScroll());
                        log('emoji-picker: Connected to scroll adjustment via vScroll');
                    }
                }
            } else if (this.#scrollView && typeof this.#scrollView.connect === 'function') {
                // Final fallback: connect to scroll-event
                this.#scrollView.connect('scroll-event', () => {
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                        this.#onScroll();
                        return GLib.SOURCE_REMOVE;
                    });
                    return false;
                });
                log('emoji-picker: Connected to scroll-event fallback');
            }
        });
    }

    /**
     * Handle scroll events to update active category
     */
    #onScroll() {
        // Skip during programmatic scrolling
        if (this.#programmaticScroll) {
            return;
        }

        if (!this.#scrollView || !this.#scrollAdjustment) {
            return;
        }

        const scrollY = this.#scrollAdjustment.get_value();

        // Find which category section is currently visible at the top
        let activeCategory = null;
        let minDistance = Infinity;

        for (const [category, section] of this.#categorySections.entries()) {
            try {
                const allocation = section.get_allocation_box();
                const sectionY = allocation.y1;
                
                // Check if this section is at or above the current scroll position
                if (sectionY <= scrollY + CATEGORY_SCROLL_THRESHOLD) {
                    const distance = scrollY - sectionY;
                    if (distance >= 0 && distance < minDistance) {
                        minDistance = distance;
                        activeCategory = category;
                    }
                }
            } catch (e) {
                // Skip if allocation fails
                continue;
            }
        }

        if (activeCategory && activeCategory !== this.#currentCategory) {
            this.#currentCategory = activeCategory;
            this.updateCategoryStates();
        }
    }

    /**
     * Build category tabs
     *
     * @param {Array<string>} categories
     * @param {Gio.File} extensionDir - For loading icons
     * @returns {St.BoxLayout}
     */
    buildCategoryTabs(categories, extensionDir) {
        log(`emoji-picker: buildCategoryTabs called with ${categories.length} categories: ${JSON.stringify(categories)}`);
        const tabBox = new St.BoxLayout({
            style_class: 'emoji-category-tabs',
            x_expand: true,
        });

        log(`emoji-picker: tabBox created, initial children count: ${tabBox.get_n_children()}`);

        for (const category of categories) {
            log(`emoji-picker: Creating tab for category: ${category}`);
            const iconName = this.#getCategoryIconName(category);
            log(`emoji-picker: Icon name: ${iconName}`);
            const iconFile = extensionDir.get_child('icons').get_child(`${iconName}.svg`);
            const iconPath = iconFile.get_path();
            log(`emoji-picker: Icon path: ${iconPath}`);

            // Load icon directly from file to avoid theme cache issues
            const gicon = Gio.FileIcon.new(iconFile);
            const icon = new St.Icon({
                style_class: 'emoji-category-icon',
                gicon: gicon,
                icon_size: 18,
            });

            const button = new St.Button({
                style_class: 'emoji-category-tab',
                child: icon,
                can_focus: true,
                track_hover: true,
            });

            button.connect('clicked', () => {
                log(`emoji-picker: Button clicked for category: "${category}"`);
                this.setCategory(category);
            });

            this.#categoryButtons.set(category, button);
            tabBox.add_child(button);
            log(`emoji-picker: Added button for "${category}", tabBox now has ${tabBox.get_n_children()} children`);
        }

        this.updateCategoryStates();
        log(`emoji-picker: Final tabBox children count: ${tabBox.get_n_children()}`);
        return tabBox;
    }

    /**
     * Get icon name for category
     *
     * @param {string} category
     * @returns {string}
     */
    #getCategoryIconName(category) {
        return CATEGORY_ICONS[category] || 'emoji-smileys-symbolic';
    }

    /**
     * Set active category and scroll to it
     *
     * @param {string} category
     */
    setCategory(category) {
        log(`emoji-picker: setCategory called with: "${category}"`);
        log(`emoji-picker: Previous currentCategory: "${this.#currentCategory}"`);
        this.#currentCategory = category;
        log(`emoji-picker: New currentCategory: "${this.#currentCategory}"`);
        this.updateCategoryStates();
        
        // Scroll to the category section after a small delay to ensure layout is ready
        // Use a programmatic scroll flag so the scroll listener doesn't override
        // the user-initiated category selection.
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, CATEGORY_SCROLL_DELAY, () => {
            const section = this.#categorySections.get(category);
            if (section) {
                try {
                    // Ensure we have the adjustment
                    if (!this.#scrollAdjustment && this.#scrollView) {
                        if (this.#scrollView.vadjustment) {
                            this.#scrollAdjustment = this.#scrollView.vadjustment;
                        }
                    }

                    if (this.#scrollAdjustment) {
                        // Mark programmatic scroll so #onScroll ignores it
                        this.#programmaticScroll = true;

                        // Get the position of the category header
                        const allocation = section.get_allocation_box();
                        const sectionY = allocation.y1;

                        // Scroll to that position
                        this.#scrollAdjustment.set_value(Math.max(0, sectionY - 10));

                        // Clear the flag shortly after to resume normal scroll handling
                        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
                            this.#programmaticScroll = false;
                            return GLib.SOURCE_REMOVE;
                        });
                    }
                } catch (e) {
                    log(`emoji-picker: error scrolling to category: ${e}`);
                    this.#programmaticScroll = false;
                }
            }
            return GLib.SOURCE_REMOVE;
        });

        // Notify the callback
        if (this.#onCategoryChangeCallback) {
            this.#onCategoryChangeCallback(category);
        }
    }

    /**
     * Update category button states (visual highlighting)
     */
    updateCategoryStates() {
        log(`emoji-picker: updateCategoryStates - highlighting category: "${this.#currentCategory}"`);
        log(`emoji-picker: Available category buttons: ${Array.from(this.#categoryButtons.keys()).join(', ')}`);
        for (const [category, button] of this.#categoryButtons) {
            if (category === this.#currentCategory) {
                log(`emoji-picker: Adding 'active' class to: "${category}"`);
                button.add_style_class_name('active');
            } else {
                button.remove_style_class_name('active');
            }
        }
    }

    /**
     * Register a category section (header widget)
     *
     * @param {string} category
     * @param {St.Widget} section
     */
    registerSection(category, section) {
        this.#categorySections.set(category, section);
    }

    /**
     * Clear all registered sections
     */
    clearSections() {
        this.#categorySections.clear();
    }

    /**
     * Get current category
     *
     * @returns {string}
     */
    getCurrentCategory() {
        return this.#currentCategory;
    }

    /**
     * Get category button
     *
     * @param {string} category
     * @returns {St.Button|undefined}
     */
    getButton(category) {
        return this.#categoryButtons.get(category);
    }
}
