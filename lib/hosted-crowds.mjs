import { createHash } from "node:crypto";

export const TTL = 30 * 60 * 1000;
const placeIds = new Set(["andheri-w", "andheri-west-metro", "andheri-e", "dn-nagar", "gundavali", "versova", "lokhandwala", "juhu", "mukesh-patel", "airport-t2", "marol", "saki-naka", "seepz", "ghatkopar", "aarey"]);
const types = new Set(["bus", "metro", "train"]);
const validPair = ({ from, to }) => placeIds.has(from) && placeIds.has(to) && from !== to;
const digest = (id) => createHash("sha256").update(id).digest("hex");

export function createHostedCrowds(store, now = Date.now) {
  async function list(from, to) {
    const time = now();
    const bucket = Math.floor(time / TTL);
    const keys = [];
    for (const window of [bucket - 1, bucket]) {
      for await (const page of store.list({ prefix: `v1/${window}/${from}/${to}/`, paginate: true })) {
        keys.push(...page.blobs.map((blob) => blob.key));
        if (keys.length > 500) throw new Error("This corridor is busy. Try again later.");
      }
    }
    const latest = new Map();
    for (let index = 0; index < keys.length; index += 10) {
      const reports = await Promise.all(keys.slice(index, index + 10).map((key) => store.get(key, { type: "json" })));
      for (const report of reports) {
        if (!report || report.from !== from || report.to !== to || !types.has(report.type)
          || !Number.isFinite(report.at) || report.at > time || time - report.at >= TTL
          || !/^[a-f0-9]{64}$/.test(report.reporterHash)
          || !(report.level === null || [0, 1, 2].includes(report.level))) continue;
        const key = `${report.type}/${report.reporterHash}`;
        if (!latest.has(key) || report.at >= latest.get(key).at) latest.set(key, report);
      }
    }
    return [...latest.values()].filter((report) => report.level !== null)
      .map(({ reporterHash, ...report }) => report);
  }

  async function save(input) {
    if (!input || !validPair(input) || !types.has(input.type)
      || typeof input.reporter !== "string" || !/^[a-zA-Z0-9-]{16,64}$/.test(input.reporter)
      || !(input.level === null || [0, 1, 2].includes(input.level))) {
      return { status: 400, body: { error: "Invalid crowd report" } };
    }
    const at = now();
    const reporterHash = digest(input.reporter);
    // Separate browser keys prevent one visitor overwriting another's report.
    // Time buckets bound reads and let cleanup delete only immutable old windows.
    const key = `v1/${Math.floor(at / TTL)}/${input.from}/${input.to}/${input.type}/${reporterHash}`;
    await store.setJSON(key, { from: input.from, to: input.to, type: input.type, level: input.level, at, reporterHash });
    return { status: 200, body: { reports: await list(input.from, input.to) } };
  }

  return {
    list, save,
    async cleanup() {
      const cutoff = Math.floor(now() / TTL) - 1;
      let deleted = 0;
      for await (const page of store.list({ prefix: "v1/", paginate: true })) {
        for (const { key } of page.blobs) {
          const bucket = Number(key.split("/")[1]);
          if (Number.isInteger(bucket) && bucket < cutoff) {
            await store.delete(key);
            deleted++;
          }
        }
      }
      return deleted;
    }
  };
}

export function createCrowdHandler(getCrowds) {
  return async (request) => {
    const reply = (status, body) => Response.json(body, { status, headers: {
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"
    } });
    const url = new URL(request.url);
    if (!["GET", "POST"].includes(request.method)) return reply(405, { error: "Method not allowed" });
    if (request.method === "POST") {
      if (request.headers.get("origin") !== url.origin) return reply(403, { error: "Use Glide to submit reports" });
      if (!request.headers.get("content-type")?.startsWith("application/json")) return reply(415, { error: "Expected JSON" });
    }
    try {
      if (request.method === "GET") {
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        if (!validPair({ from, to })) return reply(400, { error: "Choose valid starting and destination places" });
        return reply(200, { reports: await getCrowds().list(from, to) });
      }
      const reader = request.body?.getReader();
      if (!reader) return reply(400, { error: "Missing report" });
      let size = 0;
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) {
          await reader.cancel();
          return reply(413, { error: "Report too large" });
        }
        chunks.push(value);
      }
      let input;
      try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch { return reply(400, { error: "Invalid JSON" }); }
      const result = await getCrowds().save(input);
      return reply(result.status, result.body);
    } catch (error) {
      if (error.status === 401) return reply(401, { error: error.message });
      return reply(503, { error: "Community reporting is temporarily unavailable. Please try again." });
    }
  };
}
