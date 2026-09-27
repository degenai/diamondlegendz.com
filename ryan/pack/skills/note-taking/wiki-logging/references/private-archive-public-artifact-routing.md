# Private Archive → Public Artifact Routing

Use this reference when an idea captured in a private knowledge system could also become a worldwide-public page.

## Core distinction

A topic's usefulness, shareability, or search demand does not determine its publication surface. Route by **audience + artifact + repository**:

| Request / fact | Durable surface |
|---|---|
| “Wiki log” / idea capture | Dated private `_meta/log.md` receipt |
| Confirmed standing personal or family truth | Canonical private-family node |
| Standalone public guide/article/tool | Explicitly named public repository |
| Ambiguous audience | Private dated receipt with destination unresolved |

Authentication and `noindex` protect an archive; they do not turn the archive into a staging area for public content.

## Full correction sweep

When a private receipt was accidentally promoted into a standalone article:

1. **Freeze publication expansion.** Identify the intended audience and destination before creating more projections.
2. **Retain the requested receipt.** Replace article-style diagnostic language with a short dated `CAPTURED` / `ROUTED` entry.
3. **Collapse the accidental projection.** Remove the node, private media, backlinks, index/category references, and any reminder that calls the private node the public canonical source.
4. **Harden routing controls.** Update persistent memory, the governing skill, and repository-local agent configuration with the same positive destination rule.
5. **Use a non-content config surface.** In Alexpedia, root-level Markdown can be rendered as a wiki node. Store repository instructions in `.cursorrules`, which is supported project context and is not Markdown content.
6. **Clean-build.** Require build tests, a fresh output directory, zero removed-slug files, zero config-file projections, and no new redlinks.
7. **Deploy the committed correction.** If the shared checkout has unrelated changes, deploy from a detached clean worktree at the pushed commit.
8. **Preserve concurrent edits.** Stage exact paths and exact shared-log hunks; leave Obsidian and other-agent modifications unstaged.

## Publishing private-source screenshots safely

A public derivative is a new artifact, not a copied private attachment.

1. Recover the private original into a temporary local directory.
2. Crop owner/account chrome and recent-contact UI.
3. Cover irrelevant third-party identity with **opaque fill**; blur/pixelation is not de-identification.
4. Export a flattened derivative with metadata mapping disabled.
5. Strip JPEG APP1–APP15 and COM segments when practical; retain only image/JFIF structure.
6. Verify there is no EXIF, XMP, ICC, Photoshop/IPTC, comment segment, or embedded thumbnail.
7. Enforce an exact public-assets allowlist in tests so originals/intermediates cannot enter the commit silently.
8. Scan every shipped text artifact for literal home paths, private archive names/paths, file URLs, credentials, and owner identifiers.
9. Delete temporary originals and stage derivative paths individually.

Useful regression assertions:

- exact file set under the public evidence directory;
- image byte-size floor and expected intrinsic dimensions;
- safe JPEG header-marker set plus forbidden metadata signatures;
- page references each derivative and describes redactions honestly;
- canonical, `og:url`, structured-data URL, and sitemap location are byte-identical.

## Publication acceptance

A successful CI/deployment run proves that bytes were uploaded; it does not prove that the canonical public URL is safe and reachable.

For a custom domain, require:

- strict hostname-validating HTTPS (never use `curl -k` as acceptance evidence);
- canonical page `200`;
- indexable robots/meta state;
- homepage and sitemap discovery;
- byte-for-byte identity of published derivatives when privacy redaction matters.

For GitHub Pages with Cloudflare DNS, a `www` CNAME points directly to the user/organization Pages host (for example `degenai.github.io`). Pointing `www` to the apex can prevent certificate provisioning even when both names resolve to GitHub Pages IPs.
