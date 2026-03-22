#!/usr/bin/env node
/*
  Local Expo app.json sanity checker to avoid network-dependent doctor schema timeouts.
  Checks only critical fields we hit in this project:
  - expo.androidStatusBar.backgroundColor format
  - expo.android.adaptiveIcon.backgroundColor format
  - expo.android.adaptiveIcon.foregroundImage is square (PNG/JPEG)
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP_JSON = path.join(ROOT, 'app.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isHexColor(value, allowAlpha) {
  if (typeof value !== 'string') return false;
  const six = /^#[0-9a-fA-F]{6}$/;
  const eight = /^#[0-9a-fA-F]{8}$/;
  return allowAlpha ? six.test(value) || eight.test(value) : six.test(value);
}

function getPngDimensions(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.length < 24) throw new Error('PNG buffer too small');
  const sig = buffer.subarray(0, 8).toString('hex');
  if (sig !== signature) throw new Error('Invalid PNG signature');
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

function getJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error('Invalid JPEG signature');
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];
    const isSOF = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    const size = buffer.readUInt16BE(offset + 2);

    if (isSOF) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }

    offset += 2 + size;
  }

  throw new Error('JPEG dimensions not found');
}

function getImageDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.png') return getPngDimensions(buffer);
  if (ext === '.jpg' || ext === '.jpeg') return getJpegDimensions(buffer);

  throw new Error(`Unsupported image type for local check: ${ext}`);
}

function fail(errors) {
  console.error('App config check failed:\n');
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

function main() {
  if (!fs.existsSync(APP_JSON)) {
    fail([`Missing app.json at ${APP_JSON}`]);
  }

  const config = readJson(APP_JSON);
  const expo = config.expo || {};
  const errors = [];

  const statusColor = expo.androidStatusBar && expo.androidStatusBar.backgroundColor;
  if (statusColor !== undefined && !isHexColor(statusColor, true)) {
    errors.push('`expo.androidStatusBar.backgroundColor` must be #RRGGBB or #RRGGBBAA');
  }

  const adaptiveBg = expo.android && expo.android.adaptiveIcon && expo.android.adaptiveIcon.backgroundColor;
  if (adaptiveBg !== undefined && !isHexColor(adaptiveBg, false)) {
    errors.push('`expo.android.adaptiveIcon.backgroundColor` must be #RRGGBB');
  }

  const fgImageRel = expo.android && expo.android.adaptiveIcon && expo.android.adaptiveIcon.foregroundImage;
  if (typeof fgImageRel === 'string') {
    const fgImage = path.resolve(ROOT, fgImageRel);
    if (!fs.existsSync(fgImage)) {
      errors.push(`adaptive foreground image not found: ${fgImageRel}`);
    } else {
      try {
        const { width, height } = getImageDimensions(fgImage);
        if (width !== height) {
          errors.push(`adaptive foreground image must be square. Found ${width}x${height} at ${fgImageRel}`);
        }
      } catch (e) {
        errors.push(`unable to read adaptive foreground image dimensions: ${e.message}`);
      }
    }
  }

  if (errors.length > 0) {
    fail(errors);
  }

  console.log('App config check passed.');
}

main();

