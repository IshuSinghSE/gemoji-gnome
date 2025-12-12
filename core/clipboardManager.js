/**
 * Clipboard Manager
 * Handles copying and pasting emojis
 *
 * @author     Ashu <ashu@example.local>
 * @copyright  2025
 * @license    GPL-3.0-only
 */

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class ClipboardManager {
    #clipboard;
    #settings;
    #timeoutIds = new Set();

    /**
     * @param {Gio.Settings} settings
     */
    constructor(settings) {
        this.#settings = settings;
        this.#clipboard = St.Clipboard.get_default();
    }

    /**
     * Add a timeout and track it
     * @param {number} interval
     * @param {Function} callback
     * @returns {number}
     */
    #addTimeout(interval, callback) {
        const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            const result = callback();
            if (result === GLib.SOURCE_REMOVE) {
                this.#timeoutIds.delete(id);
            }
            return result;
        });
        this.#timeoutIds.add(id);
        return id;
    }

    /**
     * Copy emoji to clipboard
     *
     * @param {string} emoji
     */
    copyToClipboard(emoji) {
        if (this.#clipboard) {
            this.#clipboard.set_text(St.ClipboardType.CLIPBOARD, emoji);
            this.#clipboard.set_text(St.ClipboardType.PRIMARY, emoji);
        }
    }

    /**
     * Paste emoji using appropriate method
     */
    pasteEmoji() {
        const pasteOnSelect = this.#settings?.get_boolean('paste-on-select') ?? false;
        if (!pasteOnSelect) {
            return;
        }

        // Try different paste methods
        this.#addTimeout(100, () => {
            // Method 1: Try virtual keyboard
            if (this.#tryVirtualKeyboardPaste()) {
                return GLib.SOURCE_REMOVE;
            }

            // Method 2: Try direct Meta paste
            this.#tryMetaPaste();

            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Try pasting using virtual keyboard
     *
     * @returns {boolean} Success
     */
    #tryVirtualKeyboardPaste() {
        // We use try-catch here because creating virtual device might fail on some backends
        // or permissions might be restricted
        try {
            const seat = Clutter.get_default_backend().get_default_seat();
            if (seat && seat.create_virtual_device) {
                const virtualDevice = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);

                if (virtualDevice) {
                    const ctrlKeyval = 65507; // Control_L
                    const vKeyval = 118; // v key

                    virtualDevice.notify_keyval(
                        Clutter.get_current_event_time(),
                        ctrlKeyval,
                        Clutter.KeyState.PRESSED
                    );
                    virtualDevice.notify_keyval(
                        Clutter.get_current_event_time(),
                        vKeyval,
                        Clutter.KeyState.PRESSED
                    );
                    virtualDevice.notify_keyval(
                        Clutter.get_current_event_time(),
                        vKeyval,
                        Clutter.KeyState.RELEASED
                    );
                    virtualDevice.notify_keyval(
                        Clutter.get_current_event_time(),
                        ctrlKeyval,
                        Clutter.KeyState.RELEASED
                    );
                    return true;
                }
            }
        } catch (e) {
            console.log(`emoji-picker: virtual keyboard paste failed: ${e}`);
        }
        return false;
    }

    /**
     * Try pasting using Meta
     */
    #tryMetaPaste() {
        // Standard API call, removing try-catch unless specific error expected
        const display = global.display;
        const focus = display.get_focus_window();

        if (focus) {
            // This API might not be available or might change, but for now we assume it exists if Meta is imported
            if (Meta.keybindings_set_custom_handler) {
                 Meta.keybindings_set_custom_handler('paste-from-clipboard', () => {
                    return true;
                });
            }
        }
    }

    /**
     * Show notification toast
     *
     * @param {string} message
     */
    showToast(message) {
        Main.notify('Emoji Picker', message);
    }

    /**
     * Destroy manager
     */
    destroy() {
        // Clear all timeouts
        for (const id of this.#timeoutIds) {
            if (id) {
                GLib.source_remove(id);
            }
        }
        this.#timeoutIds.clear();
        this.#settings = null;
        this.#clipboard = null;
    }
}
