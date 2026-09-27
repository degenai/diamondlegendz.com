# Direct-Message Contact Research and Correction

Use this workflow when Alex supplies a screenshot or text from a real-world contact, corrects a voice-transcribed person/company name, and asks for research plus wiki capture.

## 1. Treat the direct source as the relationship record

Read the screenshot or message before searching conversation history. Capture only what is visible or user-confirmed:

- sender identity or self-identification
- direct phone number, link, message text, timestamp, and delivery state
- the offer or requested follow-up
- Alex's confirmed relationship to the person

A phone number taken from a private thread belongs in a `visibility: private` person node and must be labeled as direct-contact data rather than a researched public business number.

## 2. Resolve identity through the linked source

Start with the URL or organization named in the direct message, then research outward:

1. primary company site and product/about pages
2. the person's public professional profile
3. company profile and founder/team references
4. independent or company-adjacent coverage, labeled accurately

Keep evidence classes separate. A person's public title, a company's marketing claim, and an independently verified fact are different things.

When several people use overlapping founder titles, preserve the role map instead of inventing a cap table or chronology. State each attributed title and mark legal ownership/equity as unverified.

## 3. Fan corrections out to every live surface

A corrected name or organization may live beyond the four normal wiki documents. Check and update:

- active scheduled reminder or cron-job name and payload
- MCU `log.md`
- MCU `docket.md`
- person node
- organization node
- wiki `_meta/log.md`
- persistent memory only when the fact is globally useful and durable

Then sweep the touched stores for the stale transcription. Apply the Randy Hunter rule: durable records contain the correct name positively; they do not preserve the discarded phrase as a warning or comparison.

## 4. Split person and organization nodes

Create two linked private nodes when both sides have durable value:

### Person node

- public role and location, with source boundaries
- Alex's relationship and encounter date
- private contact channel
- the direct offer and concrete follow-up
- ambiguity caveats that apply to the person's role

### Organization node

- canonical name plus aliases
- product/business model and dated current facts
- founder/leadership map
- company claims clearly labeled as claims
- relationship status with Alex

A free item, warm introduction, or friendly direct message is a warm relationship signal. It becomes a formal promotional partnership only when both sides actually agree to one.

## 5. Preserve clinical and operational boundaries

If the contact was also a massage client and the user says SOAP notes remain open:

- docket the missing SOAP note
- schedule or correct the reminder when requested or already present
- do not fabricate a clinical note without the session findings

The business/person node can record that documentation is pending without importing unprovided clinical details.

## 6. Verification and backup

Before finishing:

1. Read back both nodes and the touched MCU blocks.
2. Search for the stale name across the relevant durable stores.
3. Validate frontmatter, aliases, duplicate node names, and all new wikilinks.
4. Run the vault's available wikilint; if none is present, run a targeted equivalent and report it as such.
5. Stage only intentional wiki files; preserve Obsidian workspace state and unrelated edits.
6. Commit, push, and verify `HEAD...origin/main` is synchronized.

## Session pattern distilled

A direct client message identified a founder, linked the company's canonical site, and offered Alex a free product/package. The robust result was a private person node plus a private company node, a founder-role evidence map, corrected reminder/docket/log surfaces, and a positive-name sweep that removed the voice-transcription artifact entirely.