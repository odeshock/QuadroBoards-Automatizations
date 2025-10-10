#!/bin/bash
cd "$(dirname "$0")/.."

cat > dist/head-bundle.js << 'HEADER'
/*!
 * QuadroBoards Automatizations - HEAD BUNDLE
 * @version 1.0.0
 */
HEADER

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

echo "/* MODULE 7: bank/parent.js */" >> dist/head-bundle.js
cat src/bank/parent.js >> dist/head-bundle.js

echo "✅ head-bundle.js created!"
ls -lh dist/head-bundle.js
