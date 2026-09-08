const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;

const imgDir = path.join(__dirname, '..', 'assets', 'images');
const logoOriginalPath = path.join(imgDir, 'Quizary_Logo_Original.png');
const logoWhitePath = path.join(imgDir, 'Quizary_Logo_White.png');

if (!fs.existsSync(logoOriginalPath) || !fs.existsSync(logoWhitePath)) {
  console.error('Quizary logo files missing!');
  process.exit(1);
}

const logoOriginal = PNG.sync.read(fs.readFileSync(logoOriginalPath));
const logoWhite = PNG.sync.read(fs.readFileSync(logoWhitePath));

function rescale(srcPng, targetWidth, targetHeight) {
  const dst = new PNG({ width: targetWidth, height: targetHeight });
  const xRatio = srcPng.width / targetWidth;
  const yRatio = srcPng.height / targetHeight;

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const px = Math.floor(x * xRatio);
      const py = Math.floor(y * yRatio);
      const srcIdx = (py * srcPng.width + px) * 4;
      const dstIdx = (y * targetWidth + x) * 4;

      dst.data[dstIdx] = srcPng.data[srcIdx];
      dst.data[dstIdx + 1] = srcPng.data[srcIdx + 1];
      dst.data[dstIdx + 2] = srcPng.data[srcIdx + 2];
      dst.data[dstIdx + 3] = srcPng.data[srcIdx + 3];
    }
  }
  return dst;
}

function placeOnCanvas(srcPng, canvasWidth, canvasHeight, targetLogoSize, bgColor = null) {
  const dst = new PNG({ width: canvasWidth, height: canvasHeight });

  for (let i = 0; i < canvasWidth * canvasHeight; i++) {
    const idx = i * 4;
    if (bgColor) {
      dst.data[idx] = bgColor.r;
      dst.data[idx + 1] = bgColor.g;
      dst.data[idx + 2] = bgColor.b;
      dst.data[idx + 3] = bgColor.a;
    } else {
      dst.data[idx] = 0;
      dst.data[idx + 1] = 0;
      dst.data[idx + 2] = 0;
      dst.data[idx + 3] = 0;
    }
  }

  const scaledLogo = rescale(srcPng, targetLogoSize, targetLogoSize);

  const startX = Math.floor((canvasWidth - targetLogoSize) / 2);
  const startY = Math.floor((canvasHeight - targetLogoSize) / 2);

  for (let y = 0; y < targetLogoSize; y++) {
    for (let x = 0; x < targetLogoSize; x++) {
      const dstX = startX + x;
      const dstY = startY + y;
      if (dstX >= 0 && dstX < canvasWidth && dstY >= 0 && dstY < canvasHeight) {
        const srcIdx = (y * targetLogoSize + x) * 4;
        const dstIdx = (dstY * canvasWidth + dstX) * 4;
        const alpha = scaledLogo.data[srcIdx + 3] / 255;

        if (alpha > 0) {
          if (bgColor) {
            dst.data[dstIdx] = Math.round(scaledLogo.data[srcIdx] * alpha + dst.data[dstIdx] * (1 - alpha));
            dst.data[dstIdx + 1] = Math.round(scaledLogo.data[srcIdx + 1] * alpha + dst.data[dstIdx + 1] * (1 - alpha));
            dst.data[dstIdx + 2] = Math.round(scaledLogo.data[srcIdx + 2] * alpha + dst.data[dstIdx + 2] * (1 - alpha));
            dst.data[dstIdx + 3] = 255;
          } else {
            dst.data[dstIdx] = scaledLogo.data[srcIdx];
            dst.data[dstIdx + 1] = scaledLogo.data[srcIdx + 1];
            dst.data[dstIdx + 2] = scaledLogo.data[srcIdx + 2];
            dst.data[dstIdx + 3] = scaledLogo.data[srcIdx + 3];
          }
        }
      }
    }
  }

  return dst;
}

const darkBg = { r: 15, g: 23, b: 42, a: 255 }; // #0F172A sleek Quizary dark color

console.log('Generating Quizary icons...');

// 1. icon.png (1024 x 1024) - Main Launcher Icon
const iconPng = placeOnCanvas(logoOriginal, 1024, 1024, 640, darkBg);
fs.writeFileSync(path.join(imgDir, 'icon.png'), PNG.sync.write(iconPng));
console.log('✔ icon.png (1024x1024) generated');

// 2. android-icon-foreground.png (512 x 512) - Adaptive Icon Foreground
const fgPng = placeOnCanvas(logoOriginal, 512, 512, 320, null);
fs.writeFileSync(path.join(imgDir, 'android-icon-foreground.png'), PNG.sync.write(fgPng));
console.log('✔ android-icon-foreground.png (512x512) generated');

// 3. android-icon-background.png (512 x 512) - Adaptive Icon Background
const bgPng = placeOnCanvas(logoOriginal, 512, 512, 1, darkBg); // solid dark canvas
fs.writeFileSync(path.join(imgDir, 'android-icon-background.png'), PNG.sync.write(bgPng));
console.log('✔ android-icon-background.png (512x512) generated');

// 4. android-icon-monochrome.png (512 x 512) - Monochrome/Themed Icon
const monoPng = placeOnCanvas(logoWhite, 512, 512, 320, null);
fs.writeFileSync(path.join(imgDir, 'android-icon-monochrome.png'), PNG.sync.write(monoPng));
console.log('✔ android-icon-monochrome.png (512x512) generated');

// 5. splash-icon.png (512 x 512) - Splash Screen Icon
const splashPng = placeOnCanvas(logoWhite, 512, 512, 280, null);
fs.writeFileSync(path.join(imgDir, 'splash-icon.png'), PNG.sync.write(splashPng));
console.log('✔ splash-icon.png (512x512) generated');

// 6. favicon.png (48 x 48) - Web Favicon
const faviconPng = placeOnCanvas(logoOriginal, 48, 48, 40, null);
fs.writeFileSync(path.join(imgDir, 'favicon.png'), PNG.sync.write(faviconPng));
console.log('✔ favicon.png (48x48) generated');

console.log('🎉 ALL QUIZARY APK LOGOS AND ICONS GENERATED SUCCESSFULLY!');
