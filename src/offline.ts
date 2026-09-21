export type OfflineKind = "wage" | "checkin" | "case";
export type OfflineItem = {
  id: string;
  kind: OfflineKind;
  body: Record<string, unknown>;
  createdAt: string;
  status: "queued" | "failed";
  error?: string;
};

const databaseName = "pehchaan-offline";
const storeName = "outbox";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(storeName)) {
        request.result.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Offline storage unavailable."));
  });
}

export async function addOfflineItem(item: OfflineItem): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(storeName, "readwrite").objectStore(storeName).put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Could not save offline item."));
  });
  database.close();
}

export async function listOfflineItems(): Promise<OfflineItem[]> {
  const database = await openDatabase();
  const items = await new Promise<OfflineItem[]>((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve((request.result as OfflineItem[]).sort((a, b) => (a.kind === "checkin" ? -1 : 1) - (b.kind === "checkin" ? -1 : 1) || a.createdAt.localeCompare(b.createdAt)));
    request.onerror = () => reject(request.error || new Error("Could not read offline items."));
  });
  database.close();
  return items;
}

export async function removeOfflineItem(id: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(storeName, "readwrite").objectStore(storeName).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Could not remove offline item."));
  });
  database.close();
}

export async function updateOfflineItem(item: OfflineItem): Promise<void> {
  return addOfflineItem(item);
}

