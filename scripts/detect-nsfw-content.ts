#!/usr/bin/env bun
/**
 * NSFW/Explicit Content Detection Script
 *
 * Detects NSFW content by matching:
 * - Known adult domains
 * - NSFW subreddits
 * - Keywords in URLs
 * - Keywords in titles/descriptions
 *
 * Usage:
 *   bun run scripts/detect-nsfw-content.ts [--recheck] [--limit N] [--dry-run]
 *
 * Options:
 *   --recheck    Re-check all items, not just unknown ones
 *   --limit N    Limit to N items for testing
 *   --dry-run    Don't update database, just report findings
 */

import { Database } from "bun:sqlite";
import { parseArgs } from "util";

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  dbPath: "../data/unified.db",
  batchSize: 500,
};

// =============================================================================
// NSFW DETECTION PATTERNS
// =============================================================================

// Known adult/porn domains (exact match or suffix match)
const NSFW_DOMAINS = new Set([
  // Major porn sites
  "pornhub.com",
  "xvideos.com",
  "xnxx.com",
  "xhamster.com",
  "redtube.com",
  "youporn.com",
  "tube8.com",
  "spankbang.com",
  "eporner.com",
  "txxx.com",
  "hqporner.com",
  "porn.com",
  "porntrex.com",
  "thumbzilla.com",
  "pornone.com",
  "4tube.com",
  "porndig.com",
  "fuq.com",
  "ixxx.com",
  "anyporn.com",
  "fapster.xxx",
  "porn300.com",
  "tnaflix.com",
  "empflix.com",
  "drtuber.com",
  "sunporno.com",
  "sexvid.xxx",
  "3movs.com",
  "youjizz.com",
  "tubegalore.com",
  "pornmd.com",
  "porn555.com",
  "pornrox.com",
  "cliphunter.com",
  "porntube.com",
  "alohatube.com",
  "bellesa.co",

  // Hentai/anime adult
  "hanime.tv",
  "hentaihaven.xxx",
  "hentaidude.com",
  "nhentai.net",
  "e-hentai.org",
  "exhentai.org",
  "tsumino.com",
  "hitomi.la",
  "pururin.to",
  "hentai2read.com",
  "fakku.net",

  // Adult image boards
  "rule34.xxx",
  "rule34.paheal.net",
  "gelbooru.com",
  "danbooru.donmai.us",
  "sankakucomplex.com",
  "tbib.org",
  "e621.net",
  "furaffinity.net",

  // Cam sites
  "chaturbate.com",
  "stripchat.com",
  "bongacams.com",
  "myfreecams.com",
  "camsoda.com",
  "cam4.com",
  "livejasmin.com",
  "streamate.com",
  "flirt4free.com",
  "imlive.com",

  // Amateur/user-generated
  "onlyfans.com",
  "fansly.com",
  "fanvue.com",
  "loyalfans.com",
  "manyvids.com",
  "clips4sale.com",
  "modelhub.com",
  "pornhubpremium.com",
  "brazzers.com",
  "realitykings.com",
  "bangbros.com",
  "naughtyamerica.com",
  "digitalplayground.com",
  "wicked.com",
  "tushy.com",
  "vixen.com",
  "blacked.com",
  "mofos.com",

  // Adult social/dating
  "fetlife.com",
  "adultfriendfinder.com",
  "ashleymadison.com",
  "alt.com",
  "fling.com",
  "sdc.com",
  "kasidie.com",

  // Reddit NSFW mirrors/aggregators
  "scrolller.com",
  "redgifs.com",
  "gfycat.com",  // Often NSFW content

  // Other
  "imagefap.com",
  "motherless.com",
  "literotica.com",
  "nifty.org",
  "asstr.org",
  "sexstories.com",
  "xvideosred.com",
  "pornhubpremium.com",
]);

// Explicit domains (more extreme content)
const EXPLICIT_DOMAINS = new Set([
  "motherless.com",
  "heavy-r.com",
  "efukt.com",
  "crazyshit.com",
]);

// Known NSFW subreddits (without r/ prefix)
// This is a representative sample - there are thousands
const NSFW_SUBREDDITS = new Set([
  // General NSFW
  "nsfw",
  "nsfw_gifs",
  "nsfw_gif",
  "nsfw_videos",
  "nsfwhardcore",
  "nsfwfunny",
  "realgirls",
  "amateur",
  "amateurporn",
  "homemadexxx",
  "couplesgonewild",
  "hotwifelifestyle",

  // Gonewild variants
  "gonewild",
  "gonewildcouples",
  "gonewildcurvy",
  "gonewildplus",
  "gonewild30plus",
  "gonewild18",
  "gonewildaudio",
  "gonewildtube",
  "gonewildcolor",
  "gwnerdy",
  "gwpublic",
  "workgonewild",
  "wifesharing",
  "hotwife",
  "slutwife",

  // Body parts focused
  "boobs",
  "bigboobs",
  "hugeboobs",
  "busty",
  "bustypetite",
  "tittydrop",
  "boobbounce",
  "ass",
  "bigasses",
  "pawg",
  "asstastic",
  "booty",
  "feet",
  "feetpics",
  "footfetish",
  "pussy",
  "lipsthatgrip",
  "godpussy",
  "labia",
  "cock",
  "massivecock",
  "bigdickgirl",

  // Age-related (legal adult)
  "18_19",
  "legalteens",
  "collegesluts",
  "collegeamateurs",
  "milf",
  "milfs",
  "maturemilf",
  "cougars",
  "gilf",
  "agegap",
  "oldyoung",

  // Body type
  "thick",
  "thickthighs",
  "curvy",
  "voluptuous",
  "chubby",
  "bbw",
  "ssbbw",
  "petite",
  "petitegonewild",
  "dirtysmall",
  "tinytits",
  "aa_cups",
  "smallboobs",
  "fitgirls",
  "fitnakedgirls",
  "hardbodies",
  "musclegirlart",
  "death_by_snusnu",
  "theratio",

  // Ethnicity/nationality
  "asiansgonewild",
  "asiansfw",
  "asianporn",
  "juicyasians",
  "blackchickswhitedicks",
  "womenofcolor",
  "indiansgonewild",
  "palegirls",
  "ghostnipples",
  "latinas",
  "latinasgw",

  // Hair
  "redheads",
  "ginger",
  "blondes",
  "brunette",
  "shorthairchicks",

  // Activity-based
  "blowjobs",
  "blowjobsandwich",
  "deepthroat",
  "cumsluts",
  "cumshots",
  "facials",
  "creampie",
  "breeding",
  "anal",
  "painal",
  "asshole",
  "analfood",
  "buttsharpies",
  "fisting",
  "squirting",
  "orgasmcontrol",
  "ruinedorgasms",
  "edging",
  "masturbation",
  "jilling",
  "spreading",
  "insertions",
  "objects",
  "distension",
  "pee",
  "watersports",

  // BDSM/Kink
  "bdsm",
  "bondage",
  "bdsmgw",
  "submissive",
  "dominated",
  "choking",
  "roughsex",
  "forcedorgasms",
  "abuseporn",
  "painal",
  "rapefantasy",
  "rapekink",
  "cnc",
  "freeuse",
  "misogynyfetish",
  "degradedholes",
  "slut",
  "degradingholes",
  "humiliation",
  "femdom",
  "cfnm",
  "pegging",
  "chastity",

  // Group
  "threesome",
  "gangbang",
  "spitroast",
  "doublepenetration",
  "blowbang",
  "bukkake",
  "orgy",
  "swingers",

  // Professional/staged
  "pornstars",
  "porninminutes",
  "pornid",
  "tipofmypenis",
  "porn_gifs",
  "porn",
  "pornvids",
  "fullmoviesonanything",
  "free_videos",

  // Specific creators/studios
  "onlyfans",
  "onlyfanspromoss",
  "onlyfansgirls101",
  "fansly",

  // Animated/drawn
  "hentai",
  "hentai_gif",
  "rule34",
  "nsfwanimegifs",
  "ecchi",
  "ahegao",
  "futanari",
  "tentai",
  "monstergirl",

  // Furry
  "yiff",
  "furry_irl",
  "gfur",
  "sfur",

  // Celebrity
  "celebnsfw",
  "celebsnaked",
  "celebfakes",
  "jerkofftocelebs",
  "nsfwcelebarchive",
  "extramile",
  "watchitfortheplot",
  "celebritypussy",
  "celebhub",

  // Clothing/aesthetic
  "lingerie",
  "stockings",
  "thighhighs",
  "sexyfrex",
  "tanlines",
  "bikinis",
  "pokies",
  "nipslip",
  "downblouse",
  "upskirt",
  "panties",
  "pantyfetish",
  "pantiestotheside",
  "nopanties",
  "commando",
  "seethrough",
  "yoga_pants",
  "yogapants",
  "leggings",
  "girlsinyogapants",
  "tightdresses",
  "sundresses",
  "wetspot",
  "cumstained",

  // Location-based
  "holdthemoan",
  "publicflashing",
  "flashingandflaunting",
  "exhibitionism",
  "nsfwoutfits",
  "gwpublic",
  "workgonewild",
  "gonewildatwork",
  "homemade",
  "changingrooms",
  "beachgirls",
  "nudistbeach",

  // Specific fetishes
  "feet",
  "footfetish",
  "feetish",
  "pregnantporn",
  "preggoporn",
  "lactation",
  "engorgedveinybreasts",
  "tattoos",
  "altgonewild",
  "gothsluts",
  "bigtiddygothgf",
  "emogirls",
  "suicidegirls",
  "piercednsfw",
  "braces",
  "glasses",
  "girlswithglasses",
  "nerdygw",
  "cosplaybutts",
  "nsfwcosplay",
  "gwcosplay",
  "slutsofskyrim",

  // Trans
  "transporn",
  "gonewildtrans",
  "traps",
  "femboys",
  "sissies",
  "bisexy",

  // Gay/Lesbian
  "gayporn",
  "gaybros",
  "totallystraight",
  "dykesgonewild",
  "lesbians",
  "actuallesbians",
  "scissoring",

  // Male focused
  "ladybonersgw",
  "massivecock",
  "cock",
  "penis",
  "ratemycock",
  "dicklips",
  "balls",
  "menshowering",
  "broslikeus",
]);

// URL keywords that suggest NSFW content
const NSFW_URL_KEYWORDS = [
  // Direct terms
  "porn",
  "xxx",
  "nsfw",
  "adult",
  "18+",
  "18plus",
  "mature",
  "explicit",

  // Body parts
  "pussy",
  "cock",
  "dick",
  "penis",
  "vagina",
  "boobs",
  "tits",
  "titties",
  "breasts",
  "nipples",
  "ass",
  "butt",
  "anus",
  "butthole",

  // Actions
  "sex",
  "fuck",
  "fucked",
  "fucking",
  "blowjob",
  "handjob",
  "cumshot",
  "creampie",
  "anal",
  "orgasm",
  "masturbate",
  "masturbation",
  "jerkoff",
  "fap",
  "nude",
  "naked",
  "nudity",
  "nudes",

  // Categories
  "hentai",
  "milf",
  "teen",  // Context-dependent
  "amateur",
  "hardcore",
  "softcore",
  "erotic",
  "erotica",
  "fetish",
  "bdsm",
  "bondage",
  "kinky",
  "slutty",
  "slut",
  "whore",
  "hooker",
  "escort",
  "stripper",
  "camgirl",
  "webcam",
  "livecam",
  "onlyfans",
  "fansly",
  "gonewild",
];

// Title/description keywords (case-insensitive)
const NSFW_TITLE_KEYWORDS = [
  // High confidence
  "[nsfw]",
  "(nsfw)",
  "nsfw",
  "[18+]",
  "(18+)",
  "[explicit]",
  "pornstar",
  "porn star",
  "onlyfans",
  "fansly",
  "xxx",

  // Medium confidence (need context)
  "nude",
  "naked",
  "topless",
  "bottomless",
  "strip",
  "striptease",
  "lingerie",
  "bra and panties",
  "bikini",
  "thong",
  "g-string",

  // Actions
  "blowjob",
  "handjob",
  "cumshot",
  "creampie",
  "masturbating",
  "orgasm",
  "moaning",

  // Subreddit indicators
  "r/gonewild",
  "r/nsfw",
  "/gonewild",
  "/nsfw",
];

// =============================================================================
// DETECTION LOGIC
// =============================================================================

interface Item {
  id: string;
  url: string | null;
  title: string | null;
  description: string | null;
  source: string;
  source_metadata: string | null;
}

interface DetectionResult {
  status: "safe" | "nsfw" | "explicit";
  method: "domain" | "subreddit" | "url_keyword" | "title_keyword" | "safe_default";
  pattern: string | null;
  confidence: number;
}

function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function extractSubreddit(url: string): string | null {
  // Match reddit.com/r/subreddit patterns
  const match = url.match(/reddit\.com\/r\/([a-zA-Z0-9_]+)/i);
  return match ? match[1].toLowerCase() : null;
}

function detectNSFW(item: Item): DetectionResult {
  const url = item.url?.toLowerCase() ?? "";
  const title = item.title?.toLowerCase() ?? "";
  const description = item.description?.toLowerCase() ?? "";

  // 1. Check domain
  const domain = item.url ? extractDomain(item.url) : null;
  if (domain) {
    // Check explicit domains first
    if (EXPLICIT_DOMAINS.has(domain)) {
      return {
        status: "explicit",
        method: "domain",
        pattern: domain,
        confidence: 1.0,
      };
    }

    // Check NSFW domains
    if (NSFW_DOMAINS.has(domain)) {
      return {
        status: "nsfw",
        method: "domain",
        pattern: domain,
        confidence: 1.0,
      };
    }

    // Check if domain contains NSFW TLD patterns
    if (domain.endsWith(".xxx") || domain.endsWith(".porn") || domain.endsWith(".sex") || domain.endsWith(".adult")) {
      return {
        status: "nsfw",
        method: "domain",
        pattern: domain,
        confidence: 0.95,
      };
    }
  }

  // 2. Check subreddit (for Reddit sources)
  const subreddit = item.url ? extractSubreddit(item.url) : null;
  if (subreddit) {
    if (NSFW_SUBREDDITS.has(subreddit)) {
      return {
        status: "nsfw",
        method: "subreddit",
        pattern: `r/${subreddit}`,
        confidence: 1.0,
      };
    }

    // Check if subreddit name contains NSFW keywords
    for (const keyword of ["nsfw", "gonewild", "porn", "xxx", "nude", "naked", "sex"]) {
      if (subreddit.includes(keyword)) {
        return {
          status: "nsfw",
          method: "subreddit",
          pattern: `r/${subreddit} (contains: ${keyword})`,
          confidence: 0.9,
        };
      }
    }
  }

  // 3. Check URL keywords
  for (const keyword of NSFW_URL_KEYWORDS) {
    // Check URL path (not just domain)
    if (url.includes(`/${keyword}`) || url.includes(`${keyword}/`) || url.includes(`=${keyword}`) || url.includes(`-${keyword}`) || url.includes(`_${keyword}`)) {
      return {
        status: "nsfw",
        method: "url_keyword",
        pattern: keyword,
        confidence: 0.85,
      };
    }
  }

  // 4. Check title keywords
  for (const keyword of NSFW_TITLE_KEYWORDS) {
    if (title.includes(keyword.toLowerCase()) || description.includes(keyword.toLowerCase())) {
      return {
        status: "nsfw",
        method: "title_keyword",
        pattern: keyword,
        confidence: 0.8,
      };
    }
  }

  // 5. Default to safe
  return {
    status: "safe",
    method: "safe_default",
    pattern: null,
    confidence: 1.0,
  };
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

async function runMigration(db: Database): Promise<void> {
  const migrationPath = "./backend/migrations/008_nsfw_status.sql";
  const file = Bun.file(migrationPath);

  if (await file.exists()) {
    console.log("Running migration 008_nsfw_status.sql...");
    try {
      const sql = await file.text();
      // Split by semicolon and run each statement
      const statements = sql.split(";").filter(s => s.trim());
      for (const stmt of statements) {
        try {
          db.run(stmt);
        } catch (e: any) {
          // Ignore "column already exists" errors
          if (!e.message.includes("duplicate column name")) {
            console.warn(`Migration warning: ${e.message}`);
          }
        }
      }
      console.log("Migration completed.");
    } catch (e) {
      console.error("Migration error:", e);
    }
  }
}

function getItemsToCheck(db: Database, recheck: boolean, limit?: number): Item[] {
  let query = `
    SELECT id, url, title, description, source, source_metadata
    FROM items
    WHERE url IS NOT NULL AND url != ''
  `;

  if (!recheck) {
    query += ` AND (nsfw_status IS NULL OR nsfw_status = 'unknown')`;
  }

  query += ` ORDER BY synced_at DESC`;

  if (limit) {
    query += ` LIMIT ${limit}`;
  }

  return db.query(query).all() as Item[];
}

function updateItemStatus(
  db: Database,
  itemId: string,
  url: string,
  result: DetectionResult
): void {
  const now = new Date().toISOString();

  // Update item status
  db.run(
    `UPDATE items SET nsfw_status = ?, last_nsfw_check = ? WHERE id = ?`,
    [result.status, now, itemId]
  );

  // Insert check record
  db.run(
    `INSERT INTO nsfw_checks (item_id, url, status, detection_method, matched_pattern, confidence, checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [itemId, url, result.status, result.method, result.pattern, result.confidence, now]
  );
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      recheck: { type: "boolean", default: false },
      limit: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });

  const recheck = values.recheck ?? false;
  const limit = values.limit ? parseInt(values.limit, 10) : undefined;
  const dryRun = values["dry-run"] ?? false;

  console.log("\n=== NSFW Content Detection ===\n");
  console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Recheck: ${recheck}`);
  if (limit) console.log(`Limit: ${limit}`);
  console.log();

  // Open database
  const dbPath = new URL(CONFIG.dbPath, import.meta.url).pathname;
  const db = new Database(dbPath);

  // Run migration
  await runMigration(db);

  // Get items to check
  const items = getItemsToCheck(db, recheck, limit);
  console.log(`Found ${items.length} items to check\n`);

  if (items.length === 0) {
    console.log("No items to check. Use --recheck to re-check all items.");
    db.close();
    return;
  }

  // Process items
  const stats = {
    safe: 0,
    nsfw: 0,
    explicit: 0,
  };

  const nsfwItems: Array<{ item: Item; result: DetectionResult }> = [];

  console.log("Processing items...\n");

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const result = detectNSFW(item);

    stats[result.status]++;

    if (result.status !== "safe") {
      nsfwItems.push({ item, result });
    }

    if (!dryRun && item.url) {
      updateItemStatus(db, item.id, item.url, result);
    }

    // Progress every 500 items
    if ((i + 1) % 500 === 0) {
      console.log(`Processed ${i + 1}/${items.length} items...`);
    }
  }

  // Print results
  console.log("\n=== Results ===\n");
  console.log(`Total checked: ${items.length}`);
  console.log(`Safe: ${stats.safe}`);
  console.log(`NSFW: ${stats.nsfw}`);
  console.log(`Explicit: ${stats.explicit}`);

  if (nsfwItems.length > 0) {
    console.log("\n=== Detected NSFW/Explicit Content ===\n");

    // Group by detection method
    const byMethod: Record<string, typeof nsfwItems> = {};
    for (const { item, result } of nsfwItems) {
      const key = result.method;
      if (!byMethod[key]) byMethod[key] = [];
      byMethod[key].push({ item, result });
    }

    for (const [method, methodItems] of Object.entries(byMethod)) {
      console.log(`\n--- ${method.toUpperCase()} (${methodItems.length}) ---\n`);

      // Show first 10 of each category
      for (const { item, result } of methodItems.slice(0, 10)) {
        const status = result.status === "explicit" ? "EXPLICIT" : "NSFW";
        console.log(`[${status}] ${item.title?.slice(0, 60) ?? "No title"}...`);
        console.log(`  URL: ${item.url?.slice(0, 80)}...`);
        console.log(`  Pattern: ${result.pattern}`);
        console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
        console.log();
      }

      if (methodItems.length > 10) {
        console.log(`  ... and ${methodItems.length - 10} more\n`);
      }
    }
  }

  if (dryRun) {
    console.log("\n[DRY RUN] No changes were made to the database.");
  } else {
    console.log("\nDatabase updated successfully.");
  }

  db.close();
}

main().catch(console.error);
