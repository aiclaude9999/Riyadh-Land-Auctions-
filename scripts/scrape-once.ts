/**
 * One-off scrape without Redis — handy for testing connectors against the live sites.
 *   npm run scrape                 # all sources
 *   npm run scrape -- mobasher qemah
 */
import { connectors } from '@/connectors';
import { ensureSources, runScrape } from '@/lib/scrape';
import { ensureDefaultRules } from '@/lib/notify';
import { closeBrowser } from '@/connectors/browser';
import { prisma } from '@/lib/db';

async function main() {
  await ensureSources();
  await ensureDefaultRules();
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : connectors.map((c) => c.id);
  const mode = (process.env.MODE as any) ?? 'discovery';
  for (const id of ids) {
    try {
      const r = await runScrape(id, mode);
      console.log(`✔ ${id}: found=${r.found} created=${r.created} updated=${r.updated}`);
    } catch (e: any) {
      console.log(`✘ ${id}: ${e.message}`);
    }
  }
  await closeBrowser();
  await prisma.$disconnect();
}
main();
