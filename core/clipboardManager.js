/**
 * Clipboard Manager
 * Handles copying and pasting emojis
 *
 * @author     Ashu <ashu@example.local>
 * @copyright  2025
 * @license    GPL-3.0-only
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class ClipboardManager {
    #clipboard;
    #settings;

    /**
     * @param {Gio.Settings} settings
     */
    constructor(settings) {
        this.#settings = settings;
        this.#clipboard = St.Clipboard.get_default();
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
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            // Method 1: Try using xdotool
            if (this.#tryXdotoolPaste()) {
                return GLib.SOURCE_REMOVE;
            }

            // Method 2: Try virtual keyboard
            if (this.#tryVirtualKeyboardPaste()) {
                return GLib.SOURCE_REMOVE;
            }

            // Method 3: Try direct Meta paste
            this.#tryMetaPaste();

            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Try pasting using xdotool
     *
     * @returns {boolean} Success
     */
    #tryXdotoolPaste() {
        try {
            const [, , , exitStatus] = GLib.spawn_command_line_sync('which xdotool');
            if (exitStatus === 0) {
                GLib.spawn_command_line_async('xdotool key --clearmodifiers ctrl+v');
                return true;
            }
        } catch (e) {
            // xdotool not available
        }
        return false;
    }

    /**
     * Try pasting using virtual keyboard
     *
     * @returns {boolean} Success
     */
    #tryVirtualKeyboardPaste() {
        try {
            const seat = Clutter.get_default_backend().get_default_seat();
            const virtualDevice = seat?.create_virtual_device?.(Clutter.InputDeviceType.KEYBOARD_DEVICE);
            
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
        } catch (e) {
            log(`emoji-picker: virtual keyboard paste failed: ${e}`);
        }
        return false;
    }

    /**
     * Try pasting using Meta
     */
    #tryMetaPaste() {
        try {
            const display = global.display;
            const focus = display.get_focus_window();
            
            if (focus) {
                Meta.keybindings_set_custom_handler('paste-from-clipboard', () => {
                    return true;
                });
            }
        } catch (e) {
            log(`emoji-picker: Meta paste failed: ${e}`);
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
}
