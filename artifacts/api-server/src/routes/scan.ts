import { Router, type IRouter } from "express";
import multer from "multer";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { getRecipesData } from "./recipes";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });

const ICON_CACHE_DIR = path.join(process.cwd(), ".icon-cache");
const HASH_FILE = path.join(ICON_CACHE_DIR, "hashes.json");
const PHASH_THRESHOLD = 18;

interface HashEntry { name: string; hash: string }

// Approximate dominant hue (HSV degrees) and saturation for items that frequently
// produce identical pHash distances (i.e. their wiki icons look similar in DCT space).
// Used only when two items tie at the same Hamming distance.
const COLOR_HINTS: Record<string, { h: number; s: number }> = {
  "brain":          { h: 350, s: 0.55 }, // warm reddish-pink organ
  "cotton candy":   { h: 295, s: 0.30 }, // cool pastel purple-pink
  "potato":         { h: 27,  s: 0.38 }, // warm brownish-beige
  "stew":           { h: 14,  s: 0.58 }, // orange-brown soup
  "cactus softdrink": { h: 150, s: 0.50 }, // green/teal cactus drink
  "egg toddy":      { h: 42,  s: 0.45 }, // golden-yellow egg drink
};

async function getCellHueSat(buf: Buffer): Promise<{ h: number; s: number } | null> {
  try {
    const { data } = await sharp(buf)
      .flatten({ background: { r: 15, g: 15, b: 15 } })
      .resize(8, 8, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let sumR = 0, sumG = 0, sumB = 0, cnt = 0;
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r + g + b > 60) { sumR += r; sumG += g; sumB += b; cnt++; }
    }
    if (cnt === 0) return null;

    const r = sumR / cnt / 255, g = sumG / cnt / 255, b = sumB / cnt / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    const s = max === 0 ? 0 : delta / max;
    let h = 0;
    if (delta > 0.02) {
      if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6 * 360;
      else if (max === g) h = ((b - r) / delta + 2) / 6 * 360;
      else h = ((r - g) / delta + 4) / 6 * 360;
    }
    return { h, s };
  } catch { return null; }
}

function hueDistance(h1: number, h2: number): number {
  const d = Math.abs(h1 - h2) % 360;
  return Math.min(d, 360 - d);
}

let hashMap: Map<string, bigint> | null = null;
let hashMapBuiltAt = 0;
let buildingPromise: Promise<Map<string, bigint>> | null = null;
let buildProgress = 0;
let buildTotal = 0;
const HASH_TTL = 12 * 60 * 60 * 1000;

// ---- pHash ----

function dct1d(sig: number[]): number[] {
  const N = sig.length;
  return Array.from({ length: N }, (_, k) =>
    sig.reduce((s, v, n) => s + v * Math.cos((Math.PI / N) * (n + 0.5) * k), 0)
  );
}

async function phash(buf: Buffer): Promise<bigint> {
  const N = 32;
  const { data } = await sharp(buf)
    .flatten({ background: { r: 15, g: 15, b: 15 } })
    .resize(N, N, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const matrix = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => data[i * N + j])
  );

  const rowDct = matrix.map(row => dct1d(row));
  const dct: number[][] = Array.from({ length: N }, () => new Array(N));
  for (let j = 0; j < N; j++) {
    const col = dct1d(rowDct.map(r => r[j]));
    for (let i = 0; i < N; i++) dct[i][j] = col[i];
  }

  const coeffs: number[] = [];
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++)
      if (i > 0 || j > 0) coeffs.push(dct[i][j]);

  const mean = coeffs.reduce((a, b) => a + b, 0) / coeffs.length;
  let h = 0n;
  for (const c of coeffs) h = (h << 1n) | (c >= mean ? 1n : 0n);
  return h;
}

function hammingDist(a: bigint, b: bigint): number {
  let x = a ^ b, n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

// ---- Icon fetching ----

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getIconUrl(itemName: string, retries = 2): Promise<string | null> {
  const fileName = itemName.replace(/ /g, "_");
  const url = `https://sulfur.wiki.gg/api.php?action=query&titles=File:${encodeURIComponent(fileName)}.png&prop=imageinfo&iiprop=url&format=json`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SulfurRecipeFinder/1.0 (recipe-finder)" },
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") ?? "15", 10);
      if (retries > 0) {
        await sleep((retryAfter + 1) * 1000);
        return getIconUrl(itemName, retries - 1);
      }
      return null;
    }
    if (!res.ok) return null;
    const json = await res.json() as { query?: { pages?: Record<string, { imageinfo?: { url: string }[] }> } };
    for (const page of Object.values(json.query?.pages ?? {})) {
      if (page.imageinfo?.[0]?.url) return page.imageinfo[0].url;
    }
    return null;
  } catch { return null; }
}

async function downloadBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SulfurRecipeFinder/1.0 (recipe-finder)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

// ---- Build hash map ----

async function buildHashMap(): Promise<Map<string, bigint>> {
  if (!existsSync(ICON_CACHE_DIR)) mkdirSync(ICON_CACHE_DIR, { recursive: true });

  if (existsSync(HASH_FILE)) {
    try {
      const raw = await fs.readFile(HASH_FILE, "utf8");
      const entries: HashEntry[] = JSON.parse(raw);
      const map = new Map<string, bigint>();
      for (const { name, hash } of entries) map.set(name.toLowerCase(), BigInt("0x" + hash));
      if (map.size > 0) {
        console.log(`[scan] Loaded ${map.size} icon hashes from disk cache`);
        return map;
      }
    } catch (e) {
      console.error("[scan] Failed to load hash cache:", e);
    }
  }

  console.log("[scan] Building icon hash library...");
  const { recipes } = await getRecipesData();
  console.log(`[scan] Got ${recipes.length} recipes to build icon library`);
  
  const itemNames = new Set<string>();
  for (const r of recipes) {
    itemNames.add(r.name);
    for (const variant of r.variants)
      for (const ing of variant)
        itemNames.add(ing.replace(/\s*x\d+\s*$/i, "").trim());
  }
  buildTotal = itemNames.size;
  buildProgress = 0;
  console.log(`[scan] Building hashes for ${itemNames.size} unique item names`);

  const map = new Map<string, bigint>();
  const entries: HashEntry[] = [];
  const BATCH = 2;
  const BATCH_DELAY = 600;
  const names = Array.from(itemNames);

  for (let i = 0; i < names.length; i += BATCH) {
    await Promise.all(names.slice(i, i + BATCH).map(async name => {
      try {
        const iconUrl = await getIconUrl(name);
        if (!iconUrl) return;
        const buf = await downloadBuffer(iconUrl);
        if (!buf) return;
        const h = await phash(buf);
        map.set(name.toLowerCase(), h);
        entries.push({ name, hash: h.toString(16) });
      } catch (e) {
        console.error(`[scan] Error hashing icon for ${name}:`, e);
      } finally {
        buildProgress++;
      }
    }));
    await sleep(BATCH_DELAY);
    if (i % 20 === 0) {
      console.log(`[scan] Processed ${Math.min(i + BATCH, names.length)}/${names.length} items (${map.size} hashed so far)`);
      // Save incremental progress so a restart doesn't lose work
      try { await fs.writeFile(HASH_FILE, JSON.stringify(entries)); } catch { }
    }
  }

  console.log(`[scan] Icon library built: ${map.size} items hashed`);
  try { await fs.writeFile(HASH_FILE, JSON.stringify(entries)); } catch (e) {
    console.error("[scan] Failed to save hash cache:", e);
  }
  return map;
}

async function getHashMap(): Promise<Map<string, bigint>> {
  if (hashMap && hashMap.size > 0 && Date.now() - hashMapBuiltAt < HASH_TTL) return hashMap;
  if (!buildingPromise) {
    buildingPromise = buildHashMap().then(m => {
      hashMap = m;
      hashMapBuiltAt = Date.now();
      buildingPromise = null;
      return m;
    }).catch(() => {
      buildingPromise = null;
      return new Map();
    });
  }
  return buildingPromise;
}

// Delay pre-warm so the server and recipe data are ready before hammering the wiki API
setTimeout(() => { getHashMap().catch(() => { }); }, 15_000);

// ---- Grid detection ----

function isOrangePixel(r: number, g: number, b: number): boolean {
  return r > 130 && g > 65 && g < 195 && b < 90 && r > g && g > b * 1.4;
}

function findMidpoints(scores: Uint32Array, threshold: number): number[] {
  const pts: number[] = [];
  let start = -1;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] >= threshold) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      pts.push((start + i - 1) >> 1);
      start = -1;
    }
  }
  if (start >= 0) pts.push((start + scores.length - 1) >> 1);
  return pts;
}

interface Cell { x: number; y: number; w: number; h: number }

async function detectCells(imgBuf: Buffer): Promise<Cell[]> {
  const meta = await sharp(imgBuf).metadata();
  const W = meta.width ?? 0, H = meta.height ?? 0;
  if (W === 0 || H === 0) return [];

  const { data } = await sharp(imgBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rowHits = new Uint32Array(H);
  const colHits = new Uint32Array(W);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 3;
      if (isOrangePixel(data[idx], data[idx + 1], data[idx + 2])) {
        rowHits[y]++;
        colHits[x]++;
      }
    }
  }

  // True grid lines span the full image width/height; item icons only cover one cell.
  // 50% threshold separates full-width orange lines from orange-tinted items.
  const rThresh = W * 0.5;
  const cThresh = H * 0.5;
  const hLines = findMidpoints(rowHits, rThresh);
  const vLines = findMidpoints(colHits, cThresh);

  if (hLines.length < 2 || vLines.length < 2) return [];

  const cells: Cell[] = [];
  for (let r = 0; r < hLines.length - 1; r++) {
    for (let c = 0; c < vLines.length - 1; c++) {
      const y = hLines[r], x = vLines[c];
      const h = hLines[r + 1] - y, w = vLines[c + 1] - x;
      if (w > 40 && h > 40) cells.push({ x, y, w, h });
    }
  }
  return cells;
}

async function isCellEmpty(imgBuf: Buffer, cell: Cell): Promise<boolean> {
  try {
    const { data } = await sharp(imgBuf)
      .extract({ left: cell.x, top: cell.y, width: cell.w, height: cell.h })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let sum = 0;
    for (const v of data) sum += v;
    return sum / data.length < 30;
  } catch { return true; }
}

// ---- Endpoints ----

router.post("/recipes/scan-screenshot", upload.single("image"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No image provided" }); return; }

  if (!hashMap || hashMap.size === 0) {
    res.status(503).json({
      error: "Icon library is still building",
      building: buildingPromise !== null,
      progress: buildProgress,
      total: buildTotal,
    });
    return;
  }

  try {
    const [cells, hashes] = await Promise.all([
      detectCells(req.file.buffer),
      Promise.resolve(hashMap),
    ]);

    if (cells.length === 0) {
      res.json({ items: [], detected: 0, message: "No inventory grid detected" });
      return;
    }

    const counts = new Map<string, number>();
    const debugMode = req.query.debug === "1";
    const debugRows: { cell: Cell; best: string; dist: number; color?: { h: number; s: number }; top3: { name: string; dist: number }[] }[] = [];

    for (const cell of cells) {
      try {
        if (await isCellEmpty(req.file.buffer, cell)) continue;

        const pad = Math.floor(Math.min(cell.w, cell.h) * 0.08);
        const ex = {
          left: cell.x + pad,
          top: cell.y + pad,
          width: Math.max(1, cell.w - pad * 2),
          height: Math.max(1, cell.h - pad * 2),
        };
        const cellBuf = await sharp(req.file.buffer).extract(ex).toBuffer();
        const cellHash = await phash(cellBuf);

        let best = "", bestDist = 64, secondDist = 64;
        const allDists: { name: string; dist: number }[] = [];
        for (const [name, h] of hashes) {
          const d = hammingDist(cellHash, h);
          if (debugMode) allDists.push({ name, dist: d });
          if (d < bestDist) { secondDist = bestDist; bestDist = d; best = name; }
          else if (d < secondDist) { secondDist = d; }
        }

        // When two items tie at the same Hamming distance, use cell color to break the tie.
        // This handles e.g. brain vs cotton candy (4-bit hash difference) and potato vs stew.
        let cellColor: { h: number; s: number } | undefined;
        if (bestDist === secondDist && bestDist <= PHASH_THRESHOLD) {
          const tiedWithHints: string[] = [];
          for (const [name, h] of hashes) {
            if (hammingDist(cellHash, h) === bestDist && COLOR_HINTS[name]) {
              tiedWithHints.push(name);
            }
          }
          if (tiedWithHints.length >= 1) {
            const hs = await getCellHueSat(cellBuf);
            if (hs) {
              cellColor = hs;
              let colorWinner = "", colorScore = Infinity;
              for (const name of tiedWithHints) {
                const hint = COLOR_HINTS[name]!;
                const score = hueDistance(hs.h, hint.h) + Math.abs(hs.s - hint.s) * 40;
                if (score < colorScore) { colorScore = score; colorWinner = name; }
              }
              if (colorWinner) {
                best = colorWinner;
                secondDist = bestDist + 1; // open the gap so the match is accepted below
              }
            }
          }
        }

        if (debugMode) {
          allDists.sort((a, b) => a.dist - b.dist);
          debugRows.push({ cell, best, dist: bestDist, color: cellColor, top3: allDists.slice(0, 3) });
        }

        // Accept match only if: within threshold AND best is strictly better than second
        // (tied second without color hint = random-looking item → reject)
        const confident = bestDist <= PHASH_THRESHOLD && secondDist > bestDist;
        if (confident && best) {
          counts.set(best, (counts.get(best) ?? 0) + 1);
        }
      } catch { }
    }

    // Build output list; repeat items >1 as "name x3" (frontend parser handles this format)
    const matched: string[] = [];
    for (const [name, count] of counts) {
      matched.push(count > 1 ? `${name} x${count}` : name);
    }

    if (debugMode) {
      res.json({ items: matched, detected: cells.length, debug: debugRows });
    } else {
      res.json({ items: matched, detected: cells.length });
    }
  } catch (err) {
    req.log.error({ err }, "scan-screenshot failed");
    res.status(500).json({ error: "Screenshot analysis failed" });
  }
});

router.get("/recipes/icon-library-status", (_req, res) => {
  const ready = !!(hashMap && hashMap.size > 0 && !buildingPromise);
  const count = hashMap?.size ?? 0;
  const building = buildingPromise !== null;
  res.json({ ready, count, building, progress: buildProgress, total: buildTotal });
});

export default router;
