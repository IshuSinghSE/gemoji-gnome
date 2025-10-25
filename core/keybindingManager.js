/**
 * Keybinding Manager
 * Handles keyboard shortcuts
 *
 * @author     Ashu <ashu@example.local>
 * @copyright  2025
 * @license    GPL-3.0-only
 */

import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class KeybindingManager {
    #settings;
    #keybindingName;
    #callback;
    #registered;

    /**
     * @param {Gio.Settings} settings
     * @param {string} keybindingName - Name of the keybinding setting
     * @param {Function} callback - Function to call when keybinding is pressed
     */
    constructor(settings, keybindingName, callback) {
        this.#settings = settings;
        this.#keybindingName = keybindingName;
        this.#callback = callback;
        this.#registered = false;
    }

    /**
     * Register the keybinding
     */
    register() {
        if (this.#registered) {
            return;
        }

        const useKeybind = this.#settings.get_boolean('use-keybind');
        if (!useKeybind) {
            return;
        }

        try {
            Main.wm.addKeybinding(
                this.#keybindingName,
                this.#settings,
                Meta.KeyBindingFlags.NONE,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
                this.#callback
            );
            this.#registered = true;
            log(`emoji-picker: keybinding registered: ${this.#keybindingName}`);
        } catch (error) {
            logError(error, `emoji-picker: failed to register keybinding: ${this.#keybindingName}`);
        }
    }

    /**
     * Unregister the keybinding
     */
    unregister() {
        if (!this.#registered) {
            return;
        }

        try {
            Main.wm.removeKeybinding(this.#keybindingName);
            this.#registered = false;
            log(`emoji-picker: keybinding unregistered: ${this.#keybindingName}`);
        } catch (error) {
            logError(error, `emoji-picker: failed to unregister keybinding: ${this.#keybindingName}`);
        }
    }

    /**
     * Check if keybinding is currently registered
     *
     * @returns {boolean}
     */
    isRegistered() {
        return this.#registered;
    }

    /**
     * Update keybinding registration based on settings
     */
    update() {
        const useKeybind = this.#settings.get_boolean('use-keybind');
        
        if (useKeybind && !this.#registered) {
            this.register();
        } else if (!useKeybind && this.#registered) {
            this.unregister();
        }
    }
}
