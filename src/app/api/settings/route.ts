import { getSettings, saveSettings } from '@/lib/settings';
import { handle, json } from '../_util';
import { schedulerMode } from '@/lib/scheduler-mode';

export const dynamic = 'force-dynamic';
export const GET = handle(async () => json({ ...(await getSettings()), telegramTokenConfigured: !!process.env.TELEGRAM_BOT_TOKEN, scheduler: schedulerMode(), passwordEnabled: !!process.env.APP_PASSWORD }));
export const PUT = handle(async (req: Request) => json(await saveSettings(await req.json())));
