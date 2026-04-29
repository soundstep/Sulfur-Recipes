#!/usr/bin/env node
/**
 * Seed the Cloudflare KV cache with all recipes.
 *
 * Fetches all recipe slugs from sulfur.wiki.gg (same logic as the Worker)
 * and writes the result directly into KV via wrangler, bypassing the Worker's
 * 30-second CPU limit.
 *
 * Usage:
 *   node scripts/seed-kv.mjs
 *
 * Requires: wrangler authenticated (wrangler whoami)
 */

import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const KV_NAMESPACE_ID = "5d919222bd0244ed81ed2c825f67cf2d";
const CACHE_TTL = 60 * 60 * 24; // 24 hours

const RECIPE_SLUGS = [
  "Admiral_White_Extra_Strong","Anti-Poison_Gum","Aspic","Banana_Bread","Banana_Sulfs",
  "Bark_Bread","Beef_Jerky","Berry_Jam","Berry_Jam_(Unsweetened)","Berry_Milkshake",
  "Biscuits_And_Gravy","Boba_Tea","Bottled_Water","Bread","Bread_Sandwich","Broth",
  "Buddy_Sandwich","Butter","Butter_Sandwich","Buttermilk","Buttermilk_Pancakes",
  "Cactus_Softdrink","Candy_Cane","Cereal","Cevapi","Cheese","Cheese_Sandwich",
  "Cheese_Tops","Cheeseburger","Chocolate_Ball","Chocolate_Milkshake","Chocolate_Mudcake",
  "Chocolate_Syrup","Cordon_Bleu","Cotton_Candy","Cotton_Swabs","Cuisses_De_Grenouille",
  "Currywurst","Dimmie","Dopp_I_Grytan","Double_Cheeseburger","Dumpling","Egg_Toddy",
  "Energy_Gum","Escargot","First_Aid_Kit","Fish_And_Chips","Fondue","French_Hotdog",
  "French_Toast","Fried_Blood_Pudding","Fried_Mushroom","Frog_Leg","Full_English_Breakfast",
  "Gonster","Graved_Salmon","Gravy","Green_Tea","Green_Tea_Gum","Grilled_Cactus",
  "Haggis","Hard_Bread","Hardshell_Taco","Health_Potion","Herbal_Tea","Holy_Toast",
  "Hot_Pot","Hot_Sauce","Hot_Snacks","Jansson%27s_Temptation","Jello","Julmust",
  "Kidney_Pie","Kidney_Stone","Lackerol_Cactus","Leverpastej","Liver_P%C3%A2t%C3%A9_Sandwich",
  "Lussekatt","Lutfisk","Mac%27n%27Cheese","Maki","Marshmallows","Mashed_Potatoes",
  "Meat_Skewer","Meringue","Mochi","Mulled_Wine","Mushroom_Omelette","Mushroom_Skewer",
  "Mushroom_Soup","Mystery_Meat","Nashville_Hot_Chicken","Nigiri","Nuggets","Nut_Mix",
  "Nut_Spread","Omelette","Onigiri","Peanut_Butter","Peanutbutter_Jelly_Sandwich",
  "Peanutbutter_Sandwich","Pickled_Herring_Platter","Pizza","Porridge","Poutine",
  "Power_Bar","Puffed_Rice_Cakes","Pyttipanna","P%C3%B6lsa","P%C3%B8lse","Raclette",
  "Ramen","Red_Wine","Rhubarb_Pie","Rhubarb_Porridge","Rhubarb_Sauce","Rice_Porridge",
  "Risalamande","R%C3%B6dsopp_Paste","Sashimi","Sausage_Omelette","Sausage_On_Stick",
  "Sausage_Soup","Soda","Spaghetti_Bolognese","Spanish_Omelette","Spicy_Sausage","Stew",
  "Surstromming","Swedish_Pancakes","Sweet_Gum","Toast_Skagen","Tongue_On_Stick",
  "Tori_Ramen","Tube_Caviar","Unagi","Vacuum_Cleaner","Extra_Lung","Springcoil_Boot"
];

const HARDCODED_CATEGORIES = {
  "flesh":     ["craw flesh", "dog flesh", "goblin flesh", "hellshrew flesh", "human flesh", "shav'wa flesh"],
  "skins":     ["craw skin", "dog skin", "goblin skin", "hellshrew skin", "human skin", "shav'wa skin"],
  "milk":      ["buttermilk", "low fat milk", "skimmed milk", "whole milk"],
  "mushrooms": ["karl-oskar", "mycota squamata", "rödsopp", "swing-ding", "velvet bell"],
  "nuts":      ["hazelnut", "peanut", "pine nuts", "walnut"],
  "water":     ["bottled water", "mineral water"],
};

function cleanLabel(label) {
  return label
    .replace(/'{2,3}([^']*?)'{2,3}/g, "$1")
    .replace(/&times;/gi, "×")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRecipeRows(wikitext) {
  const variants = [];
  const categoryMap = {};
  const specificMembers = {};
  const recipeSection = wikitext.split(/==\s*[Rr]ecipes?\s*==/)[1] || wikitext;
  const recipeRowRegex = /\{\{Recipe row([\s\S]*?)\}\}/g;
  let match;
  while ((match = recipeRowRegex.exec(recipeSection)) !== null) {
    const block = match[1];
    const ingredients = [];
    for (let i = 1; i <= 6; i++) {
      const keyRegex = new RegExp(`\\|\\s*i${i}\\s*=([^|\\}\\n]+)`);
      const labelRegex = new RegExp(`\\|\\s*i${i}Label\\s*=([^|\\}\\n]+)`);
      const qtyRegex = new RegExp(`\\|\\s*i${i}Qty\\s*=([^|\\}\\n]+)`);
      const labelMatch = labelRegex.exec(block);
      const keyMatch = keyRegex.exec(block);
      const qtyMatch = qtyRegex.exec(block);
      const qty = qtyMatch ? parseInt(qtyMatch[1].trim(), 10) : 1;
      const qtySuffix = qty > 1 ? ` x${qty}` : "";
      if (labelMatch) {
        const label = cleanLabel(labelMatch[1].trim());
        if (label && !label.startsWith(":") && label !== "(blank)") {
          ingredients.push(label + qtySuffix);
          if (keyMatch) {
            const key = keyMatch[1].trim();
            if (key.startsWith(":Category:")) {
              const catName = key.replace(":Category:", "").trim();
              if (label.includes("/")) {
                specificMembers[label.toLowerCase()] = label.split("/").map(s => s.trim().toLowerCase());
              } else {
                categoryMap[label.toLowerCase()] = catName;
              }
            }
          }
        }
      } else if (keyMatch) {
        const ing = keyMatch[1].trim();
        if (ing && !ing.startsWith(":Category:") && ing !== "(blank)") {
          ingredients.push(ing + qtySuffix);
        }
      }
    }
    if (ingredients.length >= 1) variants.push(ingredients);
  }
  return { variants, categoryMap, specificMembers };
}

function detectType(wikitext) {
  const lower = wikitext.toLowerCase();
  if (lower.includes("kind     = equipment") || lower.includes("kind = equipment")) return "equipment";
  if (lower.includes("category:equipment")) return "equipment";
  return "consumable";
}

async function fetchRecipe(slug) {
  const url = `https://sulfur.wiki.gg/api.php?action=parse&page=${slug}&prop=wikitext&format=json`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SulfurRecipeFinder/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || !data.parse?.wikitext?.["*"]) return null;
    const wikitext = data.parse.wikitext["*"];
    const name = data.parse.title || decodeURIComponent(slug).replace(/_/g, " ");
    const { variants, categoryMap, specificMembers } = parseRecipeRows(wikitext);
    if (variants.length === 0) return null;
    return { recipe: { name, type: detectType(wikitext), variants }, categoryMap, specificMembers };
  } catch {
    return null;
  }
}

async function main() {
  console.log(`Fetching ${RECIPE_SLUGS.length} recipes from sulfur.wiki.gg...`);
  const results = [];
  const globalCategoryMap = {};
  const globalSpecificMembers = {};
  const CONCURRENCY = 10;

  for (let i = 0; i < RECIPE_SLUGS.length; i += CONCURRENCY) {
    const batch = RECIPE_SLUGS.slice(i, i + CONCURRENCY);
    process.stdout.write(`  Batch ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(RECIPE_SLUGS.length / CONCURRENCY)}... `);
    const fetched = await Promise.all(batch.map(fetchRecipe));
    fetched.forEach(r => {
      if (r?.recipe) results.push(r.recipe);
      if (r?.categoryMap) Object.assign(globalCategoryMap, r.categoryMap);
      if (r?.specificMembers) Object.assign(globalSpecificMembers, r.specificMembers);
    });
    console.log(`${fetched.filter(r => r?.recipe).length} recipes`);
    // Small delay to avoid wiki rate limiting
    if (i + CONCURRENCY < RECIPE_SLUGS.length) await new Promise(r => setTimeout(r, 500));
  }

  const categoryMembers = {};
  for (const [label, catName] of Object.entries(globalCategoryMap)) {
    const key = catName.toLowerCase();
    categoryMembers[label] = HARDCODED_CATEGORIES[key] ?? [];
  }
  Object.assign(categoryMembers, globalSpecificMembers);

  const payload = JSON.stringify({ recipes: results, categoryMembers });
  console.log(`\nTotal: ${results.length} recipes fetched`);
  console.log(`Seeding KV namespace ${KV_NAMESPACE_ID}...`);

  const tmpFile = join(tmpdir(), "sulfur-recipes-kv.json");
  writeFileSync(tmpFile, payload, "utf8");
  try {
    execSync(
      `npx wrangler kv key put --namespace-id=${KV_NAMESPACE_ID} "recipes" --path=${tmpFile} --ttl=${CACHE_TTL} --remote`,
      { stdio: "inherit" }
    );
  } finally {
    unlinkSync(tmpFile);
  }

  console.log(`\nDone. KV seeded with ${results.length} recipes (TTL: ${CACHE_TTL}s).`);
}

main().catch(err => { console.error(err); process.exit(1); });
