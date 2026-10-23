import { SaveStorageError } from "../saves.ts";
import type { AtomicSaveStore, SaveRecord, StoredSlot } from "../saves.ts";

const DATABASE = "haifeng.rebuild.saves";
const STORE = "slots";

/** New TypeScript records only. No localStorage or legacy database access. */
export class IndexedDbSaveStore implements AtomicSaveStore {
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new SaveStorageError("STORAGE_UNAVAILABLE", "当前环境不支持本地检查点存储"));
        return;
      }
      let request: IDBOpenDBRequest;
      let abandoned = false;
      try { request = indexedDB.open(DATABASE, 1); }
      catch {
        reject(new SaveStorageError("STORAGE_OPEN", "本地存储无法打开；请检查浏览器的站点存储权限后重试"));
        return;
      }
      request.onupgradeneeded = () => {
        if (abandoned) { request.transaction?.abort(); return; }
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onblocked = () => {
        abandoned = true;
        reject(new SaveStorageError("STORAGE_BLOCKED", "其他页面阻止了存储打开；关闭旧试播页后重试"));
      };
      request.onerror = () => reject(new SaveStorageError("STORAGE_OPEN", "本地存储打开失败；已有记录未被删除"));
      request.onsuccess = () => {
        const database = request.result;
        if (abandoned) { database.close(); return; }
        database.onversionchange = () => database.close();
        resolve(database);
      };
    });
  }

  private async transact(mode: IDBTransactionMode, key: string, value?: SaveRecord): Promise<StoredSlot> {
    const database = await this.open();
    try {
      return await new Promise<StoredSlot>((resolve, reject) => {
        let transaction: IDBTransaction;
        try { transaction = database.transaction(STORE, mode); }
        catch {
          reject(new SaveStorageError("STORAGE_TRANSACTION", "无法创建存储事务；可重试，已有记录未被删除"));
          return;
        }
        let result: StoredSlot = { found: false };
        let requestError = "";
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = () => reject(new SaveStorageError("STORAGE_ABORT",
          `存储事务未提交${requestError ? `（${requestError}）` : ""}；原槽位保持原值，可重试`));
        // Do not prevent the default abort after a request error.
        transaction.onerror = () => {};
        try {
          const store = transaction.objectStore(STORE);
          const request = mode === "readonly" ? store.get(key) : store.put(value, key);
          request.onerror = () => { requestError = request.error?.name ?? "存储请求失败"; };
          request.onsuccess = () => {
            const stored: unknown = request.result;
            if (mode === "readonly") result = stored === undefined ? { found: false } : { found: true, value: stored };
          };
        } catch {
          requestError = "存储请求无法提交";
          transaction.abort();
        }
      });
    } finally {
      database.close();
    }
  }

  async read(key: string): Promise<StoredSlot> {
    return this.transact("readonly", key);
  }

  async replace(key: string, value: SaveRecord): Promise<void> {
    // One put in one transaction; never delete the old slot before writing.
    await this.transact("readwrite", key, value);
  }
}
