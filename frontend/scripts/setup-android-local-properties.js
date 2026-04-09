const fs = require('fs');
const {
  getLocalPropertiesPath,
  hasAndroidDir,
  buildLocalPropertiesContent,
  resolveSdkRoot,
} = require('./android-sdk-utils');

if (!hasAndroidDir()) {
  process.exit(0);
}

const sdkRoot = resolveSdkRoot();
if (!sdkRoot) {
  console.warn('[setup-android-local-properties] ANDROID_SDK_ROOT/ANDROID_HOME is not set.');
  process.exit(0);
}

const content = buildLocalPropertiesContent();
fs.writeFileSync(getLocalPropertiesPath(), content, 'utf8');
console.log(`[setup-android-local-properties] Wrote ${getLocalPropertiesPath()}`);

