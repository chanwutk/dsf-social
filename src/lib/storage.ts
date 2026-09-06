import type { Draft, Profile, RosterEntry } from './schema';

export type StoredFile = {
  name: string;
  type: string;
  bytes: ArrayBuffer;
};

type SettingKey = 'profile' | 'template' | 'signature';

const databaseName = 'erso-reimbursement-helper';
const databaseVersion = 1;

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('settings')) database.createObjectStore('settings');
      if (!database.objectStoreNames.contains('drafts')) database.createObjectStore('drafts', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('contacts')) database.createObjectStore('contacts', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open browser storage.'));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Browser storage request failed.'));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Browser storage transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Browser storage transaction was cancelled.'));
  });
}

export async function getSetting<T>(key: SettingKey) {
  const database = await openDatabase();
  const transaction = database.transaction('settings', 'readonly');
  const result = await requestResult(transaction.objectStore('settings').get(key));
  database.close();
  return result as T | undefined;
}

export async function setSetting(key: SettingKey, value: unknown) {
  const database = await openDatabase();
  const transaction = database.transaction('settings', 'readwrite');
  transaction.objectStore('settings').put(value, key);
  await transactionComplete(transaction);
  database.close();
}

export async function deleteSetting(key: SettingKey) {
  const database = await openDatabase();
  const transaction = database.transaction('settings', 'readwrite');
  transaction.objectStore('settings').delete(key);
  await transactionComplete(transaction);
  database.close();
}

export async function getProfile() {
  return getSetting<Profile>('profile');
}

export async function saveProfile(profile: Profile) {
  await setSetting('profile', profile);
  return profile;
}

export async function listDrafts() {
  const database = await openDatabase();
  const transaction = database.transaction('drafts', 'readonly');
  const drafts = await requestResult(transaction.objectStore('drafts').getAll()) as Draft[];
  database.close();
  return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveDraft(draft: Draft) {
  const saved = { ...draft, updatedAt: new Date().toISOString() };
  const database = await openDatabase();
  const transaction = database.transaction('drafts', 'readwrite');
  transaction.objectStore('drafts').put(saved);
  await transactionComplete(transaction);
  database.close();
  return saved;
}

export async function deleteDraft(id: string) {
  const database = await openDatabase();
  const transaction = database.transaction('drafts', 'readwrite');
  transaction.objectStore('drafts').delete(id);
  await transactionComplete(transaction);
  database.close();
}

export async function listContacts() {
  const database = await openDatabase();
  const transaction = database.transaction('contacts', 'readonly');
  const contacts = await requestResult(transaction.objectStore('contacts').getAll()) as RosterEntry[];
  database.close();
  return contacts.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveContact(contact: RosterEntry) {
  const database = await openDatabase();
  const transaction = database.transaction('contacts', 'readwrite');
  transaction.objectStore('contacts').put(contact);
  await transactionComplete(transaction);
  database.close();
  return contact;
}

export async function deleteContact(id: string) {
  const database = await openDatabase();
  const transaction = database.transaction('contacts', 'readwrite');
  transaction.objectStore('contacts').delete(id);
  await transactionComplete(transaction);
  database.close();
}

export async function clearLocalData() {
  const database = await openDatabase();
  const transaction = database.transaction(['settings', 'drafts', 'contacts'], 'readwrite');
  transaction.objectStore('settings').clear();
  transaction.objectStore('drafts').clear();
  transaction.objectStore('contacts').clear();
  await transactionComplete(transaction);
  database.close();
}

export async function storedFile(file: File): Promise<StoredFile> {
  return { name: file.name, type: file.type, bytes: await file.arrayBuffer() };
}
