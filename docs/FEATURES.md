🖐️# Emoji Picker Features

## Skin Tone Selection

The emoji picker now supports selecting different skin tones for emojis that have variants (👋, 👍, 🤚, etc.).

### How to Use Skin Tones

#### Visual Indicator
Emojis that support skin tones are marked with a small **blue dot** in the bottom-right corner of the button.

#### Methods to Select Skin Tones

1. **Right-Click Method** (Fastest)
   - Right-click on any emoji with skin tone support
   - A popup will appear showing all available skin tone variants
   - Click on the desired variant to select it

2. **Long-Press Method** (Touch-friendly)
   - Click and hold (500ms) on any emoji with skin tone support
   - A popup will appear below the emoji showing all variants
   - Release and click on the desired variant

#### Available Skin Tones

The selector provides 6 options:
1. **Default** - The original emoji without modification
2. **Light** 🏻 - Light skin tone (U+1F3FB)
3. **Medium-Light** 🏼 - Medium-light skin tone (U+1F3FC)
4. **Medium** 🏽 - Medium skin tone (U+1F3FD)
5. **Medium-Dark** 🏾 - Medium-dark skin tone (U+1F3FE)
6. **Dark** 🏿 - Dark skin tone (U+1F3FF)

### Examples of Emojis with Skin Tones

- Hand gestures: 👋 👍 👎 ✋ 🤚 🖐️ 🖖 👌 🤌 🤏
- Body parts: 💪 🦵 🦶 👂 👃 👶 🧒 👦 👧
- People: 👨 👩 🧑 👴 👵 👱 👲 👳 👷 💂
- And many more...

### Technical Details

The skin tone selector:
- Uses Unicode skin tone modifiers (U+1F3FB through U+1F3FF)
- Properly handles variation selectors (U+FE0F)
- Removes existing skin tones before applying new ones
- Automatically detects emojis with the `skin_tones` flag in the data

### Keyboard and Accessibility

- All skin tone buttons are focusable and keyboard-accessible
- Each variant has a descriptive accessible name
- The popup can be dismissed by clicking outside or pressing Escape
- Screen reader compatible with proper ARIA labels

## Other Features

### Search
- Fast emoji search by name, description, tags, or aliases
- Debounced search (120ms) for smooth performance
- Search across 13,000+ emojis

### Categories
- 10 emoji categories with visual icons
- Smooth scrolling between categories
- Category tabs sync with scroll position
- "Frequently Used" category based on usage history

### Clipboard Integration
- Auto-copy to clipboard on selection
- Optional notification on copy
- Works with Wayland and X11

### Keyboard Shortcuts
- Configurable global keybinding
- Quick emoji picker access
- Default: Super+Period (can be customized)

### Usage Tracking
- Remembers your most frequently used emojis
- Shows up to 30 recent emojis in "Frequently Used"
- Privacy-conscious: stored locally in GSettings
