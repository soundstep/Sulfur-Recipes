import { getRecipesData } from "@workspace/recipe-core";
import { KVCacheStore } from "./adapters/kv-cache";

interface Env {
  CACHE: KVNamespace;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const cache = new KVCacheStore(env.CACHE);

    if (url.pathname === "/api/recipes" && request.method === "GET") {
      try {
        const data = await getRecipesData(cache);
        return Response.json(
          { ...data, count: data.recipes.length, cachedAt: new Date().toISOString() },
          { headers: corsHeaders },
        );
      } catch {
        return Response.json({ error: "Failed to fetch recipes" }, { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/api/recipes/refresh" && request.method === "POST") {
      try {
        await env.CACHE.delete("recipes");
        const data = await getRecipesData(cache);
        return Response.json(
          { ...data, count: data.recipes.length, cachedAt: new Date().toISOString() },
          { headers: corsHeaders },
        );
      } catch {
        return Response.json({ error: "Failed to refresh recipes" }, { status: 500, headers: corsHeaders });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
