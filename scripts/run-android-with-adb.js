#!/usr/bin/env node
/**
 * Run `react-native run-android` with adb from this project's SDK path (android/local.properties).
 * Use this if adb is not in your system PATH.
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const localPropsPath = path.join(root, 'android', 'local.properties');
if (!fs.existsSync(localPropsPath)) {
  console.error('android/local.properties not found');
  process.exit(1);
}
const content = fs.readFileSync(localPropsPath, 'utf8');
const m = content.match(/sdk\.dir=(.+)/);
if (!m) {
  console.error('sdk.dir not found in android/local.properties');
  process.exit(1);
}
const sdkDir = m[1].trim().replace(/\\\\/g, '\\');
const platformTools = path.join(sdkDir, 'platform-tools');
const adbPath = path.join(platformTools, process.platform === 'win32' ? 'adb.exe' : 'adb');
if (!fs.existsSync(adbPath)) {
  console.error('adb not found at:', adbPath);
  process.exit(1);
}

const env = { ...process.env };
const sep = process.platform === 'win32' ? ';' : ':';
env.PATH = platformTools + sep + (env.PATH || '');

const child = spawn('npx', ['react-native', 'run-android'], {
  cwd: root,
  env,
  stdio: 'inherit',
  shell: true,
});
child.on('close', (code) => process.exit(code != null ? code : 0));
