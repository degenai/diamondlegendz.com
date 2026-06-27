import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const primitivesRoot = path.join(root, 'primitives');

function parseList(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return trimmed;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map(part => part.trim()).filter(Boolean);
}

function parseFacetComment(html) {
  const match = html.match(/<!--\s*facet:\s*([\s\S]*?)-->/);
  if (!match) return null;
  const meta = {};
  for (const raw of match[1].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !line.includes(':')) continue;
    const idx = line.indexOf(':');
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    meta[key] = ['tier'].includes(key) ? Number(value) : parseList(value);
  }
  return meta;
}

const entries = [];
for (const tierName of await fs.readdir(primitivesRoot)) {
  if (!tierName.startsWith('tier-')) continue;
  const tierPath = path.join(primitivesRoot, tierName);
  for (const id of await fs.readdir(tierPath)) {
    if (id.startsWith('_')) continue;
    const file = path.join(tierPath, id, 'index.html');
    try {
      const html = await fs.readFile(file, 'utf8');
      const meta = parseFacetComment(html);
      if (!meta) continue;
      const rel = `primitives/${tierName}/${id}/`;
      const lineCount = html.split(/\r?\n/).length;
      entries.push({
        id: meta.id || id,
        tier: Number(meta.tier ?? tierName.replace('tier-', '')),
        title: meta.title || id,
        description: meta.description || '',
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        apis: Array.isArray(meta.apis) ? meta.apis : [],
        parents: Array.isArray(meta.parents) ? meta.parents : [],
        loc: lineCount,
        url: rel,
        status: (Array.isArray(meta.tags) && meta.tags.includes('placeholder')) ? 'stub' : 'ready'
      });
    } catch (err) {
      console.warn(`Skipping ${file}: ${err.message}`);
    }
  }
}

const tierWeight = entry => entry.tier;
entries.sort((a, b) => tierWeight(a) - tierWeight(b) || a.id.localeCompare(b.id));
await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify(entries, null, 2) + '\n');
console.log(`wrote facets/manifest.json with ${entries.length} facets`);
