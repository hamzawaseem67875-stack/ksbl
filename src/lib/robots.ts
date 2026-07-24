/**
 * lib/robots.ts
 *
 * Minimal robots.txt compliance check for the scraper (src/app/api/scraper/*).
 * Hand-rolled rather than a dependency — the scraper only needs a simple
 * "is this path disallowed for our user-agent (or *)" check, not full RFC 9309
 * support (crawl-delay, sitemaps, wildcards beyond prefix matching, etc).
 *
 * Convention: a missing/unreachable robots.txt means "allowed" (fail-open —
 * the standard interpretation when a site publishes no robots.txt at all).
 * An explicit Disallow rule that matches means "not allowed" (fail-closed).
 */

interface RobotsRule {
  path: string;
  allow: boolean;
}

interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
}

function parseRobotsTxt(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;

    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();
    if (!value && key !== "disallow") continue;

    if (key === "user-agent") {
      // A new User-agent line starts a fresh group UNLESS it directly follows
      // another User-agent line (multiple agents sharing one rule set).
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (key === "disallow" && current) {
      if (value) current.rules.push({ path: value, allow: false });
    } else if (key === "allow" && current) {
      current.rules.push({ path: value, allow: true });
    }
  }

  return groups;
}

function selectGroup(groups: RobotsGroup[], userAgent: string): RobotsGroup | null {
  const ua = userAgent.toLowerCase();
  const specific = groups.find((g) => g.agents.some((a) => a !== "*" && ua.includes(a)));
  if (specific) return specific;
  return groups.find((g) => g.agents.includes("*")) ?? null;
}

function isPathAllowed(group: RobotsGroup | null, path: string): boolean {
  if (!group || group.rules.length === 0) return true;

  // Longest matching prefix wins (standard robots.txt precedence).
  let best: RobotsRule | null = null;
  for (const rule of group.rules) {
    if (rule.path === "") continue; // "Disallow:" with empty value = allow all
    if (path.startsWith(rule.path)) {
      if (!best || rule.path.length > best.path.length) best = rule;
    }
  }

  return best ? best.allow : true;
}

/**
 * Check whether `targetUrl` may be scraped, per its origin's robots.txt.
 * Fails open (returns true) if robots.txt is missing or unreachable.
 */
export async function isScrapingAllowed(
  targetUrl: string,
  userAgent: string
): Promise<boolean> {
  try {
    const target = new URL(targetUrl);
    const robotsUrl = `${target.origin}/robots.txt`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(robotsUrl, {
      headers: { "User-Agent": userAgent },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return true; // no robots.txt published — fail open

    const text = await res.text();
    const groups = parseRobotsTxt(text);
    const group = selectGroup(groups, userAgent);

    return isPathAllowed(group, target.pathname);
  } catch (err) {
    console.warn(`[Robots] Could not check robots.txt for ${targetUrl}, allowing by default:`, err);
    return true;
  }
}
