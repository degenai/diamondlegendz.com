const DB_NAME = 'kathies-kitchen';
const DB_VERSION = 3;
const RECIPE_STORE = 'recipes';
const META_STORE = 'metadata';
const LEGACY_STORE = 'library';
const LEGACY_KEY = 'recipes';
const PRIVATE_SEED_KEY = 'private-library-seed';
const PRIVATE_SEED_READY = 'seeded';
export const PRIVATE_SEED_SUPPRESSED = 'suppressed';

export function reconcilePrivateSeed(existingRecipes, incomingRecipes, seedState, options = {}) {
  if (seedState === PRIVATE_SEED_SUPPRESSED) {
    return { recipes: existingRecipes, saved: false, added: 0 };
  }

  const retainedRecipes = options.replaceLegacySamples
    ? existingRecipes.filter((recipe) => !(
      recipe?.source?.kind === 'sample'
      && String(recipe?.sourceKey || '').startsWith('sample:')
    ))
    : existingRecipes;
  const bySourceKey = new Map(incomingRecipes.map((recipe) => [recipe.sourceKey, recipe]));
  for (const recipe of retainedRecipes) bySourceKey.set(recipe.sourceKey, recipe);
  const existingKeys = new Set(retainedRecipes.map((recipe) => recipe.sourceKey));
  return {
    recipes: [...bySourceKey.values()],
    saved: true,
    added: incomingRecipes.filter((recipe) => !existingKeys.has(recipe.sourceKey)).length,
  };
}

export function legacyRecipesFromRecord(record) {
  if (Array.isArray(record)) return record;
  return Array.isArray(record?.value) ? record.value : [];
}

function normalizeError(error, fallback) {
  if (error instanceof Error) return error;
  return new Error(fallback);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(normalizeError(request.error, 'IndexedDB request failed')), { once: true });
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('abort', () => reject(normalizeError(transaction.error, 'IndexedDB transaction was aborted')), { once: true });
    transaction.addEventListener('error', () => reject(normalizeError(transaction.error, 'IndexedDB transaction failed')), { once: true });
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.addEventListener('upgradeneeded', (event) => {
      const database = request.result;
      const transaction = request.transaction;
      const recipes = database.objectStoreNames.contains(RECIPE_STORE)
        ? transaction.objectStore(RECIPE_STORE)
        : database.createObjectStore(RECIPE_STORE, { keyPath: 'sourceKey' });
      if (!recipes.indexNames.contains('title')) recipes.createIndex('title', 'title', { unique: false });
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: 'key' });
      }
      if (event.oldVersion < 2 && database.objectStoreNames.contains(LEGACY_STORE)) {
        const legacyRequest = transaction.objectStore(LEGACY_STORE).get(LEGACY_KEY);
        legacyRequest.addEventListener('success', () => {
          for (const recipe of legacyRecipesFromRecord(legacyRequest.result)) {
            if (recipe?.sourceKey) recipes.put(recipe);
          }
          database.deleteObjectStore(LEGACY_STORE);
        }, { once: true });
      }
    });
    request.addEventListener('success', () => {
      const database = request.result;
      database.addEventListener('versionchange', () => database.close());
      if (settled) {
        database.close();
        return;
      }
      settled = true;
      resolve(database);
    }, { once: true });
    request.addEventListener('error', () => {
      if (settled) return;
      settled = true;
      reject(normalizeError(request.error, 'Could not open the recipe library'));
    }, { once: true });
    request.addEventListener('blocked', () => {
      if (settled) return;
      settled = true;
      reject(new Error('Close other Kathie’s Kitchen tabs and try again.'));
    }, { once: true });
  });
}

async function transact(storeName, mode, work) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, mode);
    const completion = transactionDone(transaction);
    let result;
    try {
      result = await work(transaction.objectStore(storeName), transaction);
    } catch (error) {
      try { transaction.abort(); } catch {}
      await completion.catch(() => {});
      throw error;
    }
    await completion;
    return result;
  } finally {
    database.close();
  }
}

async function replaceRecipesAndSeedState(recipes, seedState) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([RECIPE_STORE, META_STORE], 'readwrite');
    const completion = transactionDone(transaction);
    try {
      const recipesStore = transaction.objectStore(RECIPE_STORE);
      const metadataStore = transaction.objectStore(META_STORE);
      recipesStore.clear();
      for (const recipe of recipes) recipesStore.put(recipe);
      metadataStore.put({ key: PRIVATE_SEED_KEY, value: seedState });
    } catch (error) {
      try { transaction.abort(); } catch {}
      await completion.catch(() => {});
      throw error;
    }
    await completion;
  } finally {
    database.close();
  }
}

export function loadLibrary() {
  return transact(RECIPE_STORE, 'readonly', (store) => requestToPromise(store.getAll()));
}

export function saveRecipe(recipe) {
  if (!recipe?.sourceKey) throw new Error('A recipe source key is required');
  return transact(RECIPE_STORE, 'readwrite', (store) => requestToPromise(store.put(recipe)));
}

export function saveLibrary(recipes) {
  return transact(RECIPE_STORE, 'readwrite', async (store) => {
    await requestToPromise(store.clear());
    for (const recipe of recipes) store.put(recipe);
  });
}

export function getPrivateLibrarySeedState() {
  return transact(META_STORE, 'readonly', async (store) => {
    const record = await requestToPromise(store.get(PRIVATE_SEED_KEY));
    return record?.value || null;
  });
}

export function savePrivateSeededLibrary(recipes, options = {}) {
  return openDatabase().then(async (database) => {
    const transaction = database.transaction([RECIPE_STORE, META_STORE], 'readwrite');
    const complete = transactionDone(transaction);
    try {
      const recipesStore = transaction.objectStore(RECIPE_STORE);
      const metadataStore = transaction.objectStore(META_STORE);
      const [existingRecipes, seedRecord] = await Promise.all([
        requestToPromise(recipesStore.getAll()),
        requestToPromise(metadataStore.get(PRIVATE_SEED_KEY)),
      ]);
      const result = reconcilePrivateSeed(existingRecipes, recipes, seedRecord?.value ?? null, options);
      if (result.saved) {
        recipesStore.clear();
        for (const recipe of result.recipes) recipesStore.put(recipe);
        metadataStore.put({ key: PRIVATE_SEED_KEY, value: PRIVATE_SEED_READY });
      }
      await complete;
      return result;
    } catch (error) {
      try { transaction.abort(); } catch {}
      await complete.catch(() => {});
      throw normalizeError(error, 'Could not seed the recipe library');
    } finally {
      database.close();
    }
  });
}

export function clearLibrary() {
  return replaceRecipesAndSeedState([], PRIVATE_SEED_SUPPRESSED);
}
