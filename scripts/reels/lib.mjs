// Shared helpers for the reel tools: headless Chromium (from npm, no download
// needed), the bundled ffmpeg binary and small file utilities.
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import ffmpeg from "@ffmpeg-installer/ffmpeg";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

export const FFMPEG = ffmpeg.path;
export const HERE = path.dirname(new URL(import.meta.url).pathname);
export const REPO = path.resolve(HERE, "..", "..");

/** Chromium's shared libraries (nss, nspr…) ship inside @sparticuz/chromium; unpack them once. */
function chromiumLibs() {
  const dir = "/tmp/al2023";
  if (!fs.existsSync(`${dir}/lib/libnspr4.so`)) {
    const br = path.join(HERE, "node_modules", "@sparticuz", "chromium", "bin", "al2023.tar.br");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync("/tmp/al2023.tar", zlib.brotliDecompressSync(fs.readFileSync(br)));
    execFileSync("tar", ["xf", "/tmp/al2023.tar", "-C", dir]);
  }
  return `${dir}/lib:/tmp`;
}

export async function browser() {
  const executablePath = await chromium.executablePath();
  return puppeteer.launch({
    executablePath,
    args: chromium.args,
    headless: true,
    protocolTimeout: 900000,
    env: { ...process.env, LD_LIBRARY_PATH: chromiumLibs() },
  });
}

export const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
export const writeJson = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 1));

/** Writes mono 16-bit PCM WAV. */
export function writeWav(file, samples, sr) {
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + samples.length * 2, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sr, 24); wav.writeUInt32LE(sr * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32000), 44 + i * 2);
  fs.writeFileSync(file, wav);
}

/** Scratch folder for one episode's intermediate files (voice, frames, overlays…), git-ignored. */
export function workDir(ep) {
  const dir = path.join(HERE, "work", ep.id);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
