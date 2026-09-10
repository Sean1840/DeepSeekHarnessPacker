// 修复旧会话：去掉 dsh-file-mount 写进 source 的非法字段（path/hash 等），
// 否则 dsh 0.1.5-alpha 加载历史会报 unexpected member "path"。
// 原文备份为同目录 session.jsonl.zstd.bak-before-source-path-strip（已有备份则不覆盖）。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { constants, zstdCompress, zstdDecompress } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const zstdDecompressAsync = promisify(zstdDecompress);
const zstdCompressAsync = promisify(zstdCompress);
const ZSTD_MAGIC = 4247762216;
const CHECKSUM_OPTIONS = { params: { [constants.ZSTD_c_checksumFlag]: 1 } };
const BACKUP_SUFFIX = ".bak-before-source-path-strip";
const PLUGIN_KEEP = new Set(["kind", "plugin", "form", "sections", "summary"]);
const COMPACT_KEEP = new Set(["compactionId", "sourceCommandId"]);

function homeDir() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));
    if (cfg.homeDir) return path.join(ROOT, cfg.homeDir);
  } catch {
    /* 缺配置则用 home */
  }
  return path.join(ROOT, "home");
}

function scanZstdFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset < buffer.length) {
    const start = offset;
    if (buffer.length - offset < 4) return { frames, tornStart: start };
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error(`非法 zstd 魔数 @${offset}`);
    offset += 4;
    if (offset === buffer.length) return { frames, tornStart: start };
    const descriptor = buffer.readUInt8(offset);
    offset += 1;
    if ((descriptor & 24) !== 0) throw new Error(`保留位 @${offset - 1}`);
    const contentSizeFlag = descriptor >>> 6;
    const singleSegment = (descriptor & 32) !== 0;
    const checksum = (descriptor & 4) !== 0;
    const dictionaryFlag = descriptor & 3;
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag;
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
    if (buffer.length - offset < remainingHeaderBytes) return { frames, tornStart: start };
    offset += remainingHeaderBytes;
    for (;;) {
      if (buffer.length - offset < 3) return { frames, tornStart: start };
      const blockHeader = buffer.readUIntLE(offset, 3);
      offset += 3;
      const lastBlock = (blockHeader & 1) !== 0;
      const blockType = (blockHeader >>> 1) & 3;
      const blockSize = blockHeader >>> 3;
      if (blockType === 3) throw new Error(`保留块 @${offset - 3}`);
      const payloadBytes = blockType === 1 ? 1 : blockSize;
      if (buffer.length - offset < payloadBytes) return { frames, tornStart: start };
      offset += payloadBytes;
      if (lastBlock) break;
    }
    if (checksum) {
      if (buffer.length - offset < 4) return { frames, tornStart: start };
      offset += 4;
    }
    frames.push({ start, end: offset });
  }
  return { frames };
}

async function readSessionLines(file) {
  const buf = fs.readFileSync(file);
  const { frames, tornStart } = scanZstdFrames(buf);
  const chunks = [];
  for (const f of frames) chunks.push(await zstdDecompressAsync(buf.subarray(f.start, f.end)));
  if (tornStart !== undefined && tornStart < buf.length) {
    try {
      chunks.push(await zstdDecompressAsync(buf.subarray(tornStart)));
    } catch {
      /* 忽略不完整尾帧 */
    }
  }
  return Buffer.concat(chunks).toString("utf8").split(/\n/).filter((l) => l.length);
}

function extraPluginSourceKeys(source) {
  if (!source || source.kind !== "plugin") return [];
  const allowed = new Set(PLUGIN_KEEP);
  if (source.plugin === "compact") {
    for (const k of COMPACT_KEEP) allowed.add(k);
  }
  return Object.keys(source).filter((k) => !allowed.has(k));
}

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  if (node.source && typeof node.source === "object" && !Array.isArray(node.source)) visit(node.source);
  for (const v of Object.values(node)) walk(v, visit);
}

function listSessionFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) listSessionFiles(p, acc);
    else if (name === "session.jsonl.zstd") acc.push(p);
  }
  return acc;
}

async function repairFile(file) {
  const lines = await readSessionLines(file);
  let hits = 0;
  const out = [];
  for (const line of lines) {
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      out.push(line);
      continue;
    }
    walk(ev, (source) => {
      const extra = extraPluginSourceKeys(source);
      if (!extra.length) return;
      hits += 1;
      for (const k of extra) delete source[k];
    });
    out.push(JSON.stringify(ev));
  }
  if (!hits) return { file, hits: 0 };
  const bak = file + BACKUP_SUFFIX;
  if (!fs.existsSync(bak)) fs.copyFileSync(file, bak);
  const plaintext = Buffer.from(out.join("\n") + "\n");
  const nl = plaintext.indexOf(10);
  const header = nl === -1 ? plaintext : plaintext.subarray(0, nl + 1);
  const rest = nl === -1 ? Buffer.alloc(0) : plaintext.subarray(nl + 1);
  const frame1 = await zstdCompressAsync(header, CHECKSUM_OPTIONS);
  const frame2 = rest.length ? await zstdCompressAsync(rest, CHECKSUM_OPTIONS) : Buffer.alloc(0);
  fs.writeFileSync(file, Buffer.concat([frame1, frame2]));
  return { file, hits, bak };
}

async function main() {
  console.log("==============================================");
  console.log("  修复 file-mount 旧会话日志");
  console.log("==============================================");
  console.log("");
  console.log("请先关掉 start.cmd。只改会话文件，不删对话。");
  console.log("");
  const sessions = path.join(homeDir(), "sessions");
  const files = listSessionFiles(sessions);
  if (!files.length) {
    console.log("没有找到 session.jsonl.zstd。");
    return;
  }
  let repaired = 0;
  let totalHits = 0;
  for (const file of files) {
    try {
      const r = await repairFile(file);
      const rel = path.relative(sessions, file);
      if (r.hits) {
        repaired += 1;
        totalHits += r.hits;
        console.log(`已修 ${rel}  （去掉 ${r.hits} 处非法字段）`);
      } else {
        console.log(`跳过 ${rel}  （无需修改）`);
      }
    } catch (err) {
      console.log(`失败 ${file}：${err.message}`);
    }
  }
  console.log("");
  console.log(`完成：扫描 ${files.length} 个会话，修复 ${repaired} 个（共 ${totalHits} 处）。`);
  console.log(`备份后缀：*${BACKUP_SUFFIX}`);
  console.log("请再双击 start.cmd，打开之前报错的对话。");
}

main().catch((err) => {
  console.error(`[错误] ${err.message}`);
  process.exitCode = 1;
});
