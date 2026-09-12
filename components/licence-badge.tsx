import {
  attributionRequired,
  commercialUseAllowed,
  derivativesAllowed,
  licenceLabel,
} from "@/lib/core/licence";
import type { Spdx } from "@/types/source-result";

export function conditions(licence: Spdx): string {
  if (licence === "UNKNOWN") return "check with the provider before reuse";
  const parts = [
    commercialUseAllowed(licence) ? "commercial ok" : "non-commercial only",
    derivativesAllowed(licence) ? "edits ok" : "no edits",
  ];
  if (attributionRequired(licence)) parts.push("credit required");
  return parts.join(" · ");
}

export function LicenceBadge({
  licence,
  licenceUrl,
  providerFamily,
}: {
  licence: Spdx;
  licenceUrl: string | null;
  /** CC family the provider named without a version, e.g. "CC BY". */
  providerFamily?: string | null;
}) {
  const free = licence !== "UNKNOWN" && commercialUseAllowed(licence);
  const className = `badge ${free ? "free" : "restricted"}`;
  const label =
    licence === "UNKNOWN" && providerFamily
      ? `${providerFamily}, version unstated`
      : licenceLabel(licence);

  if (!licenceUrl) return <span className={className}>{label}</span>;

  return (
    <a className={className} href={licenceUrl} target="_blank" rel="noreferrer noopener">
      {label}
    </a>
  );
}
