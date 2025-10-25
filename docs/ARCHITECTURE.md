# Emoji Picker - Modular Architecture

## Overview

The extension has been refactored into a modular architecture for better maintainability, testability, and code organization.

## Module Structure

```
emoji-picker/
├── core/                    # Core modules
│   ├── categoryManager.js   # Category navigation and scroll sync
│   ├── clipboardManager.js  # Clipboard operations
│   ├── constants.js         # Configuration constants
│   ├── emojiData.js        # Emoji data loading
│   ├── emojiRenderer.js    # Emoji grid rendering
│   ├── keybindingManager.js # Keyboard shortcuts
│   ├── searchManager.js    # Search and filtering
│   └── usageTracker.js     # Usage tracking
├── data/                    # Data files
│   └── emoji.json          # Emoji dataset
├── docs/                    # Documentation (dev only)
│   ├── ARCHITECTURE.md     # Architecture overview
│   ├── DEVELOPER_GUIDE.md  # Developer guide
│   └── REFACTORING.md      # Refactoring notes
├── icons/                   # SVG icons
│   └── *.svg               # Category icons
├── schemas/                 # GSettings schema
│   └── *.gschema.xml       # Settings definition
├── extension.js             # Main extension entry point
├── prefs.js                # Settings UI
├── metadata.json           # Extension metadata
├── stylesheet.css          # Extension styles
└── README.md               # Project readme
```

## Module Descriptions

### `core/constants.js`
Centralized configuration constants:
- `MAX_VISIBLE_EMOJIS`: Maximum emojis to display in search results
- `SEARCH_DEBOUNCE_MS`: Search debounce delay
- `POPUP_WIDTH`, `POPUP_HEIGHT`: Popup dimensions
- `EMOJIS_PER_ROW`: Emoji grid layout
- `CATEGORY_ICONS`: Category icon mappings

### `core/emojiData.js`
Handles emoji data:
- `loadEmojiData(directory)`: Load data/emoji.json or fallback data
- `collectCategories(emojiData)`: Extract unique categories
- Provides fallback emoji dataset if json file is missing

### `core/usageTracker.js`
Tracks frequently used emojis:
- `UsageTracker`: Class for tracking emoji usage
- `loadUsageData()`: Load usage stats from GSettings
- `saveUsageData()`: Persist usage stats
- `getFrequentlyUsed(emojiData, limit)`: Get top N frequently used
- `trackUsage(emoji)`: Increment usage count

### `core/keybindingManager.js`
Manages keyboard shortcuts:
- `KeybindingManager`: Class for keybinding registration
- `register()`: Register the keybinding
- `unregister()`: Remove the keybinding
- `update()`: Update based on settings changes
- `isRegistered()`: Check registration status

### `core/searchManager.js`
Handles search functionality:
- `SearchManager`: Class for search operations
- `queueFilter(immediate)`: Debounced search trigger
- `getQuery()`: Extract search query text
- `filterEmojis(query, emojiData)`: Filter emojis by query
- `clear()`: Reset search
- `focus()`: Focus search input

### `core/categoryManager.js`
Manages category navigation and scroll sync:
- `CategoryManager`: Class for category operations
- `buildCategoryTabs(categories, extensionDir)`: Create tab UI
- `setCategory(category)`: Navigate to category
- `updateCategoryStates()`: Update visual states
- `registerSection(category, section)`: Register category header
- Automatic scroll synchronization (tabs ↔ scroll position)

### `core/emojiRenderer.js`
Renders emoji grid:
- `EmojiRenderer`: Class for rendering operations
- `renderEmojis(emojis)`: Render flat emoji list
- `renderEmojisByCategory(emojiData, usageTracker, callback)`: Render with category headers
- `clear()`: Clear all emoji content
- Creates grid layout with configurable rows

### `core/clipboardManager.js`
Handles clipboard and pasting:
- `ClipboardManager`: Class for clipboard operations
- `copyToClipboard(emoji)`: Copy emoji to clipboard
- `pasteEmoji()`: Paste using multiple methods (xdotool, virtual keyboard, Meta)
- `showToast(message)`: Display notification
- Supports paste-on-select feature

### `extension.js`
Main extension orchestrator:
- Initializes all modules
- Builds popup UI
- Coordinates module interactions
- Handles settings changes
- Manages extension lifecycle

## Benefits of Modular Architecture

### 1. **Separation of Concerns**
Each module has a single, well-defined responsibility:
- Data loading → `emojiData.js`
- Search logic → `searchManager.js`
- Rendering → `emojiRenderer.js`
- Categories → `categoryManager.js`

### 2. **Maintainability**
- Easier to locate and fix bugs
- Clear boundaries between components
- Smaller, focused files (~100-300 lines each)

### 3. **Testability**
- Each module can be tested independently
- Mocked dependencies for unit tests
- Clear input/output contracts

### 4. **Reusability**
- Modules can be reused in other extensions
- Easy to extract common utilities
- Clean API boundaries

### 5. **Extensibility**
- Add new features without touching existing code
- Plugin-like architecture for new modules
- Easy to swap implementations

## Module Dependencies

```
extension.js
├── constants.js (no dependencies)
├── emojiData.js (no dependencies)
├── usageTracker.js
│   └── GLib (for persistence)
├── keybindingManager.js
│   ├── Meta
│   ├── Shell
│   └── Main
├── searchManager.js
│   ├── GLib (for debouncing)
│   └── constants.js
├── categoryManager.js
│   ├── St
│   ├── GLib (for timers)
│   └── constants.js
├── emojiRenderer.js
│   ├── St
│   └── constants.js
└── clipboardManager.js
    ├── St
    ├── Clutter
    ├── Meta
    ├── GLib
    └── Main
```

## Development Guidelines

### Adding a New Module

1. **Create the module file** (e.g., `myModule.js`)
2. **Export classes/functions**:
   ```javascript
   export class MyModule {
       constructor(dependencies) {
           // Initialize
       }
       
       someMethod() {
           // Implementation
       }
   }
   ```

3. **Import in `extension.js`**:
   ```javascript
   import { MyModule } from './myModule.js';
   ```

4. **Initialize in `enable()`**:
   ```javascript
   this.#myModule = new MyModule(dependencies);
   ```

5. **Cleanup in `disable()`**:
   ```javascript
   this.#myModule?.destroy();
   this.#myModule = null;
   ```

### Module Best Practices

1. **Keep modules focused**: One responsibility per module
2. **Use dependency injection**: Pass dependencies via constructor
3. **Provide cleanup methods**: Implement `destroy()` or similar
4. **Document public APIs**: Add JSDoc comments
5. **Avoid circular dependencies**: Use callbacks for bidirectional communication
6. **Use constants**: Don't hardcode values, use `constants.js`

### Communication Between Modules

Use **callbacks** to avoid circular dependencies:

```javascript
// Good: Parent passes callback to child
this.#searchManager = new SearchManager(searchEntry, (query) => {
    this.#applyFilter(query);
});

// Bad: Child directly calls parent
// searchManager calls extension.#applyFilter() directly
```

## File Size Comparison

**Before modularization**:
- `extension.js`: ~1283 lines

**After modularization**:
- `extension.js`: ~460 lines
- `constants.js`: ~40 lines
- `emojiData.js`: ~110 lines
- `usageTracker.js`: ~110 lines
- `keybindingManager.js`: ~95 lines
- `searchManager.js`: ~180 lines
- `categoryManager.js`: ~230 lines
- `emojiRenderer.js`: ~165 lines
- `clipboardManager.js`: ~150 lines

**Total**: ~1540 lines (20% increase for better organization)

## Testing

Each module can be tested independently:

```javascript
// Example: Testing SearchManager
import { SearchManager } from './searchManager.js';

const mockEntry = { get_text: () => 'smile' };
const mockCallback = (query) => console.log(`Search: ${query}`);

const searchManager = new SearchManager(mockEntry, mockCallback);
const query = searchManager.getQuery(); // "smile"
```

## Future Improvements

1. **Add unit tests** for each module
2. **Create TypeScript definitions** for better IDE support
3. **Extract more utilities** into separate modules
4. **Add plugin system** for custom emoji sources
5. **Implement caching layer** in emojiData module
6. **Add telemetry module** for usage analytics (opt-in)

## Migration from Old Code

The old monolithic `extension.js` has been backed up as `extension_old.js`.

Key changes:
- Private methods split into public module methods
- State management distributed across modules
- Event handling delegated to appropriate modules
- Settings changes routed to affected modules

All functionality remains the same, just better organized!
