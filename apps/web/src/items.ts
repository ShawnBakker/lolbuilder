/**
 * Data Dragon item metadata (names + icons), fetched client-side from the
 * CORS-open CDN at the dataset's own DDragon version. Unknown item ids
 * resolve to null and are dropped by the UI — rules still render their
 * explanations, so a renamed item never silently kills a recommendation.
 */
export interface ItemMeta {
  name: string;
  icon: string;
}

let items: Map<number, ItemMeta> | null = null;
const listeners = new Set<() => void>();
let version = 0;

export function subscribeItems(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function getItemsVersion(): number {
  return version;
}
export function getItem(id: number): ItemMeta | null {
  return items?.get(id) ?? null;
}

export function loadItems(ddragon: string): void {
  if (items) return;
  void fetch(`https://ddragon.leagueoflegends.com/cdn/${ddragon}/data/en_US/item.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((body: { data: Record<string, { name: string }> }) => {
      items = new Map(
        Object.entries(body.data).map(([id, it]) => [
          Number(id),
          { name: it.name, icon: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/item/${id}.png` },
        ]),
      );
      version++;
      for (const l of listeners) l();
    })
    .catch(() => undefined); // icons/names are enhancement; ids still render
}
