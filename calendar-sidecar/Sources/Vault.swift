import Foundation

// MARK: - Vault root

func vaultRoot() -> URL {
    if let env = ProcessInfo.processInfo.environment["ZENBORG_VAULT"] {
        return URL(fileURLWithPath: env)
    }
    #if DEBUG
    return FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent(".kairos-dev")
    #else
    return FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent(".kairos")
    #endif
}

// MARK: - FNV-1a 64-bit (byte-for-byte port of TS fnv1a64)

// Cross-language digests:
//   fnv1a64("zenborg")             == "228301fdf1d234ee"
//   fnv1a64("2026-08-24|10:30|30") == "ff236ccaea7fb964"
func fnv1a64(_ input: String) -> String {
    var hash: UInt64 = 0xcbf29ce484222325
    for byte in Array(input.utf8) {
        hash ^= UInt64(byte)
        hash = hash &* 0x100000001b3
    }
    return String(format: "%016llx", hash)
}

func momentHash(day: String, startTime: String, durationMin: Int) -> String {
    return fnv1a64("\(day)|\(startTime)|\(durationMin)")
}

// MARK: - Typed views (decoded per record for reading; writes patch raw dicts)

struct ExternalRef: Codable, Equatable {
    var source: String
    var eventId: String
    var calendarId: String
    var lastWrittenHash: String
    var lastWrittenTitle: String
    var lastSyncedAt: String
}

struct VaultMoment {
    let id: String
    var name: String
    var areaId: String
    var habitId: String?
    var phase: String?
    var day: String?
    var startTime: String?
    var durationMin: Int?
    var status: String?
    var externalRef: ExternalRef?
    var updatedAt: String

    // The underlying raw dictionary, preserving all unknown fields
    var raw: [String: Any]
}

struct CalendarSyncConfig: Codable {
    var selectedCalendarIds: [String]
    var zenborgCalendarId: String?
    var updatedAt: String
}

// MARK: - Read

func readMoments() throws -> [String: VaultMoment] {
    let url = vaultRoot().appendingPathComponent("moments.json")
    guard FileManager.default.fileExists(atPath: url.path) else {
        return [:]
    }
    let data = try Data(contentsOf: url)
    guard let dict = try JSONSerialization.jsonObject(with: data) as? [String: [String: Any]] else {
        return [:]
    }
    var result: [String: VaultMoment] = [:]
    for (id, raw) in dict {
        result[id] = decodeMoment(id: id, raw: raw)
    }
    return result
}

func readCalendarSyncConfig() -> CalendarSyncConfig {
    let url = vaultRoot().appendingPathComponent("calendarSync.json")
    guard FileManager.default.fileExists(atPath: url.path),
          let data = try? Data(contentsOf: url),
          let config = try? JSONDecoder().decode(CalendarSyncConfig.self, from: data) else {
        return CalendarSyncConfig(
            selectedCalendarIds: [],
            zenborgCalendarId: nil,
            updatedAt: iso8601Now()
        )
    }
    return config
}

func readPhaseConfigs() -> [[String: Any]] {
    let url = vaultRoot().appendingPathComponent("phaseConfigs.json")
    guard FileManager.default.fileExists(atPath: url.path),
          let data = try? Data(contentsOf: url),
          let dict = try? JSONSerialization.jsonObject(with: data) as? [String: [String: Any]] else {
        return []
    }
    return Array(dict.values)
}

// MARK: - Write (atomic temp-then-rename, field-preserving)

func writeMoments(_ moments: [String: VaultMoment]) throws {
    let url = vaultRoot().appendingPathComponent("moments.json")

    // Build the output dictionary from raw dicts (preserves unknown fields)
    var output: [String: [String: Any]] = [:]
    for (id, moment) in moments {
        output[id] = encodeMoment(moment)
    }

    let data = try JSONSerialization.data(
        withJSONObject: output,
        options: [.prettyPrinted, .sortedKeys]
    )

    let tmpName = "moments.json.tmp-\(ProcessInfo.processInfo.processIdentifier)-\(Int(Date().timeIntervalSince1970 * 1000))"
    let tmpUrl = vaultRoot().appendingPathComponent(tmpName)

    try data.write(to: tmpUrl, options: .atomic)
    _ = try FileManager.default.replaceItemAt(url, withItemAt: tmpUrl)
}

func writeCalendarSyncConfig(_ config: CalendarSyncConfig) throws {
    let url = vaultRoot().appendingPathComponent("calendarSync.json")
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    let data = try encoder.encode(config)

    let tmpName = "calendarSync.json.tmp-\(ProcessInfo.processInfo.processIdentifier)-\(Int(Date().timeIntervalSince1970 * 1000))"
    let tmpUrl = vaultRoot().appendingPathComponent(tmpName)

    try data.write(to: tmpUrl, options: .atomic)
    _ = try FileManager.default.replaceItemAt(url, withItemAt: tmpUrl)
}

// MARK: - Private helpers

private func decodeMoment(id: String, raw: [String: Any]) -> VaultMoment {
    var ref: ExternalRef? = nil
    if let refDict = raw["externalRef"] as? [String: Any] {
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
        id: id,
        name: raw["name"] as? String ?? "",
        areaId: raw["areaId"] as? String ?? "",
        habitId: raw["habitId"] as? String,
        phase: raw["phase"] as? String,
        day: raw["day"] as? String,
        startTime: raw["startTime"] as? String,
        durationMin: raw["durationMin"] as? Int,
        status: raw["status"] as? String,
        externalRef: ref,
        updatedAt: raw["updatedAt"] as? String ?? "",
        raw: raw
    )
}

private func encodeMoment(_ moment: VaultMoment) -> [String: Any] {
    var dict = moment.raw

    // Patch only the fields the sidecar owns
    dict["name"] = moment.name
    dict["areaId"] = moment.areaId
    dict["day"] = moment.day as Any
    dict["phase"] = moment.phase as Any
    dict["startTime"] = moment.startTime as Any
    dict["durationMin"] = moment.durationMin as Any
    dict["status"] = moment.status as Any
    dict["updatedAt"] = moment.updatedAt

    if let ref = moment.externalRef {
        dict["externalRef"] = [
            "source": ref.source,
            "eventId": ref.eventId,
            "calendarId": ref.calendarId,
            "lastWrittenHash": ref.lastWrittenHash,
            "lastWrittenTitle": ref.lastWrittenTitle,
            "lastSyncedAt": ref.lastSyncedAt,
        ] as [String: Any]
    } else {
        dict.removeValue(forKey: "externalRef")
    }

    return dict
}

func iso8601Now() -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: Date())
}
