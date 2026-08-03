import { mergeRecipes } from './core.mjs';
import { getPrivateLibrarySeedState, savePrivateSeededLibrary } from './db.mjs';
import { parseRecipeFile } from './importers.mjs';

const PRIVATE_LIBRARY_URL = './api/library';
const PRIVATE_LIBRARY_TIMEOUT_MS = 30_000;

function privateLibraryError(message, code, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

export function shouldUseSamplePreview(locationLike) {
  const hostname = String(locationLike?.hostname ?? '').toLowerCase();
  const preview = new URLSearchParams(locationLike?.search ?? '').get('preview');
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname) && preview === 'samples';
}

export function isLegacySampleLibrary(recipes) {
  return recipes.length > 0 && recipes.every((recipe) => (
    recipe?.source?.kind === 'sample'
    && String(recipe?.sourceKey || '').startsWith('sample:')
  ));
}

function downloadController(parentSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  let timer;
  const abortFromParent = () => controller.abort();
  if (parentSignal?.aborted) controller.abort();
  else parentSignal?.addEventListener('abort', abortFromParent, { once: true });
  const reset = () => {
    clearTimeout(timer);
    if (controller.signal.aborted) return;
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
  };
  reset();
  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    reset,
    cleanup() {
      clearTimeout(timer);
      parentSignal?.removeEventListener('abort', abortFromParent);
    },
  };
}

async function readResponseBytes(response, download) {
  if (!response.body?.getReader) {
    download.reset();
    return new Uint8Array(await response.arrayBuffer());
  }

  const reader = response.body.getReader();
  const chunks = [];
  let byteLength = 0;
  try {
    while (true) {
      download.reset();
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      byteLength += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function seedPrivateLibrary(currentRecipes, options = {}) {
  const replaceLegacySamples = isLegacySampleLibrary(currentRecipes);
  if (currentRecipes.length && !replaceLegacySamples) {
    return { recipes: currentRecipes, seeded: false, added: 0 };
  }

  const seedStateReader = options.seedStateReader || getPrivateLibrarySeedState;
  let seedState;
  try {
    seedState = await seedStateReader();
  } catch (error) {
    throw privateLibraryError('Local storage could not be opened. The family cookbook was not downloaded.', 'STORAGE_UNAVAILABLE', error);
  }
  if (seedState) return { recipes: currentRecipes, seeded: false, added: 0 };

  const fetcher = options.fetcher || globalThis.fetch;
  const parser = options.parser || parseRecipeFile;
  const saver = options.saver || savePrivateSeededLibrary;
  const timeoutMs = options.timeoutMs ?? PRIVATE_LIBRARY_TIMEOUT_MS;
  const download = downloadController(options.signal, timeoutMs);
  let response;
  let bytes;

  try {
    response = await fetcher(PRIVATE_LIBRARY_URL, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: download.signal,
    });
    if (response.status === 401) {
      throw privateLibraryError('Your private kitchen session expired. Sign in again.', 'AUTH_REQUIRED');
    }
    if (!response.ok) {
      throw privateLibraryError('The family cookbook was not available. Please try again.', 'LIBRARY_UNAVAILABLE');
    }
    bytes = await readResponseBytes(response, download);
  } catch (error) {
    if (typeof error?.code === 'string') throw error;
    if (download.didTimeOut()) {
      throw privateLibraryError('The family cookbook is taking too long to load. Please try again.', 'LIBRARY_TIMEOUT', error);
    }
    if (!response) {
      throw privateLibraryError('Check your connection and try again.', 'LIBRARY_UNAVAILABLE', error);
    }
    throw privateLibraryError('The family cookbook download was interrupted. Please try again.', 'LIBRARY_UNAVAILABLE', error);
  } finally {
    download.cleanup();
  }

  let imported;
  try {
    imported = await parser(bytes, 'kathies-private-library.json');
  } catch (error) {
    throw privateLibraryError('The family cookbook could not be read. Please try again.', 'LIBRARY_INVALID', error);
  }
  if (!imported.length) {
    throw privateLibraryError('The family cookbook was empty. Please try again.', 'LIBRARY_EMPTY');
  }

  const importedAt = (options.now || (() => new Date().toISOString()))();
  const normalized = imported.map((recipe) => ({ ...recipe, importedAt: recipe.importedAt || importedAt }));
  const merger = options.merger || mergeRecipes;
  const mergeBase = replaceLegacySamples ? [] : currentRecipes;
  const recipes = merger(mergeBase, normalized);
  let saved;
  try {
    saved = await saver(recipes, { replaceLegacySamples });
  } catch (error) {
    throw privateLibraryError('This browser could not save the cookbook. Check its storage and try again.', 'STORAGE_UNAVAILABLE', error);
  }
  if (saved?.saved === false) {
    return { recipes: saved.recipes ?? currentRecipes, seeded: false, added: 0 };
  }
  const finalRecipes = saved?.recipes ?? recipes;
  const added = Number.isInteger(saved?.added)
    ? saved.added
    : Math.max(0, finalRecipes.length - mergeBase.length);
  return { recipes: finalRecipes, seeded: true, added };
}
