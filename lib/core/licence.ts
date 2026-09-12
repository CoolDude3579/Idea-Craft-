import { isSpdx, type Spdx } from "@/types/source-result";

/** Element slugs, version-free. Providers spell these several ways. */
const ELEMENTS: Readonly<Record<string, string>> = {
  by: "CC-BY",
  "by-sa": "CC-BY-SA",
  "by-nc": "CC-BY-NC",
  "by-nd": "CC-BY-ND",
  "by-nc-sa": "CC-BY-NC-SA",
  "by-nc-nd": "CC-BY-NC-ND",
};

/** Slugs that carry no version at all. */
const VERSIONLESS: Readonly<Record<string, Spdx>> = {
  cc0: "CC0-1.0",
  "cc0-1.0": "CC0-1.0",
  zero: "CC0-1.0",
  pdm: "CC-PDDC",
  pd: "CC-PDDC",
  publicdomain: "CC-PDDC",
  "public-domain": "CC-PDDC",
  mit: "MIT",
  "apache-2.0": "Apache-2.0",
};

const SUPPORTED_VERSIONS = ["2.0", "3.0", "4.0"] as const;

/**
 * Normalises a provider licence slug to SPDX. Europe PMC writes "cc by-nc",
 * Openverse "by-nc" + license_version, Commons "cc-by-nc-4.0".
 * Anything that does not land on a known identifier becomes UNKNOWN.
 */
export function toSpdx(
  slug: string | null | undefined,
  version?: string | null,
): Spdx {
  if (!slug) return "UNKNOWN";
  if (isSpdx(slug)) return slug;

  const cleaned = slug.trim().toLowerCase().replace(/\s+/g, "-");
  const direct = VERSIONLESS[cleaned];
  if (direct) return direct;

  // "cc-by-sa-4.0" and "cc-by-sa" both reduce to the element list.
  const withoutCc = cleaned.replace(/^cc-?/, "");
  const embedded = /^(.*?)-(\d\.\d)$/.exec(withoutCc);
  const elementKey = embedded ? (embedded[1] ?? "") : withoutCc;
  const embeddedVersion = embedded ? embedded[2] : null;

  const element = ELEMENTS[elementKey];
  if (!element) return VERSIONLESS[withoutCc] ?? "UNKNOWN";

  const major = (embeddedVersion ?? version ?? "").trim();
  const normalised = SUPPORTED_VERSIONS.find((candidate) =>
    major.startsWith(candidate.slice(0, 2)),
  );
  // A CC element with no usable version is not identifiable: 1.0 and 2.5
  // exist and differ, so we report UNKNOWN rather than assuming 4.0.
  if (!normalised) return "UNKNOWN";

  const candidate = `${element}-${normalised}`;
  return isSpdx(candidate) ? candidate : "UNKNOWN";
}

/**
 * The CC family a provider named, when it named one without a version —
 * Europe PMC's "cc by", OpenAlex's "cc-by". The licence itself stays
 * UNKNOWN: this is only for showing the reader the provider's own words
 * instead of a bare "Licence unknown".
 */
export function ccFamilyLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  const cleaned = slug.trim().toLowerCase().replace(/\s+/g, "-");
  const withoutCc = cleaned.replace(/^cc-?/, "").replace(/-\d\.\d$/, "");
  const element = ELEMENTS[withoutCc];
  return element ? element.replace("CC-", "CC ") : null;
}

/** Parses a licence URL such as creativecommons.org/licenses/by-sa/2.0/. */
export function spdxFromUrl(url: string | null | undefined): Spdx {
  if (!url) return "UNKNOWN";
  const match =
    /creativecommons\.org\/(?:licenses|publicdomain)\/([^/]+)\/?([^/?#]*)/i.exec(url);
  if (!match) return "UNKNOWN";
  return toSpdx(match[1] ?? null, match[2] ?? null);
}

function elementOf(licence: Spdx): string {
  return licence.replace(/-\d\.\d$/, "");
}

/** Higher is freer to reuse. Drives ranking and the reuse badge. */
export function reuseScore(licence: Spdx): number {
  if (licence === "UNKNOWN") return 0.1;
  if (licence === "CC0-1.0" || licence === "CC-PDDC") return 1;
  if (licence === "MIT" || licence === "Apache-2.0") return 0.95;

  const base: Readonly<Record<string, number>> = {
    "CC-BY": 0.85,
    "CC-BY-SA": 0.7,
    "CC-BY-NC": 0.5,
    "CC-BY-ND": 0.45,
    "CC-BY-NC-SA": 0.4,
    "CC-BY-NC-ND": 0.3,
  };
  const score = base[elementOf(licence)] ?? 0.1;
  // Older versions are legally fine but less portable; nudge 4.0 ahead so
  // ranking prefers the modern grant when both are available.
  return licence.endsWith("-4.0") ? score : score - 0.03;
}

export function commercialUseAllowed(licence: Spdx): boolean {
  return !licence.includes("-NC");
}

export function derivativesAllowed(licence: Spdx): boolean {
  return !licence.includes("-ND");
}

export function attributionRequired(licence: Spdx): boolean {
  return licence !== "CC0-1.0" && licence !== "CC-PDDC";
}

export function licenceLabel(licence: Spdx): string {
  if (licence === "UNKNOWN") return "Licence unknown";
  if (licence === "CC-PDDC") return "Public domain";
  if (licence === "CC0-1.0") return "CC0";
  if (licence === "MIT" || licence === "Apache-2.0") return licence;
  const version = licence.slice(-3);
  return `${elementOf(licence).replace("CC-", "CC ")} ${version}`;
}
