const fs = require('fs');
const { createCanvas } = require('canvas');

// Install canvas if not available: npm install canvas
function createIcon(size) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Orange background with rounded corners
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(0, 0, size, size);
    
    // Simple lightning bolt approximation
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    
    const scale = size / 512;
    const centerX = size / 2;
    const centerY = size / 2;
    
    // Simple lightning bolt shape
    ctx.moveTo(centerX - 30 * scale, centerY - 80 * scale);
    ctx.lineTo(centerX + 10 * scale, centerY - 80 * scale);
    ctx.lineTo(centerX - 20 * scale, centerY);
    ctx.lineTo(centerX + 20 * scale, centerY);
    ctx.lineTo(centerX - 10 * scale, centerY + 80 * scale);
    ctx.lineTo(centerX - 30 * scale, centerY + 80 * scale);
    ctx.lineTo(centerX, centerY + 20 * scale);
    ctx.lineTo(centerX - 20 * scale, centerY - 20 * scale);
    ctx.closePath();
    ctx.fill();
    
    return canvas.toBuffer('image/png');
}

const sizes = [16, 32, 64, 128, 256, 512, 1024];

try {
    // Create iconset directory
    if (!fs.existsSync('assets/icon.iconset')) {
        fs.mkdirSync('assets/icon.iconset', { recursive: true });
    }
    
    sizes.forEach(size => {
        const buffer = createIcon(size);
        let filename;
        
        if (size <= 32) {
            filename = `icon_${size}x${size}.png`;
        } else {
            filename = `icon_${size}x${size}.png`;
            // Also create @2x versions for retina
            if (size >= 32) {
                fs.writeFileSync(`assets/icon.iconset/icon_${size/2}x${size/2}@2x.png`, buffer);
            }
        }
        
        fs.writeFileSync(`assets/icon.iconset/${filename}`, buffer);
        console.log(`Created ${filename}`);
    });
    
    console.log('All icon sizes created successfully!');
} catch (error) {
    console.log('Canvas module not available. Creating simple icon files...');
    
    // Fallback: copy a simple icon
    const simpleIcon = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG header
        // ... (this would be a minimal PNG, but let's use a different approach)
    ]);
    
    console.log('Please install canvas: npm install canvas');
    console.log('Or create icons manually and run: iconutil -c icns assets/icon.iconset');
}