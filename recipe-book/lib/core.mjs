export function estimateMinutes(value) {
  const text = String(value ?? '').toLocaleLowerCase();
  const iso = text.match(/^p(?:(\d+)d)?(?:t(?:(\d+)h)?(?:(\d+)m)?)?$/i);
  if (iso) return (Number(iso[1] || 0) * 1440) + (Number(iso[2] || 0) * 60) + Number(iso[3] || 0);
  const minuteMatch = /\b(\d+)\s*(?:min|minute)s?\b/.exec(text);
  const hourMatch = /\b(?:(\d+)\s+)?(\d+\/\d+)?\s*(?:hr|hour)s?\b/.exec(text);

  if (!minuteMatch && !hourMatch) return Number.POSITIVE_INFINITY;
  if (minuteMatch && (!hourMatch || minuteMatch.index < hourMatch.index)) return Number(minuteMatch[1]);

  const whole = Number(hourMatch?.[1] || (hourMatch?.[2] ? 0 : hourMatch?.[0]?.match(/\d+/)?.[0]) || 0);
  const fraction = hourMatch?.[2]
    ? hourMatch[2].split('/').map(Number).reduce((numerator, denominator) => numerator / denominator)
    : 0;
  let minutes = (whole + fraction) * 60;
  if (minuteMatch && minuteMatch.index > hourMatch.index && minuteMatch.index - hourMatch.index < 16) {
    minutes += Number(minuteMatch[1]);
  }
  return minutes;
}

export function recipeMinutes(recipe) {
  if (recipe.totalTime) return estimateMinutes(recipe.totalTime);
  const values = [recipe.prepTime, recipe.cookTime].filter(Boolean).map(estimateMinutes);
  if (!values.length || values.some((value) => !Number.isFinite(value))) return Number.POSITIVE_INFINITY;
  return values.reduce((sum, value) => sum + value, 0);
}

export function sortRecipes(recipes, sort = 'title') {
  return [...recipes].sort((left, right) => {
    if (sort === 'quickest') return recipeMinutes(left) - recipeMinutes(right) || left.title.localeCompare(right.title);
    if (sort === 'newest') return String(right.importedAt || '').localeCompare(String(left.importedAt || '')) || left.title.localeCompare(right.title);
    return left.title.localeCompare(right.title);
  });
}

export function deferObjectUrlRevoke(
  url,
  revoke = (value) => URL.revokeObjectURL(value),
  schedule = (callback) => setTimeout(callback, 0),
) {
  schedule(() => revoke(url));
}

export function canRegisterServiceWorker(locationLike) {
  if (locationLike.protocol === 'https:') return true;
  return ['localhost', '127.0.0.1', '[::1]'].includes(locationLike.hostname);
}

export function shouldRequestWakeLock(visibilityState, dialogOpen, cookModeActive) {
  return visibilityState === 'visible' && dialogOpen && cookModeActive;
}

export async function saveThenApply(nextValue, save, apply) {
  await save(nextValue);
  apply(nextValue);
  return nextValue;
}

export function mergeRecipes(existing, incoming) {
  const bySourceKey = new Map(existing.map((recipe) => [recipe.sourceKey, recipe]));

  for (const recipe of incoming) {
    const previous = bySourceKey.get(recipe.sourceKey) ?? {};
    const merged = { ...previous, ...recipe };

    if (Object.prototype.hasOwnProperty.call(previous, 'favorite')) {
      merged.favorite = previous.favorite;
    }

    if (Object.prototype.hasOwnProperty.call(previous, 'importedAt')) {
      merged.importedAt = previous.importedAt;
    }

    bySourceKey.set(recipe.sourceKey, merged);
  }

  return [...bySourceKey.values()];
}

function searchableText(recipe) {
  return [
    recipe.title,
    recipe.author,
    recipe.description,
    ...(recipe.ingredients ?? []),
    ...(recipe.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
}

export function selectRecipes(recipes, filters = {}) {
  const query = String(filters.query ?? '')
    .trim()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();

  return recipes.filter((recipe) => {
    if (filters.source && recipe.source?.kind !== filters.source) return false;
    if (filters.tag && !(recipe.tags ?? []).includes(filters.tag)) return false;
    if (filters.filter === 'quick') {
      if (recipeMinutes(recipe) > 45) return false;
    }
    if (filters.filter === 'full' && recipe.access !== 'full') return false;
    if (filters.filter === 'favorites' && !recipe.favorite) return false;
    return !query || searchableText(recipe).includes(query);
  });
}
