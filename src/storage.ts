import {
  emptyData,
  type AppData,
  type Card,
  type Practice,
  type Song,
} from "./types";
import { withCatalog } from "./catalog";

const DB_NAME = "lyric-english-notebook";
const DB_VERSION = 1;

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error ?? new Error("浏览器存储失败"));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("浏览器存储失败"));
    tx.onabort = () => reject(tx.error ?? new Error("浏览器存储已中断"));
  });
}

let dbPromise: Promise<IDBDatabase> | undefined;
export function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
      if (!db.objectStoreNames.contains("images"))
        db.createObjectStore("images");
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error("无法打开浏览器存储"));
  });
  return dbPromise;
}

export async function readData(): Promise<AppData> {
  const db = await openDb();
  const data = (await request(
    db.transaction("state").objectStore("state").get("main"),
  )) as AppData | undefined;
  return withCatalog(data ?? emptyData());
}

export async function writeData(data: AppData): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("state", "readwrite");
  tx.objectStore("state").put(data, "main");
  await transactionDone(tx);
}

export async function saveImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件");
  if (file.size > 8 * 1024 * 1024) throw new Error("单张图片请小于 8 MB");
  const id = crypto.randomUUID();
  const db = await openDb();
  const tx = db.transaction("images", "readwrite");
  tx.objectStore("images").put(file, id);
  await transactionDone(tx);
  return id;
}

export async function getImage(id?: string): Promise<Blob | undefined> {
  if (!id) return undefined;
  const db = await openDb();
  return request(
    db.transaction("images").objectStore("images").get(id),
  ) as Promise<Blob | undefined>;
}

export async function removeImage(id?: string): Promise<void> {
  if (!id) return;
  const db = await openDb();
  const tx = db.transaction("images", "readwrite");
  tx.objectStore("images").delete(id);
  await transactionDone(tx);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export interface Backup {
  format: "lyric-english-notebook";
  version: 1;
  exportedAt: string;
  data: AppData;
  images: { id: string; dataUrl: string }[];
}

export async function createBackup(data: AppData): Promise<Backup> {
  const db = await openDb();
  const tx = db.transaction("images");
  const store = tx.objectStore("images");
  const [keys, blobs] = await Promise.all([
    request(store.getAllKeys()),
    request(store.getAll()),
  ]);
  const images = await Promise.all(
    keys.map(async (key, index) => ({
      id: String(key),
      dataUrl: await blobToDataUrl(blobs[index] as Blob),
    })),
  );
  return {
    format: "lyric-english-notebook",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
    images,
  };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";

export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("文件不是有效的 JSON 备份");
  }
  if (
    !isObject(raw) ||
    raw.format !== "lyric-english-notebook" ||
    raw.version !== 1 ||
    !isObject(raw.data) ||
    !Array.isArray(raw.images)
  ) {
    throw new Error("备份格式或版本不受支持");
  }
  const data = raw.data;
  if (
    !Array.isArray(data.songs) ||
    !Array.isArray(data.cards) ||
    !Array.isArray(data.practices) ||
    !isObject(data.settings)
  ) {
    throw new Error("备份缺少学习数据");
  }
  const songs = data.songs as Song[];
  const cards = data.cards as Card[];
  const practices = data.practices as Practice[];
  if (
    songs.some(
      (s) =>
        !isObject(s) ||
        !isString(s.id) ||
        !isString(s.title) ||
        !isString(s.artist) ||
        !isString(s.lyrics) ||
        !isString(s.url),
    ) ||
    cards.some(
      (c) =>
        !isObject(c) ||
        !isString(c.id) ||
        !isString(c.songId) ||
        !isString(c.expression) ||
        !isString(c.meaning) ||
        !isString(c.nextReview) ||
        !Array.isArray(c.history),
    ) ||
    practices.some(
      (p) =>
        !isObject(p) ||
        !isString(p.id) ||
        !Array.isArray(p.cardIds) ||
        !isString(p.sentence),
    ) ||
    raw.images.some(
      (i) =>
        !isObject(i) ||
        !isString(i.id) ||
        !isString(i.dataUrl) ||
        !i.dataUrl.startsWith("data:image/"),
    )
  ) {
    throw new Error("备份中有无效的数据项");
  }
  const songIds = new Set(songs.map((s) => s.id));
  if (cards.some((c) => !songIds.has(c.songId)))
    throw new Error("备份中的卡片找不到来源歌曲");
  return raw as unknown as Backup;
}

export async function restoreBackup(backup: Backup): Promise<void> {
  const decoded = await Promise.all(
    backup.images.map(async (image) => ({
      id: image.id,
      blob: await (await fetch(image.dataUrl)).blob(),
    })),
  );
  const db = await openDb();
  const tx = db.transaction(["state", "images"], "readwrite");
  const images = tx.objectStore("images");
  images.clear();
  decoded.forEach((image) => images.put(image.blob, image.id));
  tx.objectStore("state").put(withCatalog(backup.data), "main");
  await transactionDone(tx);
}
