const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const version = require('./package.json').version;
const appPath = path.join(__dirname, 'dist/Messenger.app');
const releasePath = path.join(__dirname, 'release-assets');
const dmgPath = path.join(releasePath, `Messenger-${version}-macOS.dmg`);

console.log(`🚀 Creating release for version ${version}...`);

// Clean and create release directory
if (fs.existsSync(releasePath)) {
  fs.rmSync(releasePath, { recursive: true, force: true });
}
fs.mkdirSync(releasePath, { recursive: true });

// Check if app exists
if (!fs.existsSync(appPath)) {
  console.error('❌ Messenger.app not found. Run npm run build first.');
  process.exit(1);
}

// Strip any quarantine attrs before packaging
try {
  execSync(`xattr -cr "${appPath}"`);
} catch (e) {
  // ignore
}

console.log('📦 Creating DMG installer...');

// Create temporary DMG directory
const tempDmgDir = path.join(releasePath, 'dmg-temp');
fs.mkdirSync(tempDmgDir, { recursive: true });

// Copy app to temp directory (preserve symlinks)
execSync(`ditto "${appPath}" "${path.join(tempDmgDir, 'Messenger.app')}"`);
execSync(`xattr -cr "${path.join(tempDmgDir, 'Messenger.app')}"`);

// Create Applications symlink for easy installation
execSync(`ln -s /Applications "${tempDmgDir}/Applications"`);

// Create DMG
const dmgName = `Messenger-${version}-macOS`;
try {
  execSync(`hdiutil create -volname "${dmgName}" -srcfolder "${tempDmgDir}" -ov -format UDZO "${dmgPath}"`);
  console.log(`✅ DMG created: ${dmgPath}`);
} catch (error) {
  console.error('❌ Failed to create DMG:', error.message);
}

// Always create a ZIP that preserves symlinks (zip -y / ditto)
console.log('📦 Creating ZIP...');
const zipPath = path.join(releasePath, `Messenger-${version}-macOS.zip`);
try {
  // ditto keeps macOS resource forks + symlinks correctly for .app bundles
  execSync(`ditto -c -k --sequesterRsrc --keepParent "${appPath}" "${zipPath}"`);
  console.log(`✅ ZIP created: ${zipPath}`);
} catch (error) {
  console.error('❌ Failed to create ZIP:', error.message);
  execSync(`cd "${path.dirname(appPath)}" && zip -ry "${zipPath}" "$(basename "${appPath}")"`);
  console.log(`✅ ZIP created (fallback): ${zipPath}`);
}

// Clean up temp directory
fs.rmSync(tempDmgDir, { recursive: true, force: true });

// Create checksums
console.log('🔐 Creating checksums...');
const files = fs.readdirSync(releasePath).filter(f => f.endsWith('.dmg') || f.endsWith('.zip'));
files.forEach(file => {
  const filePath = path.join(releasePath, file);
  const checksum = execSync(`shasum -a 256 "${filePath}"`).toString().trim();
  fs.writeFileSync(filePath + '.sha256', checksum);
  console.log(`   ${file}: ${checksum.split(' ')[0]}`);
});

console.log('🎉 Release assets ready!');
console.log(`📂 Location: ${releasePath}`);
fs.readdirSync(releasePath).forEach(file => {
  const stats = fs.statSync(path.join(releasePath, file));
  console.log(`   ${file} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
});