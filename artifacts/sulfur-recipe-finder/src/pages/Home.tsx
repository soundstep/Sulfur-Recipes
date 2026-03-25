import { useState, useMemo, useEffect } from "react";
import { useRecipesData, useRefreshRecipesData } from "@/hooks/use-recipes";
import { CyberButton } from "@/components/ui/cyber-button";
import { CyberPanel } from "@/components/ui/cyber-panel";
import { RecipeCard, type ScoredRecipe, type Recipe } from "@/components/recipe-card";
import { Database, Link as LinkIcon, RefreshCw, Download, AlertCircle, Terminal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { format } from "date-fns";

const DEFAULT_INGS = "gonster, stew, mashed potatoes, butter sandwich, human skin, maki, vacuum cleaner, oats, cacao, kidney stone, rhubarb, egg, cereal, black pepper, brain";

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

function buildCraftableSet(haveMap: Map<string, number>, allRecipes: Recipe[], catMems: Record<string, string[]> = {}) {
  const craftable = new Set<string>(haveMap.keys());
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of allRecipes) {
      const rLow = r.name.toLowerCase();
      if (craftable.has(rLow)) continue;
      const canMake = r.variants.some(v => v.every(i => {
        if (hasIngredient(i, haveMap, catMems)) return true;
        const base = baseName(i);
        if (craftable.has(base)) return true;
        const members = catMems[base];
        if (members && members.some(m => craftable.has(m))) return true;
        return false;
      }));
      if (canMake) {
        craftable.add(rLow);
        changed = true;
      }
    }
  }
  return craftable;
}

function scoreRecipe(
  recipe: Recipe,
  haveMap: Map<string, number>,
  craftableSet: Set<string>,
  catMems: Record<string, string[]> = {}
): ScoredRecipe {
  const have = (i: string) => hasIngredient(i, haveMap, catMems);

  const directVariant = recipe.variants.find(v => v.every(have));
  const chainVariant = !directVariant && recipe.variants.find(v => v.every(i => {
    if (have(i)) return true;
    const base = baseName(i);
    if (craftableSet.has(base)) return true;
    const members = catMems[base];
    return !!(members && members.some(m => craftableSet.has(m)));
  }));
  
  let bestVariant = recipe.variants[0] || [];
  let bestCount = -1;
  recipe.variants.forEach(v => {
    const c = v.filter(have).length;
    if (c > bestCount) { bestCount = c; bestVariant = v; }
  });

  const displayVariant = directVariant || chainVariant || bestVariant;
  const total = displayVariant.length;
  const haveCount = displayVariant.filter(have).length;
  
  const chainSteps = chainVariant
    ? chainVariant.filter(i => !have(i) && (craftableSet.has(baseName(i)) || (catMems[baseName(i)] ?? []).some(m => craftableSet.has(m))))
    : [];
  const pct = total === 0 ? 0 : haveCount / total;

  return {
    ...recipe,
    directVariant,
    chainVariant,
    chainSteps,
    displayVariant,
    haveCount,
    total,
    pct,
    haveMap,
    craftableSet,
    catMems
  };
}

export default function Home() {
  const [inputText, setInputText] = useState(DEFAULT_INGS);
  const [activeIngs, setActiveIngs] = useState<Map<string, number>>(new Map());
  const [filter, setFilter] = useState<'all' | 'ready' | 'chain' | 'partial'>('all');
  const [logs, setLogs] = useState<string[]>(["[SYS] OS Boot sequence complete...", "[SYS] Waiting for database sync..."]);

  const { data, isLoading, isError, refetch, isFetching } = useRecipesData();
  const { mutate: refreshRecipes, isPending: isRefreshing } = useRefreshRecipesData();

  const recipes = data?.recipes || [];
  
  useEffect(() => {
    handleSetIngredients(DEFAULT_INGS);
  }, []);

  useEffect(() => {
    if (isLoading) {
      addLog("CONNECTING TO SERVER...");
    } else if (isFetching) {
      addLog("FETCHING DATABASE FROM SERVER...");
    } else if (isError) {
      addLog("ERROR: CONNECTION REFUSED.");
    } else if (data) {
      addLog(`SYNC OK: ${data.recipes.length} RECIPES LOADED.`);
      if (data.cachedAt) {
        addLog(`CACHE DATE: ${format(new Date(data.cachedAt), 'yyyy-MM-dd HH:mm:ss')}`);
      }
    }
  }, [isLoading, isFetching, isError, data]);

  function addLog(msg: string) {
    setLogs(prev => {
      const newLogs = [...prev, `[${new Date().toLocaleTimeString('en-US', { hour12: false })}] ${msg}`];
      // keep only last 50 logs
      return newLogs.length > 50 ? newLogs.slice(newLogs.length - 50) : newLogs;
    });
  }

  function handleSetIngredients(text: string) {
    const map = new Map<string, number>();
    text.split(/[\n,]+/).forEach(s => {
      const trimmed = s.trim().toLowerCase();
      if (!trimmed) return;
      const qtyMatch = trimmed.match(/\s*x(\d+)\s*$/i);
      const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
      const name = trimmed.replace(/\s*x\d+\s*$/i, "").trim();
      if (name) map.set(name, Math.max(qty, map.get(name) ?? 0));
    });
    setActiveIngs(map);
    addLog(`INVENTORY UPDATED: ${map.size} UNIQUE ITEMS.`);
  }

  function toggleIng(name: string) {
    const next = new Map(activeIngs);
    if (next.has(name)) next.delete(name);
    else next.set(name, 1);
    setActiveIngs(next);
    setInputText(
      Array.from(next.entries()).map(([n, q]) => q > 1 ? `${n} x${q}` : n).join(", ")
    );
  }

  const scoredRecipes = useMemo(() => {
    if (!recipes || recipes.length === 0) return [];
    const craftableSet = buildCraftableSet(activeIngs, recipes);
    
    return recipes.map(r => scoreRecipe(r, activeIngs, craftableSet)).sort((a, b) => {
      const rankA = a.directVariant ? 3 : a.chainVariant ? 2 : a.pct > 0 ? 1 : 0;
      const rankB = b.directVariant ? 3 : b.chainVariant ? 2 : b.pct > 0 ? 1 : 0;
      if (rankB !== rankA) return rankB - rankA;
      return b.pct - a.pct;
    });
  }, [recipes, activeIngs]);

  const toShow = useMemo(() => {
    if (filter === 'ready') return scoredRecipes.filter(r => r.directVariant);
    if (filter === 'chain') return scoredRecipes.filter(r => !r.directVariant && r.chainVariant);
    if (filter === 'partial') return scoredRecipes.filter(r => !r.directVariant && !r.chainVariant && r.pct > 0);
    return scoredRecipes;
  }, [scoredRecipes, filter]);

  const nReady = scoredRecipes.filter(r => r.directVariant).length;
  const nChain = scoredRecipes.filter(r => !r.directVariant && r.chainVariant).length;
  const nPartial = scoredRecipes.filter(r => !r.directVariant && !r.chainVariant && r.pct > 0).length;

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="border-b-2 border-border pb-4 flex flex-col md:flex-row md:justify-between md:items-end gap-4 relative">
          <div className="absolute bottom-[-2px] left-0 w-1/3 h-[2px] bg-primary shadow-[0_0_10px_rgba(57,255,20,0.8)] z-10" />
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground flex items-center gap-3 tracking-wide">
              <Database className="text-primary" size={36} />
              SULFUR <span className="text-primary">OS</span>
            </h1>
            <p className="text-muted-foreground text-sm uppercase tracking-widest mt-1 font-sans flex items-center gap-2">
              <Terminal size={14} className="text-primary" /> Recipe Database & Crafting Chain Analyzer
            </p>
          </div>
          <a href="https://sulfur.wiki.gg/wiki/Recipes" target="_blank" rel="noreferrer" className="text-xs text-chain hover:text-white flex items-center gap-1 uppercase font-sans bg-chain/10 px-3 py-1.5 border border-chain/30 transition-colors hover:bg-chain/20 hover:border-chain">
            <LinkIcon size={12} /> Source: sulfur.wiki.gg
          </a>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          
          {/* Left Col */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            <CyberPanel title="INVENTORY LINK">
              <p className="text-xs text-muted-foreground mb-1 uppercase">Input raw materials (comma or newline separated):</p>
              <p className="text-xs text-muted-foreground/60 mb-2 font-mono">e.g. <span className="text-primary/70">oats x2, egg, rhubarb x3</span> — use <span className="text-primary/70">x&lt;n&gt;</span> to specify quantity</p>
              <textarea 
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                className="w-full h-32 bg-black border-2 border-border text-foreground p-3 font-sans text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all custom-scrollbar resize-none selection:bg-primary selection:text-black"
                placeholder={"e.g. oats x2, egg, rhubarb x3\nor one per line:\noats x2\negg\nrhubarb x3"}
              />
              <CyberButton onClick={() => handleSetIngredients(inputText)} className="w-full mt-3">
                Sync Inventory
              </CyberButton>

              <div className="mt-6">
                <h3 className="text-xs text-muted-foreground uppercase border-b border-border pb-1 mb-3">Active Items ({activeIngs.size})</h3>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {activeIngs.size === 0 && <span className="text-muted-foreground text-xs italic">No items found.</span>}
                  {Array.from(activeIngs.entries()).map(([ing, qty]) => (
                    <button 
                      key={ing}
                      onClick={() => toggleIng(ing)}
                      className="text-[10px] sm:text-xs px-2 py-1 border border-primary/50 text-primary bg-primary/5 hover:bg-primary hover:text-black transition-colors uppercase font-semibold tracking-wide"
                      title="Click to remove"
                    >
                      {qty > 1 ? `${ing} x${qty}` : ing} <span className="opacity-50 ml-1 hover:opacity-100">&times;</span>
                    </button>
                  ))}
                </div>
              </div>
            </CyberPanel>

            <CyberPanel title="DATABASE UPLINK">
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <CyberButton variant="secondary" className="flex-1" onClick={() => refetch()} disabled={isLoading || isFetching}>
                    {isLoading || isFetching ? <RefreshCw className="animate-spin" size={16} /> : <Download size={16} />}
                    Fetch
                  </CyberButton>
                  <CyberButton variant="danger" className="flex-1" onClick={() => refreshRecipes()} disabled={isRefreshing}>
                    <RefreshCw className={clsx(isRefreshing && "animate-spin")} size={16} />
                    Force Refresh
                  </CyberButton>
                </div>
                
                <div className="mt-2 bg-black/80 border border-border p-3 h-48 overflow-y-auto custom-scrollbar flex flex-col-reverse relative group">
                  <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-black to-transparent pointer-events-none z-10" />
                  <div className="text-[11px] text-muted-foreground space-y-1.5 font-mono leading-tight">
                    {logs.slice().reverse().map((log, i) => (
                      <div key={i} className={clsx(
                        log.includes("ERROR") ? "text-partial" : 
                        log.includes("OK") ? "text-primary" : 
                        "text-muted-foreground"
                      )}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CyberPanel>

          </div>

          {/* Right Col */}
          <div className="lg:col-span-8 flex flex-col h-[800px] lg:h-auto lg:min-h-[800px]">
            <CyberPanel title="RECIPE MATCHES" fullHeight className="flex-1">
              
              {/* Tabs */}
              <div className="flex flex-wrap gap-2 md:gap-4 mb-4 border-b border-border pb-3 relative">
                {[
                  { id: 'all', label: `ALL (${scoredRecipes.length})` },
                  { id: 'ready', label: `READY (${nReady})` },
                  { id: 'chain', label: `CHAIN (${nChain})` },
                  { id: 'partial', label: `PARTIAL (${nPartial})` },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id as any)}
                    className={clsx(
                      "px-3 md:px-4 py-2 font-display text-lg md:text-xl uppercase tracking-widest transition-all relative",
                      filter === tab.id ? "text-primary bg-primary/10 font-bold" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    {tab.label}
                    {filter === tab.id && (
                      <motion.div layoutId="activeTab" className="absolute bottom-[-13px] left-0 right-0 h-[2px] bg-primary shadow-[0_0_8px_rgba(57,255,20,0.8)] z-10" />
                    )}
                  </button>
                ))}
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar mt-2 relative">
                {isLoading && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
                    <RefreshCw className="animate-spin text-primary" size={48} />
                    <p className="uppercase tracking-widest font-display text-xl animate-pulse">Accessing Data...</p>
                  </div>
                )}

                {!isLoading && isError && (
                  <div className="flex flex-col items-center justify-center h-full text-partial space-y-4 border-2 border-partial/30 bg-partial/5 p-8 text-center m-4">
                    <AlertCircle size={48} />
                    <h3 className="uppercase tracking-widest font-display text-2xl font-bold">Connection Failed</h3>
                    <p className="font-sans text-sm text-muted-foreground max-w-md">Could not establish link to wiki database. Ensure backend server is running and reachable.</p>
                    <CyberButton variant="danger" onClick={() => refetch()}>Retry Connection</CyberButton>
                  </div>
                )}

                {!isLoading && !isError && toShow.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4 p-8 border border-dashed border-border/50 text-center m-4">
                    <Database size={48} className="opacity-20" />
                    <p className="uppercase tracking-widest font-display text-xl">No records match criteria</p>
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-4">
                  <AnimatePresence mode="popLayout">
                    {!isLoading && !isError && toShow.map(r => (
                      <motion.div
                        key={r.name}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <RecipeCard recipe={r} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </CyberPanel>
          </div>

        </div>
      </div>
    </div>
  );
}
