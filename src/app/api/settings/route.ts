import { getSettings, saveSettings } from '@/lib/settings';
import { handle, json } from '../_util';

export const dynamic = 'force-dynamic';
export const GET = handle(async () => json({ ...(await getSettings()), telegramTokenConfigured: !!process.env.TELEGRAM_BOT_TOKEN }));
export const PUT = handle(async (req: Request) => json(await saveSettings(await req.json())));
