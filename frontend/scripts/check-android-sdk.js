const {
  hasAndroidDir,
  hasLocalProperties,
  resolveSdkRoot,
  getLocalPropertiesPath,
} = require('./android-sdk-utils');

const sdkRoot = resolveSdkRoot();
const androidDirExists = hasAndroidDir();
const localPropertiesExists = hasLocalProperties();

console.log('[check-android-sdk] Android SDK preflight');
console.log(`[check-android-sdk] ANDROID_SDK_ROOT/ANDROID_HOME: ${sdkRoot ? sdkRoot : 'not set'}`);
console.log(`[check-android-sdk] android/ directory: ${androidDirExists ? 'present' : 'not present yet (generated during build)'}`);
console.log(`[check-android-sdk] local.properties: ${localPropertiesExists ? getLocalPropertiesPath() : 'not present'}`);

if (!sdkRoot) {
  console.error('[check-android-sdk] FAIL: Set ANDROID_SDK_ROOT or ANDROID_HOME to a valid Android SDK path.');
  process.exitCode = 1;
} else {
  console.log('[check-android-sdk] PASS: Android SDK path is available.');
  if (!androidDirExists) {
    console.log('[check-android-sdk] NOTE: android/ is generated on demand, so local.properties will be written during the build hook.');
  } else if (!localPropertiesExists) {
    console.log('[check-android-sdk] NOTE: local.properties will be created by the pre-build hook.');
  }
}

