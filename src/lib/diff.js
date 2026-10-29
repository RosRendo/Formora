const SKIP = new Set(["id", "x", "y", "needs_review", "review_reason", "effective_status", "_id"]);

function label(v) {
  if (v && typeof v === "object") return v.name || v.title || v.path || v.text || v.goal || v.field || null;
  return null;
}

export function toLines(v, indent = 0, out = []) {
  const pad = "  ".repeat(indent);
  if (Array.isArray(v)) {
    if (!v.length) out.push(`${pad}(none)`);
    v.forEach((item) => {
      if (item && typeof item === "object") {
        const l = item.method ? `${item.method} ${item.path}` : label(item);
        out.push(`${pad}- ${l || "item"}`);
        toLines(item, indent + 1, out);
      } else out.push(`${pad}- ${item}`);
    });
  } else if (v && typeof v === "object") {
    Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).forEach(([k, val]) => {
      if (SKIP.has(k) || ["name", "title"].includes(k) && indent > 0) return;
      if (val && typeof val === "object") {
        if (Array.isArray(val) && !val.length) return;
        if (!Array.isArray(val) && !Object.keys(val).length) return;
        out.push(`${pad}${k}:`);
        toLines(val, indent + 1, out);
      } else if (val !== "" && val !== null && val !== undefined && val !== false) out.push(`${pad}${k}: ${val}`);
    });
  } else out.push(`${pad}${v}`);
  return out;
}

export function lineDiff(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ t: "=", s: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ t: "-", s: a[i++] });
    else out.push({ t: "+", s: b[j++] });
  }
  while (i < n) out.push({ t: "-", s: a[i++] });
  while (j < m) out.push({ t: "+", s: b[j++] });
  return out;
}

export function diffContent(oldC, newC, refs = {}) {
  const sub = (lines) => lines.map((l) => Object.entries(refs).reduce((s, [id, name]) => s.split(id).join(name), l));
  return lineDiff(sub(toLines(oldC || {})), sub(toLines(newC || {})));
}

export function refsFrom(...contents) {
  const r = {};
  contents.forEach((c) => {
    (c?.entities || []).forEach((e) => { r[e.id] = e.name; (e.fields || []).forEach((f) => { r[f.id] = `${e.name}.${f.name}`; }); });
    (c?.features || []).forEach((f) => { r[f.id] = f.title; });
    (c?.nodes || []).forEach((n) => { r[n.id] = n.name; });
    (c?.endpoints || []).forEach((e) => { r[e.id] = `${e.method} ${e.path}`; });
    (c?.tasks || []).forEach((t) => { r[t.id] = t.title; });
  });
  return r;
}
