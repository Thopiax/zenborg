import Foundation

// MARK: - Types

struct EventSnapshot {
    var eventId: String
    var calendarId: String
    var title: String
    var day: String
    var startTime: String
    var durationMin: Int
    var lastModified: String
}

struct ReconcileContext {
    var zenborgCalendarId: String
    var selectedCalendarIds: [String]
}

enum ReconcileAction: Equatable {
    case none(reason: String)
    case createTentativeMoment(name: String, day: String, startTime: String, durationMin: Int, eventId: String, calendarId: String)
    case publishEvent(momentId: String, overwroteEventEdit: Bool)
    case applyEventToMoment(momentId: String, day: String, startTime: String, durationMin: Int, overwroteMomentEdit: Bool)
    case deleteMoment(momentId: String)
    case returnToDrawingBoard(momentId: String)
    case deleteEvent(eventId: String)
}

// MARK: - snapToGrid (port of TimeGrid.ts)

let CALENDAR_GRID_MINUTES = 15
private let LAST_GRID_MINUTE = 24 * 60 - CALENDAR_GRID_MINUTES

private func snapMinutes(_ total: Int) -> Int {
    return Int((Double(total) / Double(CALENDAR_GRID_MINUTES)).rounded()) * CALENDAR_GRID_MINUTES
}

private func formatTime(_ totalMinutes: Int) -> String {
    let hh = totalMinutes / 60
    let mm = totalMinutes % 60
    return String(format: "%02d:%02d", hh, mm)
}

func snapToGrid(startTime: String, durationMin: Int) -> (startTime: String, durationMin: Int) {
    let parts = startTime.split(separator: ":").map { Int($0)! }
    let h = parts[0]
    let m = parts[1]
    let snappedStart = min(snapMinutes(h * 60 + m), LAST_GRID_MINUTE)
    let snappedDuration = max(CALENDAR_GRID_MINUTES, snapMinutes(durationMin))
    return (formatTime(snappedStart), snappedDuration)
}

// MARK: - phaseForStartTime (port of Schedule.ts:151)

private func startTimeHour(_ startTime: String) -> Int {
    return Int(startTime.prefix(2))!
}

private func isHourInPhase(_ hour: Int, startHour: Int, endHour: Int) -> Bool {
    if endHour <= startHour {
        return hour >= startHour || hour < endHour
    }
    return hour >= startHour && hour < endHour
}

func phaseForStartTime(_ startTime: String, _ phaseConfigs: [[String: Any]]) -> String? {
    let hour = startTimeHour(startTime)
    let sorted = phaseConfigs.sorted {
        ($0["order"] as? Int ?? 0) < ($1["order"] as? Int ?? 0)
    }
    for config in sorted {
        let sH = config["startHour"] as? Int ?? 0
        let eH = config["endHour"] as? Int ?? 0
        if isHourInPhase(hour, startHour: sH, endHour: eH) {
            return config["phase"] as? String
        }
    }
    return nil
}

// MARK: - countsAsAllocation (port of Moment.ts)

func countsAsAllocation(_ moment: VaultMoment) -> Bool {
    return moment.status != "tentative"
}

// MARK: - eventFieldsForMoment

func eventFieldsForMoment(_ moment: VaultMoment) -> (title: String, day: String, startTime: String, durationMin: Int)? {
    guard let day = moment.day, let startTime = moment.startTime else {
        return nil
    }
    return (moment.name, day, startTime, moment.durationMin ?? 60)
}

// MARK: - reconcile (the truth table, ten branches)

func reconcile(moment: VaultMoment?, event: EventSnapshot?, context: ReconcileContext) -> ReconcileAction {
    // Branch 1: degenerate guard
    if moment == nil && event == nil {
        return .none(reason: "inSync")
    }

    // Branch 2: orphan event in the Zenborg calendar (moment deleted/unallocated)
    if moment == nil, let event = event, event.calendarId == context.zenborgCalendarId {
        return .deleteEvent(eventId: event.eventId)
    }

    // Branch 3: new event on a selected calendar
    if moment == nil, let event = event, context.selectedCalendarIds.contains(event.calendarId) {
        let snapped = snapToGrid(startTime: event.startTime, durationMin: event.durationMin)
        let words = event.title.split(separator: " ").prefix(3).joined(separator: " ")
        let name = words.isEmpty ? event.title : words
        return .createTentativeMoment(
            name: name,
            day: event.day,
            startTime: snapped.startTime,
            durationMin: snapped.durationMin,
            eventId: event.eventId,
            calendarId: event.calendarId
        )
    }

    // Branch 4: event on an unselected calendar
    if moment == nil {
        return .none(reason: "unselectedCalendar")
    }

    let moment = moment!

    // Branch 5: ambient moment (no startTime)
    if moment.startTime == nil {
        return .none(reason: "ambient")
    }

    // Branch 6: no event, no externalRef
    if event == nil && moment.externalRef == nil {
        if moment.day != nil && moment.startTime != nil && countsAsAllocation(moment) {
            return .publishEvent(momentId: moment.id, overwroteEventEdit: false)
        }
        return .none(reason: "inSync")
    }

    // Branch 7: no event, has externalRef (event was deleted)
    if event == nil, moment.externalRef != nil {
        if moment.status == "tentative" {
            return .deleteMoment(momentId: moment.id)
        }
        return .returnToDrawingBoard(momentId: moment.id)
    }

    let event = event!

    // Branch 8: moment unallocated
    if moment.day == nil {
        return .deleteEvent(eventId: event.eventId)
    }

    guard let ref = moment.externalRef,
          let fields = eventFieldsForMoment(moment) else {
        return .none(reason: "inSync")
    }

    // Branch 9: Zenborg calendar event
    if event.calendarId == context.zenborgCalendarId {
        let eventHash = momentHash(day: event.day, startTime: event.startTime, durationMin: event.durationMin)
        let currentMomentHash = momentHash(day: fields.day, startTime: fields.startTime, durationMin: fields.durationMin)

        let eventTimingChanged = eventHash != ref.lastWrittenHash
        let momentTimingChanged = currentMomentHash != ref.lastWrittenHash

        // Name-only change in zenborg (timing unchanged on both sides)
        if !eventTimingChanged && !momentTimingChanged && moment.name != ref.lastWrittenTitle {
            return .publishEvent(momentId: moment.id, overwroteEventEdit: false)
        }

        // Neither changed: echo
        if !eventTimingChanged && !momentTimingChanged {
            return .none(reason: "echo")
        }

        // Only event changed: drag
        if eventTimingChanged && !momentTimingChanged {
            let snapped = snapToGrid(startTime: event.startTime, durationMin: event.durationMin)
            return .applyEventToMoment(
                momentId: moment.id,
                day: event.day,
                startTime: snapped.startTime,
                durationMin: snapped.durationMin,
                overwroteMomentEdit: false
            )
        }

        // Only moment changed: push
        if !eventTimingChanged && momentTimingChanged {
            return .publishEvent(momentId: moment.id, overwroteEventEdit: false)
        }

        // Both changed: last write wins by timestamp
        let eventTime = event.lastModified
        let momentTime = moment.updatedAt
        if eventTime > momentTime {
            let snapped = snapToGrid(startTime: event.startTime, durationMin: event.durationMin)
            return .applyEventToMoment(
                momentId: moment.id,
                day: event.day,
                startTime: snapped.startTime,
                durationMin: snapped.durationMin,
                overwroteMomentEdit: true
            )
        } else {
            return .publishEvent(momentId: moment.id, overwroteEventEdit: true)
        }
    }

    // Branch 10: foreign (ingested) calendar
    let snapped = snapToGrid(startTime: event.startTime, durationMin: event.durationMin)
    let eventHash = momentHash(day: event.day, startTime: snapped.startTime, durationMin: snapped.durationMin)

    // Idempotence guard
    if snapped.startTime == fields.startTime
        && snapped.durationMin == fields.durationMin
        && event.day == fields.day {
        return .none(reason: "inSync")
    }

    // Event moved on the foreign calendar
    if eventHash != ref.lastWrittenHash {
        let momentTimingChanged = momentHash(day: fields.day, startTime: fields.startTime, durationMin: fields.durationMin) != ref.lastWrittenHash
        return .applyEventToMoment(
            momentId: moment.id,
            day: event.day,
            startTime: snapped.startTime,
            durationMin: snapped.durationMin,
            overwroteMomentEdit: momentTimingChanged
        )
    }

    // Local edit of ingested moment; the moment wins
    return .none(reason: "localEdit")
}

// MARK: - Self-test (replay shared vectors)

func runSelfTest(vectorsPath: String) {
    guard let data = FileManager.default.contents(atPath: vectorsPath),
          let vectors = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
        fputs("could not read vectors file: \(vectorsPath)\n", stderr)
        exit(1)
    }

    var passed = 0
    var failed = 0

    for vector in vectors {
        let name = vector["name"] as? String ?? "unnamed"

        // Skip documentation-only vectors (no context/expected fields)
        guard let contextDict = vector["context"] as? [String: Any],
              let expected = vector["expected"] as? [String: Any] else {
            fputs("SKIP \(name) (documentation only)\n", stderr)
            continue
        }

        let momentDict = vector["moment"] as? [String: Any]
        let eventDict = vector["event"] as? [String: Any]

        let moment: VaultMoment? = momentDict.map { decodeMomentFromVector($0) }
        let event: EventSnapshot? = eventDict.map { decodeEventFromVector($0) }
        let context = ReconcileContext(
            zenborgCalendarId: contextDict["zenborgCalendarId"] as! String,
            selectedCalendarIds: contextDict["selectedCalendarIds"] as! [String]
        )

        let result = reconcile(moment: moment, event: event, context: context)
        let resultDict = encodeAction(result)

        if dictionariesEqual(resultDict, expected) {
            fputs("PASS \(name)\n", stderr)
            passed += 1
        } else {
            let resultJson = try! JSONSerialization.data(withJSONObject: resultDict, options: .sortedKeys)
            let expectedJson = try! JSONSerialization.data(withJSONObject: expected, options: .sortedKeys)
            fputs("FAIL \(name):\n  got:      \(String(data: resultJson, encoding: .utf8)!)\n  expected: \(String(data: expectedJson, encoding: .utf8)!)\n", stderr)
            failed += 1
        }
    }

    fputs("\n\(passed) passed, \(failed) failed\n", stderr)
    if failed > 0 { exit(1) }
}

// MARK: - Self-test helpers

private func decodeMomentFromVector(_ dict: [String: Any]) -> VaultMoment {
    var ref: ExternalRef? = nil
    if let refDict = dict["externalRef"] as? [String: Any] {
        ref = ExternalRef(
            source: refDict["source"] as? String ?? "eventkit",
            eventId: refDict["eventId"] as? String ?? "",
            calendarId: refDict["calendarId"] as? String ?? "",
            lastWrittenHash: refDict["lastWrittenHash"] as? String ?? "",
            lastWrittenTitle: refDict["lastWrittenTitle"] as? String ?? "",
            lastSyncedAt: refDict["lastSyncedAt"] as? String ?? ""
        )
    }
    return VaultMoment(
        id: dict["id"] as? String ?? "",
        name: dict["name"] as? String ?? "",
        areaId: dict["areaId"] as? String ?? "",
        habitId: dict["habitId"] as? String,
        phase: dict["phase"] as? String,
        day: dict["day"] as? String,
        startTime: dict["startTime"] as? String,
        durationMin: dict["durationMin"] as? Int,
        status: dict["status"] as? String,
        externalRef: ref,
        updatedAt: dict["updatedAt"] as? String ?? "",
        raw: dict
    )
}

private func decodeEventFromVector(_ dict: [String: Any]) -> EventSnapshot {
    return EventSnapshot(
        eventId: dict["eventId"] as? String ?? "",
        calendarId: dict["calendarId"] as? String ?? "",
        title: dict["title"] as? String ?? "",
        day: dict["day"] as? String ?? "",
        startTime: dict["startTime"] as? String ?? "",
        durationMin: dict["durationMin"] as? Int ?? 60,
        lastModified: dict["lastModified"] as? String ?? ""
    )
}

private func encodeAction(_ action: ReconcileAction) -> [String: Any] {
    switch action {
    case .none(let reason):
        return ["kind": "none", "reason": reason]
    case .createTentativeMoment(let name, let day, let startTime, let durationMin, let eventId, let calendarId):
        return [
            "kind": "createTentativeMoment",
            "name": name,
            "day": day,
            "startTime": startTime,
            "durationMin": durationMin,
            "eventId": eventId,
            "calendarId": calendarId,
        ]
    case .publishEvent(let momentId, let overwroteEventEdit):
        return ["kind": "publishEvent", "momentId": momentId, "overwroteEventEdit": overwroteEventEdit]
    case .applyEventToMoment(let momentId, let day, let startTime, let durationMin, let overwroteMomentEdit):
        return [
            "kind": "applyEventToMoment",
            "momentId": momentId,
            "day": day,
            "startTime": startTime,
            "durationMin": durationMin,
            "overwroteMomentEdit": overwroteMomentEdit,
        ]
    case .deleteMoment(let momentId):
        return ["kind": "deleteMoment", "momentId": momentId]
    case .returnToDrawingBoard(let momentId):
        return ["kind": "returnToDrawingBoard", "momentId": momentId]
    case .deleteEvent(let eventId):
        return ["kind": "deleteEvent", "eventId": eventId]
    }
}

private func dictionariesEqual(_ a: [String: Any], _ b: [String: Any]) -> Bool {
    guard a.keys.count == b.keys.count else { return false }
    for (key, aVal) in a {
        guard let bVal = b[key] else { return false }
        if let aStr = aVal as? String, let bStr = bVal as? String {
            if aStr != bStr { return false }
        } else if let aNum = aVal as? Int, let bNum = bVal as? Int {
            if aNum != bNum { return false }
        } else if let aBool = aVal as? Bool, let bBool = bVal as? Bool {
            if aBool != bBool { return false }
        } else if let aDict = aVal as? [String: Any], let bDict = bVal as? [String: Any] {
            if !dictionariesEqual(aDict, bDict) { return false }
        } else {
            let aDesc = String(describing: aVal)
            let bDesc = String(describing: bVal)
            if aDesc != bDesc { return false }
        }
    }
    return true
}
