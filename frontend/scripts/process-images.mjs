// Build-time photographic treatment (design brief §4.4).
//
//   node scripts/process-images.mjs <directory with the original downloads>
//
// Each original is cropped to a fixed aspect ratio, resized to web size, desaturated, given the site's single treatment
// and written to public/images/*.webp. sharp drops EXIF, XMP and IPTC metadata unless asked to keep it, so the outputs
// carry no GPS or location fields. The originals are not committed.
//
// Treatments
//   overlay  – desaturate to ~30 %, lift blacks, then an evergreen multiply overlay (used behind text on the hero)
//   duotone  – two-tone map, shadows #0F3D33 to highlights #F6F1E7 (section headers and the About portrait)

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "../public/images");
const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/process-images.mjs <source-dir>");
  process.exit(1);
}

const EVERGREEN = [0x0f, 0x3d, 0x33];
const IVORY = [0xf6, 0xf1, 0xe7];

/** file: original name; ratio: w/h; width: output width; top: vertical anchor of the crop window (0 top, 1 bottom). */
const JOBS = [
  { file: "YIYSe_lLxnY.jpg", name: "hero-grain-sifting", ratio: 21 / 9, width: 2400, top: 0.6, treat: "overlay" },
  { file: "Gz-3pPHOKzw.jpg", name: "header-irrigated-fields", ratio: 3, width: 1920, top: 0.5, treat: "duotone" },
  { file: "Gyxf5xtYkKI.jpg", name: "header-dried-maize", ratio: 3, width: 1920, top: 0.45, treat: "duotone" },
  { file: "4rTXOMv28VA.jpg", name: "header-budget-papers", ratio: 3, width: 1920, top: 0.47, treat: "duotone" },
  { file: "snNHKZ-mGfE.jpg", name: "header-document-stacks", ratio: 3, width: 1920, top: 0.62, treat: "duotone" },
  { file: "OWlfU_l2MAQ.jpg", name: "portrait-carrying-grain", ratio: 4 / 5, width: 880, top: 0.35, treat: "duotone" },
];

async function crop(file, ratio, width, top) {
  const img = sharp(path.join(src, file)).rotate();
  const { width: w, height: h } = await img.metadata();
  let cw = w;
  let ch = Math.round(w / ratio);
  if (ch > h) {
    ch = h;
    cw = Math.round(h * ratio);
  }
  const left = Math.round((w - cw) / 2);
  const t = Math.round((h - ch) * top);
  return img.extract({ left, top: t, width: cw, height: ch }).resize({ width, height: Math.round(width / ratio) });
}

async function treat(pipeline, kind) {
  if (kind === "duotone") {
    const { data, info } = await pipeline.clone().greyscale().normalise().raw().toBuffer({ resolveWithObject: true });
    const n = info.width * info.height;
    const rgb = Buffer.alloc(n * 3);
    for (let i = 0; i < n; i++) {
      // gentle contrast curve so the evergreen end holds detail
      const t = Math.pow(data[i * info.channels] / 255, 0.9);
      for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.round(EVERGREEN[c] + (IVORY[c] - EVERGREEN[c]) * t);
    }
    return sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } });
  }
  // overlay: desaturate, lift blacks, then multiply with evergreen at 68 %
  const { data, info } = await pipeline
    .clone()
    .modulate({ saturation: 0.3 })
    .linear(0.86, 18)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const a = 0.68;
  const rgb = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0; i < info.width * info.height; i++) {
    for (let c = 0; c < 3; c++) {
      const p = data[i * info.channels + c];
      rgb[i * 3 + c] = Math.round(p * (1 - a) + ((p * EVERGREEN[c]) / 255) * a);
    }
  }
  return sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } });
}

fs.mkdirSync(out, { recursive: true });
for (const j of JOBS) {
  const cropped = await crop(j.file, j.ratio, j.width, j.top);
  const treated = await treat(cropped, j.treat);
  const dest = path.join(out, `${j.name}.webp`);
  const info = await treated.webp({ quality: 78, effort: 6 }).toFile(dest);
  console.log(`${j.name}.webp  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
}
