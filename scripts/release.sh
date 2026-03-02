main() {
  local bump="${1:-patch}"
  if [[ "$bump" != "patch" && "$bump" != "minor" && "$bump" != "major" ]]; then
    echo "Usage: zenborg-release [patch|minor|major] (default: patch)"
    return 1
  fi

  local dir="$HOME/Developer/zenborg"
  local current=$(node -p "require('$dir/package.json').version")
  IFS='.' read -r major minor patch <<< "$current"

  case "$bump" in
    patch) patch=$((patch + 1)) ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    major) major=$((major + 1)); minor=0; patch=0 ;;
  esac

  local new_version="$major.$minor.$patch"

  echo "Bumping $current -> $new_version ($bump)"
  read -p "Proceed? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; return 1; }
  echo

  cd "$dir" || return 1

  sed -i '' "s/\"version\": \"$current\"/\"version\": \"$new_version\"/" package.json
  sed -i '' "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"version\": \"$new_version\"/" src-tauri/tauri.conf.json
  sed -i '' "s/version = \"[0-9]*\.[0-9]*\.[0-9]*\"/version = \"$new_version\"/" src-tauri/Cargo.toml
  git add package.json src-tauri/tauri.conf.json
  git commit -m "release: v$new_version"
  git tag "v$new_version"
  git push origin main
  git push origin "v$new_version"

  echo "Released v$new_version"
  cd - > /dev/null
}

main "$@"
