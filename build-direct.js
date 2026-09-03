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

// Copy Electron app (must preserve symlinks — cp -r follows them and
// breaks .framework bundles, which makes Gatekeeper say the app is "damaged")
console.log('📦 Copying Electron binary...');
execSync(`ditto "${electronPath}" "${outputPath}"`);

// Create app directory
const appDir = path.join(outputPath, 'Contents/Resources/app');
fs.mkdirSync(appDir, { recursive: true });

// Copy app files
console.log('📄 Copying app files...');
fs.copyFileSync(path.join(__dirname, 'main.js'), path.join(appDir, 'main.js'));
fs.copyFileSync(path.join(__dirname, 'package.json'), path.join(appDir, 'package.json'));

// Copy preload.js if it exists
const preloadPath = path.join(__dirname, 'preload.js');
if (fs.existsSync(preloadPath)) {
  fs.copyFileSync(preloadPath, path.join(appDir, 'preload.js'));
}

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
  execSync(`ditto "${assetsPath}" "${appAssetsPath}"`);
}

// Copy custom icon
const iconPath = path.join(__dirname, 'assets/icon.icns');
if (fs.existsSync(iconPath)) {
  console.log('🎨 Copying custom icon...');
  fs.copyFileSync(iconPath, path.join(outputPath, 'Contents/Resources/electron.icns'));
}

// Update Info.plist
const infoPlistPath = path.join(outputPath, 'Contents/Info.plist');
if (fs.existsSync(infoPlistPath)) {
  console.log('📝 Updating Info.plist...');
  let plist = fs.readFileSync(infoPlistPath, 'utf8');
  plist = plist.replace(/<key>CFBundleName<\/key>\s*<string>.*?<\/string>/, '<key>CFBundleName</key>\n\t<string>Messenger</string>');
  plist = plist.replace(/<key>CFBundleDisplayName<\/key>\s*<string>.*?<\/string>/, '<key>CFBundleDisplayName</key>\n\t<string>Messenger</string>');
  plist = plist.replace(/<key>CFBundleIdentifier<\/key>\s*<string>.*?<\/string>/, '<key>CFBundleIdentifier</key>\n\t<string>com.leo.messenger-desktop</string>');
  plist = plist.replace(/<key>CFBundleIconFile<\/key>\s*<string>.*?<\/string>/, '<key>CFBundleIconFile</key>\n\t<string>electron</string>');
  fs.writeFileSync(infoPlistPath, plist);
}

// Clear quarantine / Finder metadata from the build machine
try {
  execSync(`xattr -cr "${outputPath}"`);
} catch (e) {
  // ignore
}

// Re-sign after we rewrite Info.plist and inject app files.
// Electron's shipped signature becomes invalid once modified; without a
// fresh ad-hoc signature, downloaded copies often show as "damaged".
console.log('🔏 Ad-hoc code signing...');
try {
  const frameworks = path.join(outputPath, 'Contents/Frameworks');
  const nested = [
    'Electron Framework.framework/Versions/A/Libraries/libffmpeg.dylib',
    'Electron Framework.framework/Versions/A/Libraries/libEGL.dylib',
    'Electron Framework.framework/Versions/A/Libraries/libGLESv2.dylib',
    'Electron Framework.framework/Versions/A/Libraries/libvk_swiftshader.dylib',
    'Electron Framework.framework',
    'Mantle.framework',
    'ReactiveObjC.framework',
    'Squirrel.framework',
    'Electron Helper.app',
    'Electron Helper (GPU).app',
    'Electron Helper (Plugin).app',
    'Electron Helper (Renderer).app',
  ];
  for (const rel of nested) {
    const target = path.join(frameworks, rel);
    if (fs.existsSync(target)) {
      execSync(`codesign --force --sign - --timestamp=none "${target}"`);
    }
  }
  execSync(`codesign --force --sign - --timestamp=none "${outputPath}"`);
  execSync(`codesign --verify --deep --strict "${outputPath}"`, { stdio: 'inherit' });
  console.log('✅ Code signature OK');
} catch (e) {
  console.warn('⚠️  codesign failed — other Macs may need: xattr -cr /path/to/Messenger.app');
  console.warn(String(e.message || e));
}

console.log('✅ Build complete: dist/Messenger.app');
console.log('📱 Run: npm run install-app');
console.log('ℹ️  Apple Silicon (arm64) build. Other Macs: xattr -cr /path/to/Messenger.app');