/**
 * Preferences Dialog
 *
 * @author     Ashu <ashu@example.local>
 * @copyright  2025
 * @license    GPL-3.0-only
 */

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
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

        // Create main preferences group
        const generalGroup = new Adw.PreferencesGroup({
            title: 'General Settings',
            description: 'Configure the Emoji Picker Extension',
        });

        // Add a simple label
        const label = new Gtk.Label({
            label: 'Emoji Picker Extension Preferences',
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });

        generalGroup.add(label);

        // Create a preferences page and add group
        const page = new Adw.PreferencesPage();
        page.add(generalGroup);

        // Add the page to the window
        window.add(page);
    }
}
