export function normalizeSchemaModuleName(moduleName: string): string {
  const trimmed = moduleName.trim();
  return trimmed.startsWith("divi/") ? trimmed.slice("divi/".length) : trimmed;
}

// Encode each segment but keep the namespace slash literal: add-on names like
// `dsm/button` become `dsm%2Fbutton` otherwise, which Apache (default
// AllowEncodedSlashes Off) rejects with its own 404 before WordPress runs.
// The plugin's route pattern already accepts `/` in the name.
export function schemaModuleRoute(moduleName: string): string {
  const path = normalizeSchemaModuleName(moduleName)
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `/schema/module/${path}`;
}
