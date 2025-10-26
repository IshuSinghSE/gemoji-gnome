# Gemoji — GNOME Emoji Picker

Gemoji is a compact, fast emoji picker for GNOME Shell. Quickly find and insert emoji using search, categories, and a frequently-used section.

## Features

- 🎨 **Modern UI** - Clean, minimal design inspired by EmojiMart
- 🔍 **Fast Search** - Real-time emoji search with debouncing
- 📊 **Category Navigation** - Organized by emoji categories with scroll sync
- ⭐ **Frequently Used** - Tracks your most-used emojis
- ⌨️ **Keyboard Shortcut** - Default: `Super+Comma` (configurable)
- 🎭 **Theme Toggle** - Custom theme or native Shell theme
- 📋 **Auto-paste** - Optional paste-on-select feature
- 🎯 **Panel Indicator** - Optional panel button for quick access

## Installation

### Developer Installation

1. Clone and deploy:
    ```bash
    git clone https://github.com/IshuSinghSE/gnome-emoji-picker.git
    cd gnome-emoji-picker
    rsync -av --delete --exclude='.git' --exclude='docs/' \
       . ~/.local/share/gnome-shell/extensions/gemoji@ishusinghse/
    ```

2. Compile schemas:
   ```bash
   glib-compile-schemas ~/.local/share/gnome-shell/extensions/gemoji@ishusinghse/schemas
   ```

3. Restart GNOME Shell:
   - X11: `Alt+F2`, type `r`, press Enter
   - Wayland: Log out and back in

4. Enable the extension:
   ```bash
   gnome-extensions enable gemoji@ishusinghse
   ```

## Usage

- **Open Picker**: Press `Super+Comma` or click the panel indicator (😀)
- **Search**: Type in the search box to filter emojis
- **Select Category**: Click category icons at the top
- **Choose Emoji**: Click any emoji to copy to clipboard
- **Close**: Click outside the picker or press `Esc`

## Settings

Open preferences: `gnome-extensions prefs gemoji@ishusinghse`

- **Show Indicator** - Display emoji icon in panel
- **Use Keybinding** - Enable/disable keyboard shortcut
- **Paste on Select** - Auto-paste emoji after selection
- **Custom Keybinding** - Change keyboard shortcut

## Project Structure

```
emoji-picker/
├── core/              # Core extension modules
│   ├── categoryManager.js
│   ├── clipboardManager.js
│   ├── constants.js
│   ├── emojiData.js
│   ├── emojiRenderer.js
│   ├── keybindingManager.js
│   ├── searchManager.js
│   └── usageTracker.js
├── data/              # Emoji dataset
│   └── emoji.json
├── docs/              # Documentation
├── icons/             # Category icons
├── schemas/           # GSettings schema
├── extension.js       # Main entry point
├── prefs.js          # Settings UI
├── stylesheet.css    # Extension styles
└── metadata.json     # Extension metadata
```

## Development

See detailed documentation:
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Module architecture
- [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) - Developer guide
- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) - Structure overview

### Quick Start

1. Edit files in the project directory
2. Deploy changes:
   ```bash
      rsync -av --delete --exclude='.git' --exclude='docs/' \
         . ~/.local/share/gnome-shell/extensions/gemoji@ishusinghse/
   ```
3. Restart GNOME Shell and test

### Module System

The extension uses a modular architecture:
- **Core modules** in `core/` - Independent, focused responsibilities
- **Data layer** in `data/` - Emoji dataset (13,000+ emojis)
- **Clean separation** - Easy to test and maintain

## Compatibility

- **GNOME Shell**: 45, 46, 47, 48, 49
- **Tested on**: GNOME 49 (Brescia)

## License

GPL-3.0-only

## Credits

- Inspired by [EmojiMart](https://github.com/missive/emoji-mart)
- Emoji data from Unicode Consortium
