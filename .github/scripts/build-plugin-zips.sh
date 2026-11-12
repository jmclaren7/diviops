#!/usr/bin/env bash
# Builds the fork's WordPress plugin zips from plugins/ and writes release notes.
#
# Usage: .github/scripts/build-plugin-zips.sh [output-dir]   (default: dist)
#
# Writes diviops-agent.zip, diviops-design-library.zip, SHA256SUMS and
# release-notes.md to the output directory. Fails if a plugin's version header
# disagrees with the other place that version is recorded. Under GitHub Actions
# it also sets the step outputs agent_version, visuals_version and tag.
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd)
out=${1:-dist}
mkdir -p "$out"
out=$(cd "$out" && pwd)

agent_php="$root/plugins/diviops-agent/diviops-agent.php"
agent_readme="$root/plugins/diviops-agent/readme.txt"
agent_changelog="$root/plugins/diviops-agent/changelog.txt"
visuals_php="$root/plugins/diviops-design-library/diviops-design-library.php"

# First "Version:" line of a WordPress plugin header.
header_version() {
	sed -n 's/^[[:space:]]*\*[[:space:]]*Version:[[:space:]]*//p' "$1" | head -n 1 | tr -d '\r[:space:]'
}

agent=$(header_version "$agent_php")
stable=$(sed -n 's/^Stable tag:[[:space:]]*//p' "$agent_readme" | head -n 1 | tr -d '\r[:space:]')
visuals=$(header_version "$visuals_php")
visuals_const=$(sed -n "s/^[[:space:]]*const VERSION = '\([^']*\)';.*/\1/p" "$visuals_php" | head -n 1)

fail=0
if [ -z "$agent" ] || [ -z "$visuals" ]; then
	echo "::error::Could not read a plugin Version header (agent='$agent', visuals='$visuals')." >&2
	fail=1
fi
if [ "$agent" != "$stable" ]; then
	echo "::error file=plugins/diviops-agent/readme.txt::Stable tag '$stable' does not match the DiviOps Agent header version '$agent'." >&2
	fail=1
fi
if [ "$visuals" != "$visuals_const" ]; then
	echo "::error file=plugins/diviops-design-library/diviops-design-library.php::VERSION constant '$visuals_const' does not match the DiviOps Visuals header version '$visuals'." >&2
	fail=1
fi
[ "$fail" -eq 0 ] || exit 1

# Same layout as upstream's committed zips: the plugin folder at the top level,
# files only, sorted, no extra fields.
for slug in diviops-agent diviops-design-library; do
	rm -f "$out/$slug.zip"
	(cd "$root/plugins" && find "$slug" -type f | LC_ALL=C sort | zip -X -q "$out/$slug.zip" -@)
done
(cd "$out" && sha256sum diviops-agent.zip diviops-design-library.zip > SHA256SUMS)

tag="agent-v${agent}_visuals-v${visuals}"
commit=${GITHUB_SHA:-$(git -C "$root" rev-parse HEAD)}

{
	echo "| Plugin | Version | File |"
	echo "|---|---|---|"
	echo "| DiviOps Agent | $agent | \`diviops-agent.zip\` |"
	echo "| DiviOps Visuals | $visuals | \`diviops-design-library.zip\` |"
	echo
	echo "Built from $commit."
	echo
	echo "Both plugins set \`Update URI: false\`, so WordPress won't offer updates for them. To update, upload the zip under **Plugins → Add New → Upload Plugin** and choose **Replace current with uploaded**."
	echo
	echo "## DiviOps Agent changelog"
	echo
	# The newest "## <version>" section, one heading level down.
	awk '/^## /{n++} n==1' "$agent_changelog" | sed '1s/^## /### /'
} > "$out/release-notes.md"

echo "DiviOps Agent $agent, DiviOps Visuals $visuals -> $out"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
	{
		echo "agent_version=$agent"
		echo "visuals_version=$visuals"
		echo "tag=$tag"
	} >> "$GITHUB_OUTPUT"
fi
