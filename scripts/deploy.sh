#!/bin/bash
# Quick deploy script for emoji-picker extension

set -e

echo "📦 Deploying Gemoji — GNOME Emoji Picker..."

# Deploy all files
rsync -av --delete \
  --exclude='.git' \
  --exclude='docs/' \
  --exclude='dist/' \
  --exclude='node_modules/' \
  --exclude='package-lock.json' \
  --exclude='package.json' \
  --exclude='assets/' \
  --exclude='scripts/' \
  --exclude='*.md' \
  --exclude='eslint.config.js' \
  --exclude='.gitignore' \
  --exclude='*.log' \
  --exclude='*.bak' \
  --exclude='*.tmp' \
  --exclude='extension_old.js' \
  --exclude='deploy.sh' \
  /home/ashu/Code/linux/emoji-picker/ \
  ~/.local/share/gnome-shell/extensions/gemoji@ishusinghse/

# Compile schemas
echo "🔧 Compiling GSettings schemas..."
glib-compile-schemas ~/.local/share/gnome-shell/extensions/gemoji@ishusinghse/schemas/

echo "✅ Deployment complete!"
echo ""
echo "⚠️  On Wayland, you need to log out and log back in to reload the extension"
echo "   Press: Ctrl+Alt+Backspace (if enabled) or use the logout menu"
echo ""
echo "💡 Tip: Keep your work saved before logging out!"
