// Lets scripts/ import project modules with plain node: resolves the "@/*"
// tsconfig path and transpiles .ts with the TypeScript already in
// devDependencies. Node's strip-only mode cannot handle everything the
// project uses (parameter properties in lib/core/http.ts), hence the full
// transpile. Lives in scripts/ and changes nothing about how the app builds.
import { existsSync, readFileSync } from "node:fs";
import { register } from "node:module";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = join(ROOT, specifier.slice(2).replace(/\.tsx?$/, ""));
    const candidates = [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), base];
    const hit = candidates.find((candidate) => existsSync(candidate));
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }

  // Relative TS imports written with an explicit .ts extension.
  if (/^\.{1,2}\//.test(specifier) && /\.tsx?$/.test(specifier)) {
    const parent = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : ROOT;
    const target = resolvePath(parent, specifier);
    if (existsSync(target)) {
      return { url: pathToFileURL(target).href, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}

let transpile = null;

export async function load(url, context, nextLoad) {
  if (!/\.tsx?$/.test(url) || !url.startsWith("file:")) {
    return nextLoad(url, context);
  }

  if (!transpile) {
    const ts = await import("typescript");
    const api = ts.default ?? ts;
    transpile = (source, fileName) =>
      api.transpileModule(source, {
        fileName,
        compilerOptions: {
          module: api.ModuleKind.ESNext,
          target: api.ScriptTarget.ES2022,
          jsx: api.JsxEmit.ReactJSX,
          verbatimModuleSyntax: false,
        },
      }).outputText;
  }

  const fileName = fileURLToPath(url);
  return {
    format: "module",
    shortCircuit: true,
    source: transpile(readFileSync(fileName, "utf8"), fileName),
  };
}

// Self-register when used via `node --import ./scripts/alias-hook.mjs`.
if (!process.env.IDEA_REFINERY_TS_HOOK) {
  process.env.IDEA_REFINERY_TS_HOOK = "1";
  register(import.meta.url);
}
