import type { AtomicVoicePreferenceStore, VoicePreferenceRecord } from "../voice-preferences.ts";
import { SaveStorageError } from "../saves.ts";
import type { AtomicSaveStore, SaveRecord, StoredSavePage, StoredSlot } from "../saves.ts";
import type { AtomicPlayerStore, PlayerRecords } from "../records.ts";
import type { AtomicAudioPreferenceStore, AudioPreferenceRecord } from "../preferences.ts";
import type { AtomicReadingPreferenceStore, ReadingPreferenceRecord } from "../reading-preferences.ts";
import type { AtomicButtonPreferenceStore, ButtonPreferenceRecord } from "../button-preferences.ts";
import type { AtomicReadoutPreferenceStore, ReadoutPreferenceRecord } from "../readout-preferences.ts";

const DATABASE = "haifeng.rebuild.saves";
const STORE = "slots";

/** New TypeScript records only. No localStorage or legacy database access. */
export class IndexedDbSaveStore implements AtomicSaveStore, AtomicPlayerStore, AtomicAudioPreferenceStore, AtomicReadingPreferenceStore,
  AtomicButtonPreferenceStore, AtomicReadoutPreferenceStore, AtomicVoicePreferenceStore {
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
          if (mode === "readonly") {
            const request = store.openCursor(key);
            request.onerror = () => { requestError = request.error?.name ?? "存储请求失败"; };
            request.onsuccess = () => {
              const cursor = request.result;
              const stored: unknown = cursor?.value;
              result = cursor ? { found: true, value: stored } : { found: false };
            };
          } else {
            const request = store.put(value, key);
            request.onerror = () => { requestError = request.error?.name ?? "存储请求失败"; };
          }
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

  async scan(prefix: string, after: string | null, limit: number): Promise<StoredSavePage> {
    if (!prefix || (after !== null && !after.startsWith(prefix))
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new SaveStorageError("STORAGE_PAGE", "槽位读取范围或容量无效");
    }
    const database = await this.open();
    try {
      return await new Promise<StoredSavePage>((resolve, reject) => {
        let transaction: IDBTransaction;
        try { transaction = database.transaction(STORE, "readonly"); }
        catch {
          reject(new SaveStorageError("STORAGE_TRANSACTION", "无法读取槽位目录，已有记录未被修改"));
          return;
        }
        const result: StoredSavePage = { entries: [], next: null };
        let failure: unknown = null;
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = () => reject(failure ?? new SaveStorageError("STORAGE_ABORT", "槽位目录读取未完成，可刷新重试"));
        transaction.onerror = () => {};
        try {
          const range = IDBKeyRange.bound(after ?? prefix, `${prefix}\uffff`, after !== null, false);
          const request = transaction.objectStore(STORE).openCursor(range);
          request.onerror = () => { failure = new SaveStorageError("STORAGE_READ", "槽位目录读取失败，已有记录未被修改"); };
          request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return;
            try {
              if (typeof cursor.key !== "string" || !cursor.key.startsWith(prefix)) {
                throw new SaveStorageError("STORAGE_PAGE", "存储游标返回了范围外地址");
              }
              if (result.entries.length === limit) {
                result.next = result.entries.at(-1)!.key;
                return;
              }
              const value: unknown = cursor.value;
              result.entries.push({ key: cursor.key, value });
              cursor.continue();
            } catch (error: unknown) {
              failure = error;
              transaction.abort();
            }
          };
        } catch (error: unknown) {
          failure = error;
          transaction.abort();
        }
      });
    } finally { database.close(); }
  }

  async update(key: string, change: (stored: StoredSlot) => PlayerRecords): Promise<PlayerRecords> {
    return this.updateRecord(key, change, "PLAYER", "全局记录");
  }

  async updateAudio(key: string, change: (stored: StoredSlot) => AudioPreferenceRecord): Promise<AudioPreferenceRecord> {
    return this.updateRecord(key, change, "AUDIO_PREFERENCES", "声音偏好");
  }

  async updateReading(key: string, change: (stored: StoredSlot) => ReadingPreferenceRecord): Promise<ReadingPreferenceRecord> {
    return this.updateRecord(key, change, "READING_PREFERENCES", "阅读偏好");
  }

  async updateButtons(key: string, change: (stored: StoredSlot) => ButtonPreferenceRecord): Promise<ButtonPreferenceRecord> {
    return this.updateRecord(key, change, "BUTTON_PREFERENCES", "按钮声音偏好");
  }

  async updateReadout(key: string, change: (stored: StoredSlot) => ReadoutPreferenceRecord): Promise<ReadoutPreferenceRecord> {
    return this.updateRecord(key, change, "READOUT_PREFERENCES", "数值显示偏好");
  }

  async updateVoice(key: string, change: (stored: StoredSlot) => VoicePreferenceRecord): Promise<VoicePreferenceRecord> {
    return this.updateRecord(key, change, "VOICE_PREFERENCES", "语音偏好");
  }

  private async updateRecord<T>(
    key: string, change: (stored: StoredSlot) => T, code: string, label: string,
  ): Promise<T> {
    const database = await this.open();
    try {
      return await new Promise<T>((resolve, reject) => {
        let transaction: IDBTransaction;
        try { transaction = database.transaction(STORE, "readwrite"); }
        catch {
          reject(new SaveStorageError(`${code}_TRANSACTION`, `无法更新${label}，原记录保持原值`));
          return;
        }
        let result: T | null = null;
        let failure: unknown = null;
        transaction.oncomplete = () => {
          if (result !== null) resolve(result);
          else reject(new SaveStorageError(`${code}_TRANSACTION`, `${label}未形成提交结果`));
        };
        transaction.onabort = () => reject(failure ?? new SaveStorageError(`${code}_ABORT`, `${label}事务未提交，可重试；原记录保持原值`));
        transaction.onerror = () => {};
        try {
          const store = transaction.objectStore(STORE);
          const request = store.openCursor(key);
          request.onsuccess = () => {
            try {
              const cursor = request.result;
              const value: unknown = cursor?.value;
              result = change(cursor ? { found: true, value } : { found: false });
              store.put(result, key);
            } catch (error: unknown) {
              failure = error;
              transaction.abort();
            }
          };
        } catch (error: unknown) {
          failure = error;
          transaction.abort();
        }
      });
    } finally {
      database.close();
    }
  }
}
