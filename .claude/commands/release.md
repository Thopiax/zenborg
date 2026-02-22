Automate a release for Zenborg. The bump type is: $ARGUMENTS (must be one of: patch, minor, major).

## Steps

1. Read the current version from `package.json`.
2. Compute the new version by applying the bump type to the current version (semver).
3. Update the version string in these files:
   - `package.json` — the `"version"` field
   - `src-tauri/tauri.conf.json` — the `"version"` field
4. Commit the changes with message: `release: v{new_version}`
5. Create a git tag: `v{new_version}`
6. Push the commit and the tag to origin.

## Rules

- If `$ARGUMENTS` is empty or not one of patch/minor/major, ask the user which bump type they want.
- Do NOT touch `src-tauri/Cargo.toml` — the Rust crate version is independent.
- Do NOT run build or tests — CI handles that on tag push.
- Do NOT create a GitHub release — the release workflow triggers on the tag.
- Confirm the version change with the user before committing (e.g., "Bumping 0.3.1 -> 0.3.2. Proceed?").
