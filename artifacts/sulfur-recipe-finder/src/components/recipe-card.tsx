import { Zap, Check, AlertTriangle } from "lucide-react";
import clsx from "clsx";

function baseName(ing: string) {
  return ing.toLowerCase().replace(/\s*x\d+\s*$/i, "").trim();
}

function requiredQty(ing: string): number {
  const m = ing.match(/x(\d+)\s*$/i);
  return m ? parseInt(m[1], 10) : 1;
}

function hasIngredient(ing: string, haveMap: Map<string, number>, catMems: Record<string, string[]> = {}): boolean {
  const base = baseName(ing);
  const qty = requiredQty(ing);
  if ((haveMap.get(base) ?? 0) >= qty) return true;
  const members = catMems[base];
  if (members) return members.some(m => (haveMap.get(m) ?? 0) >= qty);
  return false;
}

function wikiUrl(name: string) {
  const slug = name.trim().replace(/\s+/g, "_");
  return `https://sulfur.wiki.gg/wiki/${slug.charAt(0).toUpperCase() + slug.slice(1)}`;
}

export interface Recipe {
  name: string;
  type: string;
  variants: string[][];
}

export type ScoredRecipe = Recipe & {
  directVariant?: string[];
  chainVariant?: string[];
  chainSteps: string[];
  displayVariant: string[];
  haveCount: number;
  total: number;
  pct: number;
  haveMap: Map<string, number>;
  craftableSet: Set<string>;
  catMems: Record<string, string[]>;
};

export function RecipeCard({ recipe }: { recipe: ScoredRecipe }) {
  const isReady = !!recipe.directVariant;
  const isChain = !isReady && !!recipe.chainVariant;
  const isPartial = !isReady && !isChain && recipe.pct > 0;

  const colorClass = isReady ? "text-ready" :
                     isChain ? "text-chain" :
                     isPartial ? "text-partial" :
                     "text-muted-foreground";

  const borderColor = isReady ? "border-ready shadow-[0_0_10px_rgba(57,255,20,0.15)] hover:shadow-[0_0_20px_rgba(57,255,20,0.3)]" : 
                      isChain ? "border-chain shadow-[0_0_10px_rgba(0,255,255,0.1)] hover:shadow-[0_0_20px_rgba(0,255,255,0.25)]" : 
                      isPartial ? "border-partial/50" : "border-border";

  const barColor = isReady ? "bg-ready" : isChain ? "bg-chain" : isPartial ? "bg-partial" : "bg-muted";

  return (
    <div className={clsx("relative border p-4 bg-black/60 group transition-all duration-300", borderColor)}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className={clsx("font-display text-2xl font-bold uppercase tracking-wider", colorClass)}>
            <a
              href={wikiUrl(recipe.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline underline-offset-4 decoration-dotted"
            >
              {recipe.name}
            </a>
          </h3>
          <div className="text-xs text-muted-foreground uppercase font-sans flex flex-wrap gap-x-4 gap-y-1 mt-1">
            <span className="flex items-center gap-1">
               TYPE: <span className="text-foreground">{recipe.type}</span>
            </span>
            <span className="flex items-center gap-1">
               VARIANTS: <span className="text-foreground">{recipe.variants.length}</span>
            </span>
            <span className="flex items-center gap-1">
               MATS: <span className={clsx(recipe.haveCount === recipe.total ? "text-ready" : "text-foreground")}>{recipe.haveCount}/{recipe.total}</span>
            </span>
          </div>
        </div>
        <div>
          {isReady && <div className="bg-ready/20 text-ready p-1.5 border border-ready/50 shadow-[0_0_10px_rgba(57,255,20,0.2)]"><Check size={18} /></div>}
          {isChain && <div className="bg-chain/20 text-chain p-1.5 border border-chain/50"><Zap size={18} /></div>}
          {isPartial && <div className="bg-partial/20 text-partial p-1.5 border border-partial/50"><AlertTriangle size={18} /></div>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 mt-4">
        {recipe.displayVariant.map((ing, idx) => {
          const have = hasIngredient(ing, recipe.haveMap, recipe.catMems);
          const base = baseName(ing);
          const canCraft = !have && (
            recipe.craftableSet.has(base) ||
            (recipe.catMems[base] ?? []).some(m => recipe.craftableSet.has(m))
          );
          
          return (
            <div key={idx} className="flex items-center">
              {idx > 0 && <span className="text-border mx-1">+</span>}
              <a
                href={wikiUrl(baseName(ing))}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx(
                  "text-xs px-2 py-1 border uppercase font-sans font-semibold tracking-wide transition-colors hover:brightness-125",
                  have ? 'border-ready/50 text-ready bg-ready/10' :
                  canCraft ? 'border-chain/50 text-chain bg-chain/10' :
                  'border-border/60 text-muted-foreground bg-muted/10'
                )}
              >
                {ing}
              </a>
            </div>
          );
        })}
      </div>

      {recipe.chainSteps.length > 0 && (
        <div className="text-xs text-chain mb-3 flex items-center gap-2 bg-chain/5 p-2 border border-chain/20 font-sans">
          <Zap size={14} className="animate-pulse" />
          <span>CRAFT FIRST: <span className="font-bold">{recipe.chainSteps.join(' → ')}</span></span>
        </div>
      )}

      {/* Progress Bar at bottom */}
      <div className="absolute bottom-0 left-0 h-1 w-full bg-muted/20">
        <div className={clsx("h-full transition-all duration-1000 ease-out", barColor)} style={{ width: `${recipe.pct * 100}%` }} />
      </div>
    </div>
  );
}
