const DB_NAME = 'kathies-kitchen';
const DB_VERSION = 2;
const RECIPE_STORE = 'recipes';
const LEGACY_STORE = 'library';
const LEGACY_KEY = 'recipes';

let databasePromise;

export function legacyRecipesFromRecord(record) {
  if (Array.isArray(record)) return record;
  return Array.isArray(record?.value) ? record.value : [];
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      const transaction = request.transaction;
      const recipes = database.objectStoreNames.contains(RECIPE_STORE)
        ? transaction.objectStore(RECIPE_STORE)
        : database.createObjectStore(RECIPE_STORE, { keyPath: 'sourceKey' });

      if (event.oldVersion < 2 && database.objectStoreNames.contains(LEGACY_STORE)) {
        const legacyRequest = transaction.objectStore(LEGACY_STORE).get(LEGACY_KEY);
        legacyRequest.onsuccess = () => {
          for (const recipe of legacyRecipesFromRecord(legacyRequest.result)) {
            if (recipe?.sourceKey) recipes.put(recipe);
          }
          database.deleteObjectStore(LEGACY_STORE);
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Local recipe storage could not be opened'));
    request.onblocked = () => reject(new Error('Close other Kathie’s Kitchen tabs, then try again'));
  });
  return databasePromise;
}

function transact(mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(RECIPE_STORE, mode);
    const store = transaction.objectStore(RECIPE_STORE);
    let request;
    try {
      request = operation(store);
    } catch (error) {
      transaction.abort();
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error || request?.error || new Error('Local recipe storage failed'));
    transaction.onabort = () => reject(transaction.error || new Error('Local recipe storage was interrupted'));
  }));
}

export async function loadLibrary() {
  const result = await transact('readonly', (store) => store.getAll());
  return Array.isArray(result) ? result : [];
}

export async function saveLibrary(recipes) {
  await transact('readwrite', (store) => {
    store.clear();
    let finalRequest;
    for (const recipe of recipes) finalRequest = store.put(recipe);
    return finalRequest;
  });
}

export async function saveRecipe(recipe) {
  if (!recipe?.sourceKey) throw new Error('A recipe source key is required');
  await transact('readwrite', (store) => store.put(recipe));
}

export async function clearLibrary() {
  await transact('readwrite', (store) => store.clear());
}
