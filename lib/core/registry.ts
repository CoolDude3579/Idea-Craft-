import { articAdapter } from "@/lib/adapters/artic";
import { commonsAdapter } from "@/lib/adapters/commons";
import { europepmcAdapter } from "@/lib/adapters/europepmc";
import { gutendexAdapter } from "@/lib/adapters/gutendex";
import { metAdapter } from "@/lib/adapters/met";
import { openalexAdapter } from "@/lib/adapters/openalex";
import { adapter as openverseAdapter } from "@/lib/adapters/openverse";
import type { Adapter } from "@/types/source-result";

import { sourceLabel } from "./source-labels";

export const ADAPTERS: readonly Adapter[] = [
  openalexAdapter,
  europepmcAdapter,
  openverseAdapter,
  commonsAdapter,
  articAdapter,
  metAdapter,
  gutendexAdapter,
];

const BY_ID = new Map(ADAPTERS.map((adapter) => [adapter.sourceId, adapter]));

export function adaptersFor(sourceIds: readonly string[]): Adapter[] {
  return sourceIds
    .map((id) => BY_ID.get(id))
    .filter((adapter): adapter is Adapter => adapter !== undefined);
}

export function adapterLabel(sourceId: string): string {
  return BY_ID.get(sourceId)?.label ?? sourceLabel(sourceId);
}

export function adapterHomepage(sourceId: string): string | null {
  return BY_ID.get(sourceId)?.homepage ?? null;
}
