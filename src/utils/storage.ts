import { createNewBandSession } from '../data/mallConfig';
import { BandSession, SafeStepStore } from '../types/safestep';

export const STORAGE_KEY = 'safestep_master_v1';

export function getDefaultPublicBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://safestep-booth.app/';
  return `${window.location.origin}${window.location.pathname}`;
}

export function createInitialStore(): SafeStepStore {
  const defaultMall = 'جراند أفنيو مول';
  const starterBand = createNewBandSession({
    bandId: 'SKB-101',
    childName: 'آدم كريم',
    editionId: 'batman',
    safeRadius: 18,
    mallName: defaultMall,
  });

  return {
    bands: {
      [starterBand.bandId]: starterBand,
    },
    activeBandId: starterBand.bandId,
    nextSerial: 102,
    mallName: defaultMall,
    publicBaseUrl: getDefaultPublicBaseUrl(),
  };
}

export function loadStore(): SafeStepStore {
  if (typeof window === 'undefined') return createInitialStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = createInitialStore();
      saveStore(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as Partial<SafeStepStore>;
    if (!parsed || typeof parsed !== 'object' || !parsed.bands) {
      const initial = createInitialStore();
      saveStore(initial);
      return initial;
    }
    const bands = parsed.bands;
    const bandIds = Object.keys(bands);
    const activeIds = bandIds.filter((id) => bands[id]?.status === 'active');
    const resolvedActive =
      parsed.activeBandId && bands[parsed.activeBandId]?.status === 'active'
        ? parsed.activeBandId
        : activeIds[0] ?? null;

    return {
      bands,
      activeBandId: resolvedActive,
      nextSerial: typeof parsed.nextSerial === 'number' ? parsed.nextSerial : 102,
      mallName: parsed.mallName || 'جراند أفنيو مول',
      publicBaseUrl: parsed.publicBaseUrl || getDefaultPublicBaseUrl(),
    };
  } catch {
    return createInitialStore();
  }
}

export function saveStore(store: SafeStepStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota errors gracefully
  }
}

export function saveSingleBandToCache(band: BandSession): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadStore();
    const updated: SafeStepStore = {
      ...current,
      bands: {
        ...current.bands,
        [band.bandId]: band,
      },
    };
    saveStore(updated);
  } catch {
    // ignore
  }
}

export function buildParentScanUrl(baseUrl: string, bandId: string): string {
  const cleanBase = baseUrl.trim().replace(/[?#].*$/, '');
  return `${cleanBase}?p=${encodeURIComponent(bandId)}`;
}
