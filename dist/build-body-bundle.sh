#!/bin/bash
cd "$(dirname "$0")/.."

cat > dist/body-bundle.js << 'HEADER'
/*!
 * QuadroBoards Automatizations - BODY BUNDLE
 * @version 1.0.0
 */
HEADER

echo "" >> dist/body-bundle.js
echo "/* UI Components */" >> dist/body-bundle.js
cat src/ui/*.js >> dist/body-bundle.js

echo "" >> dist/body-bundle.js
echo "/* Private Pages */" >> dist/body-bundle.js
cat src/private_pages/*.js >> dist/body-bundle.js

echo "" >> dist/body-bundle.js
echo "/* Forms */" >> dist/body-bundle.js
cat src/form/*.js >> dist/body-bundle.js

echo "" >> dist/body-bundle.js
echo "/* Profile */" >> dist/body-bundle.js
cat src/profile/*.js >> dist/body-bundle.js

echo "" >> dist/body-bundle.js
echo "/* Comments & Chrono */" >> dist/body-bundle.js
cat src/comments/*.js >> dist/body-bundle.js
# Load helpers.js first to define checkChronoFields
cat src/chrono/helpers.js >> dist/body-bundle.js
# Then load parser and button files
cat src/chrono/parser.js src/chrono/button_*.js >> dist/body-bundle.js

echo "" >> dist/body-bundle.js
echo "/* Episodes */" >> dist/body-bundle.js
# Load ui.js (contains all bootstrap logic for creation/edition)
cat src/episodes/ui.js >> dist/body-bundle.js
# Load tags_visibility.js
cat src/episodes/tags_visibility.js >> dist/body-bundle.js

echo "✅ body-bundle.js created!"
ls -lh dist/body-bundle.js
