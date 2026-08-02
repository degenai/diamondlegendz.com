import { gunzipSync, inflateSync, strFromU8 } from './fflate.mjs';

const decoder = new TextDecoder();
const MAX_ZIP_ENTRIES = 5_000;
const MAX_ZIP_ENTRY_BYTES = 64 * 1024 * 1024;
const MAX_ZIP_TOTAL_BYTES = 256 * 1024 * 1024;

function u16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function u64(bytes, offset) {
  const low = BigInt(u32(bytes, offset));
  const high = BigInt(u32(bytes, offset + 4));
  const value = (high << 32n) | low;
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('ZIP64 value is too large to read safely');
  return Number(value);
}

function zip64Fields(extra, fields) {
  let cursor = 0;
  while (cursor + 4 <= extra.length) {
    const id = u16(extra, cursor);
    const size = u16(extra, cursor + 2);
    const end = cursor + 4 + size;
    if (end > extra.length) throw new Error('ZIP extra data is truncated');
    if (id === 0x0001) {
      let valueOffset = cursor + 4;
      const resolved = { ...fields };
      for (const key of ['uncompressedSize', 'compressedSize', 'localOffset']) {
        if (resolved[key] === 0xffffffff) {
          if (valueOffset + 8 > end) throw new Error('ZIP64 size data is truncated');
          resolved[key] = u64(extra, valueOffset);
          valueOffset += 8;
        }
      }
      return resolved;
    }
    cursor = end;
  }
  return fields;
}

export function unzipCompatible(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let end = bytes.length - 22;
  const minimum = Math.max(0, bytes.length - 65_558);
  while (end >= minimum && u32(bytes, end) !== 0x06054b50) end -= 1;
  if (end < minimum) throw new Error('ZIP end record was not found');

  let entryCount = u16(bytes, end + 10);
  let centralOffset = u32(bytes, end + 16);
  if (entryCount === 0xffff || centralOffset === 0xffffffff) {
    const locator = end - 20;
    if (locator < 0 || u32(bytes, locator) !== 0x07064b50) throw new Error('ZIP64 locator was not found');
    const zip64End = u64(bytes, locator + 8);
    if (u32(bytes, zip64End) !== 0x06064b50) throw new Error('ZIP64 end record was not found');
    entryCount = u64(bytes, zip64End + 32);
    centralOffset = u64(bytes, zip64End + 48);
  }

  if (entryCount > MAX_ZIP_ENTRIES) throw new Error(`ZIP contains too many files (${entryCount})`);
  const files = {};
  let cursor = centralOffset;
  let totalBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > bytes.length || u32(bytes, cursor) !== 0x02014b50) throw new Error('ZIP directory is invalid');
    const flags = u16(bytes, cursor + 8);
    const compression = u16(bytes, cursor + 10);
    const nameLength = u16(bytes, cursor + 28);
    const extraLength = u16(bytes, cursor + 30);
    const commentLength = u16(bytes, cursor + 32);
    const nameStart = cursor + 46;
    const extraStart = nameStart + nameLength;
    const next = extraStart + extraLength + commentLength;
    if (next > bytes.length) throw new Error('ZIP directory entry is truncated');

    const name = decoder.decode(bytes.subarray(nameStart, extraStart));
    let fields = {
      compressedSize: u32(bytes, cursor + 20),
      uncompressedSize: u32(bytes, cursor + 24),
      localOffset: u32(bytes, cursor + 42),
    };
    fields = zip64Fields(bytes.subarray(extraStart, extraStart + extraLength), fields);
    cursor = next;

    if (flags & 0x0001) throw new Error(`Encrypted ZIP entries are not supported (${name})`);
    if (fields.uncompressedSize > MAX_ZIP_ENTRY_BYTES) throw new Error(`ZIP entry is too large (${name})`);
    totalBytes += fields.uncompressedSize;
    if (totalBytes > MAX_ZIP_TOTAL_BYTES) throw new Error('ZIP expands beyond the safe import limit');

    const local = fields.localOffset;
    if (local + 30 > bytes.length || u32(bytes, local) !== 0x04034b50) throw new Error(`ZIP entry header is invalid (${name})`);
    const localNameLength = u16(bytes, local + 26);
    const localExtraLength = u16(bytes, local + 28);
    const dataStart = local + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + fields.compressedSize;
    if (dataEnd > bytes.length) throw new Error(`ZIP entry data is truncated (${name})`);

    const compressed = bytes.subarray(dataStart, dataEnd);
    if (compression === 0) files[name] = compressed.slice();
    else if (compression === 8) files[name] = inflateSync(compressed, { out: new Uint8Array(fields.uncompressedSize) });
    else throw new Error(`Unsupported ZIP compression method ${compression} (${name})`);
  }
  return files;
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function slug(value) {
  return clean(value)
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function escapeSelector(value) {
  return String(value).replace(/["\\]/g, '\\$&');
}

function decodeEntities(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const codePoint = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      try {
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : '\uFFFD';
      } catch {
        return '\uFFFD';
      }
    }
    return entities[entity.toLowerCase()] ?? `&${entity};`;
  });
}

function textFromHtml(value) {
  return clean(decodeEntities(String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|li|div|h\d)>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')));
}

function getAttr(markup, name) {
  const match = String(markup).match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return decodeEntities(match?.[1] ?? '');
}

function fallbackItem(block, itemprop) {
  const safe = escapeSelector(itemprop);
  const meta = block.match(new RegExp(`<[^>]*itemprop\\s*=\\s*["']${safe}["'][^>]*>`, 'i'));
  if (!meta) return { text: '', html: '', open: '' };
  const open = meta[0];
  const content = getAttr(open, 'content');
  if (content) return { text: clean(content), html: '', open };
  const tag = open.match(/^<\s*([a-z0-9-]+)/i)?.[1];
  if (!tag) return { text: '', html: '', open };
  const start = (meta.index ?? 0) + open.length;
  const close = block.slice(start).search(new RegExp(`</${tag}\\s*>`, 'i'));
  const html = close < 0 ? '' : block.slice(start, start + close);
  return { text: textFromHtml(html), html, open };
}

function fallbackList(block, itemprop) {
  const section = fallbackItem(block, itemprop);
  const paragraphs = [...section.html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => textFromHtml(match[1]))
    .filter(Boolean);
  return paragraphs.length ? paragraphs : section.text.split(/\n+/).map(clean).filter(Boolean);
}

function dataUrl(bytes, path) {
  if (!bytes) return '';
  const extension = String(path).split('.').pop()?.toLowerCase();
  const mime = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function recipeKeeperFromDom(html, files) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  return [...document.querySelectorAll('.recipe-details')].map((node, index) => {
    const item = (name) => node.querySelector(`[itemprop="${name}"]`);
    const itemText = (name) => clean(item(name)?.getAttribute('content') || item(name)?.textContent);
    const list = (name) => {
      const container = item(name);
      const rows = [...(container?.querySelectorAll('p, li') ?? [])].map((row) => clean(row.textContent)).filter(Boolean);
      return rows.length ? rows : clean(container?.textContent).split(/\n+/).map(clean).filter(Boolean);
    };
    const sourceNode = item('recipeSource');
    const title = itemText('name');
    const imagePath = clean(node.querySelector('img.recipe-photo')?.getAttribute('src'));
    const id = itemText('recipeId')
      || `fallback-${slug(title) || 'recipe'}-${stableHash(`${clean(node.textContent)}|${imagePath}|${index}`)}`;
    const categoryNodes = [...node.querySelectorAll('[itemprop="recipeCategory"]')];
    return {
      sourceKey: `recipe-keeper:${id}`,
      title,
      author: '',
      description: '',
      ingredients: list('recipeIngredients'),
      directions: list('recipeDirections'),
      notes: itemText('recipeNotes'),
      yield: itemText('recipeYield'),
      prepTime: itemText('prepTime'),
      cookTime: itemText('cookTime'),
      totalTime: '',
      tags: categoryNodes.map((category) => clean(category.getAttribute('content') || category.textContent)).filter(Boolean),
      source: {
        kind: 'recipe-keeper',
        label: itemText('recipeSource') || 'Recipe Keeper',
        originalUrl: safeSourceUrl(sourceNode?.querySelector('a[href]')?.getAttribute('href')),
      },
      image: imagePath ? { path: imagePath, dataUrl: dataUrl(files[imagePath], imagePath) } : null,
      access: 'full',
    };
  }).filter((recipe) => recipe.title);
}

function recipeKeeperFallback(html, files) {
  return html.split(/(?=<div\b[^>]*class\s*=\s*["'][^"']*\brecipe-details\b[^"']*["'])/i)
    .filter((block) => /class\s*=\s*["'][^"']*\brecipe-details\b/i.test(block))
    .map((block, index) => {
      const title = fallbackItem(block, 'name').text;
      const sourceSection = fallbackItem(block, 'recipeSource');
      const sourceLink = sourceSection.html.match(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
      const imageOpen = block.match(/<img\b[^>]*class\s*=\s*["'][^"']*\brecipe-photo\b[^"']*["'][^>]*>/i)?.[0] ?? '';
      const imagePath = clean(getAttr(imageOpen, 'src'));
      const id = fallbackItem(block, 'recipeId').text
        || `fallback-${slug(title) || 'recipe'}-${stableHash(`${clean(block)}|${imagePath}|${index}`)}`;
      const tags = [...block.matchAll(/<[^>]*itemprop\s*=\s*["']recipeCategory["'][^>]*>/gi)]
        .map((match) => getAttr(match[0], 'content'))
        .filter(Boolean);
      return {
        sourceKey: `recipe-keeper:${id}`,
        title,
        author: '',
        description: '',
        ingredients: fallbackList(block, 'recipeIngredients'),
        directions: fallbackList(block, 'recipeDirections'),
        notes: fallbackItem(block, 'recipeNotes').text,
        yield: fallbackItem(block, 'recipeYield').text,
        prepTime: fallbackItem(block, 'prepTime').text,
        cookTime: fallbackItem(block, 'cookTime').text,
        totalTime: '',
        tags,
        source: {
          kind: 'recipe-keeper',
          label: sourceSection.text || 'Recipe Keeper',
          originalUrl: safeSourceUrl(decodeEntities(sourceLink)),
        },
        image: imagePath ? { path: imagePath, dataUrl: dataUrl(files[imagePath], imagePath) } : null,
        access: 'full',
      };
    }).filter((recipe) => recipe.title);
}

function parseRecipeKeeper(files) {
  const htmlBytes = files['recipes.html'] ?? Object.entries(files).find(([name]) => name.toLowerCase().endsWith('/recipes.html'))?.[1];
  if (!htmlBytes) throw new Error('Recipe Keeper archive is missing recipes.html');
  const html = decoder.decode(htmlBytes);
  return typeof DOMParser === 'function' ? recipeKeeperFromDom(html, files) : recipeKeeperFallback(html, files);
}

function lines(value) {
  return String(value ?? '').split(/\r?\n+/).map(clean).filter(Boolean);
}

function parsePaprika(files) {
  return Object.entries(files)
    .filter(([name]) => name.toLocaleLowerCase().endsWith('.paprikarecipe'))
    .map(([name, compressed], index) => {
      let payload;
      try {
        payload = JSON.parse(strFromU8(gunzipSync(compressed)));
      } catch (error) {
        throw new Error(`Could not read ${name}: ${error.message}`);
      }
      const title = clean(payload.name);
      const id = clean(payload.uid || payload.hash)
        || `fallback-${slug(title) || 'recipe'}-${stableHash(JSON.stringify(payload))}`;
      const encodedPhoto = clean(payload.photo_data || payload.photo);
      const photoUrl = safeEmbeddedImage(encodedPhoto || payload.image_url || payload.photo_url);
      return {
        sourceKey: `paprika:${id}`,
        title,
        author: '',
        description: clean(payload.description),
        ingredients: lines(payload.ingredients),
        directions: lines(payload.directions),
        notes: clean(payload.notes),
        yield: clean(payload.servings),
        prepTime: clean(payload.prep_time),
        cookTime: clean(payload.cook_time),
        totalTime: clean(payload.total_time),
        tags: Array.isArray(payload.categories) ? payload.categories.map(clean).filter(Boolean) : [],
        source: {
          kind: 'paprika',
          label: clean(payload.source) || 'Paprika',
          originalUrl: safeSourceUrl(payload.source_url),
        },
        image: photoUrl ? { path: clean(payload.photo_hash || name), dataUrl: photoUrl } : null,
        access: 'full',
        favorite: Boolean(payload.on_favorites),
        rating: Number(payload.rating) || null,
        createdAt: clean(payload.created),
      };
    })
    .filter((recipe) => recipe.title);
}

export async function parseRecipeArchive(input, fileName = '') {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const files = unzipCompatible(bytes);
  const lowerName = String(fileName).toLocaleLowerCase();

  if (lowerName.endsWith('.paprikarecipes')) return parsePaprika(files);
  return parseRecipeKeeper(files);
}

function safeSourceUrl(value) {
  const url = clean(value);
  return /^https?:\/\//i.test(url) ? url : '';
}

function safeEmbeddedImage(value) {
  const encoded = clean(value);
  if (!encoded) return '';
  if (/^data:image\/(?:jpeg|png|webp);base64,/i.test(encoded)) return encoded;
  const normalized = encoded.replace(/\s+/g, '');
  return /^[a-zA-Z0-9+/]+=*$/.test(normalized) && (normalized.length % 4) === 0
    ? `data:image/jpeg;base64,${normalized}`
    : '';
}

function parseKitchenJson(input) {
  let document;
  try {
    document = JSON.parse(decoder.decode(input));
  } catch {
    throw new Error('That JSON file could not be read');
  }
  if (document?.schema !== 'kathies-kitchen/v1' || !Array.isArray(document.recipes)) {
    throw new Error('This is not a Kathie’s Kitchen v1 export');
  }
  return document.recipes.flatMap((recipe, index) => {
    const title = clean(recipe?.title);
    const sourceKind = clean(recipe?.source?.kind) || 'manual';
    const sourceKey = clean(recipe?.sourceKey) || `${sourceKind}:${slug(title) || index + 1}`;
    if (!title) return [];
    return [{
      sourceKey,
      title,
      author: clean(recipe.author),
      description: clean(recipe.description),
      ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients.map(clean).filter(Boolean) : [],
      directions: Array.isArray(recipe.directions) ? recipe.directions.map(clean).filter(Boolean) : [],
      notes: clean(recipe.notes),
      yield: clean(recipe.yield),
      prepTime: clean(recipe.prepTime),
      cookTime: clean(recipe.cookTime),
      totalTime: clean(recipe.totalTime),
      tags: Array.isArray(recipe.tags) ? recipe.tags.map(clean).filter(Boolean) : [],
      rating: Number(recipe.rating) || null,
      ratingCount: clean(recipe.ratingCount),
      source: {
        kind: sourceKind,
        label: clean(recipe.source?.label) || 'Imported',
        originalUrl: safeSourceUrl(recipe.source?.originalUrl),
      },
      image: safeEmbeddedImage(recipe.image?.dataUrl)
        ? { path: clean(recipe.image?.path), dataUrl: safeEmbeddedImage(recipe.image.dataUrl) }
        : null,
      access: recipe.access === 'external' ? 'external' : 'full',
      favorite: Boolean(recipe.favorite),
      importedAt: clean(recipe.importedAt),
      createdAt: clean(recipe.createdAt),
      provenance: recipe.provenance && typeof recipe.provenance === 'object'
        ? {
            capture: clean(recipe.provenance.capture),
            image: clean(recipe.provenance.image),
            transcription: clean(recipe.provenance.transcription),
          }
        : undefined,
    }];
  });
}

export async function parseRecipeFile(input, fileName = '') {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (String(fileName).toLocaleLowerCase().endsWith('.json')) return parseKitchenJson(bytes);
  return parseRecipeArchive(bytes, fileName);
}
