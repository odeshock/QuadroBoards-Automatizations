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
# Загружаем JSON-версии для API
cat src/private_pages/admin_bridge_json.js >> dist/body-bundle.js
cat src/private_pages/get_skin_api.js >> dist/body-bundle.js
cat src/private_pages/collect_skins_api.js >> dist/body-bundle.js
cat src/private_pages/collect_skin_n_chrono_api.js >> dist/body-bundle.js
# Остальные файлы из private_pages (кроме уже загруженных и старых версий)
for file in src/private_pages/*.js; do
  filename=$(basename "$file")
  if [ "$filename" != "admin_bridge_json.js" ] && \
     [ "$filename" != "get_skin_api.js" ] && \
     [ "$filename" != "collect_skins_api.js" ] && \
     [ "$filename" != "collect_skin_n_chrono_api.js" ] && \
     [ "$filename" != "skin_html_json_parser.js" ] && \
     [ "$filename" != "admin_bridge_api.js" ] && \
     [ "$filename" != "admin_bridge.js" ] && \
     [ "$filename" != "get_skin.js" ]; then
    cat "$file" >> dist/body-bundle.js
  fi
done

echo "" >> dist/body-bundle.js
echo "/* Forms */" >> dist/body-bundle.js
cat src/form/*.js >> dist/body-bundle.js

echo "" >> dist/body-bundle.js
echo "/* Profile */" >> dist/body-bundle.js
# Загружаем JSON-панели в правильном порядке
cat src/profile/fetch_libraries.js >> dist/body-bundle.js
cat src/profile/create_choice_panel_json.js >> dist/body-bundle.js
cat src/profile/skin_set_up_json.js >> dist/body-bundle.js
cat src/profile/profile_runner_json.js >> dist/body-bundle.js
# Остальные файлы из profile (кроме уже загруженных и старых версий)
for file in src/profile/*.js; do
  filename=$(basename "$file")
  if [ "$filename" != "fetch_libraries.js" ] && \
     [ "$filename" != "create_choice_panel_json.js" ] && \
     [ "$filename" != "skin_set_up_json.js" ] && \
     [ "$filename" != "profile_runner_json.js" ] && \
     [ "$filename" != "create_choice_panel.js" ] && \
     [ "$filename" != "skin_set_up.js" ] && \
     [ "$filename" != "profile_runner.js" ]; then
    cat "$file" >> dist/body-bundle.js
  fi
done

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
cat src/chrono/button_update_chrono_api.js >> dist/body-bundle.js

echo "" >> dist/body-bundle.js
echo "/* Episodes */" >> dist/body-bundle.js
# Load ui.js (contains all bootstrap logic for creation/edition)
cat src/episodes/ui.js >> dist/body-bundle.js
# Load tags_visibility.js
cat src/episodes/tags_visibility.js >> dist/body-bundle.js

echo "✅ body-bundle.js created!"
ls -lh dist/body-bundle.js
