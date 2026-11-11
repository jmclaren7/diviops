# Fork notes

`jmclaren7/diviops` is a fork of DiviOps that tracks upstream and adds a small set of changes. The DiviOps Agent's module schema tools also discover third-party Divi 5 add-on modules (Divi Supreme, Divi Torque, Squad Modules and others). The Claude plugin ships its own MCP server build, so it runs the fork's server code instead of the npm release. The fork also has its own identity: the marketplace is `jcs-diviops`, both WordPress plugins set `Update URI: false`, and the URLs point at the fork. That way it installs alongside upstream and WordPress.org releases can't overwrite it. Everything else follows upstream.

## Upstream

- URL: https://github.com/oaris-dev/diviops
- Tracked branch: `main`
- Last rebase: 2026-11-11, onto `407a9b09d99b32eb003fe33d11cc9bf2a73dcab2` ("chore: sync MCP 1.5.76 and Free 1.5.50 checksum guards")
- Update method: the fork's commits are rebased onto upstream `main`. Backups are kept as `rebase-backup` and `rebase-backup-YYYY-MM-DD` (newest 3).

## Active changes

1. **Add-on module discovery in schema tools** (adapted 2026-11-11)
   - Why: without it, agents couldn't see modules that add-ons register under their own block namespaces, or get their schemas.
   - What: `schema_list_modules` tags every module with `source` (`divi` | `addon`) and `namespace`. A module counts if upstream's `is_supported_divi_module()` accepts it (core, or registered through Divi's own extension registration). It also counts if its namespace is on the allowlist (extend it with `DIVIOPS_AGENT_MODULE_NAMESPACES` or the `diviops_agent_module_namespaces` filter), or if it declares a Divi 5 module category (turn that off with `diviops_agent_detect_modules_by_category`). `core/*` blocks never count. `schema_get_module` resolves bare add-on names and returns `conflict` with candidates when a name is ambiguous. `validate_blocks` warns about add-on blocks whose plugin isn't active. `dump_all` stays core-only. The builder skill tells agents to treat add-on modules as equal candidates.
   - Files: `plugins/diviops-agent/includes/trait-module-schema.php`, `plugins/diviops-agent/includes/trait-validate.php`, `plugins/diviops-agent/README.md`, `plugins/diviops-agent/changelog.txt`, `skills/diviops-divi-5/SKILL.md`, `skills/diviops-divi-5/references/tools.md`
2. **Fork packaging for the Agent**
   - Why: a WordPress.org release must not replace the fork build.
   - What: version `1.5.50.1` (upstream version + `.1`), `Update URI: false`, a fork note in the description, and a fork changelog entry.
   - Files: `plugins/diviops-agent/diviops-agent.php`, `plugins/diviops-agent/readme.txt`, `plugins/diviops-agent/changelog.txt`
3. **schema_get_module description for bare add-on names**
   - Why: tells agents what the fork's plugin accepts (see change 1).
   - Files: `diviops-server/src/index.ts`
4. **MCP server shipped inside the Claude plugin**
   - Why: installing the fork's plugin should run the fork's server code.
   - What: `plugin.json` declares a `diviops` MCP server that runs `diviops-server/bundle/diviops-mcp.mjs`. Rebuild that file with `npm run bundle` (esbuild). Also adds a README note and `.gitignore`.
   - Files: `.claude-plugin/plugin.json`, `README.md`, `diviops-server/package.json`, `diviops-server/.gitignore`, `diviops-server/bundle/diviops-mcp.mjs` (generated)
5. **Fork identity at runtime**
   - Why: if upstream's `diviops` marketplace was added earlier, adding the fork under the same name fails, and the Visuals plugin needs the same update protection as the Agent.
   - What: marketplace renamed to `jcs-diviops` (owner jmclaren7). Claude plugin version `1.4.16`, kept ahead of upstream's `1.4.15`. DiviOps Visuals (design library) is `1.0.0-beta.26.1` with `Update URI: false`. Plugin URI, plugin.json and package.json URLs point at the fork. `meta_wp_cli`'s WP_PATH hint no longer points users at the npm release. The root plugin zips are rebuilt from the fork's sources.
   - Files: `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`, `README.md`, `diviops-server/package.json`, `diviops-server/src/index.ts`, `plugins/diviops-agent/diviops-agent.php`, `plugins/diviops-design-library/diviops-design-library.php`, `diviops-agent.zip`, `diviops-design-library.zip` (generated)

Generated files (`diviops-server/bundle/diviops-mcp.mjs`, `diviops-agent.zip`, `diviops-design-library.zip`) are never hand-merged. Rebuild them after each rebase: run `npm ci && npm run bundle` in `diviops-server/`, then zip `plugins/diviops-agent` and `plugins/diviops-design-library` from `plugins/`, sorted and with no extra fields. Upstream's desktop skill zips (`diviops-desktop.zip`, `diviops-divi-5-desktop.zip`) are taken from upstream unchanged.

## Superseded changes

- **Literal namespace slash in `schemaModuleRoute()`** (fork `d2b4a6c`): upstream now keeps the slash literal and validates the name in `diviops-server/src/schema-route.ts`. It arrived in upstream `11c7d87` ("Sync from dev repo: ec330d9"), the same commit that added `is_supported_divi_module()`. The fork's tool-description part survives as change 3.
- **Upstream sync squash** (fork `965c104`, squash of upstream `9abb9be`): the upstream part is now in upstream history. Its fork-only content (version bumps, changelog header, rebuilt artifacts) is folded into changes 2, 4 and 5.

## Undocumented changes

No FORK.md existed before this rebase, so it was reconstructed from the commits since the merge-base (`e1a4d59`). No fork changes were found beyond the ones listed above.
