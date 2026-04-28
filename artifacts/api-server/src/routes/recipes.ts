import { Router, type IRouter } from "express";
import { getRecipesData, MemoryCacheStore } from "@workspace/recipe-core";

const router: IRouter = Router();

const cache = new MemoryCacheStore();

router.get("/recipes", async (req, res) => {
  try {
    const { recipes, categoryMembers } = await getRecipesData(cache);
    const cachedEntry = await cache.get("recipes");
    const cachedAt = cachedEntry ? new Date().toISOString() : new Date().toISOString();
    res.json({ recipes, categoryMembers, count: recipes.length, cachedAt });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch recipes");
    res.status(500).json({ error: "Failed to fetch recipes from wiki" });
  }
});

router.post("/recipes/refresh", async (req, res) => {
  cache.invalidate("recipes");
  try {
    const { recipes, categoryMembers } = await getRecipesData(cache);
    const cachedAt = new Date().toISOString();
    res.json({ recipes, categoryMembers, count: recipes.length, cachedAt });
  } catch (err) {
    req.log.error({ err }, "Failed to refresh recipes");
    res.status(500).json({ error: "Failed to refresh recipes from wiki" });
  }
});

export default router;
