import { z } from "zod";
import { normalizeTag, validateTag } from "../services/TagService";

export const CultivarParamsSchema = z.record(
  z.string(),
  z.union([z.string(), z.number()]),
);

export const CultivarSchema = z.object({
  tag: z
    .string()
    .min(1)
    .max(20)
    .refine(validateTag, {
      message: "Tag must be lowercase alphanumeric + hyphen, 1-20 chars",
    }),
  params: CultivarParamsSchema.optional(),
});

export type Cultivar = z.infer<typeof CultivarSchema>;

export function normalizeCultivars(list: unknown[]): Cultivar[] {
  const seen = new Set<string>();
  const out: Cultivar[] = [];

  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    const tagRaw = typeof obj.tag === "string" ? normalizeTag(obj.tag) : null;
    if (!tagRaw || seen.has(tagRaw)) continue;
    seen.add(tagRaw);

    const params =
      obj.params && typeof obj.params === "object"
        ? Object.fromEntries(
            Object.entries(obj.params as Record<string, unknown>).filter(
              ([, v]) => typeof v === "string" || typeof v === "number",
            ),
          )
        : undefined;

    const hasParams = params && Object.keys(params).length > 0;
    out.push(hasParams ? { tag: tagRaw, params } : { tag: tagRaw });
  }
  return out;
}

export function findCultivar(
  cultivars: Cultivar[],
  tag: string,
): Cultivar | undefined {
  return cultivars.find((c) => c.tag === tag);
}

export function nextInRotation(
  rotation: string[],
  allocatedCount: number,
): string {
  return rotation[allocatedCount % rotation.length];
}

export function validateRotationAgainstHabit(
  rotation: string[],
  cultivars: Cultivar[],
): string | null {
  const knownTags = new Set(cultivars.map((c) => c.tag));
  const orphans = rotation.filter((t) => !knownTags.has(t));
  if (orphans.length > 0) {
    return `Rotation tags not in habit cultivars: ${orphans.join(", ")}`;
  }
  return null;
}
