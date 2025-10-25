#!/bin/bash
# Quick deploy script for emoji-picker extension

set -e

echo "📦 Deploying emoji-picker extension..."

# Deploy all files
rsync -av --delete \
  --exclude='.git' \
  --exclude='docs/' \
  --exclude='extension_old.js' \
  --exclude='deploy.sh' \
  /home/ashu/Code/linux/emoji-picker/ \
  ~/.local/share/gnome-shell/extensions/emoji-picker@local/

# Compile schemas
echo "🔧 Compiling GSettings schemas..."
glib-compile-schemas ~/.local/share/gnome-shell/extensions/emoji-picker@local/schemas/

echo "🔄 Restarting emoji-picker extension..."
gnome-extensions disable emoji-picker@local && sleep 1 && gnome-extensions enable emoji-picker@local

echo "✅ Deployment complete!"
echo ""
echo "⚠️  On Wayland, you need to log out and log back in to reload the extension"
echo "   Press: Ctrl+Alt+Backspace (if enabled) or use the logout menu"
echo ""
echo "💡 Tip: Keep your work saved before logging out!"
