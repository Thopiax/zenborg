import type { Phase } from "@/domain/value-objects/Phase";
import { PhaseIcon } from "@/domain/value-objects/phaseStyles";
import type {
  HarvestMoment,
  HarvestSeason,
} from "@/infrastructure/state/harvestViewModel";
import { formatCycleDateRange, getDateLabel } from "@/lib/dates";

/**
 * SeasonReadback — one closed season, read back.
 *
 * What it intended, what it held, and what was planted in it. In that order,
 * because the order is the point: intention first, then the record, and the
 * record never answers to the intention.
 *
 * Design: stone tones throughout. The single coloured thing on the page is
 * the area swatch beside a moment — area `color` is the one sanctioned colour
 * channel, and a viewer can always name the plot a colour belongs to
 * (`../DESIGN.md`). Phases are structural: an icon and a position, never a
 * hue. Flat at rest, square, no modals.
 *
 * There is no score here, and there is no room for one: no bar against a
 * budget, no percentage, no comparison with another season.
 */
export function SeasonReadback({ season }: { season: HarvestSeason | null }) {
  if (!season) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          No season to read back yet. Close one and it will be here.
        </p>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-2xl px-6 py-12">
      <header className="border-b border-stone-200 pb-6 dark:border-stone-800">
        <h1 className="text-2xl font-medium tracking-tight text-stone-900 dark:text-stone-100">
          {season.name}
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {formatCycleDateRange(season.startDate, season.endDate)}
        </p>

        {season.intention && (
          <div className="mt-6">
            <h2 className="text-xs uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Intention
            </h2>
            <p className="mt-1 text-stone-700 dark:text-stone-300">
              {season.intention}
            </p>
          </div>
        )}
      </header>

      {season.reflection && (
        <section className="border-b border-stone-200 py-8 dark:border-stone-800">
          <p className="text-lg leading-relaxed text-stone-900 dark:text-stone-100">
            {season.reflection.l0}
          </p>
          {season.reflection.l1 && (
            <p className="mt-4 whitespace-pre-line leading-relaxed text-stone-600 dark:text-stone-400">
              {season.reflection.l1}
            </p>
          )}
        </section>
      )}

      <section className="pt-8">
        <h2 className="text-xs uppercase tracking-wider text-stone-400 dark:text-stone-500">
          {season.momentCount === 1
            ? "1 moment planted"
            : `${season.momentCount} moments planted`}
        </h2>

        {season.days.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
            Nothing was planted in this season.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {season.days.map((day) => (
              <div key={day.date}>
                <h3 className="text-xs text-stone-400 dark:text-stone-500">
                  {getDateLabel(day.date)}
                </h3>
                <ul className="mt-2 space-y-1">
                  {day.moments.map((moment) => (
                    <PlantedMoment key={moment.id} moment={moment} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

/**
 * One moment, as it was planted: when in the day, which plot, who was there.
 *
 * Every moment in the season renders. A phase holding more than three is
 * history, not overflow — the day view's capacity does not apply to a record.
 */
function PlantedMoment({ moment }: { moment: HarvestMoment }) {
  return (
    <li className="flex items-baseline gap-2 text-sm">
      <span className="w-4 shrink-0 text-stone-300 dark:text-stone-600">
        {moment.phase && (
          <PhaseIcon className="h-3 w-3" phase={moment.phase as Phase} />
        )}
      </span>

      {moment.areaColor && (
        <span
          aria-hidden="true"
          className="mt-[1px] h-2 w-2 shrink-0"
          data-area-id={moment.areaId}
          data-area-swatch
          style={{ backgroundColor: moment.areaColor }}
          title={moment.areaName ?? undefined}
        />
      )}

      <span className="text-stone-800 dark:text-stone-200">{moment.name}</span>

      {moment.people.length > 0 && (
        <span className="text-stone-400 dark:text-stone-500">
          with {moment.people.join(", ")}
        </span>
      )}
    </li>
  );
}
