import {
  canRegisterServiceWorker,
  deferObjectUrlRevoke,
  mergeRecipes,
  saveThenApply,
  selectRecipes,
  shouldRequestWakeLock,
  sortRecipes,
} from './lib/core.mjs';
import { clearLibrary, loadLibrary, saveLibrary, saveRecipe } from './lib/db.mjs';
import { parseRecipeFile } from './lib/importers.mjs';

const SAMPLE_RECIPES = [
  {
    sourceKey: 'sample:sunday-lemon-chicken',
    title: 'Sunday Lemon Chicken',
    author: 'Family kitchen',
    description: 'A bright roast chicken for a long-table Sunday supper.',
    ingredients: ['1 whole chicken', '2 lemons', '6 garlic cloves', 'Rosemary, salt and black pepper'],
    directions: ['Heat the oven to 425°F.', 'Season the chicken and tuck the lemon and garlic around it.', 'Roast until deeply golden and cooked through, then rest before carving.'],
    totalTime: '1 hr 20 min',
    tags: ['Dinner', 'Sunday'],
    source: { kind: 'sample', label: 'Sample card' },
    access: 'full',
  },
  {
    sourceKey: 'sample:garden-tomato-tart',
    title: 'Garden Tomato Tart',
    author: 'Family kitchen',
    description: 'Juicy tomatoes, herbs and a crisp savory shell.',
    ingredients: ['1 tart shell', '4 ripe tomatoes', 'Fresh basil', 'Sharp cheese'],
    directions: ['Blind-bake the shell.', 'Layer in cheese, herbs and tomatoes.', 'Bake until the edges are crisp and the tomatoes slump.'],
    totalTime: '55 min',
    tags: ['Vegetarian', 'Summer'],
    source: { kind: 'sample', label: 'Sample card' },
    access: 'full',
  },
  {
    sourceKey: 'sample:golden-corn-spoonbread',
    title: 'Golden Corn Spoonbread',
    author: 'Family kitchen',
    description: 'Soft-centered corn comfort with a bronzed top.',
    ingredients: ['Fresh corn', 'Cornmeal', 'Milk', 'Eggs', 'Butter'],
    directions: ['Warm the cornmeal with milk.', 'Fold in eggs, butter and corn.', 'Bake until puffed and golden.'],
    totalTime: '45 min',
    tags: ['Side', 'Vegetarian'],
    source: { kind: 'sample', label: 'Sample card' },
    access: 'full',
  },
  {
    sourceKey: 'sample:market-berry-salad',
    title: 'Market Berry Salad',
    author: 'Family kitchen',
    description: 'Peppery greens, berries and a sharp little vinaigrette.',
    ingredients: ['Mixed greens', 'Fresh berries', 'Toasted walnuts', 'Shallot vinaigrette'],
    directions: ['Whisk the vinaigrette.', 'Toss the greens lightly.', 'Finish with berries and walnuts.'],
    totalTime: '15 min',
    tags: ['Quick', 'Vegetarian'],
    source: { kind: 'sample', label: 'Sample card' },
    access: 'full',
  },
  {
    sourceKey: 'sample:mushroom-toasts',
    title: 'Garlicky Mushroom Toasts',
    author: 'Family kitchen',
    description: 'Savory mushrooms piled onto crisp bread.',
    ingredients: ['Mixed mushrooms', 'Country bread', 'Garlic', 'Thyme'],
    directions: ['Toast the bread.', 'Brown the mushrooms hard in a wide pan.', 'Add garlic and thyme, then spoon over toast.'],
    totalTime: '25 min',
    tags: ['Quick', 'Vegetarian'],
    source: { kind: 'sample', label: 'Sample card' },
    access: 'full',
  },
  {
    sourceKey: 'sample:chocolate-pantry-cake',
    title: 'Chocolate Pantry Cake',
    author: 'Family kitchen',
    description: 'A simple cocoa cake for the nights dessert cannot wait.',
    ingredients: ['Flour', 'Cocoa', 'Brown sugar', 'Buttermilk'],
    directions: ['Whisk the dry ingredients.', 'Fold in the wet ingredients.', 'Bake until a tester comes out with a few crumbs.'],
    totalTime: '40 min',
    tags: ['Dessert', 'Baking'],
    source: { kind: 'sample', label: 'Sample card' },
    access: 'full',
  },
  {
    sourceKey: 'sample:red-lentil-soup',
    title: 'Weeknight Red Lentil Soup',
    author: 'Family kitchen',
    description: 'A deeply spiced bowl that comes together in one pot.',
    ingredients: ['Red lentils', 'Tomato paste', 'Cumin', 'Lemon'],
    directions: ['Bloom the spices.', 'Add lentils and water, then simmer.', 'Finish with lemon and olive oil.'],
    totalTime: '35 min',
    tags: ['Quick', 'Soup'],
    source: { kind: 'sample', label: 'Sample card' },
    access: 'full',
  },
  {
    sourceKey: 'sample:crispy-potato-tray',
    title: 'Crispy Potato Tray',
    author: 'Family kitchen',
    description: 'Craggy golden potatoes with rosemary and sea salt.',
    ingredients: ['Small potatoes', 'Olive oil', 'Rosemary', 'Sea salt'],
    directions: ['Boil the potatoes until tender.', 'Crush onto an oiled tray.', 'Roast until every edge is crisp.'],
    totalTime: '50 min',
    tags: ['Side', 'Vegetarian'],
    source: { kind: 'sample', label: 'Sample card' },
    access: 'full',
  },
];

const elements = {
  search: document.querySelector('#recipe-search'),
  sort: document.querySelector('#recipe-sort'),
  filters: document.querySelector('#filter-row'),
  resultCount: document.querySelector('#result-count'),
  grid: document.querySelector('#recipe-grid'),
  empty: document.querySelector('#empty-state'),
  noResults: document.querySelector('#no-results'),
  importDialog: document.querySelector('#import-dialog'),
  detailDialog: document.querySelector('#recipe-dialog'),
  detail: document.querySelector('#recipe-detail'),
  files: document.querySelector('#recipe-files'),
  dropZone: document.querySelector('#drop-zone'),
  importStatus: document.querySelector('#import-status'),
  toast: document.querySelector('#toast'),
  installButton: document.querySelector('#install-button'),
};

const state = {
  recipes: [],
  mode: 'all',
  query: '',
  sort: 'title',
  installPrompt: null,
  wakeLock: null,
  storageReady: false,
};

let favoriteWriteQueue = Promise.resolve();
let wakeLockRequestToken = 0;

function element(tagName, options = {}, children = []) {
  const node = document.createElement(tagName);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.id) node.id = options.id;
  if (options.type) node.type = options.type;
  if (options.title) node.title = options.title;
  if (options.href) node.href = options.href;
  if (options.target) node.target = options.target;
  if (options.rel) node.rel = options.rel;
  if (options.ariaLabel) node.setAttribute('aria-label', options.ariaLabel);
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child) node.append(child);
  }
  return node;
}

function sourceLabel(recipe) {
  const fixed = {
    'nyt-index': 'NYT Cooking',
    'recipe-keeper': 'Recipe Keeper',
    sample: 'Sample card',
  }[recipe.source?.kind];
  if (fixed) return fixed;

  const label = recipe.source?.label || (recipe.source?.kind === 'paprika' ? 'Paprika' : 'Family recipe');
  try {
    return new URL(label).hostname.replace(/^www\./, '');
  } catch {
    return String(label).replace(/^www\./, '');
  }
}

function shortMark(title) {
  return String(title || 'Recipe')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toLocaleUpperCase();
}

function colorIndex(value) {
  return [...String(value)].reduce((sum, character) => sum + character.codePointAt(0), 0) % 6;
}

function recipeImage(recipe) {
  return recipe.image?.dataUrl || '';
}

function makeCover(recipe, extraClass = '') {
  const cover = element('div', { className: `recipe-cover color-${colorIndex(recipe.title)} ${extraClass}`.trim() });
  cover.setAttribute('aria-hidden', 'true');
  const source = recipeImage(recipe);
  if (source) {
    const image = element('img', { ariaLabel: '' });
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.src = source;
    image.addEventListener('error', () => image.remove(), { once: true });
    cover.append(image);
  }
  cover.append(
    element('span', { className: 'cover-mark', text: shortMark(recipe.title) }),
    element('small', { className: 'cover-source', text: sourceLabel(recipe) }),
  );
  return cover;
}

function readableDuration(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if (!match) return raw;
  const parts = [];
  if (match[1]) parts.push(`${Number(match[1])} ${Number(match[1]) === 1 ? 'day' : 'days'}`);
  if (match[2]) parts.push(`${Number(match[2])} hr`);
  if (match[3]) parts.push(`${Number(match[3])} min`);
  return parts.join(' ') || raw;
}

function timeLabel(recipe) {
  return readableDuration(recipe.totalTime)
    || [recipe.prepTime, recipe.cookTime].map(readableDuration).filter(Boolean).join(' · ')
    || 'Time not listed';
}

async function persistRecipes(nextRecipes) {
  if (!state.storageReady) throw new Error('Local storage is unavailable; no changes were saved.');
  await saveThenApply(nextRecipes, saveLibrary, (savedRecipes) => { state.recipes = savedRecipes; });
}

function filteredRecipes() {
  const filters = { query: state.query };
  if (state.mode === 'nyt-index') filters.source = 'nyt-index';
  else if (state.mode !== 'all') filters.filter = state.mode;

  return sortRecipes(selectRecipes(state.recipes, filters), state.sort);
}

function toggleFavorite(recipe) {
  const activeFavorite = document.activeElement?.closest?.('.favorite-button');
  const restoreKey = activeFavorite?.dataset.recipeKey || '';
  const operation = favoriteWriteQueue.then(async () => {
    if (!state.storageReady) throw new Error('Local storage is unavailable; no changes were saved.');
    const current = state.recipes.find((candidate) => candidate.sourceKey === recipe.sourceKey);
    if (!current) return;
    const updated = { ...current, favorite: !current.favorite };
    await saveRecipe(updated);
    state.recipes = state.recipes.map((candidate) => candidate.sourceKey === updated.sourceKey ? updated : candidate);
    render();
    const detailFavorite = elements.detail.querySelector('[data-detail-favorite]');
    if (detailFavorite?.dataset.recipeKey === updated.sourceKey) {
      detailFavorite.textContent = updated.favorite ? '♥ Favorited' : '♡ Favorite';
      detailFavorite.setAttribute('aria-pressed', String(Boolean(updated.favorite)));
    }
    if (restoreKey) {
      const replacement = [...elements.grid.querySelectorAll('.favorite-button')]
        .find((button) => button.dataset.recipeKey === restoreKey);
      const fallback = elements.noResults.hidden
        ? elements.grid
        : document.querySelector('#clear-filters');
      (replacement || fallback).focus();
    }
  });
  favoriteWriteQueue = operation.catch(() => {});
  operation.catch((error) => {
    showToast(error.message || 'The favorite could not be saved.');
  });
  return operation;
}

function makeCard(recipe) {
  const card = element('article', { className: 'recipe-card' });
  const openButton = element('button', {
    className: 'card-open',
    type: 'button',
    ariaLabel: `Open ${recipe.title}`,
  });
  openButton.addEventListener('click', () => openDetail(recipe));

  const copy = element('div', { className: 'card-copy' });
  copy.append(
    element('span', { className: `source-kicker source-${recipe.source?.kind || 'other'}`, text: sourceLabel(recipe) }),
    element('h2', { text: recipe.title }),
  );
  if (recipe.author) copy.append(element('p', { className: 'card-author', text: recipe.author }));
  const facts = element('div', { className: 'card-facts' });
  facts.append(element('span', { text: timeLabel(recipe) }));
  if (recipe.rating) facts.append(element('span', { text: `${recipe.rating}★${recipe.ratingCount ? ` · ${recipe.ratingCount}` : ''}` }));
  if (recipe.access === 'external') facts.append(element('span', { className: 'external-mark', text: 'NYT ↗' }));
  copy.append(facts);

  const favorite = element('button', {
    className: `favorite-button ${recipe.favorite ? 'is-favorite' : ''}`,
    type: 'button',
    text: recipe.favorite ? '♥' : '♡',
    ariaLabel: `${recipe.favorite ? 'Remove' : 'Add'} ${recipe.title} ${recipe.favorite ? 'from' : 'to'} favorites`,
  });
  favorite.setAttribute('aria-pressed', String(Boolean(recipe.favorite)));
  favorite.dataset.recipeKey = recipe.sourceKey;
  favorite.addEventListener('click', () => toggleFavorite(recipe));
  card.append(makeCover(recipe), copy, openButton, favorite);
  return card;
}

function countFor(mode) {
  if (mode === 'all') return state.recipes.length;
  if (mode === 'nyt-index') return state.recipes.filter((recipe) => recipe.source?.kind === 'nyt-index').length;
  return selectRecipes(state.recipes, { filter: mode }).length;
}

function render() {
  const selected = filteredRecipes();
  const hasRecipes = state.recipes.length > 0;
  const hasResults = selected.length > 0;

  elements.empty.hidden = hasRecipes;
  elements.noResults.hidden = !hasRecipes || hasResults;
  elements.grid.hidden = !hasRecipes || !hasResults;
  elements.grid.setAttribute('aria-busy', 'false');
  elements.resultCount.textContent = `${selected.length} ${selected.length === 1 ? 'recipe' : 'recipes'}`;
  elements.grid.replaceChildren(...selected.map(makeCard));

  document.querySelectorAll('[data-count]').forEach((node) => {
    node.textContent = String(countFor(node.dataset.count));
  });
  document.querySelectorAll('.filter-chip').forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function detailMeta(recipe) {
  const line = element('div', { className: 'detail-meta' });
  line.append(element('span', { text: timeLabel(recipe) }));
  if (recipe.rating) line.append(element('span', { text: `${recipe.rating}★${recipe.ratingCount ? ` from ${recipe.ratingCount}` : ''}` }));
  for (const tag of (recipe.tags || []).slice(0, 3)) line.append(element('span', { text: tag }));
  return line;
}

async function requestCookWakeLock() {
  const cookModeActive = elements.detailDialog.classList.contains('is-cook-mode');
  if (!('wakeLock' in navigator)
    || !shouldRequestWakeLock(document.visibilityState, elements.detailDialog.open, cookModeActive)
    || (state.wakeLock && !state.wakeLock.released)) return;
  const requestToken = ++wakeLockRequestToken;
  try {
    const wakeLock = await navigator.wakeLock.request('screen');
    if (requestToken !== wakeLockRequestToken || !shouldRequestWakeLock(
      document.visibilityState,
      elements.detailDialog.open,
      elements.detailDialog.classList.contains('is-cook-mode'),
    )) {
      await wakeLock.release().catch(() => {});
      return;
    }
    state.wakeLock = wakeLock;
  } catch {
    if (requestToken === wakeLockRequestToken) state.wakeLock = null;
  }
}

async function releaseCookWakeLock() {
  wakeLockRequestToken += 1;
  const wakeLock = state.wakeLock;
  state.wakeLock = null;
  if (wakeLock) await wakeLock.release().catch(() => {});
}

async function setCookMode(button, enabled) {
  elements.detailDialog.classList.toggle('is-cook-mode', enabled);
  button.textContent = enabled ? 'Exit cook mode' : 'Cook mode';
  button.setAttribute('aria-pressed', String(enabled));
  if (enabled) {
    await requestCookWakeLock();
  } else {
    await releaseCookWakeLock();
  }
}

function openDetail(recipe) {
  if (!recipe) return;
  elements.detail.replaceChildren();
  const shell = element('article', { className: 'detail-shell' });
  const close = element('button', { className: 'detail-close', type: 'button', text: '×', ariaLabel: 'Close recipe' });
  close.addEventListener('click', () => elements.detailDialog.close());

  const visual = makeCover(recipe, 'detail-cover');
  const content = element('div', { className: 'detail-content' });
  const heading = element('header', { className: 'detail-heading' });
  heading.append(
    element('p', { className: 'eyebrow', text: sourceLabel(recipe) }),
    element('h2', { id: 'detail-title', text: recipe.title }),
  );
  if (recipe.author) heading.append(element('p', { className: 'detail-author', text: `By ${recipe.author}` }));
  heading.append(detailMeta(recipe));
  if (recipe.description) heading.append(element('p', { className: 'detail-description', text: recipe.description }));

  const actions = element('div', { className: 'detail-actions' });
  const favorite = element('button', {
    className: 'button button-secondary',
    type: 'button',
    text: recipe.favorite ? '♥ Favorited' : '♡ Favorite',
  });
  favorite.setAttribute('aria-pressed', String(Boolean(recipe.favorite)));
  favorite.dataset.detailFavorite = 'true';
  favorite.dataset.recipeKey = recipe.sourceKey;
  favorite.addEventListener('click', () => toggleFavorite(recipe));
  actions.append(favorite);

  if (recipe.access === 'external') {
    if (recipe.source?.originalUrl) {
      actions.append(element('a', {
        className: 'button button-primary',
        text: 'Find in NYT Cooking ↗',
        href: recipe.source.originalUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
      }));
    } else {
      actions.append(element('p', { text: 'The original NYT link was not saved.' }));
    }
    const external = element('section', { className: 'external-panel' });
    external.append(
      element('p', { className: 'eyebrow', text: 'Saved index card' }),
      element('h3', { text: 'The recipe stays with NYT.' }),
      element('p', { text: 'Kathie’s Kitchen keeps only the private bookmark metadata. Open NYT Cooking while signed in for the complete recipe and original photography.' }),
    );
    content.append(heading, actions, external);
  } else {
    const cookModeActive = elements.detailDialog.classList.contains('is-cook-mode');
    const cook = element('button', {
      className: 'button button-primary',
      type: 'button',
      text: cookModeActive ? 'Exit cook mode' : 'Cook mode',
    });
    cook.setAttribute('aria-pressed', String(cookModeActive));
    cook.addEventListener('click', () => setCookMode(cook, !elements.detailDialog.classList.contains('is-cook-mode')));
    actions.append(cook);
    content.append(heading, actions);

    if (recipe.ingredients?.length) {
      const ingredients = element('section', { className: 'recipe-section ingredients-section' });
      ingredients.append(element('h3', { text: 'Ingredients' }));
      const list = element('ul', { className: 'check-list' });
      recipe.ingredients.forEach((ingredient, index) => {
        const checkbox = element('input');
        checkbox.type = 'checkbox';
        checkbox.id = `ingredient-${index}`;
        const label = element('label', {}, [checkbox, element('span', { text: ingredient })]);
        list.append(element('li', {}, label));
      });
      ingredients.append(list);
      content.append(ingredients);
    }

    if (recipe.directions?.length) {
      const directions = element('section', { className: 'recipe-section directions-section' });
      directions.append(element('h3', { text: 'Directions' }));
      const list = element('ol', { className: 'step-list' });
      recipe.directions.forEach((step) => {
        const button = element('button', { type: 'button', text: step, ariaLabel: `Mark step complete: ${step}` });
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
          const done = button.classList.toggle('is-done');
          button.setAttribute('aria-pressed', String(done));
          button.setAttribute('aria-label', `${done ? 'Mark step incomplete' : 'Mark step complete'}: ${step}`);
        });
        list.append(element('li', {}, button));
      });
      directions.append(list);
      content.append(directions);
    }

    if (recipe.notes) {
      const notes = element('section', { className: 'recipe-section notes-section' });
      notes.append(element('h3', { text: 'Notes' }), element('p', { text: recipe.notes }));
      content.append(notes);
    }

    if (recipe.source?.originalUrl) {
      content.append(element('a', {
        className: 'source-link',
        text: 'Open original source ↗',
        href: recipe.source.originalUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
      }));
    }
  }

  shell.append(close, visual, content);
  elements.detail.append(shell);
  if (!elements.detailDialog.open) elements.detailDialog.showModal();
}

function openImportDialog() {
  elements.importStatus.textContent = '';
  elements.importDialog.showModal();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { elements.toast.hidden = true; }, 3600);
}

async function importFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  elements.importStatus.className = 'import-status is-working';
  elements.importStatus.textContent = `Reading ${files.length} ${files.length === 1 ? 'file' : 'files'}…`;
  const incoming = [];
  const errors = [];

  for (const file of files) {
    try {
      const records = await parseRecipeFile(new Uint8Array(await file.arrayBuffer()), file.name);
      const importedAt = new Date().toISOString();
      incoming.push(...records.map((recipe) => ({ ...recipe, importedAt: recipe.importedAt || importedAt })));
    } catch (error) {
      errors.push(`${file.name}: ${error.message}`);
    }
  }

  const before = new Set(state.recipes.map((recipe) => recipe.sourceKey));
  const uniqueIncoming = [...new Map(incoming.map((recipe) => [recipe.sourceKey, recipe])).values()];
  let added = 0;
  let updated = 0;

  if (uniqueIncoming.length) {
    try {
      const nextRecipes = mergeRecipes(state.recipes, uniqueIncoming);
      await persistRecipes(nextRecipes);
      added = uniqueIncoming.filter((recipe) => !before.has(recipe.sourceKey)).length;
      updated = uniqueIncoming.length - added;
      navigator.storage?.persist?.().catch(() => {});
      state.mode = 'all';
      state.query = '';
      elements.search.value = '';
      render();
    } catch (error) {
      errors.push(`Local storage: ${error.message || 'the imported recipes could not be saved'}`);
    }
  }

  const summary = [];
  if (added) summary.push(`${added} added`);
  if (updated) summary.push(`${updated} updated`);
  if (!added && !updated) summary.push('No recipes added');
  if (errors.length) summary.push(`${errors.length} file ${errors.length === 1 ? 'error' : 'errors'}`);
  elements.importStatus.className = `import-status ${errors.length ? 'has-errors' : 'is-success'}`;
  elements.importStatus.textContent = `${summary.join(' · ')}${errors.length ? ` — ${errors.join(' | ')}` : ''}`;
  showToast(summary.join(' · '));
  elements.files.value = '';
}

function exportLibrary() {
  if (!state.recipes.length) {
    showToast('There are no recipes to back up yet.');
    return;
  }
  const documentBody = JSON.stringify({
    schema: 'kathies-kitchen/v1',
    exportedAt: new Date().toISOString(),
    recipes: state.recipes,
  }, null, 2);
  const url = URL.createObjectURL(new Blob([documentBody], { type: 'application/json' }));
  const link = element('a', { href: url });
  link.download = `kathies-kitchen-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  deferObjectUrlRevoke(url);
  showToast(`Backed up ${state.recipes.length} recipes.`);
}

async function eraseLocalLibrary() {
  if (!window.confirm('Erase every recipe stored by Kathie’s Kitchen on this device? Download a backup first if you need one.')) return;
  if (!state.storageReady) {
    showToast('Local storage is unavailable; nothing was erased.');
    return;
  }
  try {
    await clearLibrary();
    state.recipes = [];
    state.mode = 'all';
    state.query = '';
    elements.search.value = '';
    render();
    elements.importDialog.close();
    showToast('Local cookbook erased.');
  } catch (error) {
    showToast(error.message || 'The local cookbook could not be erased.');
  }
}

async function loadSamples() {
  const importedAt = new Date().toISOString();
  const nextRecipes = mergeRecipes(state.recipes, SAMPLE_RECIPES.map((recipe) => ({ ...recipe, importedAt })));
  try {
    await persistRecipes(nextRecipes);
    render();
    showToast('Eight sample cards added. Import files whenever you’re ready.');
  } catch (error) {
    showToast(error.message || 'Sample cards could not be saved.');
  }
}

function clearSearchAndFilters() {
  state.mode = 'all';
  state.query = '';
  elements.search.value = '';
  render();
  elements.search.focus();
}

elements.search.addEventListener('input', (event) => {
  state.query = event.target.value;
  render();
});
elements.sort.addEventListener('change', (event) => {
  state.sort = event.target.value;
  render();
});
elements.filters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-mode]');
  if (!button) return;
  state.mode = button.dataset.mode;
  render();
});
for (const selector of ['#open-import', '#empty-import']) document.querySelector(selector).addEventListener('click', openImportDialog);
document.querySelector('#load-samples').addEventListener('click', loadSamples);
document.querySelector('#clear-filters').addEventListener('click', clearSearchAndFilters);
document.querySelector('#export-button').addEventListener('click', exportLibrary);
document.querySelector('#dialog-export').addEventListener('click', exportLibrary);
document.querySelector('#erase-library').addEventListener('click', eraseLocalLibrary);
elements.files.addEventListener('change', (event) => importFiles(event.target.files));

elements.dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  elements.dropZone.classList.add('is-dragging');
});
elements.dropZone.addEventListener('dragleave', () => elements.dropZone.classList.remove('is-dragging'));
elements.dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  elements.dropZone.classList.remove('is-dragging');
  importFiles(event.dataTransfer.files);
});

elements.detailDialog.addEventListener('click', (event) => {
  if (event.target === elements.detailDialog) elements.detailDialog.close();
});
elements.detailDialog.addEventListener('close', () => {
  releaseCookWakeLock();
  elements.detailDialog.classList.remove('is-cook-mode');
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') releaseCookWakeLock();
  else if (elements.detailDialog.open && elements.detailDialog.classList.contains('is-cook-mode')) requestCookWakeLock();
});
elements.importDialog.addEventListener('click', (event) => {
  if (event.target === elements.importDialog) elements.importDialog.close();
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
    event.preventDefault();
    elements.search.focus();
  }
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  state.installPrompt = event;
  elements.installButton.hidden = false;
});
elements.installButton.addEventListener('click', async () => {
  if (!state.installPrompt) return;
  state.installPrompt.prompt();
  await state.installPrompt.userChoice;
  state.installPrompt = null;
  elements.installButton.hidden = true;
});

try {
  state.recipes = await loadLibrary();
  state.storageReady = true;
  if (!state.recipes.length && new URLSearchParams(location.search).get('preview') === 'samples') {
    const importedAt = new Date().toISOString();
    state.recipes = SAMPLE_RECIPES.map((recipe) => ({ ...recipe, importedAt }));
  }
} catch {
  state.storageReady = false;
  elements.importStatus.textContent = 'Local storage could not be opened in this browser. No changes will be saved.';
  showToast('Local storage is unavailable; Kathie’s Kitchen is read-only.');
}
render();

if ('serviceWorker' in navigator && canRegisterServiceWorker(location)) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
