export const UA = "lolbuilder-pipeline (github.com/ShawnBakker/lolbuilder)";
export const DELAY_MS = 2000;
export const TIER = "emerald_plus";
export const QUEUE = "ranked";
export const REGION = "all";

export const buildUrl = (slug: string): string => `https://lolalytics.com/lol/${slug}/build/q-data.json`;
export const countersUrl = (slug: string, vslane?: string): string =>
  `https://lolalytics.com/lol/${slug}/counters/q-data.json${vslane ? `?vslane=${vslane}` : ""}`;
export const synergyUrl = (slug: string, patch: string): string =>
  `https://a1.lolalytics.com/mega/?ep=build-team&v=1&patch=${patch}&c=${slug}&lane=all&tier=${TIER}&queue=${QUEUE}&region=${REGION}`;
