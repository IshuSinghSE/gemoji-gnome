/**
 * Preferences Dialog
 *
 * @author     Ashu <ashu@example.local>
 * @copyright  2025
 * @license    GPL-3.0-only
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

/**
 * Preferences window entry point
 */
export default class EmojiPickerPrefs extends ExtensionPreferences {
    /**
     * Fill preferences window
     *
     * @returns {void}
     */
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Create main preferences page
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'emoji-symbols-symbolic',
        });

        // General Settings Group
        const generalGroup = new Adw.PreferencesGroup({
            title: 'General Settings',
            description: 'Configure your Emoji Picker extension settings.',
        });

        // Show Indicator
        const showIndicatorRow = new Adw.SwitchRow({
            title: 'Show Indicator',
            subtitle: 'Whether to show the emoji indicator.',
        });
        settings.bind(
            'show-indicator',
            showIndicatorRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        generalGroup.add(showIndicatorRow);

        // Paste on Select
        const pasteOnSelectRow = new Adw.SwitchRow({
            title: 'Paste on Select',
            subtitle: 'Automatically paste the selected emoji.',
        });
        settings.bind(
            'paste-on-select',
            pasteOnSelectRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        generalGroup.add(pasteOnSelectRow);

        // Use Keybind
        const useKeybindRow = new Adw.SwitchRow({
            title: 'Use Keybind',
            subtitle: 'Enable your default keybind to open the emoji menu.',
        });
        settings.bind(
            'use-keybind',
            useKeybindRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        generalGroup.add(useKeybindRow);

        // Emoji Copy Keybind Entry
        const keybindRow = new Adw.ActionRow({
            title: 'Emoji Copy Keybind',
        });

        const keybindLabel = new Gtk.Label({
            label: this._getKeybindLabel(settings),
            margin_top: 6,
            margin_bottom: 6,
            margin_start: 6,
            margin_end: 6,
        });

        const keybindButton = new Gtk.Button({
            child: keybindLabel,
            valign: Gtk.Align.CENTER,
        });

        keybindButton.connect('clicked', () => {
            this._showKeybindDialog(window, settings, keybindLabel);
        });

        keybindRow.add_suffix(keybindButton);
        keybindRow.activatable_widget = keybindButton;
        generalGroup.add(keybindRow);

        page.add(generalGroup);
        window.add(page);
    }

    /**
     * Get keybind label text
     *
     * @param {Gio.Settings} settings
     * @returns {string}
     */
    _getKeybindLabel(settings) {
        const keybindings = settings.get_strv('emoji-keybinding');
        if (keybindings.length > 0) {
            let binding = keybindings[0];
            
            // Parse and format the keybinding string properly
            // Handle modifiers: <Control>, <Alt>, <Shift>, <Super>, <Primary>
            const modifiers = [];
            
            // Extract modifiers
            if (binding.includes('<Primary>') || binding.includes('<Control>')) {
                modifiers.push('Ctrl');
                binding = binding.replace('<Primary>', '').replace('<Control>', '');
            }
            if (binding.includes('<Alt>')) {
                modifiers.push('Alt');
                binding = binding.replace('<Alt>', '');
            }
            if (binding.includes('<Shift>')) {
                modifiers.push('Shift');
                binding = binding.replace('<Shift>', '');
            }
            if (binding.includes('<Super>')) {
                modifiers.push('Super');
                binding = binding.replace('<Super>', '');
            }
            
            // Clean up remaining angle brackets and get the key
            let key = binding.replace(/[<>]/g, '');
            
            // Format special key names
            if (key.startsWith('KEY_')) {
                key = key.substring(4);
            }
            
            // Capitalize first letter of key if it's a single letter
            if (key.length === 1) {
                key = key.toLowerCase();
            } else {
                // Handle special keys like "comma", "period", etc.
                const specialKeys = {
                    'comma': ',',
                    'period': '.',
                    'slash': '/',
                    'backslash': '\\',
                    'semicolon': ';',
                    'apostrophe': "'",
                    'bracketleft': '[',
                    'bracketright': ']',
                    'grave': '`',
                    'minus': '-',
                    'equal': '=',
                    'space': 'Space',
                    'return': 'Enter',
                    'backspace': 'Backspace',
                    'tab': 'Tab',
                    'escape': 'Esc',
                };
                
                const lowerKey = key.toLowerCase();
                if (specialKeys[lowerKey]) {
                    key = specialKeys[lowerKey];
                } else {
                    // Capitalize first letter for other keys
                    key = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
                }
            }
            
            // Combine modifiers and key with '+'
            if (modifiers.length > 0) {
                return modifiers.join('+') + '+' + key;
            }
            return key;
        }
        return 'Not Set';
    }

    /**
     * Show keybind configuration dialog
     *
     * @param {Adw.PreferencesWindow} window
     * @param {Gio.Settings} settings
     * @param {Gtk.Label} label
     * @returns {void}
     */
    _showKeybindDialog(window, settings, label) {
        const dialog = new Gtk.MessageDialog({
            transient_for: window,
            modal: true,
            buttons: Gtk.ButtonsType.OK_CANCEL,
            message_type: Gtk.MessageType.QUESTION,
            text: 'Set Emoji Copy Keybind',
            secondary_text: 'Press your desired key combination...',
        });

        const contentArea = dialog.get_content_area();
        const entry = new Gtk.Entry({
            placeholder_text: '<Super>period',
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
            editable: false,
        });

        contentArea.append(entry);

        // Capture key press
        const controller = new Gtk.EventControllerKey();
        controller.connect('key-pressed', (_, keyval, keycode, state) => {
            const mask = state & Gtk.accelerator_get_default_mod_mask();
            
            if (keyval === Gdk.KEY_Escape) {
                dialog.response(Gtk.ResponseType.CANCEL);
                return true;
            }

            if (mask === 0 && keyval === Gdk.KEY_BackSpace) {
                entry.set_text('');
                return true;
            }

            const binding = Gtk.accelerator_name_with_keycode(null, keyval, keycode, mask);
            entry.set_text(binding);
            return true;
        });

        entry.add_controller(controller);

        dialog.connect('response', (_, response) => {
            if (response === Gtk.ResponseType.OK) {
                const binding = entry.get_text();
                if (binding && binding.length > 0) {
                    settings.set_strv('emoji-keybinding', [binding]);
                    label.set_text(this._getKeybindLabel(settings));
                }
            }
            dialog.destroy();
        });

        dialog.show();
    }
}
