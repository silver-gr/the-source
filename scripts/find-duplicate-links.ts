#!/usr/bin/env bun
/**
 * Duplicate Link Finder for UnifiedSaved
 *
 * Finds duplicate links using aggressive URL normalization:
 * - Removes tracking parameters (utm_*, fbclid, ref, etc.)
 * - Normalizes www/non-www
 * - Normalizes http/https
 * - Removes trailing slashes
 * - Removes URL fragments (#...)
 * - Normalizes mobile/desktop URLs (m.youtube.com -> youtube.com)
 * - Lowercases URLs
 * - Optionally checks title similarity for same-domain items
 *
 * Usage:
 *   bun run scripts/find-duplicate-links.ts [options]
 *
 * Options:
 *   --limit N           Process only N items (for testing)
 *   --output FILE       Output file path (default: duplicates-<timestamp>.json)
 *   --format FORMAT     Output format: json | csv | markdown (default: json)
 *   --min-duplicates N  Minimum duplicates to report (default: 2)
 *   --include-titles    Include title similarity checking
 *   --verbose           Show detailed progress
 */

import { Database } from "bun:sqlite";
import { parseArgs } from "util";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  dbPath: "../data/unified.db",

  // Tracking parameters to remove from URLs
  trackingParams: new Set([
    // UTM parameters
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_id",
    "utm_cid",
    // Facebook
    "fbclid",
    "fb_action_ids",
    "fb_action_types",
    "fb_source",
    "fb_ref",
    // Google
    "gclid",
    "gclsrc",
    "dclid",
    "gbraid",
    "wbraid",
    // Microsoft/Bing
    "msclkid",
    // Twitter
    "twclid",
    // TikTok
    "ttclid",
    // LinkedIn
    "li_fat_id",
    // HubSpot
    "hsa_acc",
    "hsa_cam",
    "hsa_grp",
    "hsa_ad",
    "hsa_src",
    "hsa_tgt",
    "hsa_kw",
    "hsa_mt",
    "hsa_net",
    "hsa_ver",
    // Mailchimp
    "mc_cid",
    "mc_eid",
    // Reddit
    "ref",
    "ref_source",
    "ref_campaign",
    // YouTube specific (NOT 't' or 'list' - could be essential on some sites)
    "si",
    "feature",
    "index",
    "start",
    "ab_channel",
    "pp",
    // Amazon
    "tag",
    "linkCode",
    "camp",
    "creative",
    "creativeASIN",
    "ascsubtag",
    "pd_rd_i",
    "pd_rd_r",
    "pd_rd_w",
    "pd_rd_wg",
    "pf_rd_p",
    "pf_rd_r",
    "pd_rd_m",
    "pf_rd_i",
    "pf_rd_m",
    "pf_rd_s",
    "pf_rd_t",
    // Affiliate/tracking
    "affiliate",
    "aff_id",
    "partner",
    "partner_id",
    "source",
    "campaign",
    "medium",
    // Analytics
    "_ga",
    "_gac",
    "_gl",
    "__hsfp",
    "__hssc",
    "__hstc",
    "_hsenc",
    "hsCtaTracking",
    // Misc
    "share",
    "via",
    "context",
    "igshid",
    "_t",
    "s",
    "src",
    "spm",
    "track",
    "trk",
    "trkInfo",
    "original_referer",
    "referer",
    "referrer",
    "action_object_map",
    "action_type_map",
    "action_ref_map",
    // Reddit mobile
    "utm_name",
    "share_id",
    "instanceId",
    // Hacker News
    "p",
    // News sites
    "ncid",
    "cid",
    "cmp",
    "soc_src",
    "soc_trk",
  ]),

  // Mobile to desktop domain mappings
  mobileToDesktop: {
    "m.youtube.com": "youtube.com",
    "mobile.twitter.com": "twitter.com",
    "m.twitter.com": "twitter.com",
    "m.facebook.com": "facebook.com",
    "mobile.facebook.com": "facebook.com",
    "m.reddit.com": "reddit.com",
    "i.reddit.com": "reddit.com",
    "m.imgur.com": "imgur.com",
    "m.wikipedia.org": "en.wikipedia.org",
    "en.m.wikipedia.org": "en.wikipedia.org",
    "m.wikihow.com": "wikihow.com",
    "m.imdb.com": "imdb.com",
    "m.soundcloud.com": "soundcloud.com",
    "m.twitch.tv": "twitch.tv",
    "m.aliexpress.com": "aliexpress.com",
    "m.ebay.com": "ebay.com",
    "m.yelp.com": "yelp.com",
  } as Record<string, string>,

  // Short URL domains that we could expand (future enhancement)
  shortUrlDomains: new Set([
    "bit.ly",
    "t.co",
    "tinyurl.com",
    "goo.gl",
    "ow.ly",
    "is.gd",
    "buff.ly",
    "j.mp",
    "amzn.to",
    "youtu.be",
    "redd.it",
    "v.redd.it",
    "i.redd.it",
  ]),

  // Domains that use fragments for content routing (do NOT strip fragments)
  // Exact match domains
  fragmentBasedRoutingExact: new Set([
    "groups.google.com",
    "mail.google.com",
    "github.com",
    "hashicorp.com",
    "notion.so",
    "medium.com",
    "dev.to",
    "docs.google.com",
    "drive.google.com",
  ]),
  // Suffix match domains (for subdomains like *.blogspot.com)
  fragmentBasedRoutingSuffix: [
    ".blogspot.com",
    ".blogspot.gr",
    ".wordpress.com",
    ".tumblr.com",
    ".substack.com",
  ],

  // Domain-specific essential params (never remove these for these domains)
  essentialParams: {
    "dmt-nexus.me": ["t", "g", "p"],
    "groups.google.com": ["fromgroups"],
    "youtube.com": ["v"],
    "reddit.com": [],
    "mail.google.com": ["th", "view"],
    "docs.google.com": ["d", "edit"],
    "drive.google.com": ["d"],
    "twitter.com": [],
    "x.com": [],
  } as Record<string, string[]>,

  // Special path normalizations per domain
  pathNormalizations: {
    // YouTube video/playlist normalization
    "youtube.com": (url: URL): URL => {
      // Convert /shorts/VIDEO_ID to /watch?v=VIDEO_ID
      const shortsMatch = url.pathname.match(/^\/shorts\/([^/?]+)/);
      if (shortsMatch) {
        url.pathname = "/watch";
        url.searchParams.set("v", shortsMatch[1]);
      }

      // Handle playlists - keep list param
      if (url.pathname === "/playlist") {
        const listId = url.searchParams.get("list");
        if (listId) {
          url.search = `?list=${listId}`;
        }
        return url;
      }

      // For videos, keep only the 'v' parameter
      const videoId = url.searchParams.get("v");
      if (videoId) {
        url.search = `?v=${videoId}`;
        // Don't include timestamp for duplicate detection - same video at different time is same video
      }
      return url;
    },
    // Reddit: normalize old.reddit, www.reddit, reddit
    "reddit.com": (url: URL): URL => {
      // Normalize Reddit URLs while keeping comment IDs
      // /r/sub/comments/postid/title/commentid -> /r/sub/comments/postid/commentid
      // /r/sub/comments/postid/title -> /r/sub/comments/postid
      const fullMatch = url.pathname.match(
        /^\/r\/([^/]+)\/comments\/([^/]+)(?:\/[^/]+)?(?:\/([^/]+))?/
      );
      if (fullMatch) {
        const [, subreddit, postId, commentId] = fullMatch;
        if (commentId) {
          // Has comment ID - keep it (different comments = different content)
          url.pathname = `/r/${subreddit}/comments/${postId}/${commentId}`;
        } else {
          // Just post, no comment
          url.pathname = `/r/${subreddit}/comments/${postId}`;
        }
      }
      return url;
    },
    // Twitter/X: normalize tweet URLs
    "twitter.com": (url: URL): URL => {
      // Keep only the essential path /user/status/id
      const statusMatch = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
      if (statusMatch) {
        url.pathname = `/${statusMatch[1]}/status/${statusMatch[2]}`;
      }
      return url;
    },
    "x.com": (url: URL): URL => {
      const statusMatch = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
      if (statusMatch) {
        url.pathname = `/${statusMatch[1]}/status/${statusMatch[2]}`;
      }
      return url;
    },
    // Gmail: Keep thread/view params but still normalize
    "mail.google.com": (url: URL): URL => {
      // Keep essential Gmail params
      const th = url.searchParams.get("th");
      const view = url.searchParams.get("view");
      url.search = "";
      if (th) url.searchParams.set("th", th);
      if (view) url.searchParams.set("view", view);
      return url;
    },
  } as Record<string, (url: URL) => URL>,
};

// ============================================================================
// Types
// ============================================================================

interface Item {
  id: string;
  url: string;
  title: string;
  source: string;
  saved_at: string | null;
  synced_at: string;
  created_at: string | null;
}

interface DuplicateGroup {
  normalizedUrl: string;
  items: Item[];
  count: number;
  sources: string[];
  titles: string[];
  oldestSaved: string | null;
  newestSaved: string | null;
}

interface DuplicateReport {
  generatedAt: string;
  totalItems: number;
  itemsWithUrls: number;
  uniqueNormalizedUrls: number;
  duplicateGroups: number;
  totalDuplicates: number;
  groups: DuplicateGroup[];
}

// ============================================================================
// URL Normalization
// ============================================================================

/**
 * Aggressively normalizes a URL for duplicate detection
 */
function normalizeUrl(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  try {
    // Trim and handle common issues
    let urlStr = rawUrl.trim();

    // Skip non-http URLs
    if (
      !urlStr.startsWith("http://") &&
      !urlStr.startsWith("https://") &&
      !urlStr.startsWith("//")
    ) {
      return null;
    }

    // Handle protocol-relative URLs
    if (urlStr.startsWith("//")) {
      urlStr = "https:" + urlStr;
    }

    const url = new URL(urlStr);

    // 1. Normalize protocol to https (treat http and https as same)
    url.protocol = "https:";

    // 2. Normalize hostname
    let hostname = url.hostname.toLowerCase();

    // Remove www. prefix
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }

    // Map mobile domains to desktop
    if (CONFIG.mobileToDesktop[hostname]) {
      hostname = CONFIG.mobileToDesktop[hostname];
    }

    url.hostname = hostname;

    // 3. Get base domain for configuration lookups
    const baseDomain = hostname.replace(/^old\./, "").replace(/^new\./, "");

    // 4. Get essential params for this domain (never remove these)
    const essentialParams = new Set(CONFIG.essentialParams[baseDomain] || []);

    // 5. Remove tracking parameters (but keep essential ones for this domain)
    const paramsToDelete: string[] = [];
    url.searchParams.forEach((_, key) => {
      const lowerKey = key.toLowerCase();
      // Only remove if it's a tracking param AND not essential for this domain
      if (CONFIG.trackingParams.has(lowerKey) && !essentialParams.has(lowerKey)) {
        paramsToDelete.push(key);
      }
    });
    paramsToDelete.forEach((key) => url.searchParams.delete(key));

    // 6. Apply domain-specific path normalizations
    if (CONFIG.pathNormalizations[baseDomain]) {
      CONFIG.pathNormalizations[baseDomain](url);
    }

    // 7. Sort remaining query parameters for consistency
    const sortedParams = new URLSearchParams(
      [...url.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    );
    url.search = sortedParams.toString() ? `?${sortedParams.toString()}` : "";

    // 8. Handle fragment (hash) - keep for fragment-based routing sites
    const keepFragment =
      CONFIG.fragmentBasedRoutingExact.has(baseDomain) ||
      CONFIG.fragmentBasedRoutingExact.has(hostname) ||
      CONFIG.fragmentBasedRoutingSuffix.some(suffix => hostname.endsWith(suffix));

    if (!keepFragment) {
      url.hash = "";
    }

    // 9. Normalize path
    let pathname = url.pathname;

    // Remove trailing slash (except for root)
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }

    // Normalize multiple slashes
    pathname = pathname.replace(/\/+/g, "/");

    // Decode URL-encoded characters for comparison
    try {
      pathname = decodeURIComponent(pathname);
    } catch {
      // Keep original if decode fails
    }

    url.pathname = pathname;

    // 10. Build normalized URL
    let normalized = url.toString();

    // Remove trailing slash from final URL (except for domain-only URLs)
    if (normalized.endsWith("/") && url.pathname !== "/") {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  } catch (error) {
    // Invalid URL
    return null;
  }
}

/**
 * Expand short URLs (youtu.be, redd.it, etc.) to full URLs
 */
function expandShortUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;

  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");

    // youtu.be -> youtube.com
    if (hostname === "youtu.be") {
      const videoId = url.pathname.slice(1).split("/")[0];
      if (videoId) {
        return `https://youtube.com/watch?v=${videoId}`;
      }
    }

    // redd.it -> reddit.com (short post links)
    if (hostname === "redd.it") {
      const postId = url.pathname.slice(1);
      if (postId) {
        return `https://reddit.com/comments/${postId}`;
      }
    }

    // For other short URLs, we'd need to actually fetch them
    // For now, return as-is
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

/**
 * Calculate simple title similarity (Jaccard similarity of words)
 */
function titleSimilarity(title1: string, title2: string): number {
  if (!title1 || !title2) return 0;

  const words1 = new Set(
    title1
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
  const words2 = new Set(
    title2
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

// ============================================================================
// Main Logic
// ============================================================================

async function findDuplicates(options: {
  limit?: number;
  minDuplicates: number;
  includeTitles: boolean;
  verbose: boolean;
}): Promise<DuplicateReport> {
  const db = new Database(CONFIG.dbPath, { readonly: true });

  console.log("📚 Loading items from database...");

  // Query all items with URLs
  let query = `
    SELECT id, url, title, source, saved_at, synced_at, created_at
    FROM items
    WHERE url IS NOT NULL AND url != ''
    ORDER BY saved_at DESC
  `;

  if (options.limit) {
    query += ` LIMIT ${options.limit}`;
  }

  const items = db.query(query).all() as Item[];
  console.log(`   Found ${items.length} items with URLs`);

  // Group by normalized URL
  console.log("🔗 Normalizing URLs...");
  const urlGroups = new Map<string, Item[]>();
  let normalizedCount = 0;
  let failedCount = 0;

  for (const item of items) {
    // First expand short URLs
    const expandedUrl = expandShortUrl(item.url);

    // Then normalize
    const normalized = normalizeUrl(expandedUrl);

    if (normalized) {
      const existing = urlGroups.get(normalized) || [];
      existing.push(item);
      urlGroups.set(normalized, existing);
      normalizedCount++;
    } else {
      failedCount++;
      if (options.verbose) {
        console.log(`   ⚠️ Failed to normalize: ${item.url}`);
      }
    }
  }

  console.log(`   Normalized ${normalizedCount} URLs (${failedCount} failed)`);
  console.log(`   Unique normalized URLs: ${urlGroups.size}`);

  // Find duplicates
  console.log("🔍 Finding duplicates...");
  const duplicateGroups: DuplicateGroup[] = [];

  for (const [normalizedUrl, groupItems] of urlGroups) {
    if (groupItems.length >= options.minDuplicates) {
      // Sort by saved_at (oldest first)
      groupItems.sort((a, b) => {
        const dateA = a.saved_at || a.synced_at;
        const dateB = b.saved_at || b.synced_at;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });

      const sources = [...new Set(groupItems.map((i) => i.source))];
      const titles = [...new Set(groupItems.map((i) => i.title))];
      const dates = groupItems
        .map((i) => i.saved_at || i.synced_at)
        .filter(Boolean)
        .sort();

      duplicateGroups.push({
        normalizedUrl,
        items: groupItems,
        count: groupItems.length,
        sources,
        titles,
        oldestSaved: dates[0] || null,
        newestSaved: dates[dates.length - 1] || null,
      });
    }
  }

  // Sort duplicate groups by count (most duplicates first)
  duplicateGroups.sort((a, b) => b.count - a.count);

  console.log(`   Found ${duplicateGroups.length} duplicate groups`);

  // Calculate total duplicates (items that could be removed)
  const totalDuplicates = duplicateGroups.reduce(
    (sum, g) => sum + (g.count - 1),
    0
  );
  console.log(`   Total duplicate items: ${totalDuplicates}`);

  db.close();

  return {
    generatedAt: new Date().toISOString(),
    totalItems: items.length,
    itemsWithUrls: items.length,
    uniqueNormalizedUrls: urlGroups.size,
    duplicateGroups: duplicateGroups.length,
    totalDuplicates,
    groups: duplicateGroups,
  };
}

/**
 * Format report as JSON
 */
function formatJson(report: DuplicateReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Format report as CSV
 */
function formatCsv(report: DuplicateReport): string {
  const lines: string[] = [
    "normalized_url,duplicate_count,sources,item_ids,titles,oldest_saved,newest_saved",
  ];

  for (const group of report.groups) {
    const ids = group.items.map((i) => i.id).join(";");
    const titles = group.titles.map((t) => t.replace(/"/g, '""')).join(";");
    const escapedUrl = group.normalizedUrl.replace(/"/g, '""');
    const sources = group.sources.join(";");

    lines.push(
      `"${escapedUrl}",${group.count},"${sources}","${ids}","${titles}","${group.oldestSaved || ""}","${group.newestSaved || ""}"`
    );
  }

  return lines.join("\n");
}

/**
 * Format report as Markdown
 */
function formatMarkdown(report: DuplicateReport): string {
  const lines: string[] = [
    "# Duplicate Links Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Total items with URLs: ${report.itemsWithUrls}`,
    `- Unique normalized URLs: ${report.uniqueNormalizedUrls}`,
    `- Duplicate groups: ${report.duplicateGroups}`,
    `- Total duplicate items: ${report.totalDuplicates}`,
    "",
    "## Duplicate Groups",
    "",
  ];

  for (const group of report.groups) {
    lines.push(`### ${group.count}x duplicates`);
    lines.push("");
    lines.push(`**Normalized URL:** \`${group.normalizedUrl}\``);
    lines.push(`**Sources:** ${group.sources.join(", ")}`);
    lines.push(`**Date range:** ${group.oldestSaved} → ${group.newestSaved}`);
    lines.push("");
    lines.push("| ID | Source | Title | Saved At |");
    lines.push("|---|---|---|---|");

    for (const item of group.items) {
      const title = item.title.replace(/\|/g, "\\|").slice(0, 60);
      const date = (item.saved_at || item.synced_at || "").slice(0, 10);
      lines.push(`| ${item.id} | ${item.source} | ${title} | ${date} |`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      limit: { type: "string" },
      output: { type: "string" },
      format: { type: "string", default: "json" },
      "min-duplicates": { type: "string", default: "2" },
      "include-titles": { type: "boolean", default: false },
      verbose: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });

  if (values.help) {
    console.log(`
Duplicate Link Finder for UnifiedSaved

Usage:
  bun run scripts/find-duplicate-links.ts [options]

Options:
  --limit N           Process only N items (for testing)
  --output FILE       Output file path (default: duplicates-<timestamp>.json)
  --format FORMAT     Output format: json | csv | markdown (default: json)
  --min-duplicates N  Minimum duplicates to report (default: 2)
  --include-titles    Include title similarity checking
  --verbose           Show detailed progress
  --help              Show this help message
`);
    process.exit(0);
  }

  console.log("🔍 UnifiedSaved Duplicate Link Finder");
  console.log("=====================================\n");

  const options = {
    limit: values.limit ? parseInt(values.limit, 10) : undefined,
    minDuplicates: parseInt(values["min-duplicates"] || "2", 10),
    includeTitles: values["include-titles"] || false,
    verbose: values.verbose || false,
  };

  // Find duplicates
  const report = await findDuplicates(options);

  // Format output
  const format = (values.format || "json").toLowerCase();
  let output: string;
  let extension: string;

  switch (format) {
    case "csv":
      output = formatCsv(report);
      extension = "csv";
      break;
    case "markdown":
    case "md":
      output = formatMarkdown(report);
      extension = "md";
      break;
    case "json":
    default:
      output = formatJson(report);
      extension = "json";
      break;
  }

  // Determine output file
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "");
  const defaultFilename = `duplicates-${timestamp}.${extension}`;
  const outputPath = values.output || path.join(".", defaultFilename);

  // Write to file
  fs.writeFileSync(outputPath, output);
  console.log(`\n✅ Report saved to: ${outputPath}`);

  // Print summary
  console.log("\n📊 Summary:");
  console.log(`   Total items: ${report.totalItems}`);
  console.log(`   Unique URLs: ${report.uniqueNormalizedUrls}`);
  console.log(`   Duplicate groups: ${report.duplicateGroups}`);
  console.log(`   Total duplicates: ${report.totalDuplicates}`);

  // Show top duplicates
  if (report.groups.length > 0) {
    console.log("\n🔝 Top duplicate groups:");
    const topGroups = report.groups.slice(0, 10);
    for (const group of topGroups) {
      const shortUrl =
        group.normalizedUrl.length > 60
          ? group.normalizedUrl.slice(0, 57) + "..."
          : group.normalizedUrl;
      console.log(`   ${group.count}x: ${shortUrl}`);
    }
  }
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
