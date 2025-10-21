#!/bin/bash
cd "$(dirname "$0")/.."

cat > dist/head-bundle.js << 'HEADER'
/*!
 * QuadroBoards Automatizations - HEAD BUNDLE
 * @version 1.0.0
 */
HEADER

echo "" >> dist/head-bundle.js
echo "/* MODULE 0: src/consts_from_form.js */" >> dist/head-bundle.js
cat src/consts_from_form.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "" >> dist/head-bundle.js
echo "/* MODULE 1: common.js */" >> dist/head-bundle.js
cat src/core/common.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 2: common_users.js (FMV.fetchUsers) */" >> dist/head-bundle.js
cat src/core/common_users.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 3: helpers.js */" >> dist/head-bundle.js
cat src/core/helpers.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 4: profile_from_user.js */" >> dist/head-bundle.js
cat src/core/profile_from_user.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 5: check_group.js */" >> dist/head-bundle.js
cat src/core/check_group.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 6: load_main_users_money.js */" >> dist/head-bundle.js
cat src/profile/load_main_users_money.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 6.5: ui/button.js (createForumButton framework) */" >> dist/head-bundle.js
cat src/ui/button.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 7.0: bank/gringotts_page_update.js */" >> dist/head-bundle.js
cat src/bank/gringotts_page_update.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 7.1: bank/buttons/start_ams_check.js */" >> dist/head-bundle.js
cat src/bank/buttons/start_ams_check.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 7.2: bank/buttons/admin_edit.js */" >> dist/head-bundle.js
cat src/bank/buttons/admin_edit.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 7.24: bank/groupByRecipient.js */" >> dist/head-bundle.js
cat src/bank/groupByRecipient.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 7.25: bank/buttons/admin_autocheck.js */" >> dist/head-bundle.js
cat src/bank/buttons/admin_autocheck.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 7.3: bank/buttons/no_edits_needed.js */" >> dist/head-bundle.js
cat src/bank/buttons/no_edits_needed.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 7.4: bank/buttons/pay_out.js */" >> dist/head-bundle.js
cat src/bank/buttons/pay_out.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 7: bank/api.js */" >> dist/head-bundle.js
cat src/bank/api.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 8: bank/parent/format_text.js */" >> dist/head-bundle.js
cat src/bank/parent/format_text.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 9: bank/parent/fetch_design_items.js.js */" >> dist/head-bundle.js
cat src/bank/parent/fetch_design_items.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 9.5: bank/parent/fetch_library_items.js */" >> dist/head-bundle.js
cat src/bank/parent/fetch_library_items.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 10: bank/parent/fetch_user_coupons.js */" >> dist/head-bundle.js
cat src/bank/parent/fetch_user_coupons.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 11.1: bank/parent/messages-utils.js */" >> dist/head-bundle.js
cat src/bank/parent/messages-utils.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 11.2: bank/parent/messages-config.js */" >> dist/head-bundle.js
cat src/bank/parent/messages-config.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 11.3: bank/parent/messages-queue.js */" >> dist/head-bundle.js
cat src/bank/parent/messages-queue.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 11.4: bank/parent/messages-scrapers.js */" >> dist/head-bundle.js
cat src/bank/parent/messages-scrapers.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 11.5: bank/parent/messages.js */" >> dist/head-bundle.js
cat src/bank/parent/messages.js >> dist/head-bundle.js
echo "" >> dist/head-bundle.js

echo "/* MODULE 12: utilities/text/profile_fields_as_html.js */" >> dist/head-bundle.js
cat utilities/text/profile_fields_as_html.js >> dist/head-bundle.js

echo "✅ head-bundle.js created!"
ls -lh dist/head-bundle.js
