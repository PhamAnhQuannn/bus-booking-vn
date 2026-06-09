// Enumerate every bus operator ("nhà xe" / brand) listed on vexere.com.
//
// Source of truth: vexere's public sitemap. The operator pages live under
//   https://vexere.com/bus-operator-en.xml  (index)
//     -> https://vexere.com/bus-operator-en/bus-operator-en-N.xml  (leaves, N = 1..)
// Each operator URL is `https://vexere.com/en-US/<slug>-bus` and the brand name is
// fully embedded in the slug, so no per-page visit is needed.
//
// "Using Playwright" is honored via the request (APIRequestContext) API — plain HTTP,
// no browser binary / `playwright install` required.
//
// Run: node scripts/research/vexere-operators.mjs

import { request } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const INDEX_URL = 'https://vexere.com/bus-operator-en.xml'
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/research')

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36'

// robots.txt Disallows these specific operator slugs — exclude them.
const DISALLOWED_SLUGS = new Set(['xe-nam-viet', 'nam-viet-bus', 'xe-vexere'])

const LOC_RE = /<loc>([^<]+)<\/loc>/g

function locs(xml) {
  const out = []
  let m
  while ((m = LOC_RE.exec(xml)) !== null) out.push(m[1].trim())
  return out
}

async function fetchText(ctx, url) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await ctx.get(url)
      if (res.ok()) return await res.text()
      console.warn(`  ! ${res.status()} ${url}${attempt < 2 ? ' — retrying' : ''}`)
    } catch (err) {
      console.warn(`  ! error ${url}: ${err.message}${attempt < 2 ? ' — retrying' : ''}`)
    }
  }
  return null
}

function titleCase(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

function toOperator(url) {
  // .../en-US/<slug>-bus
  const m = url.match(/\/en-US\/([^/?#]+)-bus(?:[/?#]|$)/)
  if (!m) return null
  const slug = m[1]
  if (DISALLOWED_SLUGS.has(slug) || DISALLOWED_SLUGS.has(`${slug}-bus`)) return null
  return { brand: titleCase(slug), slug, url: url.split(/[?#]/)[0] }
}

async function main() {
  const ctx = await request.newContext({ extraHTTPHeaders: { 'User-Agent': UA } })
  try {
    console.log(`Fetching index: ${INDEX_URL}`)
    const indexXml = await fetchText(ctx, INDEX_URL)
    if (!indexXml) throw new Error('could not fetch sitemap index')

    // Index may itself be a sitemapindex (leaves) or already contain operator URLs.
    const indexLocs = locs(indexXml)
    const leafUrls = indexLocs.filter((u) => /\.xml(?:[?#]|$)/.test(u))
    const directOps = indexLocs.filter((u) => /\/en-US\/[^/]+-bus/.test(u))

    const leaves = leafUrls.length ? leafUrls : [INDEX_URL]
    console.log(`Leaf sitemaps to read: ${leaves.length}`)

    const bySlug = new Map()
    const ingest = (urls) => {
      for (const u of urls) {
        const op = toOperator(u)
        if (op && !bySlug.has(op.slug)) bySlug.set(op.slug, op)
      }
    }
    ingest(directOps)

    for (const leaf of leaves) {
      if (leaf === INDEX_URL && !leafUrls.length) continue
      console.log(`Reading leaf: ${leaf}`)
      const xml = await fetchText(ctx, leaf)
      if (!xml) continue
      ingest(locs(xml))
    }

    const operators = [...bySlug.values()].sort((a, b) =>
      a.brand.localeCompare(b.brand, 'en'),
    )
    console.log(`\nTotal operators: ${operators.length}`)

    await mkdir(OUT_DIR, { recursive: true })
    const fetchedAt = new Date().toISOString()

    const json = {
      source: INDEX_URL,
      note: 'Brand names derived from vexere.com operator-page URL slugs (title-cased).',
      fetchedAt,
      count: operators.length,
      operators,
    }
    await writeFile(
      resolve(OUT_DIR, 'vexere-operators.json'),
      JSON.stringify(json, null, 2) + '\n',
      'utf8',
    )

    const md = [
      `# Bus operators (brands) listed on vexere.com`,
      ``,
      `- **Source:** ${INDEX_URL} (sitemap)`,
      `- **Fetched:** ${fetchedAt}`,
      `- **Count:** ${operators.length}`,
      `- Brand names are derived from each operator page's URL slug (title-cased), not the`,
      `  on-page H1 — so diacritics are absent (e.g. "Hai Van" not "Hải Vân").`,
      ``,
      `| # | Brand | Slug | URL |`,
      `| - | ----- | ---- | --- |`,
      ...operators.map(
        (o, i) => `| ${i + 1} | ${o.brand} | \`${o.slug}\` | ${o.url} |`,
      ),
      ``,
    ].join('\n')
    await writeFile(resolve(OUT_DIR, 'vexere-operators.md'), md, 'utf8')

    console.log(`Wrote:\n  ${resolve(OUT_DIR, 'vexere-operators.json')}\n  ${resolve(OUT_DIR, 'vexere-operators.md')}`)
  } finally {
    await ctx.dispose()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
