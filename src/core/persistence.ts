import { V1Data } from "./legacyTypes";
import { migrateV1 } from "./migrate";
import { AppData, DEFAULT_SETTINGS, Settings, Solve } from "./types";

// indexeddb with one record per solve, v1 was a single blob and v2 had sessions

const DB_NAME = "kubetimr";
const DB_VERSION = 3;

export interface Storage {
  persistent: boolean;
  load(): Promise<AppData>;
  putSolves(solves: Solve[]): Promise<void>;
  deleteSolves(ids: string[]): Promise<void>;
  putSettings(settings: Settings): Promise<void>;
  setProfile(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      const tx = r.transaction!;
      if (!db.objectStoreNames.contains("solves")) {
        db.createObjectStore("solves", { keyPath: "id" }).createIndex("scrambleType", "scrambleType");
      } else {
        const solves = tx.objectStore("solves");
        if (solves.indexNames.contains("sessionId")) solves.deleteIndex("sessionId");
        if (!solves.indexNames.contains("scrambleType")) solves.createIndex("scrambleType", "scrambleType");
      }
      if (db.objectStoreNames.contains("sessions")) db.deleteObjectStore("sessions");
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    r.onsuccess = () => {
      const db = r.result;
      // let a newer tab upgrade instead of being blocked by this one
      db.onversionchange = () => db.close();
      resolve(db);
    };
    r.onerror = () => reject(r.error);
    r.onblocked = () => console.warn("kubetimr: waiting for other tabs to close before upgrading");
  });
}

class IdbStorage implements Storage {
  persistent = true;
  constructor(private db: IDBDatabase) {}

  // copies the v1 blob into the solves store once and leaves the blob in place
  private async migrateIfNeeded(): Promise<void> {
    const db = this.db;
    if (!db.objectStoreNames.contains("state")) return;
    const migrated = await req(db.transaction("meta").objectStore("meta").get("migratedV1"));
    if (migrated) return;
    const legacy = (await req(db.transaction("state").objectStore("state").get("data"))) as V1Data | undefined;
    const tx = db.transaction(["solves", "meta"], "readwrite");
    if (legacy && Array.isArray(legacy.solves)) {
      const m = migrateV1(legacy);
      for (const s of m.solves) tx.objectStore("solves").put(s);
      tx.objectStore("meta").put(m.settings, "settings");
      tx.objectStore("meta").put(m.profile, "profile");
    }
    tx.objectStore("meta").put(Date.now(), "migratedV1");
    await done(tx);
  }

  async load(): Promise<AppData> {
    await this.migrateIfNeeded();
    const tx = this.db.transaction(["solves", "meta"]);
    const [solves, settings, profile] = await Promise.all([
      req(tx.objectStore("solves").getAll()) as Promise<(Solve & { sessionId?: string })[]>,
      req(tx.objectStore("meta").get("settings")) as Promise<Partial<Settings> | undefined>,
      req(tx.objectStore("meta").get("profile")) as Promise<string | undefined>,
    ]);
    for (const s of solves) delete s.sessionId;
    solves.sort((a, b) => a.date - b.date);
    return { solves, settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) }, profile: profile ?? solves[solves.length - 1]?.scrambleType ?? "333" };
  }

  async putSolves(solves: Solve[]): Promise<void> {
    if (!solves.length) return;
    const tx = this.db.transaction("solves", "readwrite");
    for (const s of solves) tx.objectStore("solves").put(s);
    await done(tx);
  }

  async deleteSolves(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const tx = this.db.transaction("solves", "readwrite");
    for (const id of ids) tx.objectStore("solves").delete(id);
    await done(tx);
  }

  async putSettings(settings: Settings): Promise<void> {
    const tx = this.db.transaction("meta", "readwrite");
    tx.objectStore("meta").put(settings, "settings");
    await done(tx);
  }

  async setProfile(id: string): Promise<void> {
    const tx = this.db.transaction("meta", "readwrite");
    tx.objectStore("meta").put(id, "profile");
    await done(tx);
  }

  async clearAll(): Promise<void> {
    const tx = this.db.transaction(["solves", "meta"], "readwrite");
    tx.objectStore("solves").clear();
    tx.objectStore("meta").delete("settings");
    tx.objectStore("meta").delete("profile");
    await done(tx);
  }
}

// fallback when indexeddb is unavailable, nothing is saved
class MemoryStorage implements Storage {
  persistent = false;
  async load(): Promise<AppData> {
    return { solves: [], settings: DEFAULT_SETTINGS, profile: "333" };
  }
  async putSolves() {}
  async deleteSolves() {}
  async putSettings() {}
  async setProfile() {}
  async clearAll() {}
}

export async function openStorage(): Promise<Storage> {
  try {
    if (typeof indexedDB === "undefined") throw new Error("no indexeddb");
    const db = await openDb();
    void navigator.storage?.persist?.().catch(() => undefined);
    return new IdbStorage(db);
  } catch (err) {
    console.error("indexeddb unavailable, data will not be saved", err);
    return new MemoryStorage();
  }
}
