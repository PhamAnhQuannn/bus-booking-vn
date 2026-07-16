/**
 * One-off script to generate all brand assets from the design source files.
 *
 * Input (project root):
 *   - logo.png                  (1254×1254, primary logo on white bg)
 *   - complete-logo.png         (1774×887, 2×2 grid: orange|white|dark|peach bg)
 *   - favicon design set.png    (1536×1024, 2×2 grid: icon variants)
 *
 * Output:
 *   - public/logo-light.png     (transparent, for light surfaces)
 *   - public/logo-dark.png      (transparent, for dark surfaces)
 *   - app/icon.png              (32×32 tab icon)
 *   - app/apple-icon.png        (180×180 iOS home screen)
 *   - app/favicon.ico           (16+32+48 multi-res)
 *   - public/icons/icon-192.png (PWA manifest)
 *   - public/icons/icon-512.png (PWA manifest)
 *
 * Usage: node scripts/generate-logo-assets.mjs
 */

import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Background removal via color-distance thresholding on RGBA buffer
// ---------------------------------------------------------------------------

async function removeBackground(inputBuffer, bgRgb, threshold = 30, feather = 20) {
  const image = sharp(inputBuffer).ensureAlpha();
  const { info, data } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const buf = Buffer.from(data);

  for (let i = 0; i < buf.length; i += 4) {
    const dr = buf[i] - bgRgb[0];
    const dg = buf[i + 1] - bgRgb[1];
    const db = buf[i + 2] - bgRgb[2];
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    if (dist < threshold) {
      buf[i + 3] = 0;
    } else if (dist < threshold + feather) {
      const t = (dist - threshold) / feather;
      buf[i + 3] = Math.round(buf[i + 3] * t);
    }
  }

  return sharp(buf, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

// ---------------------------------------------------------------------------
// Detect background color by sampling edge pixels (corners + edge midpoints)
// ---------------------------------------------------------------------------

async function detectBgColor(inputBuffer) {
  const image = sharp(inputBuffer).ensureAlpha();
  const { info, data } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const ch = 4;

  function px(x, y) {
    const i = (y * width + x) * ch;
    return [data[i], data[i + 1], data[i + 2]];
  }

  const samples = [
    px(2, 2),
    px(width - 3, 2),
    px(2, height - 3),
    px(width - 3, height - 3),
    px(Math.floor(width / 2), 2),
    px(2, Math.floor(height / 2)),
  ];

  return samples[0].map((_, i) =>
    Math.round(samples.reduce((s, c) => s + c[i], 0) / samples.length),
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await mkdir(join(ROOT, 'public/icons'), { recursive: true });

  console.log('=== Step 1: Generate transparent logos ===');

  // --- Light-mode logo from logo.png (1254×1254, white bg) ---
  const logoPng = await sharp(join(ROOT, 'logo.png')).toBuffer();
  const logoBg = await detectBgColor(logoPng);
  console.log('  logo.png detected bg:', logoBg);

  const logoLightRaw = await removeBackground(logoPng, logoBg, 28, 18);
  const logoLight = await sharp(logoLightRaw).trim().toBuffer();
  await sharp(logoLight).toFile(join(ROOT, 'public/logo-light.png'));
  console.log('  ✓ public/logo-light.png');

  // --- Dark-mode logo from complete-logo.png bottom-left quadrant ---
  // Grid is 1774×887 but NOT evenly split. Horizontal divider at y≈458.
  // Scan left-edge pixels to find exact divider (orange→dark transition).
  const completeLogoMeta = await sharp(join(ROOT, 'complete-logo.png')).metadata();
  const clW = completeLogoMeta.width;
  const clH = completeLogoMeta.height;
  const clRaw = await sharp(join(ROOT, 'complete-logo.png')).ensureAlpha().raw().toBuffer();
  const clCh = 4;

  let dividerY = Math.floor(clH / 2);
  for (let y = Math.floor(clH / 2) - 20; y < Math.floor(clH / 2) + 30; y++) {
    const i = (y * clW + 5) * clCh;
    if (clRaw[i] < 80 && clRaw[i + 1] < 80 && clRaw[i + 2] < 80) {
      dividerY = y;
      break;
    }
  }
  console.log('  Detected grid divider at y =', dividerY);

  const cw = Math.floor(clW / 2);
  const margin = 5;

  const darkQuadrant = await sharp(join(ROOT, 'complete-logo.png'))
    .extract({
      left: margin,
      top: dividerY + margin,
      width: cw - margin * 2,
      height: clH - dividerY - margin * 2,
    })
    .toBuffer();

  const darkBg = await detectBgColor(darkQuadrant);
  console.log('  complete-logo.png dark quadrant bg:', darkBg);

  const logoDarkRaw = await removeBackground(darkQuadrant, darkBg, 35, 22);
  const logoDark = await sharp(logoDarkRaw).trim().toBuffer();
  await sharp(logoDark).toFile(join(ROOT, 'public/logo-dark.png'));
  console.log('  ✓ public/logo-dark.png');

  console.log('\n=== Step 2: Generate favicon & app icons ===');

  // --- Extract icon from favicon design set, top-right quadrant (white bg) ---
  const faviconMeta = await sharp(join(ROOT, 'favicon design set.png')).metadata();
  const fw = Math.floor(faviconMeta.width / 2);
  const fh = Math.floor(faviconMeta.height / 2);

  const iconQuadrant = await sharp(join(ROOT, 'favicon design set.png'))
    .extract({ left: fw + 10, top: 10, width: fw - 20, height: fh - 20 })
    .toBuffer();

  // Trim surrounding whitespace to isolate the rounded-square icon
  const iconTrimmed = await sharp(iconQuadrant)
    .trim({ threshold: 15 })
    .toBuffer();

  const iconMeta = await sharp(iconTrimmed).metadata();
  console.log(`  Icon mark isolated: ${iconMeta.width}×${iconMeta.height}`);

  // Generate each size
  const sizes = [
    { size: 16, dest: null },
    { size: 32, dest: join(ROOT, 'app/icon.png') },
    { size: 48, dest: null },
    { size: 180, dest: join(ROOT, 'app/apple-icon.png') },
    { size: 192, dest: join(ROOT, 'public/icons/icon-192.png') },
    { size: 512, dest: join(ROOT, 'public/icons/icon-512.png') },
  ];

  const icoSources = [];

  for (const { size, dest } of sizes) {
    const buf = await sharp(iconTrimmed)
      .resize(size, size, { kernel: 'lanczos3', fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();

    if (dest) {
      await writeFile(dest, buf);
      console.log(`  ✓ ${dest.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`);
    }

    if ([16, 32, 48].includes(size)) {
      icoSources.push(buf);
    }
  }

  // Generate favicon.ico
  const ico = await pngToIco(icoSources);
  await writeFile(join(ROOT, 'app/favicon.ico'), ico);
  console.log('  ✓ app/favicon.ico');

  console.log('\n=== Done ===');
  console.log('Generated 7 files. Run `pnpm dev` to verify.');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
