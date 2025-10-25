# Quick Developer Reference

## Module Quick Reference

### Import Statements

```javascript
// Constants
import { POPUP_WIDTH, EMOJIS_PER_ROW, CATEGORIES } from './core/constants.js';

// Data Loading
import { loadEmojiData, collectCategories } from './core/emojiData.js';

// Usage Tracking
import { UsageTracker } from './core/usageTracker.js';

// Keybindings
import { KeybindingManager } from './core/keybindingManager.js';

// Search
import { SearchManager } from './core/searchManager.js';

// Categories
import { CategoryManager } from './core/categoryManager.js';

// Rendering
import { EmojiRenderer } from './core/emojiRenderer.js';

// Clipboard
import { ClipboardManager } from './core/clipboardManager.js';
```

## Common Tasks

### Initialize a Module

```javascript
// In extension.js enable() method
this.#usageTracker = new UsageTracker(this.#settings);
```

### Cleanup a Module

```javascript
// In extension.js disable() method
if (this.#searchManager) {
    this.#searchManager.destroy();
    this.#searchManager = null;
}
```

### Add a New Constant

```javascript
// In core/constants.js
export const MY_NEW_CONSTANT = 42;

// In any module
import { MY_NEW_CONSTANT } from './core/constants.js';
```

### Track Emoji Usage

```javascript
// When emoji is selected
this.#usageTracker.trackUsage(emoji);

// Get frequently used
const frequentlyUsed = this.#usageTracker.getFrequentlyUsed(this.#emojiData, 30);
```

### Filter Emojis

```javascript
// Search for emojis
const results = this.#searchManager.filterEmojis(query, this.#emojiData);
```

### Render Emojis

```javascript
// Render filtered list
this.#emojiRenderer.renderEmojis(results);

// Render by category with headers
this.#emojiRenderer.renderEmojisByCategory(
    this.#emojiData,
    this.#usageTracker,
    (category, section) => {
        this.#categoryManager.registerSection(category, section);
    }
);
```

### Navigate to Category

```javascript
// Programmatically navigate
this.#categoryManager.setCategory('Smileys & Emotion');

// Get current category
const current = this.#categoryManager.getCurrentCategory();
```

### Copy to Clipboard

```javascript
this.#clipboardManager.copyToClipboard(emoji);
this.#clipboardManager.showToast(`${emoji} copied`);
```

### Register Keybinding

```javascript
this.#keybindingManager = new KeybindingManager(
    this.#settings,
    'emoji-keybinding',
    () => this.#togglePopup()
);
this.#keybindingManager.register();
```

## Module Communication Patterns

### Parent to Child (Constructor Injection)

```javascript
// Parent passes dependencies to child
this.#searchManager = new SearchManager(
    searchEntry,      // UI element
    (query) => {      // Callback
        this.#applyFilter(query);
    }
);
```

### Child to Parent (Callbacks)

```javascript
// Child calls parent via callback
class SearchManager {
    constructor(searchEntry, onSearchCallback) {
        this.#onSearchCallback = onSearchCallback;
    }
    
    queueFilter() {
        // ... debouncing logic
        this.#onSearchCallback(query);  // Notify parent
    }
}
```

### Sibling Communication (via Parent)

```javascript
// CategoryManager → Parent → EmojiRenderer
this.#categoryManager = new CategoryManager(scrollView, (category) => {
    // Parent coordinates between siblings
    this.#renderCategory(category);  // Updates renderer
});
```

## File Structure Conventions

### Module Template

```javascript
/**
 * Module Name
 * Brief description
 *
 * @author     Your Name
 * @copyright  2025
 * @license    GPL-3.0-only
 */

import Dependency from 'gi://Dependency';
import { CONSTANT } from './constants.js';

export class MyModule {
    #privatefield;
    
    /**
     * Constructor
     *
     * @param {Type} dependency - Description
     */
    constructor(dependency) {
        this.#privatefield = dependency;
    }
    
    /**
     * Public method
     *
     * @param {string} param - Description
     * @returns {boolean} Description
     */
    publicMethod(param) {
        return this.#privateMethod(param);
    }
    
    /**
     * Private method
     *
     * @param {string} param
     * @returns {boolean}
     */
    #privateMethod(param) {
        // Implementation
        return true;
    }
    
    /**
     * Cleanup
     */
    destroy() {
        this.#privatefield = null;
    }
}
```

## Debugging Tips

### Enable Debug Logging

```javascript
// Add to any module
log(`emoji-picker: [ModuleName] Debug message: ${value}`);
```

### Check Logs

```bash
# Real-time logs
journalctl -f -g "emoji-picker"

# Recent logs
journalctl -b0 -g "emoji-picker" --since "5 minutes ago"
```

### Test Module Independently

```javascript
// Create test file: test_module.js
import { MyModule } from './myModule.js';

const mockDep = { /* mock object */ };
const module = new MyModule(mockDep);
const result = module.publicMethod('test');
console.log('Result:', result);
```

### Verify Module Exports

```bash
# Check what a module exports
grep -n "^export" myModule.js
```

## Performance Tips

### Debounce Expensive Operations

```javascript
// Use GLib timeouts for debouncing
GLib.timeout_add(GLib.PRIORITY_DEFAULT, DELAY_MS, () => {
    this.expensiveOperation();
    return GLib.SOURCE_REMOVE;
});
```

### Lazy Load Modules

```javascript
// Only create module when needed
if (!this.#heavyModule) {
    this.#heavyModule = new HeavyModule(dependencies);
}
```

### Clean Up Resources

```javascript
// Always cleanup in destroy()
destroy() {
    if (this.#timeoutId) {
        GLib.source_remove(this.#timeoutId);
    }
    if (this.#widget) {
        this.#widget.destroy();
    }
}
```

## Common Pitfalls

### ❌ Circular Dependencies

```javascript
// BAD: Module A imports Module B, Module B imports Module A
// Module A
import { ModuleB } from './moduleB.js';

// Module B
import { ModuleA } from './moduleA.js';  // ❌ Circular!
```

**Solution**: Use callbacks instead

```javascript
// Module A
const moduleB = new ModuleB((data) => {
    this.handleData(data);  // Callback to A
});
```

### ❌ Forgetting to Clean Up

```javascript
// BAD: Leaving event listeners connected
enable() {
    this.#connection = widget.connect('clicked', callback);
}

disable() {
    // ❌ Forgot to disconnect!
}
```

**Solution**: Always cleanup

```javascript
disable() {
    if (this.#connection) {
        widget.disconnect(this.#connection);
        this.#connection = 0;
    }
}
```

### ❌ Hardcoding Values

```javascript
// BAD: Magic numbers everywhere
const width = 420;
const height = 600;
```

**Solution**: Use constants

```javascript
import { POPUP_WIDTH, POPUP_HEIGHT } from './constants.js';
```

## Testing Workflow

### 1. Edit Module

```bash
vim /path/to/emoji-picker/myModule.js
```

### 2. Deploy

```bash
rsync -av . ~/.local/share/gnome-shell/extensions/emoji-picker@local/
```

### 3. Restart GNOME Shell

```bash
busctl --user call org.gnome.Shell /org/gnome/Shell \
  org.gnome.Shell Eval s 'Meta.restart("Testing changes...")'
```

### 4. Check Logs

```bash
journalctl -b0 -g "emoji-picker" --no-pager --since "1 minute ago"
```

### 5. Test Extension

```bash
# Press Super+Comma or click panel indicator
# Test the feature you changed
```

## Quick Commands

```bash
# Deploy extension
rsync -av --delete --exclude='.git' \
  . ~/.local/share/gnome-shell/extensions/emoji-picker@local/

# Restart GNOME Shell
busctl --user call org.gnome.Shell /org/gnome/Shell \
  org.gnome.Shell Eval s 'Meta.restart("Testing...")'

# Watch logs in real-time
journalctl -f -g "emoji-picker"

# Check for errors only
journalctl -b0 -g "emoji-picker" -p err

# List installed extensions
gnome-extensions list

# Enable extension
gnome-extensions enable emoji-picker@local

# Disable extension
gnome-extensions disable emoji-picker@local

# Open preferences
gnome-extensions prefs emoji-picker@local
```

## Git Workflow

```bash
# Check status
git status

# Add new modules
git add constants.js emojiData.js usageTracker.js

# Commit with good message
git commit -m "refactor: modularize extension into separate files"

# Push changes
git push origin master
```

## Resources

- [GNOME Shell Extensions Documentation](https://gjs.guide/)
- [GJS API Reference](https://gjs-docs.gnome.org/)
- [St Toolkit Docs](https://gjs-docs.gnome.org/st10/)
- [Clutter Documentation](https://gjs-docs.gnome.org/clutter10/)

## Need Help?

1. Check `ARCHITECTURE.md` for detailed module descriptions
2. Check `REFACTORING.md` for migration notes
3. Read JSDoc comments in module files
4. Check logs: `journalctl -b0 -g "emoji-picker"`
5. Compare with `extension_old.js` if needed

---

**Last Updated**: October 25, 2025  
**Extension Version**: Modular Architecture v1.0
