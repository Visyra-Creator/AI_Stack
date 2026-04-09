const fs = require('fs');
const path = require('path');

function getProjectRoot() {
  return path.resolve(__dirname, '..');
}

function getAndroidDir() {
  return path.join(getProjectRoot(), 'android');
}

function getLocalPropertiesPath() {
  return path.join(getAndroidDir(), 'local.properties');
}

function resolveSdkRoot() {
  return process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || '';
}

function hasAndroidDir() {
  return fs.existsSync(getAndroidDir());
}

function hasLocalProperties() {
  return fs.existsSync(getLocalPropertiesPath());
}

function buildLocalPropertiesContent() {
  const sdkRoot = resolveSdkRoot();
  if (!sdkRoot) return '';
  return `sdk.dir=${sdkRoot.replace(/\\/g, '\\\\')}\n`;
}

module.exports = {
  getAndroidDir,
  getLocalPropertiesPath,
  resolveSdkRoot,
  hasAndroidDir,
  hasLocalProperties,
  buildLocalPropertiesContent,
};

