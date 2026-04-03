import PocketBase from 'pocketbase';

const POCKETBASE_URL = process.env.EXPO_PUBLIC_POCKETBASE_URL?.trim();
const USE_POCKETBASE = process.env.EXPO_PUBLIC_USE_POCKETBASE === 'true' && !!POCKETBASE_URL;

const pb = POCKETBASE_URL
  ? (() => {
      const client = new PocketBase(POCKETBASE_URL);
      // Sync runs concurrent list/update calls; disable SDK auto-cancel to avoid aborted sync requests.
      client.autoCancellation(false);
      return client;
    })()
  : null;
const MAX_RESOURCE_PAYLOAD_LENGTH = 5000;

const isAutoCancelledError = (error: unknown) => {
  const message = (error as any)?.message;
  return typeof message === 'string' && message.toLowerCase().includes('autocancel');
};

const KEY_TO_KIND: Record<string, string> = {
  ai_stack: 'ai_stack',
  prompts: 'prompts',
  tools: 'tools',
  tutorials: 'tutorials',
  open_source: 'open_source',
  lead_generation: 'lead_generation',
  business: 'business',
  content_creation: 'content_creation',
  website: 'website',
  reference: 'reference',
  marketing: 'marketing',
  notes: 'notes',
  noteSections: 'note_sections',
};

const CATEGORY_KEY_TO_KIND: Record<string, string> = {
  ai_stack_categories: 'ai_stack',
  prompt_categories: 'prompts',
  tools_categories: 'tools',
  tutorial_categories: 'tutorials',
  open_source_categories: 'open_source',
  lead_generation_categories: 'lead_generation',
  business_categories: 'business',
  content_creation_categories: 'content_creation',
  website_categories: 'website',
  website_CATEGORIES: 'website',
  marketing_categories: 'marketing',
};

interface ResourceRecord {
  id: string;
  legacy_id: string;
  kind: string;
  payload: string;
  updated_at?: string;
}

interface CategoryRecord {
  id: string;
  kind: string;
  values: string;
}

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
};

const toIso = (timestamp: number): string => new Date(timestamp).toISOString();
const toTimestamp = (iso?: string): number | undefined => (iso ? new Date(iso).getTime() : undefined);

const safeParse = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const clampText = (value: unknown, max: number): string => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
};

const resolveTitle = (item: any): string => {
  const contentTitle =
    typeof item?.content === 'string' && item.content.trim().length > 0
      ? item.content.trim().split('\n')[0]
      : '';
  return clampText(
    item?.title ?? item?.toolName ?? item?.promptName ?? item?.tutorialName ?? item?.name ?? item?.sectionName ?? contentTitle ?? 'Untitled',
    250
  ) || 'Untitled';
};

const resolveCategory = (item: any): string => {
  const rawCategory =
    item?.category ??
    (Array.isArray(item?.categories) && item.categories.length > 0 ? item.categories[0] : '');
  return clampText(rawCategory, 120);
};

const serializePayloadWithinLimit = (kind: string, payload: Record<string, any>): string => {
  const toJson = (value: Record<string, any>) => JSON.stringify(value);
  const clone = { ...payload };
  let serialized = toJson(clone);
  if (serialized.length <= MAX_RESOURCE_PAYLOAD_LENGTH) return serialized;

  // Notes should keep attachment links/files whenever possible.
  if (kind === 'notes') {
    const noteTextKeys = ['richContent', 'content', 'description', 'instructions'];
    for (const key of noteTextKeys) {
      if (typeof clone[key] !== 'string') continue;
      let value = clone[key] as string;
      while (value.length > 80) {
        value = value.slice(0, Math.floor(value.length * 0.7));
        clone[key] = value;
        serialized = toJson(clone);
        if (serialized.length <= MAX_RESOURCE_PAYLOAD_LENGTH) return serialized;
      }
    }
  }

  // Remove heavy binary/document reference fields first.
  const heavyKeys = kind === 'notes'
    ? ['images', 'inputImages', 'generatedImages', 'inputImage', 'generatedImage', 'videoFile']
    : ['files', 'images', 'inputImages', 'generatedImages', 'inputImage', 'generatedImage', 'videoFile'];
  for (const key of heavyKeys) {
    if (key in clone) {
      delete clone[key];
      serialized = toJson(clone);
      if (serialized.length <= MAX_RESOURCE_PAYLOAD_LENGTH) return serialized;
    }
  }

  // Then progressively trim long text fields.
  const textKeys = kind === 'prompts'
    ? ['description', 'prompt', 'instructions', 'guides', 'content']
    : ['description', 'instructions', 'guides', 'prompt', 'content'];

  for (const key of textKeys) {
    if (typeof clone[key] !== 'string') continue;
    let value = clone[key] as string;
    while (value.length > 80) {
      value = value.slice(0, Math.floor(value.length * 0.7));
      clone[key] = value;
      serialized = toJson(clone);
      if (serialized.length <= MAX_RESOURCE_PAYLOAD_LENGTH) return serialized;
    }
  }

  // Final fallback keeps sync alive with essential metadata only.
  const minimal = {
    id: clone.id,
    title: clone.title,
    createdAt: clone.createdAt,
    updatedAt: clone.updatedAt,
    type: clone.type,
    category: clone.category,
    categories: Array.isArray(clone.categories) ? clone.categories.slice(0, 3) : undefined,
    promptName: clone.promptName,
    toolName: clone.toolName,
    tutorialName: clone.tutorialName,
    name: clone.name,
    sectionName: clone.sectionName,
    aiToolUsed: clone.aiToolUsed,
    isFavorite: clone.isFavorite,
    syncTruncated: true,
  };

  serialized = toJson(minimal);
  return serialized.length <= MAX_RESOURCE_PAYLOAD_LENGTH
    ? serialized
    : serialized.slice(0, MAX_RESOURCE_PAYLOAD_LENGTH);
};

const getSyncErrorDetails = (error: unknown) => {
  const anyErr = error as any;
  const responseData = anyErr?.response?.data ?? anyErr?.data ?? anyErr?.response;
  return {
    status: anyErr?.status,
    message: anyErr?.message,
    response: responseData,
    responseText:
      responseData && typeof responseData === 'object'
        ? JSON.stringify(responseData)
        : String(responseData ?? ''),
    url: anyErr?.url,
  };
};

async function findResourceRecord(kind: string, legacyId: string): Promise<ResourceRecord | null> {
  if (!pb) return null;
  try {
    return await pb
      .collection('resources')
      .getFirstListItem<ResourceRecord>(`kind = \"${kind}\" && legacy_id = \"${legacyId}\"`);
  } catch {
    return null;
  }
}

export function shouldUsePocketBase(): boolean {
  return USE_POCKETBASE;
}

export function hasPocketBaseMapping(key: string): boolean {
  return !!KEY_TO_KIND[key] || !!CATEGORY_KEY_TO_KIND[key];
}

export async function getPocketBaseItems<T>(key: string): Promise<T[]> {
  if (!pb) return [];
  const kind = KEY_TO_KIND[key];
  if (!kind) return [];

  let records: ResourceRecord[] = [];
  try {
    records = await pb.collection('resources').getFullList<ResourceRecord>({
      filter: `kind = \"${kind}\"`,
      sort: '-updated_at',
    });
  } catch {
    // Some PocketBase setups may reject sort when field metadata/rules are misaligned.
    // Fallback to unsorted fetch so the UI still loads, then sort locally by timestamps.
    records = await pb.collection('resources').getFullList<ResourceRecord>({
      filter: `kind = \"${kind}\"`,
    });
  }

  return records
    .map((record) => {
      const payload = safeParse<any>(record.payload, {});
      return {
        ...payload,
        id: payload.id ?? record.legacy_id ?? record.id,
        updatedAt: payload.updatedAt ?? toTimestamp(record.updated_at),
      } as T;
    })
    .sort((a: any, b: any) => {
      const aUpdated = a?.updatedAt ?? a?.createdAt ?? 0;
      const bUpdated = b?.updatedAt ?? b?.createdAt ?? 0;
      return bUpdated - aUpdated;
    })
    .filter((item) => !!(item as any)?.id);
}

export async function savePocketBaseItems<T>(key: string, items: T[]): Promise<void> {
  if (!pb) return;
  const kind = KEY_TO_KIND[key];
  if (!kind) return;

  let existing: ResourceRecord[] = [];
  try {
    existing = await pb.collection('resources').getFullList<ResourceRecord>({
      filter: `kind = \"${kind}\"`,
    });
  } catch (error) {
    if (isAutoCancelledError(error)) {
      return;
    }
    // Continue with upsert path even if the prefetch fails.
    console.warn(`PocketBase existing-record fetch failed for ${kind}, continuing sync:`, error);
  }

  const byLegacy = new Map(existing.map((record) => [record.legacy_id, record]));
  const attemptedLegacyIds = new Set<string>();

  for (const item of items as any[]) {
    const legacyId = item.id ?? generateId();
    attemptedLegacyIds.add(legacyId);
    const updatedAt = item.updatedAt ?? Date.now();
    const createdAt = item.createdAt ?? updatedAt;
    const payload = { ...item, id: legacyId, updatedAt };
    const body = {
      legacy_id: legacyId,
      kind,
      title: resolveTitle(item),
      category: resolveCategory(item),
      is_favorite: !!item.isFavorite,
      payload: serializePayloadWithinLimit(kind, payload),
      created_at: toIso(createdAt),
      updated_at: toIso(updatedAt),
      favorited_at: item.favoritedAt ? toIso(item.favoritedAt) : undefined,
    };

    try {
      const existingRecord = byLegacy.get(legacyId);
      if (existingRecord) {
        await pb.collection('resources').update(existingRecord.id, body);
        byLegacy.delete(legacyId);
      } else {
        await pb.collection('resources').create(body);
      }
    } catch (error) {
      // If create fails because record already exists (eg. stale prefetch), retry as update.
      try {
        const existingRecord = await findResourceRecord(kind, legacyId);
        if (existingRecord) {
          await pb.collection('resources').update(existingRecord.id, body);
          byLegacy.delete(legacyId);
          continue;
        }
      } catch {
        // Fall through to diagnostics below.
      }

      // Keep local-first UX reliable: one malformed record shouldn't block full sync batch.
      console.warn(`PocketBase item sync skipped for ${kind}/${legacyId}`, {
        debug: {
          titleLength: typeof body.title === 'string' ? body.title.length : 0,
          categoryLength: typeof body.category === 'string' ? body.category.length : 0,
          payloadLength: typeof body.payload === 'string' ? body.payload.length : 0,
          hasPayload: typeof body.payload === 'string' && body.payload.length > 0,
          isFavorite: body.is_favorite,
        },
        error: getSyncErrorDetails(error),
      });
    }
  }

  // Remove stale records that are no longer in the latest saved list.
  for (const stale of byLegacy.values()) {
    if (attemptedLegacyIds.has(stale.legacy_id)) {
      continue;
    }
    try {
      await pb.collection('resources').delete(stale.id);
    } catch (error) {
      console.warn(`PocketBase stale record cleanup skipped for ${kind}/${stale.id}`, {
        error: getSyncErrorDetails(error),
      });
    }
  }
}

export async function addPocketBaseItem<T extends { id: string; createdAt: number }>(
  key: string,
  item: Omit<T, 'id' | 'createdAt'>
): Promise<T> {
  if (!pb) {
    throw new Error('PocketBase client is not configured.');
  }
  const kind = KEY_TO_KIND[key];
  if (!kind) {
    throw new Error(`No PocketBase mapping found for key: ${key}`);
  }

  const now = Date.now();
  const id = generateId();
  const newItem = {
    ...item,
    id,
    createdAt: now,
    updatedAt: now,
    ...((item as any).isFavorite ? { favoritedAt: now } : {}),
  } as T;

  await pb.collection('resources').create({
    legacy_id: id,
    kind,
    title: resolveTitle(newItem),
    category: resolveCategory(newItem),
    is_favorite: !!(newItem as any).isFavorite,
    payload: serializePayloadWithinLimit(kind, newItem as Record<string, any>),
    created_at: toIso(now),
    updated_at: toIso(now),
    favorited_at: (newItem as any).favoritedAt ? toIso((newItem as any).favoritedAt) : undefined,
  });

  return newItem;
}

export async function updatePocketBaseItem<T extends { id: string }>(
  key: string,
  id: string,
  updates: Partial<T>
): Promise<void> {
  if (!pb) return;
  const kind = KEY_TO_KIND[key];
  if (!kind) return;

  const record = await findResourceRecord(kind, id);
  if (!record) return;

  const existingPayload = safeParse<any>(record.payload, {});
  const finalUpdates: any = { ...updates };
  if ('isFavorite' in finalUpdates) {
    if (finalUpdates.isFavorite) {
      finalUpdates.favoritedAt = Date.now();
    } else {
      delete finalUpdates.favoritedAt;
    }
  }

  const merged = {
    ...existingPayload,
    ...finalUpdates,
    id,
    updatedAt: Date.now(),
  };

  await pb.collection('resources').update(record.id, {
    title: resolveTitle(merged),
    category: resolveCategory(merged),
    is_favorite: !!merged.isFavorite,
    payload: serializePayloadWithinLimit(kind, merged),
    updated_at: toIso(merged.updatedAt),
    favorited_at: merged.favoritedAt ? toIso(merged.favoritedAt) : undefined,
  });
}

export async function deletePocketBaseItem(key: string, id: string): Promise<void> {
  if (!pb) return;
  const kind = KEY_TO_KIND[key];
  if (!kind) return;

  const record = await findResourceRecord(kind, id);
  if (record) {
    await pb.collection('resources').delete(record.id);
  }
}

export async function getPocketBaseCategories(key: string): Promise<string[]> {
  if (!pb) return [];
  const kind = CATEGORY_KEY_TO_KIND[key];
  if (!kind) return [];

  try {
    const record = await pb
      .collection('resource_categories')
      .getFirstListItem<CategoryRecord>(`kind = \"${kind}\"`);
    return safeParse<string[]>(record.values, []);
  } catch {
    return [];
  }
}

export async function savePocketBaseCategories(key: string, categories: string[]): Promise<void> {
  if (!pb) return;
  const kind = CATEGORY_KEY_TO_KIND[key];
  if (!kind) return;

  try {
    const existing = await pb
      .collection('resource_categories')
      .getFirstListItem<CategoryRecord>(`kind = \"${kind}\"`);
    await pb.collection('resource_categories').update(existing.id, { values: JSON.stringify(categories) });
  } catch {
    await pb.collection('resource_categories').create({
      kind,
      values: JSON.stringify(categories),
    });
  }
}

export async function clearPocketBaseAppData(): Promise<void> {
  if (!pb) return;

  const resourceRecords = await pb.collection('resources').getFullList<{ id: string }>({
    fields: 'id',
  });
  for (const record of resourceRecords) {
    await pb.collection('resources').delete(record.id);
  }

  const categoryRecords = await pb.collection('resource_categories').getFullList<{ id: string }>({
    fields: 'id',
  });
  for (const record of categoryRecords) {
    await pb.collection('resource_categories').delete(record.id);
  }
}


