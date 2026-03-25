import { Router, type IRouter } from "express";

const router: IRouter = Router();

interface Recipe {
  name: string;
  type: string;
  variants: string[][];
}

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

function parseRecipeRows(wikitext: string): { variants: string[][]; categoryMap: Record<string, string> } {
  const variants: string[][] = [];
  const categoryMap: Record<string, string> = {};

  const recipeSection = wikitext.split(/==\s*[Rr]ecipes?\s*==/)[1] || wikitext;

  const recipeRowRegex = /\{\{Recipe row([\s\S]*?)\}\}/g;
  let match;
  while ((match = recipeRowRegex.exec(recipeSection)) !== null) {
    const block = match[1];
    const ingredients: string[] = [];

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
        const label = labelMatch[1].trim();
        if (label && !label.startsWith(":") && label !== "(blank)") {
          ingredients.push(label + qtySuffix);
          if (keyMatch) {
            const key = keyMatch[1].trim();
            if (key.startsWith(":Category:")) {
              const catName = key.replace(":Category:", "").trim();
              categoryMap[label.toLowerCase()] = catName;
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

    if (ingredients.length >= 1) {
      variants.push(ingredients);
    }
  }

  return { variants, categoryMap };
}

function detectType(wikitext: string): string {
  const lower = wikitext.toLowerCase();
  if (lower.includes("kind     = equipment") || lower.includes("kind = equipment")) return "equipment";
  if (lower.includes("category:equipment")) return "equipment";
  return "consumable";
}

async function fetchCategoryMembers(catName: string): Promise<string[]> {
  const url = `https://sulfur.wiki.gg/api.php?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(catName)}&cmlimit=100&format=json`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SulfurRecipeFinder/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { query?: { categorymembers?: Array<{ title: string }> } };
    return (data.query?.categorymembers ?? []).map(m => m.title.toLowerCase());
  } catch {
    return [];
  }
}

async function fetchRecipeFromApi(slug: string): Promise<{ recipe: Recipe | null; categoryMap: Record<string, string> }> {
  const url = `https://sulfur.wiki.gg/api.php?action=parse&page=${slug}&prop=wikitext&format=json`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SulfurRecipeFinder/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { recipe: null, categoryMap: {} };

    const data = await res.json() as { parse?: { title?: string; wikitext?: { "*": string } }; error?: unknown };
    if (data.error || !data.parse?.wikitext?.["*"]) return { recipe: null, categoryMap: {} };

    const wikitext = data.parse.wikitext["*"];
    const name = data.parse.title || decodeURIComponent(slug).replace(/_/g, " ");
    const { variants, categoryMap } = parseRecipeRows(wikitext);

    if (variants.length === 0) return { recipe: null, categoryMap: {} };

    const type = detectType(wikitext);
    return { recipe: { name, type, variants }, categoryMap };
  } catch {
    return { recipe: null, categoryMap: {} };
  }
}

interface RecipeCache {
  recipes: Recipe[];
  categoryMembers: Record<string, string[]>;
}

let cachedData: RecipeCache | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000;

async function getRecipesData(): Promise<RecipeCache> {
  if (cachedData && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedData;
  }

  const results: Recipe[] = [];
  const globalCategoryMap: Record<string, string> = {};
  const CONCURRENCY = 10;

  for (let i = 0; i < RECIPE_SLUGS.length; i += CONCURRENCY) {
    const batch = RECIPE_SLUGS.slice(i, i + CONCURRENCY);
    const fetched = await Promise.all(batch.map(s => fetchRecipeFromApi(s)));
    fetched.forEach(({ recipe, categoryMap }) => {
      if (recipe) results.push(recipe);
      Object.assign(globalCategoryMap, categoryMap);
    });
  }

  const categoryMembers: Record<string, string[]> = {};
  const uniqueCategories = Object.entries(globalCategoryMap);
  await Promise.all(uniqueCategories.map(async ([label, catName]) => {
    categoryMembers[label] = await fetchCategoryMembers(catName);
  }));

  cachedData = { recipes: results, categoryMembers };
  cacheTimestamp = Date.now();
  return cachedData;
}

router.get("/recipes", async (req, res) => {
  try {
    const { recipes, categoryMembers } = await getRecipesData();
    res.json({ recipes, categoryMembers, count: recipes.length, cachedAt: new Date(cacheTimestamp).toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch recipes");
    res.status(500).json({ error: "Failed to fetch recipes from wiki" });
  }
});

router.post("/recipes/refresh", async (req, res) => {
  cachedData = null;
  cacheTimestamp = 0;
  try {
    const { recipes, categoryMembers } = await getRecipesData();
    res.json({ recipes, categoryMembers, count: recipes.length, cachedAt: new Date(cacheTimestamp).toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to refresh recipes");
    res.status(500).json({ error: "Failed to refresh recipes from wiki" });
  }
});

export default router;
