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
const PHASH_THRESHOLD = 12;

interface HashEntry { name: string; hash: string }

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

  const rThresh = Math.max(6, W * 0.06);
  const cThresh = Math.max(6, H * 0.06);
  const hLines = findMidpoints(rowHits, rThresh);
  const vLines = findMidpoints(colHits, cThresh);

  if (hLines.length < 2 || vLines.length < 2) return [];

  const cells: Cell[] = [];
  for (let r = 0; r < hLines.length - 1; r++) {
    for (let c = 0; c < vLines.length - 1; c++) {
      const y = hLines[r], x = vLines[c];
      const h = hLines[r + 1] - y, w = vLines[c + 1] - x;
      if (w > 18 && h > 18) cells.push({ x, y, w, h });
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

    const matched: string[] = [];
    const seen = new Set<string>();

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

        let best = "", bestDist = PHASH_THRESHOLD;
        for (const [name, h] of hashes) {
          const d = hammingDist(cellHash, h);
          if (d < bestDist) { bestDist = d; best = name; }
        }

        if (best && !seen.has(best)) {
          seen.add(best);
          const display = hashes.has(best) ? best : best;
          matched.push(display);
        }
      } catch { }
    }

    res.json({ items: matched, detected: cells.length });
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
