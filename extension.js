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
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

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
     * Popup box
     *
     * @type {St.BoxLayout|null}
     */
    #popup = null;

    /**
     * Enable extension
     *
     * @returns {void}
     */
    enable() {
        // Get settings
        const settings = this.getSettings();

        // Create panel button
        this.#button = new PanelMenu.Button(0.0, this.metadata.uuid);
        const icon = new St.Icon({
            icon_name: 'face-smile-symbolic',
            style_class: 'system-status-icon',
        });
        this.#button.add_child(icon);

        // Create popup
        this.#popup = new St.BoxLayout({
            style_class: 'hello-world-popup',
            vertical: true,
            reactive: true,
        });

        const label = new St.Label({
            text: 'Hello World!',
            style_class: 'hello-world-label',
        });

        this.#popup.add_child(label);
        // Add popup to the top-level UI group in a way that's compatible
        // across GNOME Shell versions. Prefer the modern add_child APIs
        // and only call add_actor as a last-resort fallback (some builds
        // expose an add_actor property that's not callable).
        try {
            if (Main.layoutManager && Main.layoutManager.uiGroup &&
                typeof Main.layoutManager.uiGroup.add_child === 'function') {
                Main.layoutManager.uiGroup.add_child(this.#popup);
            } else if (Main.uiGroup && typeof Main.uiGroup.add_child === 'function') {
                Main.uiGroup.add_child(this.#popup);
            } else if (typeof globalThis !== 'undefined' && globalThis.stage &&
                typeof globalThis.stage.add_child === 'function') {
                globalThis.stage.add_child(this.#popup);
            } else if (Main.uiGroup && typeof Main.uiGroup.add_actor === 'function') {
                // last resort: some very old shells use add_actor
                Main.uiGroup.add_actor(this.#popup);
            } else {
                log('emoji-picker: could not add popup to uiGroup (no compatible API)');
            }
        } catch (e) {
            log('emoji-picker: error adding popup to uiGroup: ' + e);
        }

        this.#popup.hide();

        // Register keybinding
        Main.wm.addKeybinding(
            'emoji-keybinding',
            settings,
            GLib.ModifierType.SUPER_MASK,
            GLib.ModifierType.RELEASE_MASK,
            () => this._togglePopup()
        );

        // Connect button click
        this.#button.connect('button-press-event', () => this._togglePopup());

        // Add button to panel
        Main.panel.addToStatusArea(this.metadata.uuid, this.#button, 1, 'right');
    }

    /**
     * Disable extension
     *
     * @returns {void}
     */
    disable() {
        Main.wm.removeKeybinding('emoji-keybinding');

        if (this.#popup) {
            this.#popup.destroy();
            this.#popup = null;
        }

        if (this.#button) {
            this.#button.destroy();
            this.#button = null;
        }
    }

    /**
     * Toggle popup visibility
     *
     * @returns {void}
     */
    _togglePopup() {
        if (!this.#popup) return;

        if (this.#popup.visible) {
            this.#popup.hide();
        } else {
            const monitor = Main.layoutManager.primaryMonitor;
            this.#popup.set_position(
                monitor.x + monitor.width / 2 - 100,
                monitor.y + monitor.height / 2 - 50
            );
            this.#popup.show();
        }
    }
}
