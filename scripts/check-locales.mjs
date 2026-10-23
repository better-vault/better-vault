#!/usr/bin/env node
// Checks that every locale under locales/ has exactly the keys of locales/en.
// Usage: pnpm i18n:check
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "locales");
const source = "en";

/** Flattens {"a": {"b": "x"}} into ["a.b"]. */
function keysOf(value, prefix = "") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    keysOf(child, prefix ? `${prefix}.${key}` : key),
  );
}

function read(language, file) {
  return JSON.parse(readFileSync(join(root, language, file), "utf8"));
}

const sourceFiles = readdirSync(join(root, source)).filter((f) => f.endsWith(".json"));
const languages = readdirSync(root).filter(
  (entry) => entry !== source && statSync(join(root, entry)).isDirectory(),
);

let problems = 0;
for (const language of languages) {
  for (const file of sourceFiles) {
    let target;
    try {
      target = read(language, file);
    } catch {
      console.error(`✗ ${language}/${file} is missing`);
      problems++;
      continue;
    }
    const expected = new Set(keysOf(read(source, file)));
    const actual = new Set(keysOf(target));
    for (const key of expected) {
      if (!actual.has(key)) {
        console.error(`✗ ${language}/${file}: missing "${key}"`);
        problems++;
      }
    }
    for (const key of actual) {
      if (!expected.has(key)) {
        console.error(`✗ ${language}/${file}: extra "${key}" (not in ${source})`);
        problems++;
      }
    }
  }
}

if (problems > 0) {
  console.error(`\n${problems} problem(s) found.`);
  process.exit(1);
}
console.log(
  `✓ ${languages.length + 1} locale(s) checked against "${source}" (${sourceFiles.length} namespaces).`,
);
