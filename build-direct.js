const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const electronPath = path.join(__dirname, 'node_modules/electron/dist/Electron.app');
const outputPath = path.join(__dirname, 'dist/Messenger.app');

console.log('🔨 Building Messenger.app using direct Electron copy...');

// Clean output
if (fs.existsSync(outputPath)) {
  fs.rmSync(outputPath, { recursive: true, force: true });
}

// Ensure dist directory exists
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

// Copy Electron app
console.log('📦 Copying Electron binary...');
execSync(`cp -r "${electronPath}" "${outputPath}"`);

// Create app directory
const appDir = path.join(outputPath, 'Contents/Resources/app');
fs.mkdirSync(appDir, { recursive: true });

// Copy app files
console.log('📄 Copying app files...');
fs.copyFileSync(path.join(__dirname, 'main.js'), path.join(appDir, 'main.js'));
fs.copyFileSync(path.join(__dirname, 'package.json'), path.join(appDir, 'package.json'));

// Copy styles.css if it exists
const stylesPath = path.join(__dirname, 'styles.css');
if (fs.existsSync(stylesPath)) {
  fs.copyFileSync(stylesPath, path.join(appDir, 'styles.css'));
}

// Copy assets if they exist
const assetsPath = path.join(__dirname, 'assets');
if (fs.existsSync(assetsPath)) {
  const appAssetsPath = path.join(appDir, 'assets');
  fs.mkdirSync(appAssetsPath, { recursive: true });
  execSync(`cp -r "${assetsPath}/"* "${appAssetsPath}/" 2>/dev/null || true`);
}

// Update Info.plist
const infoPlistPath = path.join(outputPath, 'Contents/Info.plist');
if (fs.existsSync(infoPlistPath)) {
  let plist = fs.readFileSync(infoPlistPath, 'utf8');
  plist = plist.replace(/<key>CFBundleName<\/key>\s*<string>.*?<\/string>/, '<key>CFBundleName</key>\n\t<string>Messenger</string>');
  plist = plist.replace(/<key>CFBundleDisplayName<\/key>\s*<string>.*?<\/string>/, '<key>CFBundleDisplayName</key>\n\t<string>Messenger</string>');
  plist = plist.replace(/<key>CFBundleIdentifier<\/key>\s*<string>.*?<\/string>/, '<key>CFBundleIdentifier</key>\n\t<string>com.leo.messenger-desktop</string>');
  fs.writeFileSync(infoPlistPath, plist);
}

console.log('✅ Build complete: dist/Messenger.app');
console.log('📱 Run: npm run install-app');