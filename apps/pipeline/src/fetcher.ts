/**
 * Polite fetcher with a local file cache (AC-4/AC-5): sequential requests,
 * ≥2s between real network hits, honest UA; cache hits cost nothing and make
 * re-runs resume where a failed run stopped. On Actions the cache directory
 * is persisted via actions/cache keyed by patch + run type.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DELAY_MS, UA } from "./config.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** HTTP-level failure: recoverable per-champion, unlike format violations. */
export class FetchFailure extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = "FetchFailure";
  }
}

export class PoliteFetcher {
  #cacheDir: string;
  #firstHit = true;
  fetched = 0;
  cached = 0;

  constructor(cacheDir: string) {
    this.#cacheDir = cacheDir;
    mkdirSync(cacheDir, { recursive: true });
  }

  async json(url: string): Promise<unknown> {
    const file = join(this.#cacheDir, createHash("sha1").update(url).digest("hex") + ".json");
    if (existsSync(file)) {
      this.cached++;
      return JSON.parse(readFileSync(file, "utf8"));
    }
    if (!this.#firstHit) await sleep(DELAY_MS);
    this.#firstHit = false;
    const res = await fetch(url, { headers: { "user-agent": UA } });
    if (!res.ok) throw new FetchFailure(url, res.status);
    const text = await res.text();
    JSON.parse(text); // reject non-JSON before caching
    writeFileSync(file, text);
    this.fetched++;
    return JSON.parse(text);
  }
}
