// Rasterise the brand SVGs into PNG app icons. Run with `npm run icons`.
// Committing the generated PNGs keeps the build dependency-light (sharp is only
// a devDependency used here), while giving installable-PWA + iOS coverage that
// SVG icons alone don't provide (Safari ignores SVG apple-touch-icons).
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const pub = fileURLToPath(new URL('../public/', import.meta.url))
await mkdir(`${pub}icons`, { recursive: true })

async function render(src, size, out, { flatten } = {}) {
  let img = sharp(`${pub}${src}`, { density: 1024 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  if (flatten) img = img.flatten({ background: '#0F766E' })
  await img.png().toFile(`${pub}${out}`)
  console.log(`✓ ${out} (${size}×${size})`)
}

// Standard "any" icons (transparent rounded tile).
await render('icon.svg', 192, 'icons/icon-192.png')
await render('icon.svg', 512, 'icons/icon-512.png')
// Maskable icon (full-bleed, safe-zoned).
await render('maskable.svg', 512, 'icons/maskable-512.png')
// iOS home-screen icon: must be an opaque PNG, so flatten onto the brand colour.
await render('icon.svg', 180, 'apple-touch-icon.png', { flatten: true })

console.log('Done.')
