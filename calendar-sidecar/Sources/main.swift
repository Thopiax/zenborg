import Foundation

let arguments = Array(CommandLine.arguments.dropFirst())
let command = arguments.first ?? "run"

switch command {
case "status":
    printStatus()
case "hash":
    print(fnv1a64(arguments.count > 1 ? arguments[1] : ""))
case "roundtrip":
    do {
        let moments = try readMoments()
        try writeMoments(moments)
        fputs("roundtrip ok: \(moments.count) moments\n", stderr)
    } catch {
        fputs("roundtrip failed: \(error)\n", stderr)
        exit(1)
    }
case "self-test":
    guard arguments.count > 1 else {
        fputs("usage: zenborg-calendar self-test <vectors.json>\n", stderr)
        exit(2)
    }
    runSelfTest(vectorsPath: arguments[1])
case "dedup":
    dedup()
case "reconcile-once":
    reconcileOnce()
case "run":
    runWatchLoop()
default:
    fputs("unknown command: \(command)\n", stderr)
    exit(2)
}
