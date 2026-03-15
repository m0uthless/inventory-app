import fs from "node:fs";

const auditPath = process.argv[2];
if (!auditPath) {
  console.error("Usage: node scripts/_parse_npm_audit.mjs <audit.json>");
  process.exit(2);
}

let raw = "";
try {
  raw = fs.readFileSync(auditPath, "utf8");
} catch (e) {
  console.error("[audit] could not read audit json:", e?.message ?? String(e));
  process.exit(2);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error("[audit] invalid JSON from npm audit:", e?.message ?? String(e));
  process.exit(2);
}

// npm v7+ format
const meta = data?.metadata?.vulnerabilities ?? {};
const summary = {
  critical: meta.critical ?? 0,
  high: meta.high ?? 0,
  moderate: meta.moderate ?? 0,
  low: meta.low ?? 0,
  info: meta.info ?? 0,
};

console.log(`[audit] summary: critical=${summary.critical} high=${summary.high} moderate=${summary.moderate} low=${summary.low} info=${summary.info}`);

// Print HIGH/CRITICAL details if available
const vulns = data?.vulnerabilities ?? {};
const severities = new Set(["high", "critical"]);

const lines = [];
for (const [name, v] of Object.entries(vulns)) {
  const sev = v?.severity;
  if (!severities.has(sev)) continue;

  const title = v?.title || v?.via?.find?.((x) => typeof x === "object")?.title || "";
  const url = v?.url || v?.via?.find?.((x) => typeof x === "object")?.url || "";
  const via = Array.isArray(v?.via)
    ? v.via
        .map((x) => (typeof x === "string" ? x : x?.source ? `${x.source}` : ""))
        .filter(Boolean)
        .slice(0, 6)
        .join(" -> ")
    : "";

  lines.push({
    sev,
    name,
    title,
    url,
    via,
    range: v?.range || "",
    fixAvailable: v?.fixAvailable ?? false,
  });
}

if (lines.length) {
  console.log("[audit] HIGH/CRITICAL:");
  for (const it of lines.sort((a, b) => (a.sev === b.sev ? a.name.localeCompare(b.name) : a.sev === "critical" ? -1 : 1))) {
    const fix = typeof it.fixAvailable === "object" ? `fixAvailable=${it.fixAvailable.name}@${it.fixAvailable.version}` : `fixAvailable=${it.fixAvailable}`;
    console.log(`- ${it.sev.toUpperCase()} ${it.name} ${it.range} ${fix}`);
    if (it.title) console.log(`  title: ${it.title}`);
    if (it.via) console.log(`  via: ${it.via}`);
    if (it.url) console.log(`  url: ${it.url}`);
  }
} else {
  console.log("[audit] HIGH/CRITICAL: none");
}

// exit code: 0 if no critical, 10 if critical present
process.exit(summary.critical > 0 ? 10 : 0);
