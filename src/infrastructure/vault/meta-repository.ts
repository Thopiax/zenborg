import { defaultMeta, type Meta } from "@/domain/entities/Meta";

const STORAGE_KEY = "zenborg:meta";
let cached: Meta | null = null;

export { defaultMeta } from "@/domain/entities/Meta";

export function readMeta(): Meta {
  if (cached) return cached;
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    cached = {
      migrations: {
        derivedDeck: Boolean(parsed?.migrations?.derivedDeck),
      },
    };
  } catch {
    cached = defaultMeta();
  }
  return cached;
}

export function writeMeta(meta: Meta): void {
  cached = meta;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  }
}

export function clearMetaCache(): void {
  cached = null;
}
