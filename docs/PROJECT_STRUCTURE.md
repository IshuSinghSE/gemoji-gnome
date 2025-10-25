# Project Structure Overview

## Emoji Picker GNOME Shell Extension

### Directory Layout

```
emoji-picker/
├── 📁 core/                 # Core extension modules
├── 📁 data/                 # Static data files
├── 📁 docs/                 # Documentation (dev only)
├── 📁 icons/                # SVG icon assets
├── 📁 schemas/              # GSettings definitions
├──  extension.js          # Main entry point
├── 📄 prefs.js             # Settings UI
├── 📄 metadata.json        # Extension metadata
├── 📄 stylesheet.css       # Extension styles
└── 📄 README.md            # Project overview
```

### Folder Purposes

#### `core/` - Core Modules (8 files)
Contains all the modularized JavaScript code:
- **categoryManager.js** - Category navigation and scroll synchronization
- **clipboardManager.js** - Clipboard operations and paste functionality
- **constants.js** - Centralized configuration constants
- **emojiData.js** - Emoji data loading from JSON
- **emojiRenderer.js** - Emoji grid rendering engine
- **keybindingManager.js** - Keyboard shortcut registration
- **searchManager.js** - Search and filtering logic
- **usageTracker.js** - Frequently used emoji tracking

#### `data/` - Data Files (1 file)
Contains static data:
- **emoji.json** - Complete emoji dataset (13,000+ emojis)

#### `docs/` - Documentation (3 files)
Developer documentation (excluded from deployment):
- **ARCHITECTURE.md** - Module architecture and design
- **DEVELOPER_GUIDE.md** - Quick reference for developers
- **REFACTORING.md** - Refactoring notes and migration guide

#### `icons/` - Icons (11 files)
SVG symbolic icons for category tabs:
- emoji-recent-symbolic.svg
- emoji-smileys-symbolic.svg
- emoji-people-symbolic.svg
- emoji-nature-symbolic.svg
- emoji-food-symbolic.svg
- emoji-travel-symbolic.svg
- emoji-activities-symbolic.svg
- emoji-objects-symbolic.svg
- emoji-symbols-symbolic.svg
- emoji-flags-symbolic.svg
- emoji-body-symbolic.svg

#### `schemas/` - Settings Schema (2 files)
GSettings configuration:
- **org.gnome.shell.extensions.emoji-picker.gschema.xml** - Schema definition
- **gschemas.compiled** - Compiled schema

### Root Files

- **extension.js** - Main extension class, orchestrates all modules
- **prefs.js** - Preferences UI (Adw.PreferencesWindow)
- **metadata.json** - Extension metadata (name, version, shell compatibility)
- **stylesheet.css** - Extension styles (EmojiMart theme, automatically loaded by GNOME Shell)
- **README.md** - Project description and usage

### Import Paths

#### From extension.js
```javascript
import { POPUP_WIDTH } from './core/constants.js';
import { loadEmojiData } from './core/emojiData.js';
import { UsageTracker } from './core/usageTracker.js';
// ... etc
```

#### Within core/ modules
```javascript
import { EMOJIS_PER_ROW } from './constants.js';  // Relative path within same folder
```

#### Data loading
```javascript
// In core/emojiData.js
const file = directory.get_child('data').get_child('emoji.json');
```

### Deployment

When deploying, the `docs/` folder and `extension_old.js` are excluded:

```bash
rsync -av --delete \
  --exclude='.git' \
  --exclude='extension_old.js' \
  --exclude='docs/' \
  . ~/.local/share/gnome-shell/extensions/emoji-picker@local/
```

### File Count Summary

| Folder   | Files | Purpose                        |
|----------|-------|--------------------------------|
| core/    | 8     | JavaScript modules             |
| data/    | 1     | Emoji dataset                  |
| docs/    | 5     | Documentation (dev only)       |
| icons/   | 11    | SVG category icons             |
| schemas/ | 2     | GSettings schema               |
| Root     | 5     | Extension entry points & meta  |
| **Total**| **32**| **Clean, organized structure** |

### Benefits

1. **Clear Organization** - Related files grouped together
2. **Easy Navigation** - Find files quickly by category
3. **Clean Deployment** - Exclude dev-only files easily
4. **Maintainable** - Logical structure for long-term maintenance
5. **Scalable** - Easy to add new modules or data files

### Key Design Decisions

1. **stylesheet.css at root** - GNOME Shell automatically loads `stylesheet.css` from extension root
2. **Relative imports in core/** - Modules in same folder use `./` relative paths
3. **Docs excluded from deployment** - Keep extension lightweight in production
4. **Data subfolder** - Separates large JSON from code
5. **Icons at root level** - Commonly referenced, easy to find

---

**Note**: This structure supports the modular architecture introduced in the refactoring. Each module in `core/` has a single responsibility and can be tested/maintained independently.
