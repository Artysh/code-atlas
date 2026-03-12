/**
 * Generates the Code Atlas logo as an SVG file with a gradient background,
 * then converts it to PNG via the `sharp` library (if available) or
 * outputs just the SVG for manual conversion.
 *
 * Usage:  node scripts/generate-logo.mjs
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mediaDir = join(__dirname, '..', 'media');

const WIDTH = 800;
const HEIGHT = 280;

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0D1117"/>
      <stop offset="100%" stop-color="#161B22"/>
    </linearGradient>
    <linearGradient id="icon-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#58A6FF"/>
      <stop offset="50%" stop-color="#BC8CFF"/>
      <stop offset="100%" stop-color="#F778BA"/>
    </linearGradient>
    <linearGradient id="text-grad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#E6EDF3"/>
      <stop offset="100%" stop-color="#C9D1D9"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <filter id="icon-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" rx="20" fill="url(#bg)"/>

  <!-- Subtle grid pattern -->
  <g opacity="0.03" stroke="#58A6FF" stroke-width="0.5" fill="none">
    ${Array.from({ length: 20 }, (_, i) => `<line x1="${i * 40}" y1="0" x2="${i * 40}" y2="${HEIGHT}"/>`).join('\n    ')}
    ${Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${i * 40}" x2="${WIDTH}" y2="${i * 40}"/>`).join('\n    ')}
  </g>

  <!-- Decorative connection lines (background) -->
  <g opacity="0.12" stroke-width="1.5" fill="none">
    <line x1="80" y1="60" x2="180" y2="100" stroke="#58A6FF"/>
    <line x1="180" y1="100" x2="130" y2="180" stroke="#BC8CFF"/>
    <line x1="130" y1="180" x2="220" y2="200" stroke="#F778BA"/>
    <line x1="220" y1="200" x2="200" y2="120" stroke="#58A6FF"/>
    <line x1="80" y1="60" x2="130" y2="180" stroke="#BC8CFF" stroke-dasharray="4 3"/>
    <line x1="180" y1="100" x2="220" y2="200" stroke="#F778BA" stroke-dasharray="4 3"/>
  </g>

  <!-- Decorative small dots -->
  <g opacity="0.15">
    <circle cx="80" cy="60" r="3" fill="#58A6FF"/>
    <circle cx="220" cy="200" r="3" fill="#F778BA"/>
    <circle cx="700" cy="80" r="2" fill="#58A6FF"/>
    <circle cx="720" cy="200" r="2" fill="#BC8CFF"/>
    <circle cx="660" cy="220" r="2" fill="#F778BA"/>
  </g>

  <!-- Main icon (graph nodes network) — scaled & centered -->
  <g transform="translate(100, 44) scale(0.75)" filter="url(#icon-glow)">
    <path d="M200,152a31.84,31.84,0,0,0-19.53,6.68l-23.11-18A31.65,31.65,0,0,0,160,128c0-.74,0-1.48-.08-2.21l13.23-4.41A32,32,0,1,0,168,104c0,.74,0,1.48.08,2.21l-13.23,4.41A32,32,0,0,0,128,96a32.59,32.59,0,0,0-5.27.44L115.89,81A32,32,0,1,0,96,88a32.59,32.59,0,0,0,5.27-.44l6.84,15.4a31.92,31.92,0,0,0-8.57,39.64L73.83,165.44a32.06,32.06,0,1,0,10.63,12l25.71-22.84a31.91,31.91,0,0,0,37.36-1.24l23.11,18A31.65,31.65,0,0,0,168,184a32,32,0,1,0,32-32Z"
          fill="url(#icon-grad)"/>
    <!-- Node highlights -->
    <circle cx="200" cy="104" r="16" fill="#58A6FF" opacity="0.9"/>
    <circle cx="96" cy="56" r="16" fill="#BC8CFF" opacity="0.9"/>
    <circle cx="56" cy="192" r="16" fill="#F778BA" opacity="0.9"/>
    <circle cx="200" cy="184" r="16" fill="#58A6FF" opacity="0.9"/>
    <circle cx="128" cy="128" r="18" fill="#BC8CFF" opacity="0.7"/>

    <!-- Tiny connection sparkles -->
    <circle cx="200" cy="104" r="4" fill="white" opacity="0.6"/>
    <circle cx="96" cy="56" r="4" fill="white" opacity="0.6"/>
    <circle cx="56" cy="192" r="4" fill="white" opacity="0.6"/>
    <circle cx="200" cy="184" r="4" fill="white" opacity="0.6"/>
    <circle cx="128" cy="128" r="5" fill="white" opacity="0.5"/>
  </g>

  <!-- Text: "Code Atlas" -->
  <text x="350" y="128" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
        font-size="72" font-weight="700" fill="url(#text-grad)" letter-spacing="-2">
    Code Atlas
  </text>

  <!-- Subtitle -->
  <text x="352" y="168" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
        font-size="18" font-weight="400" fill="#8B949E" letter-spacing="0.5">
    Architecture Visualizer for VS Code
  </text>

  <!-- Tech badges -->
  <g transform="translate(352, 190)">
    <!-- TypeScript badge -->
    <rect x="0" y="0" width="86" height="24" rx="12" fill="#3178C6" opacity="0.25"/>
    <text x="43" y="16" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          font-size="11" font-weight="500" fill="#58A6FF">TypeScript</text>

    <!-- Kubernetes badge -->
    <rect x="96" y="0" width="86" height="24" rx="12" fill="#326CE5" opacity="0.25"/>
    <text x="139" y="16" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          font-size="11" font-weight="500" fill="#6B9BF0">Kubernetes</text>

    <!-- Argo badge -->
    <rect x="192" y="0" width="56" height="24" rx="12" fill="#EF7B4D" opacity="0.25"/>
    <text x="220" y="16" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          font-size="11" font-weight="500" fill="#F5A080">Argo</text>

    <!-- Helm badge -->
    <rect x="258" y="0" width="56" height="24" rx="12" fill="#0F1689" opacity="0.25"/>
    <text x="286" y="16" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          font-size="11" font-weight="500" fill="#7B7FFF">Helm</text>

    <!-- React badge -->
    <rect x="324" y="0" width="60" height="24" rx="12" fill="#61DAFB" opacity="0.2"/>
    <text x="354" y="16" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          font-size="11" font-weight="500" fill="#61DAFB">React</text>
  </g>
</svg>`;

// Write the banner SVG
const svgPath = join(mediaDir, 'logo-banner.svg');
writeFileSync(svgPath, svgContent);
console.log(`Written: ${svgPath}`);

// Also generate a simpler square icon SVG for use elsewhere
const iconSize = 256;
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}" viewBox="0 0 ${iconSize} ${iconSize}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0D1117"/>
      <stop offset="100%" stop-color="#161B22"/>
    </linearGradient>
    <linearGradient id="icon-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#58A6FF"/>
      <stop offset="50%" stop-color="#BC8CFF"/>
      <stop offset="100%" stop-color="#F778BA"/>
    </linearGradient>
    <filter id="icon-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="${iconSize}" height="${iconSize}" rx="48" fill="url(#bg)"/>

  <!-- Grid -->
  <g opacity="0.04" stroke="#58A6FF" stroke-width="0.5" fill="none">
    ${Array.from({ length: 9 }, (_, i) => `<line x1="${i * 32}" y1="0" x2="${i * 32}" y2="${iconSize}"/>`).join('\n    ')}
    ${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${i * 32}" x2="${iconSize}" y2="${i * 32}"/>`).join('\n    ')}
  </g>

  <g filter="url(#icon-glow)">
    <path d="M200,152a31.84,31.84,0,0,0-19.53,6.68l-23.11-18A31.65,31.65,0,0,0,160,128c0-.74,0-1.48-.08-2.21l13.23-4.41A32,32,0,1,0,168,104c0,.74,0,1.48.08,2.21l-13.23,4.41A32,32,0,0,0,128,96a32.59,32.59,0,0,0-5.27.44L115.89,81A32,32,0,1,0,96,88a32.59,32.59,0,0,0,5.27-.44l6.84,15.4a31.92,31.92,0,0,0-8.57,39.64L73.83,165.44a32.06,32.06,0,1,0,10.63,12l25.71-22.84a31.91,31.91,0,0,0,37.36-1.24l23.11,18A31.65,31.65,0,0,0,168,184a32,32,0,1,0,32-32Z"
          fill="url(#icon-grad)"/>
    <circle cx="200" cy="104" r="16" fill="#58A6FF" opacity="0.9"/>
    <circle cx="96" cy="56" r="16" fill="#BC8CFF" opacity="0.9"/>
    <circle cx="56" cy="192" r="16" fill="#F778BA" opacity="0.9"/>
    <circle cx="200" cy="184" r="16" fill="#58A6FF" opacity="0.9"/>
    <circle cx="128" cy="128" r="18" fill="#BC8CFF" opacity="0.7"/>
    <circle cx="200" cy="104" r="4" fill="white" opacity="0.6"/>
    <circle cx="96" cy="56" r="4" fill="white" opacity="0.6"/>
    <circle cx="56" cy="192" r="4" fill="white" opacity="0.6"/>
    <circle cx="200" cy="184" r="4" fill="white" opacity="0.6"/>
    <circle cx="128" cy="128" r="5" fill="white" opacity="0.5"/>
  </g>
</svg>`;

const iconSvgPath = join(mediaDir, 'logo-icon.svg');
writeFileSync(iconSvgPath, iconSvg);
console.log(`Written: ${iconSvgPath}`);

// Try to convert to PNG using sharp
try {
  const { default: sharp } = await import('sharp');

  await sharp(Buffer.from(svgContent))
    .resize(1600, 560)
    .png()
    .toFile(join(mediaDir, 'logo-banner.png'));
  console.log(`Written: ${join(mediaDir, 'logo-banner.png')}`);

  await sharp(Buffer.from(iconSvg))
    .resize(512, 512)
    .png()
    .toFile(join(mediaDir, 'logo-icon.png'));
  console.log(`Written: ${join(mediaDir, 'logo-icon.png')}`);

  console.log('PNG logos generated successfully!');
} catch {
  console.log('sharp not installed — SVGs written, will try alternative PNG conversion...');

  // Fallback: use built-in resvg-js or sips (macOS)
  try {
    const { execSync } = await import('child_process');
    // macOS has sips but it doesn't handle SVG. Let's use rsvg-convert or qlmanage
    execSync(`qlmanage -t -s 1600 -o "${mediaDir}" "${svgPath}" 2>/dev/null || true`);
    execSync(`qlmanage -t -s 512 -o "${mediaDir}" "${iconSvgPath}" 2>/dev/null || true`);
    console.log('Attempted macOS qlmanage conversion');
  } catch {
    console.log('No PNG converter available. Use the SVGs directly or install sharp: npm i sharp');
  }
}
