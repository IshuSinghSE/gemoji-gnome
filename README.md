# Emoji Picker GNOME Shell Extension

Minimal aesthetic emoji picker with an option to use a custom theme or inherit the native Shell theme.

Installation (developer):

1. Copy this folder to ~/.local/share/gnome-shell/extensions/emoji-picker@local
2. Compile the GSettings schemas:

   glib-compile-schemas ~/.local/share/gnome-shell/extensions/emoji-picker@local/schemas

3. Restart GNOME Shell (Alt+F2, r) or log out and back in.

Notes:
- This is a starting point. The picker currently uses a small emoji list at data/emojis.js.
- To expand emojis, replace data/emojis.js with a larger dataset or load from JSON.
 - You can provide a larger `emoji.json` in the extension root. The extension will try to load `emoji.json` first and fall back to `data/emojis.js`.
Target GNOME version

This extension targets GNOME 49 (Brescia) as the current stable release. It should also work on GNOME 48 and a few earlier releases, but GNOME APIs evolve; test on your target Shell version.
- The extension expects the schema id org.gnome.shell.extensions.emoji-picker.
