#!/usr/bin/env bun
/**
 * Broken Link Checker for UnifiedSaved
 *
 * Features:
 * - Groups URLs by domain for intelligent rate limiting
 * - Per-domain rate limiting (configurable req/sec)
 * - Concurrent request limits with domain awareness
 * - GET requests with proper timeouts (not HEAD - more reliable)
 * - Follows redirects and tracks final URL
 * - Retry logic for transient failures
 * - Soft 404 detection (200 status but error content)
 * - Comprehensive error categorization
 * - Progress tracking with ETA
 * - Results stored in SQLite for historical tracking
 *
 * Usage:
 *   bun run scripts/check-broken-links.ts [options]
 *
 * Options:
 *   --dry-run       Don't write to database, just report
 *   --limit N       Check only N links (for testing)
 *   --domain D      Check only links from domain D
 *   --recheck       Re-check links even if recently checked
 *   --verbose       Show detailed progress
 *   --concurrency N Max concurrent requests (default: 30)
 */

import { Database } from "bun:sqlite";
import { parseArgs } from "util";

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Database path
  dbPath: "../data/unified.db",

  // Request settings
  timeout: 15000, // 15 seconds per request
  maxRedirects: 10, // Maximum redirects to follow
  retryAttempts: 2, // Number of retries for transient errors
  retryDelay: 5000, // Delay between retries (ms) - longer to be polite

  // Rate limiting - conservative to avoid blocks
  defaultConcurrency: 20, // Global concurrent requests (reduced from 30)
  requestsPerDomainPerSecond: 1, // Rate limit per domain (reduced from 2)
  domainConcurrency: 2, // Max concurrent requests per domain (reduced from 3)

  // Skip re-checking if checked within this period
  recheckAfterDays: 7,

  // Domains to SKIP - these block automated requests without authentication
  // Links from these domains are assumed valid since they were synced successfully
  skipDomains: new Set([
    // Reddit - requires authentication for most content
    "reddit.com",
    "www.reddit.com",
    "old.reddit.com",
    "i.redd.it",
    "v.redd.it",

    // YouTube - aggressive bot detection
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
    "m.youtube.com",

    // Hacker News - rate limits aggressively
    "news.ycombinator.com",

    // Twitter/X - requires auth
    "twitter.com",
    "x.com",
    "mobile.twitter.com",

    // Instagram - requires auth
    "instagram.com",
    "www.instagram.com",

    // Facebook - requires auth
    "facebook.com",
    "www.facebook.com",
    "m.facebook.com",

    // TikTok - aggressive bot detection
    "tiktok.com",
    "www.tiktok.com",
    "vm.tiktok.com",

    // LinkedIn - requires auth
    "linkedin.com",
    "www.linkedin.com",

    // Sites that block scrapers
    "spankbang.com",  // Blocks all requests
    "www.spankbang.com",
    "fetlife.com",    // Requires login for all content
    "www.fetlife.com",
  ]),

  // Patterns that indicate login is required (results in "login_required" status)
  loginRequiredPatterns: [
    /sign.?in.*required/i,
    /log.?in.*required/i,
    /please.*(sign|log).?in/i,
    /must.*(sign|log).?in/i,
    /you.*(need|must).*(sign|log).?in/i,
    /authentication.*required/i,
    /access.*denied.*login/i,
    /members?.?only/i,
    /create.*account.*to/i,
    /join.*to.*view/i,
  ],

  // Soft 404 detection patterns (case-insensitive)
  soft404Patterns: [
    /page not found/i,
    /404.*not found/i,
    /this page (doesn't|does not) exist/i,
    /content.*unavailable/i,
    /sorry.*couldn't find/i,
    /oops.*wrong/i,
    /no longer available/i,
    /has been (removed|deleted)/i,
    /account.*suspended/i,
    /this video is (unavailable|private)/i,
    /video.*removed/i,
  ],

  // User agent to use
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

// ============================================================================
// Types
// ============================================================================

interface Item {
  id: string;
  url: string;
  title: string;
  source: string;
}

interface CheckResult {
  itemId: string;
  url: string;
  status: LinkStatus;
  httpStatus: number | null;
  finalUrl: string | null;
  redirectCount: number;
  errorType: string | null;
  errorMessage: string | null;
  responseTimeMs: number | null;
  isSoft404: boolean;
  contentLength: number | null;
}

type LinkStatus =
  | "ok"
  | "broken"
  | "redirect"
  | "timeout"
  | "dns_error"
  | "ssl_error"
  | "connection_error"
  | "blocked"
  | "login_required"
  | "unknown";

interface DomainStats {
  domain: string;
  total: number;
  checked: number;
  ok: number;
  broken: number;
  lastRequestTime: number;
  activeRequests: number;
}

// ============================================================================
// Progress Tracking
// ============================================================================

class ProgressTracker {
  private startTime: number;
  private total: number;
  private checked: number = 0;
  private ok: number = 0;
  private broken: number = 0;
  private errors: number = 0;
  private verbose: boolean;

  constructor(total: number, verbose: boolean = false) {
    this.startTime = Date.now();
    this.total = total;
    this.verbose = verbose;
  }

  update(result: CheckResult) {
    this.checked++;
    if (result.status === "ok") this.ok++;
    else if (result.status === "broken" || result.isSoft404) this.broken++;
    else this.errors++;

    if (this.verbose || this.checked % 50 === 0 || this.checked === this.total) {
      this.printProgress(result);
    }
  }

  private printProgress(lastResult: CheckResult) {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = this.checked / elapsed;
    const remaining = (this.total - this.checked) / rate;
    const eta = this.formatTime(remaining);

    const statusIcon = this.getStatusIcon(lastResult);
    const percent = ((this.checked / this.total) * 100).toFixed(1);

    console.log(
      `[${percent}%] ${this.checked}/${this.total} | ` +
        `✓${this.ok} ✗${this.broken} ?${this.errors} | ` +
        `${rate.toFixed(1)}/s | ETA: ${eta} | ` +
        `${statusIcon} ${this.truncate(lastResult.url, 50)}`
    );
  }

  private getStatusIcon(result: CheckResult): string {
    if (result.status === "ok" && !result.isSoft404) return "✅";
    if (result.status === "broken" || result.isSoft404) return "❌";
    if (result.status === "login_required") return "🔐";
    if (result.status === "timeout") return "⏱️";
    if (result.status === "redirect") return "↪️";
    return "⚠️";
  }

  private truncate(str: string, len: number): string {
    return str.length > len ? str.slice(0, len - 3) + "..." : str;
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  }

  printSummary() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    console.log("\n" + "=".repeat(60));
    console.log("📊 LINK CHECK SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total checked: ${this.checked}`);
    console.log(`✅ OK: ${this.ok} (${((this.ok / this.checked) * 100).toFixed(1)}%)`);
    console.log(`❌ Broken: ${this.broken} (${((this.broken / this.checked) * 100).toFixed(1)}%)`);
    console.log(`⚠️ Errors: ${this.errors} (${((this.errors / this.checked) * 100).toFixed(1)}%)`);
    console.log(`⏱️ Time: ${this.formatTime(elapsed)}`);
    console.log(`📈 Rate: ${(this.checked / elapsed).toFixed(1)} links/sec`);
    console.log("=".repeat(60));
  }
}

// ============================================================================
// Domain Rate Limiter
// ============================================================================

class DomainRateLimiter {
  private domains: Map<string, DomainStats> = new Map();
  private requestsPerSecond: number;
  private maxConcurrentPerDomain: number;

  constructor(
    requestsPerSecond: number = CONFIG.requestsPerDomainPerSecond,
    maxConcurrentPerDomain: number = CONFIG.domainConcurrency
  ) {
    this.requestsPerSecond = requestsPerSecond;
    this.maxConcurrentPerDomain = maxConcurrentPerDomain;
  }

  async acquire(url: string): Promise<void> {
    const domain = this.extractDomain(url);
    let stats = this.domains.get(domain);

    if (!stats) {
      stats = {
        domain,
        total: 0,
        checked: 0,
        ok: 0,
        broken: 0,
        lastRequestTime: 0,
        activeRequests: 0,
      };
      this.domains.set(domain, stats);
    }

    // Wait for domain concurrency slot
    while (stats.activeRequests >= this.maxConcurrentPerDomain) {
      await Bun.sleep(100);
    }

    // Rate limiting: ensure minimum time between requests
    const minInterval = 1000 / this.requestsPerSecond;
    const timeSinceLast = Date.now() - stats.lastRequestTime;
    if (timeSinceLast < minInterval) {
      await Bun.sleep(minInterval - timeSinceLast);
    }

    stats.activeRequests++;
    stats.lastRequestTime = Date.now();
  }

  release(url: string, result: CheckResult) {
    const domain = this.extractDomain(url);
    const stats = this.domains.get(domain);
    if (stats) {
      stats.activeRequests--;
      stats.checked++;
      if (result.status === "ok" && !result.isSoft404) stats.ok++;
      else stats.broken++;
    }
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return "unknown";
    }
  }

  getStats(): DomainStats[] {
    return Array.from(this.domains.values()).sort((a, b) => b.broken - a.broken);
  }
}

// ============================================================================
// Domain Skip Helper
// ============================================================================

function shouldSkipUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    // Check if hostname matches any skip domain (or is a subdomain of it)
    for (const skipDomain of CONFIG.skipDomains) {
      if (hostname === skipDomain || hostname.endsWith(`.${skipDomain}`)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "unknown";
  }
}

// ============================================================================
// Link Checker
// ============================================================================

async function checkLink(
  item: Item,
  rateLimiter: DomainRateLimiter,
  attempt: number = 1
): Promise<CheckResult> {
  const startTime = Date.now();

  const baseResult: CheckResult = {
    itemId: item.id,
    url: item.url,
    status: "unknown",
    httpStatus: null,
    finalUrl: null,
    redirectCount: 0,
    errorType: null,
    errorMessage: null,
    responseTimeMs: null,
    isSoft404: false,
    contentLength: null,
  };

  if (!item.url) {
    return {
      ...baseResult,
      status: "broken",
      errorType: "no_url",
      errorMessage: "Item has no URL",
    };
  }

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(item.url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return {
        ...baseResult,
        status: "broken",
        errorType: "invalid_protocol",
        errorMessage: `Unsupported protocol: ${parsedUrl.protocol}`,
      };
    }
  } catch {
    return {
      ...baseResult,
      status: "broken",
      errorType: "invalid_url",
      errorMessage: "Invalid URL format",
    };
  }

  // Acquire rate limit slot
  await rateLimiter.acquire(item.url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

    const response = await fetch(item.url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": CONFIG.userAgent,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
      },
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;
    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
    const finalUrl = response.url !== item.url ? response.url : null;

    // Calculate redirect count (approximate)
    const redirectCount = response.redirected ? 1 : 0; // Fetch API doesn't expose exact count

    // Check for soft 404 and login required pages
    let isSoft404 = false;
    let isLoginRequired = false;
    if (response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        try {
          const text = await response.text();
          isSoft404 = CONFIG.soft404Patterns.some((pattern) => pattern.test(text));
          // Check for login required patterns (only if not already a soft 404)
          if (!isSoft404) {
            isLoginRequired = CONFIG.loginRequiredPatterns.some((pattern) => pattern.test(text));
            // Also check if redirected to a login page
            if (!isLoginRequired && finalUrl) {
              isLoginRequired = /\/(login|signin|sign-in|auth|authenticate)/i.test(finalUrl);
            }
          }
        } catch {
          // Ignore read errors for detection
        }
      }
    }

    let status: LinkStatus = "ok";
    let errorType: string | null = null;
    let errorMessage: string | null = null;

    if (response.status >= 400) {
      status = "broken";
      errorType = `http_${response.status}`;
      errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    } else if (response.status >= 300) {
      status = "redirect";
      errorMessage = `Redirect to ${finalUrl}`;
    } else if (isLoginRequired) {
      status = "login_required";
      errorType = "login_required";
      errorMessage = "Content requires login/authentication";
    }

    const result: CheckResult = {
      ...baseResult,
      status,
      httpStatus: response.status,
      finalUrl,
      redirectCount,
      errorType,
      errorMessage,
      responseTimeMs: responseTime,
      isSoft404,
      contentLength,
    };

    rateLimiter.release(item.url, result);
    return result;
  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;
    let status: LinkStatus = "unknown";
    let errorType: string | null = null;
    let errorMessage: string | null = null;

    if (error instanceof Error) {
      const errMsg = error.message.toLowerCase();
      const errName = error.name.toLowerCase();

      if (errName === "aborterror" || errMsg.includes("abort") || errMsg.includes("timeout")) {
        status = "timeout";
        errorType = "timeout";
        errorMessage = `Request timed out after ${CONFIG.timeout}ms`;
      } else if (
        errMsg.includes("dns") ||
        errMsg.includes("getaddrinfo") ||
        errMsg.includes("enotfound")
      ) {
        status = "dns_error";
        errorType = "dns_error";
        errorMessage = "DNS resolution failed";
      } else if (
        errMsg.includes("ssl") ||
        errMsg.includes("certificate") ||
        errMsg.includes("cert")
      ) {
        status = "ssl_error";
        errorType = "ssl_error";
        errorMessage = `SSL/TLS error: ${error.message}`;
      } else if (
        errMsg.includes("econnrefused") ||
        errMsg.includes("econnreset") ||
        errMsg.includes("connection")
      ) {
        status = "connection_error";
        errorType = "connection_error";
        errorMessage = `Connection error: ${error.message}`;
      } else if (errMsg.includes("403") || errMsg.includes("forbidden") || errMsg.includes("blocked")) {
        status = "blocked";
        errorType = "blocked";
        errorMessage = "Access blocked or forbidden";
      } else {
        status = "unknown";
        errorType = "unknown";
        errorMessage = error.message;
      }
    }

    const result: CheckResult = {
      ...baseResult,
      status,
      errorType,
      errorMessage,
      responseTimeMs: responseTime,
    };

    rateLimiter.release(item.url, result);

    // Retry for transient errors
    if (
      attempt < CONFIG.retryAttempts &&
      ["timeout", "connection_error", "unknown"].includes(status)
    ) {
      await Bun.sleep(CONFIG.retryDelay * attempt);
      return checkLink(item, rateLimiter, attempt + 1);
    }

    return result;
  }
}

// ============================================================================
// Database Operations
// ============================================================================

function getDb(): Database {
  const dbPath = new URL(CONFIG.dbPath, import.meta.url).pathname;
  return new Database(dbPath);
}

async function runMigrations(db: Database) {
  const migrations = [
    "../backend/migrations/006_link_checks.sql",
    "../backend/migrations/007_link_status.sql",
  ];

  for (const migrationFile of migrations) {
    const migrationPath = new URL(migrationFile, import.meta.url).pathname;
    const migration = await Bun.file(migrationPath).text();
    const fileName = migrationFile.split("/").pop();

    try {
      db.exec(migration);
      console.log(`✅ ${fileName} applied`);
    } catch (error) {
      // Table/column might already exist - this is expected on subsequent runs
      if (
        error instanceof Error &&
        (error.message.includes("already exists") || error.message.includes("duplicate column"))
      ) {
        console.log(`ℹ️ ${fileName} already applied`);
      } else {
        console.warn(`⚠️ ${fileName} warning:`, error);
      }
    }
  }
}

function getItemsToCheck(
  db: Database,
  options: { limit?: number; domain?: string; recheck: boolean }
): Item[] {
  let query = `
    SELECT i.id, i.url, i.title, i.source
    FROM items i
    WHERE i.url IS NOT NULL AND i.url != ''
  `;

  const params: (string | number)[] = [];

  // Filter by domain if specified
  if (options.domain) {
    query += ` AND i.url LIKE ?`;
    params.push(`%${options.domain}%`);
  }

  // Skip recently checked unless recheck is true
  if (!options.recheck) {
    query += `
      AND NOT EXISTS (
        SELECT 1 FROM link_checks lc
        WHERE lc.item_id = i.id
        AND lc.checked_at > datetime('now', ?)
      )
    `;
    params.push(`-${CONFIG.recheckAfterDays} days`);
  }

  query += ` ORDER BY i.saved_at DESC`;

  if (options.limit) {
    query += ` LIMIT ?`;
    params.push(options.limit);
  }

  const stmt = db.prepare(query);
  return stmt.all(...params) as Item[];
}

function saveResult(db: Database, result: CheckResult) {
  // Save detailed check result
  const insertStmt = db.prepare(`
    INSERT INTO link_checks (
      item_id, url, status, http_status, final_url, redirect_count,
      error_type, error_message, response_time_ms, checked_at,
      is_soft_404, content_length
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
  `);

  insertStmt.run(
    result.itemId,
    result.url,
    result.status,
    result.httpStatus,
    result.finalUrl,
    result.redirectCount,
    result.errorType,
    result.errorMessage,
    result.responseTimeMs,
    result.isSoft404 ? 1 : 0,
    result.contentLength
  );

  // Update item's link_status for quick filtering
  // login_required is stored as-is (not broken, content exists but needs auth)
  let linkStatus: string;
  if (result.isSoft404 || result.status === "broken") {
    linkStatus = "broken";
  } else if (result.status === "ok") {
    linkStatus = "ok";
  } else if (result.status === "login_required") {
    linkStatus = "login_required";
  } else {
    linkStatus = "broken";  // timeout, dns_error, etc. = treat as broken
  }

  const updateStmt = db.prepare(`
    UPDATE items
    SET link_status = ?, last_link_check = datetime('now')
    WHERE id = ?
  `);

  updateStmt.run(linkStatus, result.itemId);
}

function printBrokenLinksReport(db: Database) {
  console.log("\n" + "=".repeat(60));
  console.log("🔗 BROKEN LINKS REPORT");
  console.log("=".repeat(60));

  // Get broken links from latest checks
  const broken = db
    .prepare(
      `
    SELECT
      i.id, i.title, i.url, i.source,
      lc.status, lc.http_status, lc.error_message, lc.is_soft_404
    FROM items i
    JOIN latest_link_checks lc ON i.id = lc.item_id
    WHERE lc.status IN ('broken', 'timeout', 'dns_error', 'ssl_error', 'connection_error')
       OR lc.is_soft_404 = 1
    ORDER BY lc.status, i.source
  `
    )
    .all() as Array<{
    id: string;
    title: string;
    url: string;
    source: string;
    status: string;
    http_status: number | null;
    error_message: string | null;
    is_soft_404: number;
  }>;

  if (broken.length === 0) {
    console.log("🎉 No broken links found!");
    return;
  }

  console.log(`Found ${broken.length} broken links:\n`);

  // Group by status
  const byStatus = broken.reduce(
    (acc, item) => {
      const key = item.is_soft_404 ? "soft_404" : item.status;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, typeof broken>
  );

  for (const [status, items] of Object.entries(byStatus)) {
    console.log(`\n--- ${status.toUpperCase()} (${items.length}) ---`);
    for (const item of items.slice(0, 20)) {
      // Limit output
      console.log(`  [${item.source}] ${item.title?.slice(0, 50) || "No title"}`);
      console.log(`    URL: ${item.url}`);
      if (item.error_message) {
        console.log(`    Error: ${item.error_message}`);
      }
    }
    if (items.length > 20) {
      console.log(`  ... and ${items.length - 20} more`);
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const { values: args } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "dry-run": { type: "boolean", default: false },
      limit: { type: "string" },
      domain: { type: "string" },
      recheck: { type: "boolean", default: false },
      verbose: { type: "boolean", default: false },
      concurrency: { type: "string" },
      help: { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  if (args.help) {
    console.log(`
Broken Link Checker for UnifiedSaved

Usage: bun run scripts/check-broken-links.ts [options]

Options:
  --dry-run       Don't write to database, just report
  --limit N       Check only N links (for testing)
  --domain D      Check only links containing domain D
  --recheck       Re-check links even if recently checked
  --verbose       Show detailed progress for each link
  --concurrency N Max concurrent requests (default: 30)
  --help          Show this help message
    `);
    process.exit(0);
  }

  console.log("🔍 UnifiedSaved Broken Link Checker\n");

  const db = getDb();

  // Run migrations
  await runMigrations(db);

  // Get items to check
  const allItems = getItemsToCheck(db, {
    limit: args.limit ? parseInt(args.limit, 10) : undefined,
    domain: args.domain,
    recheck: args.recheck ?? false,
  });

  // Separate items into checkable and skipped (blocked domains)
  const items: Item[] = [];
  const skippedItems: Item[] = [];
  const skippedByDomain: Map<string, number> = new Map();

  for (const item of allItems) {
    if (shouldSkipUrl(item.url)) {
      skippedItems.push(item);
      const hostname = extractHostname(item.url);
      skippedByDomain.set(hostname, (skippedByDomain.get(hostname) || 0) + 1);
    } else {
      items.push(item);
    }
  }

  if (allItems.length === 0) {
    console.log("No items to check. All links were checked recently.");
    console.log("Use --recheck to force re-checking all links.");
    process.exit(0);
  }

  console.log(`📋 Found ${allItems.length} total links`);
  console.log(`  ✅ ${items.length} links to check`);
  console.log(`  ⏭️  ${skippedItems.length} links skipped (blocked domains)`);

  if (skippedByDomain.size > 0) {
    console.log("\n📊 Skipped domains (require auth/block bots):");
    const sorted = [...skippedByDomain.entries()].sort((a, b) => b[1] - a[1]);
    for (const [domain, count] of sorted.slice(0, 10)) {
      console.log(`  ${domain}: ${count} links`);
    }
    if (sorted.length > 10) {
      console.log(`  ... and ${sorted.length - 10} more domains`);
    }
    console.log();
  }

  if (items.length === 0) {
    console.log("No checkable items after filtering blocked domains.");
    process.exit(0);
  }
  if (args["dry-run"]) {
    console.log("🏃 DRY RUN - results will NOT be saved to database\n");
  }

  const concurrency = args.concurrency ? parseInt(args.concurrency, 10) : CONFIG.defaultConcurrency;
  const rateLimiter = new DomainRateLimiter();
  const progress = new ProgressTracker(items.length, args.verbose ?? false);

  // Process items with concurrency control
  const semaphore = { count: 0 };
  const results: CheckResult[] = [];

  async function processItem(item: Item) {
    while (semaphore.count >= concurrency) {
      await Bun.sleep(50);
    }
    semaphore.count++;

    try {
      const result = await checkLink(item, rateLimiter);
      results.push(result);
      progress.update(result);

      if (!args["dry-run"]) {
        saveResult(db, result);
      }
    } finally {
      semaphore.count--;
    }
  }

  // Start all checks (they will self-throttle via semaphore and rate limiter)
  await Promise.all(items.map(processItem));

  // Print summary
  progress.printSummary();

  // Print domain statistics
  const domainStats = rateLimiter.getStats();
  const problematicDomains = domainStats.filter((d) => d.broken > 0);
  if (problematicDomains.length > 0) {
    console.log("\n📊 Domains with broken links:");
    for (const d of problematicDomains.slice(0, 10)) {
      const brokenPct = ((d.broken / d.checked) * 100).toFixed(0);
      console.log(`  ${d.domain}: ${d.broken}/${d.checked} broken (${brokenPct}%)`);
    }
  }

  // Print broken links report
  if (!args["dry-run"]) {
    printBrokenLinksReport(db);
  }

  db.close();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
