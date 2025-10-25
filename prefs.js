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
     * Get icon for preference pages
     * @param {string} name - Icon name (general, appearance, features)
     * @returns {Gio.Icon}
     */
    _getPageIcon(name) {
        const iconPath = this.dir.get_child('icons').get_child('extension').get_child(`${name}-symbolic.svg`);
        if (iconPath.query_exists(null)) {
            return Gio.FileIcon.new(iconPath);
        }
        // Fallback to system icons
        const iconNames = {
            general: 'preferences-system-symbolic',
            appearance: 'preferences-desktop-font-symbolic',
            features: 'applications-system-symbolic'
        };
        return Gio.ThemedIcon.new(iconNames[name] || 'dialog-information-symbolic');
    }
    /**
     * Fill preferences window
     *
     * @returns {void}
     */
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // Create main preferences window
        const header_bar = new Adw.HeaderBar();
        window.set_titlebar(header_bar);

        // Create view stack for multiple pages
        const stack = new Adw.ViewStack();
        const stack_switcher = new Adw.ViewStackPage({
            child: stack,
            title: 'Emoji Picker Settings',
        });

        // Page 1: General Settings
        const generalPage = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'general-symbolic',
        });

        const generalGroup = new Adw.PreferencesGroup({
            title: 'General Settings',
            description: 'Configure basic extension settings.',
        });

        // Show Indicator
        const showIndicatorRow = new Adw.SwitchRow({
            title: 'Show Indicator',
            subtitle: 'Show emoji picker icon in top panel',
        });
        settings.bind(
            'show-indicator',
            showIndicatorRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        generalGroup.add(showIndicatorRow);

        // Use Keybind
        const useKeybindRow = new Adw.SwitchRow({
            title: 'Use Keybind',
            subtitle: 'Enable global keyboard shortcut',
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
            title: 'Emoji Picker Keybind',
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

        // Paste on Select
        const pasteOnSelectRow = new Adw.SwitchRow({
            title: 'Paste on Select',
            subtitle: 'Automatically paste selected emoji at cursor',
        });
        settings.bind(
            'paste-on-select',
            pasteOnSelectRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        generalGroup.add(pasteOnSelectRow);

        generalPage.add(generalGroup);

        // Page 2: Appearance
        const appearancePage = new Adw.PreferencesPage({
            title: 'Appearance',
            icon_name: 'appearance-symbolic',
        });

        const appearanceGroup = new Adw.PreferencesGroup({
            title: 'Look & Feel',
            description: 'Customize the appearance of the emoji picker.',
        });

        // Theme
        const themeRow = new Adw.ComboRow({
            title: 'Theme',
            subtitle: 'Select color scheme',
            model: new Gtk.StringList({
                strings: ['Auto', 'Light', 'Dark', 'Custom'],
            }),
        });
        const themeValues = ['auto', 'light', 'dark', 'custom'];
        const currentTheme = settings.get_string('theme');
        themeRow.set_selected(themeValues.indexOf(currentTheme));
        themeRow.connect('notify::selected', () => {
            settings.set_string('theme', themeValues[themeRow.get_selected()]);
        });
        appearanceGroup.add(themeRow);

        // Custom Theme
        const useCustomThemeRow = new Adw.SwitchRow({
            title: 'Use Custom Theme',
            subtitle: 'Override GNOME Shell theme',
        });
        settings.bind(
            'use-custom-theme',
            useCustomThemeRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        appearanceGroup.add(useCustomThemeRow);

        // Emoji Style
        const emojiStyleRow = new Adw.ComboRow({
            title: 'Emoji Style',
            subtitle: 'Choose emoji rendering style',
            model: new Gtk.StringList({
                strings: ['Native', 'Apple', 'Google', 'Twitter', 'Emojipedia'],
            }),
        });
        const emojiStyleValues = ['native', 'apple', 'google', 'twitter', 'emojipedia'];
        const currentStyle = settings.get_string('emoji-style');
        emojiStyleRow.set_selected(emojiStyleValues.indexOf(currentStyle));
        emojiStyleRow.connect('notify::selected', () => {
            settings.set_string('emoji-style', emojiStyleValues[emojiStyleRow.get_selected()]);
        });
        appearanceGroup.add(emojiStyleRow);

        // Popup Size Mode
        const sizeModeRow = new Adw.ComboRow({
            title: 'Popup Size',
            subtitle: 'Choose size preset or customize',
            model: new Gtk.StringList({
                strings: ['Compact', 'Default', 'Comfortable', 'Custom'],
            }),
        });
        const sizeModeValues = ['compact', 'default', 'comfortable', 'custom'];
        const currentSizeMode = settings.get_string('popup-size-mode') || 'default';
        sizeModeRow.set_selected(sizeModeValues.indexOf(currentSizeMode));
        sizeModeRow.connect('notify::selected', () => {
            const newMode = sizeModeValues[sizeModeRow.get_selected()];
            settings.set_string('popup-size-mode', newMode);
            // Show/hide custom size controls
            widthRow.set_visible(newMode === 'custom');
            heightRow.set_visible(newMode === 'custom');
        });
        appearanceGroup.add(sizeModeRow);

        // Popup Width (only shown in custom mode)
        const widthRow = new Adw.SpinRow({
            title: 'Popup Width',
            subtitle: 'Width in pixels (300-1280)',
            adjustment: new Gtk.Adjustment({
                lower: 300,
                upper: 1280,
                step_increment: 10,
                page_increment: 50,
                value: settings.get_int('popup-width'),
            }),
            numeric: true,
            snap_to_ticks: true,
            visible: currentSizeMode === 'custom',
        });
        widthRow.connect('notify::value', () => {
            settings.set_int('popup-width', Math.round(widthRow.get_value()));
        });
        appearanceGroup.add(widthRow);

        // Popup Height (only shown in custom mode)
        const heightRow = new Adw.SpinRow({
            title: 'Popup Height',
            subtitle: 'Height in pixels (300-720)',
            adjustment: new Gtk.Adjustment({
                lower: 300,
                upper: 720,
                step_increment: 10,
                page_increment: 50,
                value: settings.get_int('popup-height'),
            }),
            numeric: true,
            snap_to_ticks: true,
            visible: currentSizeMode === 'custom',
        });
        heightRow.connect('notify::value', () => {
            settings.set_int('popup-height', Math.round(heightRow.get_value()));
        });
        appearanceGroup.add(heightRow);

        appearancePage.add(appearanceGroup);

        // Page 3: Features
        const featuresPage = new Adw.PreferencesPage({
            title: 'Features',
            
        });

        const featuresGroup = new Adw.PreferencesGroup({
            title: 'Feature Settings',
            description: 'Enable or disable specific features.',
        });

        // Skin Tones Disabled
        const skinTonesRow = new Adw.SwitchRow({
            title: 'Skin Tones',
            subtitle: 'Show skin tone variants for emojis',
        });
        const skinTonesActive = !settings.get_boolean('skin-tones-disabled');
        skinTonesRow.set_active(skinTonesActive);
        skinTonesRow.connect('notify::active', () => {
            settings.set_boolean('skin-tones-disabled', !skinTonesRow.get_active());
        });
        featuresGroup.add(skinTonesRow);

        // Search
        const searchRow = new Adw.SwitchRow({
            title: 'Search',
            subtitle: 'Enable emoji search functionality',
        });
        const searchActive = !settings.get_boolean('search-disabled');
        searchRow.set_active(searchActive);
        searchRow.connect('notify::active', () => {
            settings.set_boolean('search-disabled', !searchRow.get_active());
        });
        featuresGroup.add(searchRow);

        // Search Placeholder
        const searchPlaceholderRow = new Adw.EntryRow({
            title: 'Search Placeholder',
            text: settings.get_string('search-placeholder'),
        });
        searchPlaceholderRow.connect('notify::text', () => {
            settings.set_string('search-placeholder', searchPlaceholderRow.get_text());
        });
        featuresGroup.add(searchPlaceholderRow);

        // Suggestion Mode
        const suggestionModeRow = new Adw.ComboRow({
            title: 'Suggestion Mode',
            subtitle: 'How to suggest emojis',
            model: new Gtk.StringList({
                strings: ['Recent', 'Frequent', 'Trending'],
            }),
        });
        const suggestionValues = ['recent', 'frequent', 'trending'];
        const currentSuggestion = settings.get_string('suggestion-mode');
        suggestionModeRow.set_selected(suggestionValues.indexOf(currentSuggestion));
        suggestionModeRow.connect('notify::selected', () => {
            settings.set_string('suggestion-mode', suggestionValues[suggestionModeRow.get_selected()]);
        });
        featuresGroup.add(suggestionModeRow);

        // Skin Tone Location
        const skinToneLocationRow = new Adw.ComboRow({
            title: 'Skin Tone Picker Location',
            subtitle: 'Where to show skin tone selector',
            model: new Gtk.StringList({
                strings: ['Search Bar', 'Top', 'Bottom'],
            }),
        });
        const locationValues = ['search', 'top', 'bottom'];
        const currentLocation = settings.get_string('skin-tone-location');
        skinToneLocationRow.set_selected(locationValues.indexOf(currentLocation));
        skinToneLocationRow.connect('notify::selected', () => {
            settings.set_string('skin-tone-location', locationValues[skinToneLocationRow.get_selected()]);
        });
        featuresGroup.add(skinToneLocationRow);

        // Custom Emojis
        const customEmojisRow = new Adw.SwitchRow({
            title: 'Custom Emojis',
            subtitle: 'Allow adding custom emoji shortcuts',
        });
        settings.bind(
            'custom-emojis-enabled',
            customEmojisRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        featuresGroup.add(customEmojisRow);

        // Reactions
        const reactionsRow = new Adw.SwitchRow({
            title: 'Reactions',
            subtitle: 'Show reaction shortcuts',
        });
        settings.bind(
            'reactions-enabled',
            reactionsRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        featuresGroup.add(reactionsRow);

        featuresPage.add(featuresGroup);

        // Add all pages to stack
        stack.add_titled(generalPage, 'general', 'General');
        stack.add_titled(appearancePage, 'appearance', 'Appearance');
        stack.add_titled(featuresPage, 'features', 'Features');

        // Set default page
        stack.set_visible_child_name('general');

        // Create switcher and content area
        const switcher = new Adw.ViewSwitcher({
            stack: stack,
            policy: Adw.ViewSwitcherPolicy.WIDE,
        });

        const switcherBar = new Adw.HeaderBar({
            title_widget: switcher,
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
        });
        box.append(switcherBar);
        box.append(stack);

        window.set_content(box);
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
