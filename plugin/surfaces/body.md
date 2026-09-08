# Body

The gardener's physiological state — sleep, recovery, readiness, vitals.

## Sources

| Source | Type | Probe tools |
|--------|------|-------------|
| garmin | MCP | `get_sleep_summary`, `get_body_battery`, `get_training_readiness`, `get_heart_rates`, `get_hrv_data`, `get_stats` |

## Key fields

### Sleep (`get_sleep_summary`)

- `overallSleepScore` — 0–100, the headline
- `sleepStartTimestampLocal` / `sleepEndTimestampLocal` — when they slept
- `deepSleepSeconds`, `lightSleepSeconds`, `remSleepSeconds`, `awakeSleepSeconds`
- `averageSpO2Value`, `averageRespirationValue`

### Body battery (`get_body_battery`)

- `charged` / `drained` — net energy for the day
- `startOfDayBodyBattery`, current level from latest entry in `bodyBatteryValuesArray`

### Training readiness (`get_training_readiness`)

- `score` — 0–100, readiness headline
- `sleepScore`, `recoveryScore`, `hrvStatus` — the components

### Heart rate (`get_heart_rates`)

- `restingHeartRate` — the number that matters
- `maxHeartRate`, `minHeartRate` — range for the day

### HRV (`get_hrv_data`)

- `hrvValue` (overnight average), `status` (BALANCED / LOW / etc.)

## Noise (skip on probe)

- Raw timeseries arrays (minute-by-minute HR, BB timeline) — capture only the summary
- `startTimestampGMT` / `endTimestampGMT` — local timestamps are the useful ones
- Device metadata, version strings, `calendarDate` duplicates

## Gotchas

- Garmin returns `null` for everything if the watch wasn't worn — check for this
- Sleep data for "today" is last night's sleep (the sleep that ended this morning)
- Body battery resets at midnight but the useful reading is start-of-day vs current
- `get_stats` overlaps with the above; prefer the specific tools
