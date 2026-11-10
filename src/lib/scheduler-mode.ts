/**
 * How auctions get collected:
 *  - "worker": the BullMQ worker + Redis (Docker Compose / paid server)
 *  - "github": GitHub Actions runs scripts/collect.ts on a schedule (free hosting: Netlify + Neon)
 */
export type SchedulerMode = 'worker' | 'github';
export const schedulerMode = (): SchedulerMode => (process.env.REDIS_URL ? 'worker' : 'github');

export const GITHUB_SCHEDULE_MIN = 30;

/** Start the collector workflow on GitHub (needs GITHUB_TOKEN with Actions: write, and GITHUB_REPO=owner/name). */
export async function triggerGithubCollect(): Promise<void> {
  const token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPO, ref = process.env.GITHUB_REF_NAME || 'ccr-684fffdf-bi3tdz';
  if (!token || !repo) throw new Error('زر التحديث الفوري غير مفعّل: أضف GITHUB_TOKEN و GITHUB_REPO في إعدادات Netlify. التحديث التلقائي يعمل كل 30 دقيقة.');
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/collect.yml/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'mazad-radar' },
    body: JSON.stringify({ ref }),
  });
  if (!res.ok) throw new Error(`GitHub رفض طلب التحديث (${res.status}). تحقق من صلاحيات GITHUB_TOKEN.`);
}
