#!/bin/bash
cd "$(dirname "$0")/.."

cat > dist/body-bundle.js << 'HEADER'
/*!
 * QuadroBoards Automatizations - BODY BUNDLE
 * @version 1.0.0
 */
HEADER

echo "" >> dist/body-bundle.js
echo "/* ДАЙСЫ utilities/gamification/dices.js */" >> dist/body-bundle.js
cat utilities/gamification/dices.js >> dist/body-bundle.js

echo "" >> dist/body-bundle.js
echo "/* ЗАМЕНА ДЕФИСОВ utilities/text/hyphens_replacing.js */" >> dist/body-bundle.js
cat utilities/text/hyphens_replacing.js >> dist/body-bundle.js

echo "" >> dist/body-bundle.js
echo "/* UI Components (button.js загружается в head-bundle) */" >> dist/body-bundle.js
for file in src/ui/*.js; do
  if [ "$(basename "$file")" != "button.js" ]; then
    cat "$file" >> dist/body-bundle.js
  fi
done

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
cat src/chrono/parser.js >> dist/body-bundle.js

echo "" >> dist/body-bundle.js
echo "/* Crhono buttons */" >> dist/body-bundle.js
cat src/chrono/button_update_total.js >> dist/body-bundle.js
cat src/chrono/button_total_to_excel.js >> dist/body-bundle.js
cat src/chrono/button_update_per_user.js >> dist/body-bundle.js
cat src/chrono/button_update_personal_page.js >> dist/body-bundle.js
cat src/chrono/button_update_chrono_api >> dist/body-bundle.js

echo "" >> dist/body-bundle.js
echo "/* Episodes */" >> dist/body-bundle.js
# Load ui.js (contains all bootstrap logic for creation/edition)
cat src/episodes/ui.js >> dist/body-bundle.js
# Load tags_visibility.js
cat src/episodes/tags_visibility.js >> dist/body-bundle.js

echo "✅ body-bundle.js created!"
ls -lh dist/body-bundle.js
