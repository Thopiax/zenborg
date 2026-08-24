import EventKit
import Foundation

// MARK: - Constants

private let SYNC_WINDOW_PAST_DAYS = 7
private let SYNC_WINDOW_FUTURE_DAYS = 60
private let ZENBORG_CALENDAR_TITLE = "Zenborg"

// MARK: - Lock

private func acquireLock() -> Int32? {
    let lockPath = vaultRoot().appendingPathComponent(".calendar-sidecar.lock").path
    let fd = open(lockPath, O_CREAT | O_RDWR, 0o644)
    guard fd >= 0 else { return nil }
    if flock(fd, LOCK_EX | LOCK_NB) != 0 {
        close(fd)
        return nil
    }
    return fd
}

// MARK: - Status

func printStatus() {
    let store = EKEventStore()
    let auth = EKEventStore.authorizationStatus(for: .event)
    let authString: String
    switch auth {
    case .fullAccess: authString = "fullAccess"
    case .denied, .restricted: authString = "denied"
    case .notDetermined: authString = "notDetermined"
    case .writeOnly: authString = "writeOnly"
    @unknown default: authString = "unknown"
    }

    var calendars: [[String: String]] = []
    if auth == .fullAccess {
        for cal in store.calendars(for: .event) {
            calendars.append([
                "id": cal.calendarIdentifier,
                "title": cal.title,
                "source": cal.source?.title ?? "unknown",
            ])
        }
    }

    let config = readCalendarSyncConfig()
    let result: [String: Any] = [
        "authorization": authString,
        "calendars": calendars,
        "zenborgCalendarId": config.zenborgCalendarId as Any,
        "selectedCalendarIds": config.selectedCalendarIds,
    ]

    if let data = try? JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]) {
        print(String(data: data, encoding: .utf8)!)
    }
}

// MARK: - Reconcile once

func reconcileOnce() {
    guard let lockFd = acquireLock() else {
        fputs("[calendar] another instance holds the lock; exiting\n", stderr)
        return
    }
    defer { close(lockFd) }

    let store = EKEventStore()
    guard requestAccess(store: store) else {
        fputs("[calendar] access denied; dormant\n", stderr)
        return
    }

    doReconcilePass(store: store)
}

// MARK: - Watch loop

func runWatchLoop() {
    guard let lockFd = acquireLock() else {
        fputs("[calendar] another instance holds the lock; exiting\n", stderr)
        return
    }

    let store = EKEventStore()
    guard requestAccess(store: store) else {
        fputs("[calendar] access denied; dormant\n", stderr)
        // Keep running but idle so the app does not respawn us
        RunLoop.current.run()
        close(lockFd)
        return
    }

    // Initial reconcile
    doReconcilePass(store: store)

    // Watch for changes
    let center = NotificationCenter.default
    center.addObserver(
        forName: .EKEventStoreChanged,
        object: store,
        queue: .main
    ) { _ in
        fputs("[calendar] event store changed; reconciling\n", stderr)
        doReconcilePass(store: store)
    }

    fputs("[calendar] watching for changes\n", stderr)

    // Keep the process alive
    signal(SIGTERM) { _ in exit(0) }
    signal(SIGINT) { _ in exit(0) }
    RunLoop.current.run()
    close(lockFd)
}

// MARK: - Access request

private func requestAccess(store: EKEventStore) -> Bool {
    let status = EKEventStore.authorizationStatus(for: .event)
    switch status {
    case .fullAccess:
        return true
    case .notDetermined:
        var granted = false
        let semaphore = DispatchSemaphore(value: 0)
        store.requestFullAccessToEvents { success, error in
            granted = success
            if let error = error {
                fputs("[calendar] access request error: \(error)\n", stderr)
            }
            semaphore.signal()
        }
        semaphore.wait()
        return granted
    default:
        return false
    }
}

// MARK: - The reconcile pass

private func doReconcilePass(store: EKEventStore) {
    do {
        var config = readCalendarSyncConfig()
        var moments = try readMoments()
        let phaseConfigs = readPhaseConfigs()

        // Ensure the Zenborg calendar exists
        let zenborgCalId = ensureZenborgCalendar(store: store, config: &config)
        guard let calId = zenborgCalId else {
            fputs("[calendar] could not create Zenborg calendar\n", stderr)
            return
        }

        let context = ReconcileContext(
            zenborgCalendarId: calId,
            selectedCalendarIds: config.selectedCalendarIds
        )

        // Compute the sync window
        let now = Date()
        let calendar = Calendar.current
        let windowStart = calendar.date(byAdding: .day, value: -SYNC_WINDOW_PAST_DAYS, to: now)!
        let windowEnd = calendar.date(byAdding: .day, value: SYNC_WINDOW_FUTURE_DAYS, to: now)!

        let windowStartDay = dayString(from: windowStart)
        let windowEndDay = dayString(from: windowEnd)

        // Fetch events in the sync window
        let allCalendarIds = Set([calId] + config.selectedCalendarIds)
        let allCalendars = store.calendars(for: .event).filter { allCalendarIds.contains($0.calendarIdentifier) }

        let predicate = store.predicateForEvents(withStart: windowStart, end: windowEnd, calendars: allCalendars.isEmpty ? nil : allCalendars)
        let ekEvents = store.events(matching: predicate)

        // Build event snapshots
        var eventSnapshots: [String: EventSnapshot] = [:]
        for ekEvent in ekEvents {
            let snapshot = eventSnapshotFrom(ekEvent)
            eventSnapshots[snapshot.eventId] = snapshot
        }

        // Partition moments by sync window
        var inWindowMoments: [String: VaultMoment] = [:]
        var outWindowMomentIds: Set<String> = []

        for (id, moment) in moments {
            guard let day = moment.day else {
                // Unallocated moments only matter if they have an externalRef
                // whose event is in our snapshot set
                if moment.externalRef != nil {
                    inWindowMoments[id] = moment
                }
                continue
            }
            if day >= windowStartDay && day <= windowEndDay {
                inWindowMoments[id] = moment
            } else {
                outWindowMomentIds.insert(id)
            }
        }

        // For in-window moments with externalRef but no fetched event,
        // confirm absence with a direct lookup (window-independent)
        for (_, moment) in inWindowMoments {
            guard let ref = moment.externalRef else { continue }
            if eventSnapshots[ref.eventId] != nil { continue }

            // Direct lookup, ignoring the window
            if let ekEvent = store.event(withIdentifier: ref.eventId) {
                // Event exists but outside window; treat as present and in sync
                let snapshot = eventSnapshotFrom(ekEvent)
                eventSnapshots[snapshot.eventId] = snapshot
            }
            // If nil, the event is genuinely deleted; moment will pair with event=null
        }

        // Pair and reconcile
        var actions: [(ReconcileAction, String?)] = [] // action + related moment id
        var processedEventIds: Set<String> = []

        // Moments with events (paired by externalRef.eventId)
        for (id, moment) in inWindowMoments {
            let event: EventSnapshot?
            if let ref = moment.externalRef {
                event = eventSnapshots[ref.eventId]
                if let eid = event?.eventId { processedEventIds.insert(eid) }
            } else {
                event = nil
            }

            let action = reconcile(moment: moment, event: event, context: context)
            if case .none = action { continue }
            actions.append((action, id))
        }

        // Orphan events (no matching moment)
        for (eventId, event) in eventSnapshots where !processedEventIds.contains(eventId) {
            let action = reconcile(moment: nil, event: event, context: context)
            if case .none = action { continue }
            actions.append((action, nil))
        }

        // Apply actions
        var changed = false
        for (action, _) in actions {
            switch action {
            case .publishEvent(let momentId, let overwroteEventEdit):
                if let moment = moments[momentId],
                   let fields = eventFieldsForMoment(moment) {
                    if let ekEvent = createOrUpdateEvent(
                        store: store,
                        calendarId: calId,
                        existingEventId: moment.externalRef?.eventId,
                        title: fields.title,
                        day: fields.day,
                        startTime: fields.startTime,
                        durationMin: fields.durationMin
                    ) {
                        var updated = moment
                        let hash = momentHash(day: fields.day, startTime: fields.startTime, durationMin: fields.durationMin)
                        updated.externalRef = ExternalRef(
                            source: "eventkit",
                            eventId: ekEvent.eventIdentifier,
                            calendarId: calId,
                            lastWrittenHash: hash,
                            lastWrittenTitle: fields.title,
                            lastSyncedAt: iso8601Now()
                        )
                        updated.updatedAt = iso8601Now()
                        moments[momentId] = updated
                        changed = true
                        if overwroteEventEdit {
                            fputs("[calendar] overwrote event edit for moment \(momentId) (moment was newer)\n", stderr)
                        }
                    }
                }

            case .createTentativeMoment(let name, let day, let startTime, let durationMin, let eventId, let eventCalendarId):
                let newId = UUID().uuidString.lowercased()
                let hash = momentHash(day: day, startTime: startTime, durationMin: durationMin)
                let configs = readPhaseConfigs()
                let phase = phaseForStartTime(startTime, configs)
                let newMoment = VaultMoment(
                    id: newId,
                    name: name,
                    areaId: "pending",
                    habitId: nil,
                    phase: phase,
                    day: day,
                    startTime: startTime,
                    durationMin: durationMin,
                    status: "tentative",
                    externalRef: ExternalRef(
                        source: "eventkit",
                        eventId: eventId,
                        calendarId: eventCalendarId,
                        lastWrittenHash: hash,
                        lastWrittenTitle: name,
                        lastSyncedAt: iso8601Now()
                    ),
                    updatedAt: iso8601Now(),
                    raw: [
                        "id": newId,
                        "name": name,
                        "areaId": "pending",
                        "habitId": NSNull(),
                        "cycleId": NSNull(),
                        "cyclePlanId": NSNull(),
                        "phase": phase as Any,
                        "day": day,
                        "order": 0,
                        "startTime": startTime,
                        "durationMin": durationMin,
                        "status": "tentative",
                        "tags": NSNull(),
                        "createdAt": iso8601Now(),
                        "updatedAt": iso8601Now(),
                    ]
                )
                moments[newId] = newMoment
                changed = true
                fputs("[calendar] ingested tentative moment '\(name)' from \(eventCalendarId)\n", stderr)

            case .applyEventToMoment(let momentId, let day, let startTime, let durationMin, let overwroteMomentEdit):
                if var moment = moments[momentId] {
                    moment.day = day
                    moment.startTime = startTime
                    moment.durationMin = durationMin
                    moment.phase = phaseForStartTime(startTime, phaseConfigs)
                    let hash = momentHash(day: day, startTime: startTime, durationMin: durationMin)
                    if var ref = moment.externalRef {
                        ref.lastWrittenHash = hash
                        ref.lastSyncedAt = iso8601Now()
                        moment.externalRef = ref
                    }
                    moment.updatedAt = iso8601Now()
                    moments[momentId] = moment
                    changed = true
                    if overwroteMomentEdit {
                        fputs("[calendar] overwrote moment edit for \(momentId) (event was newer)\n", stderr)
                    }
                }

            case .deleteMoment(let momentId):
                moments.removeValue(forKey: momentId)
                changed = true
                fputs("[calendar] deleted tentative moment \(momentId)\n", stderr)

            case .returnToDrawingBoard(let momentId):
                if var moment = moments[momentId] {
                    moment.day = nil
                    moment.phase = nil
                    moment.externalRef = nil
                    moment.updatedAt = iso8601Now()
                    moments[momentId] = moment
                    changed = true
                    fputs("[calendar] returned moment \(momentId) to drawing board\n", stderr)
                }

            case .deleteEvent(let eventId):
                if let ekEvent = store.event(withIdentifier: eventId) {
                    do {
                        try store.remove(ekEvent, span: .thisEvent)
                        fputs("[calendar] deleted event \(eventId)\n", stderr)
                    } catch {
                        fputs("[calendar] failed to delete event \(eventId): \(error)\n", stderr)
                    }
                }

            case .none:
                break
            }
        }

        // Write once if anything changed
        if changed {
            try writeMoments(moments)
            fputs("[calendar] reconcile pass complete: \(actions.count) actions applied\n", stderr)
        } else {
            fputs("[calendar] reconcile pass complete: no changes\n", stderr)
        }

    } catch {
        fputs("[calendar] reconcile failed: \(error)\n", stderr)
    }
}

// MARK: - EventKit helpers

private func ensureZenborgCalendar(store: EKEventStore, config: inout CalendarSyncConfig) -> String? {
    // Check if existing calendar id still resolves
    if let existingId = config.zenborgCalendarId {
        if let cal = store.calendar(withIdentifier: existingId) {
            return cal.calendarIdentifier
        }
        // Calendar was deleted; clear stale refs
        fputs("[calendar] Zenborg calendar was deleted; recreating\n", stderr)
        config.zenborgCalendarId = nil
    }

    // Check if a "Zenborg" calendar already exists
    for cal in store.calendars(for: .event) {
        if cal.title == ZENBORG_CALENDAR_TITLE {
            config.zenborgCalendarId = cal.calendarIdentifier
            try? writeCalendarSyncConfig(config)
            return cal.calendarIdentifier
        }
    }

    // Create a new one
    let newCal = EKCalendar(for: .event, eventStore: store)
    newCal.title = ZENBORG_CALENDAR_TITLE

    // Use the default source for new calendars
    if let defaultSource = store.defaultCalendarForNewEvents?.source {
        newCal.source = defaultSource
    } else if let localSource = store.sources.first(where: { $0.sourceType == .local }) {
        newCal.source = localSource
    } else {
        fputs("[calendar] no suitable calendar source found\n", stderr)
        return nil
    }

    do {
        try store.saveCalendar(newCal, commit: true)
        config.zenborgCalendarId = newCal.calendarIdentifier
        try writeCalendarSyncConfig(config)
        fputs("[calendar] created Zenborg calendar: \(newCal.calendarIdentifier)\n", stderr)
        return newCal.calendarIdentifier
    } catch {
        fputs("[calendar] failed to create calendar: \(error)\n", stderr)
        return nil
    }
}

private func eventSnapshotFrom(_ ekEvent: EKEvent) -> EventSnapshot {
    let calendar = Calendar.current
    let components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: ekEvent.startDate)
    let day = String(format: "%04d-%02d-%02d", components.year!, components.month!, components.day!)
    let startTime = String(format: "%02d:%02d", components.hour!, components.minute!)
    let durationMin = Int(ekEvent.endDate.timeIntervalSince(ekEvent.startDate) / 60)

    return EventSnapshot(
        eventId: ekEvent.eventIdentifier,
        calendarId: ekEvent.calendar.calendarIdentifier,
        title: ekEvent.title ?? "",
        day: day,
        startTime: startTime,
        durationMin: max(durationMin, 15),
        lastModified: ekEvent.lastModifiedDate?.iso8601 ?? iso8601Now()
    )
}

private func createOrUpdateEvent(
    store: EKEventStore,
    calendarId: String,
    existingEventId: String?,
    title: String,
    day: String,
    startTime: String,
    durationMin: Int
) -> EKEvent? {
    let ekEvent: EKEvent
    if let existingId = existingEventId, let existing = store.event(withIdentifier: existingId) {
        ekEvent = existing
    } else {
        ekEvent = EKEvent(eventStore: store)
        guard let cal = store.calendar(withIdentifier: calendarId) else { return nil }
        ekEvent.calendar = cal
    }

    ekEvent.title = title

    let parts = day.split(separator: "-").map { Int($0)! }
    let timeParts = startTime.split(separator: ":").map { Int($0)! }

    var components = DateComponents()
    components.year = parts[0]
    components.month = parts[1]
    components.day = parts[2]
    components.hour = timeParts[0]
    components.minute = timeParts[1]

    let calendar = Calendar.current
    guard let startDate = calendar.date(from: components) else { return nil }

    ekEvent.startDate = startDate
    ekEvent.endDate = startDate.addingTimeInterval(Double(durationMin) * 60)

    do {
        try store.save(ekEvent, span: .thisEvent)
        return ekEvent
    } catch {
        fputs("[calendar] failed to save event: \(error)\n", stderr)
        return nil
    }
}

private func dayString(from date: Date) -> String {
    let calendar = Calendar.current
    let components = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", components.year!, components.month!, components.day!)
}

// MARK: - Date extension

extension Date {
    var iso8601: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: self)
    }
}
