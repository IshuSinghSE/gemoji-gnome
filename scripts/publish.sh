#!/bin/bash
# publish.sh - Create a clean GNOME Extensions zip for submission
# Only include runtime files required by GNOME Shell

set -e


EXT_UUID="gemoji@ishusinghse"
DIST_DIR="dist"
ZIP_NAME="$DIST_DIR/$EXT_UUID.zip"

INCLUDE_FILES=(
    metadata.json
    extension.js
    prefs.js
    stylesheet.css
    schemas/*.gschema.xml
    core/
    icons/
    data/
)


# Create dist directory if it doesn't exist
mkdir -p "$DIST_DIR"
# Remove any previous zip
rm -f "$ZIP_NAME"

# Create the zip
zip -r "$ZIP_NAME" ${INCLUDE_FILES[@]} \
    -x "*.git*" "node_modules/*" "*.md" "*.sh" "*.json" "package*" "eslint*" "dist/*" "docs/*" "assets/*" "tests/*" "*.zip"

# Show result
ls -lh "$ZIP_NAME"
echo "\nCreated $ZIP_NAME for GNOME Extensions submission."
