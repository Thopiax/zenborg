import type { Health } from "@/domain/value-objects/Health";

/**
 * Opacity class for health treatment of the habit emoji.
 * Monochrome, no hue changes, no new icons.
 */
export function healthEmojiClass(health: Health): string {
  switch (health) {
    case "wilting":
      return "opacity-50";
    case "dormant":
      return "opacity-30 grayscale";
    case "blooming":
    case "budding":
    case "seedling":
    case "evergreen":
    case "unstated":
    default:
      return "opacity-100";
  }
}
