/**
 * Shared Playwright helper for JavaScript-heavy / protected sources.
 * Loads a page in headless Chromium, detects bot challenges, and captures JSON XHR responses
 * so a connector can map the site's own API payloads.
 */
import type { Browser } from 'playwright';
import { BlockedError } from './types';
import { USER_AGENT } from '@/lib/http';

let browserP: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserP) {
    browserP = (async () => {
      const { chromium } = await import('playwright');
      const proxy = process.env.PLAYWRIGHT_PROXY ?? process.env.HTTPS_PROXY;
      return chromium.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_PATH || undefined,
        proxy: proxy ? { server: proxy } : undefined,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
    })().catch((e) => {
      browserP = null;
      throw e;
    });
  }
  return browserP;
}

export async function closeBrowser() {
  if (browserP) (await browserP.catch(() => null))?.close().catch(() => {});
  browserP = null;
}

export interface CapturedJson { url: string; data: unknown }

const CHALLENGE = /just a moment|attention required|checking your browser|cf-chl|لحظة|تحقق من أنك إنسان/i;

export async function loadAndCapture(url: string, opts: { waitMs?: number; match?: RegExp } = {}): Promise<{ html: string; json: CapturedJson[]; finalUrl: string }> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({ userAgent: USER_AGENT, locale: 'ar-SA', timezoneId: 'Asia/Riyadh', ignoreHTTPSErrors: !!process.env.HTTPS_PROXY });
  const page = await ctx.newPage();
  const json: CapturedJson[] = [];
  page.on('response', async (r) => {
    try {
      const ct = r.headers()['content-type'] ?? '';
      if (!ct.includes('json')) return;
      if (opts.match && !opts.match.test(r.url())) return;
      json.push({ url: r.url(), data: await r.json() });
    } catch { /* ignore bodies we cannot read */ }
  });
  try {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
    } catch (e: any) {
      if (/ERR_CONNECTION_RESET|ERR_CONNECTION_REFUSED|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|ERR_TIMED_OUT/.test(e.message)) {
        throw new BlockedError(`Network refused connection to ${url}: ${e.message.split('\n')[0]}`);
      }
      // networkidle timeouts are common on sites with websockets — continue with what we have
    }
    await page.waitForTimeout(opts.waitMs ?? 3000);
    const title = await page.title().catch(() => '');
    const html = await page.content();
    if (CHALLENGE.test(title) || (/challenge-platform/.test(html) && html.length < 20_000)) {
      throw new BlockedError(`Bot challenge (Cloudflare) on ${url} — title "${title}"`);
    }
    if (html.length < 1000 && json.length === 0) {
      throw new BlockedError(`Empty response from ${url} (${html.length} bytes) — the site refused to serve this network`);
    }
    return { html, json, finalUrl: page.url() };
  } finally {
    await ctx.close().catch(() => {});
  }
}
