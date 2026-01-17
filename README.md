# Messenger Desktop

A lightweight macOS wrapper for Facebook Messenger web app with persistent login and native macOS integration.

## Features

- 🔐 **Persistent Login** - Stay logged in after quitting the app (no password needed on restart!)
- 🖥️ Native macOS window with traffic light buttons and hidden title bar
- 🔔 Dock badge for unread message count
- ⌨️ Keyboard shortcuts for common actions
- 🪟 Window position remembered between sessions
- 🎨 Custom styling to hide annoying "download app" prompts and fix layout issues
- 🔗 External links open in default browser
- 📱 Single instance (clicking dock icon brings existing window to front)
- 🎯 Optimized layout - no unwanted scrollbars, proper window sizing

## Installation

### Quick Start (Development)

```bash
# Install dependencies
npm install

# Run the app
npm start
```

### Build for Production

```bash
# Build macOS app (creates both Intel and Apple Silicon versions)
npm run build
```

The built app will be in the `dist` folder:
- **`dist/mac/Messenger.app`** - Intel Mac version
- **`dist/mac-arm64/Messenger.app`** - Apple Silicon (M1/M2/M3) version
- **`dist/Messenger-1.0.0.dmg`** - DMG installer for Intel Mac
- **`dist/Messenger-1.0.0-arm64.dmg`** - DMG installer for Apple Silicon

### Install as a Real macOS Application

**Option 1: Install from DMG (Recommended)**
1. Open the appropriate DMG file for your Mac:
   - Intel Mac: `dist/Messenger-1.0.0.dmg`
   - Apple Silicon: `dist/Messenger-1.0.0-arm64.dmg`
2. Drag `Messenger.app` to your Applications folder
3. Open it from Applications (you may need to right-click and select "Open" the first time due to macOS security)

**Option 2: Install from .app directly**
1. Copy `Messenger.app` from `dist/mac/` or `dist/mac-arm64/` to your Applications folder
2. Open it from Applications

**Option 3: Quick install script**
```bash
# Automatically installs the correct version for your Mac to Applications
npm run install-app
```

**Note:** Since the app isn't code-signed, macOS may show a security warning. To open it:
- Right-click the app → "Open" → Click "Open" in the security dialog
- Or go to System Settings → Privacy & Security → Allow the app

After the first launch, it will open normally like any other app!

## App Icon

The app uses a custom original icon design (not the Facebook Messenger logo) to avoid trademark issues. The icon appears in:
- Dock when the app is running
- Applications folder
- About window
- App switcher (Cmd + Tab)
- Spotlight search results

### Generating macOS Icon (.icns)

To create a proper macOS `.icns` icon from the SVG for the built app:

```bash
# Install required tool
brew install librsvg

# Create iconset
mkdir -p assets/icon.iconset

# Generate different sizes
for size in 16 32 64 128 256 512; do
  rsvg-convert -w $size -h $size assets/icon.svg > "assets/icon.iconset/icon_${size}x${size}.png"
  size2=$((size * 2))
  if [ $size -le 256 ]; then
    rsvg-convert -w $size2 -h $size2 assets/icon.svg > "assets/icon.iconset/icon_${size}x${size}@2x.png"
  fi
done

# Convert to icns
iconutil -c icns assets/icon.iconset -o assets/icon.icns

# Cleanup
rm -rf assets/icon.iconset
```

Or you can use any image and convert it with online tools like [cloudconvert](https://cloudconvert.com/png-to-icns).

**Note:** The icon is optional - if `icon.icns` doesn't exist, Electron will use a default icon. The app will still work perfectly.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd + N` | New chat |
| `Cmd + ,` | Settings |
| `Cmd + F` | Search |
| `Cmd + R` | Reload page (keeps login session) |
| `Cmd + Shift + R` | Reload styles only (keeps login session) |
| `Cmd + Q` | Quit |
| `Cmd + +/-` | Zoom in/out |

## Session Persistence

The app uses Electron's persistent session storage to keep you logged in between app restarts. 

**How it works:**
1. Log in to Messenger the first time you use the app
2. Your login cookies are automatically saved to disk
3. When you restart the app, you'll be automatically logged in - no password needed!

**Session data location:**
```
~/Library/Application Support/messenger-desktop/Partitions/messenger/
```

**Note:** Make sure to quit the app properly (Cmd + Q) to ensure your session is saved correctly.

## Customization

Edit `styles.css` to customize the appearance of the Messenger interface. After making changes:
- Press `Cmd + Shift + R` to reload styles without losing your login session
- Or press `Cmd + R` to reload the entire page (session will still be preserved)

## Troubleshooting

**App not staying logged in?**
- Make sure you're using `Cmd + Q` to quit (not just closing the window)
- Check that the session partition directory exists in `~/Library/Application Support/messenger-desktop/`

**Seeing unwanted scrollbars?**
- The CSS should prevent this, but if you see issues, try `Cmd + Shift + R` to reload styles
- Or restart the app

**Styles not applying?**
- Press `Cmd + Shift + R` to reload styles
- Or restart the app

## License

MIT - For personal use only.
