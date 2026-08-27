/**
 * Place -- a registry entity referenced by Moment.placeIds, Habit.placeIds
 * and Cycle.placeIds.
 *
 * Hierarchical via parentKey (e.g. "paris" -> "france"). The key is a
 * stable slug, the id a UUID. url is an optional map/directions link.
 */
export interface Place {
  id: string;
  name: string;
  key: string;
  parentKey: string | null;
  emoji: string | null;
  url: string | null;
  createdAt: string;
  updatedAt: string;
}
