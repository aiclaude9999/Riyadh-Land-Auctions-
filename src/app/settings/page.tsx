'use client';
import { useEffect, useState } from 'react';

const FIELDS: { k: string; label: string; unit: string; min: number }[] = [
  { k: 'discoveryMin', label: 'اكتشاف المزادات الجديدة', unit: 'دقيقة', min: 5 },
  { k: 'liveMin', label: 'تحديث المزادات الجارية', unit: 'دقيقة', min: 2 },
  { k: 'closingMin', label: 'المزادات التي تغلق خلال أقل من ساعة', unit: 'دقيقة', min: 1 },
  { k: 'upcomingMin', label: 'المزادات القادمة', unit: 'دقيقة', min: 5 },
  { k: 'endedMin', label: 'المزادات المنتهية', unit: 'دقيقة', min: 60 },
  { k: 'uiRefreshSec', label: 'تحديث الواجهة من قاعدة البيانات', unit: 'ثانية', min: 15 },
];

export default function SettingsPage() {
  const [s, setS] = useState<any>(null);
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => { fetch('/api/settings').then((r) => r.json()).then(setS); }, []);
  if (!s) return <div className="muted p-6">جاري التحميل…</div>;

  const save = async () => {
    const r = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }).then((x) => x.json());
    if (r.error) return setSaved(`خطأ: ${r.error}`);
    setS({ ...s, ...r });
    setSaved('تم الحفظ — يطبّق الـ worker الفترات الجديدة خلال 30 ثانية.');
  };

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">الإعدادات</h1>
      <div className="card space-y-3 p-4">
        <h2 className="font-semibold">فترات التحديث التلقائي</h2>
        {FIELDS.map((f) => (
          <label key={f.k} className="flex items-center justify-between gap-3 text-sm">
            <span>{f.label}</span>
            <span className="flex items-center gap-2">
              <input className="input num w-24" type="number" min={f.min} value={s.intervals[f.k]} onChange={(e) => setS({ ...s, intervals: { ...s.intervals, [f.k]: Number(e.target.value) } })} />
              <span className="muted w-12 text-xs">{f.unit}</span>
            </span>
          </label>
        ))}
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>نافذة "قرب الإغلاق"</span>
          <span className="flex items-center gap-2"><input className="input num w-24" type="number" min={10} value={s.closingWindowMin} onChange={(e) => setS({ ...s, closingWindowMin: Number(e.target.value) })} /><span className="muted w-12 text-xs">دقيقة</span></span>
        </label>
      </div>
      <div className="card space-y-3 p-4">
        <h2 className="font-semibold">نوع المزادات الافتراضي</h2>
        <select className="input" value={s.defaultFocus} onChange={(e) => setS({ ...s, defaultFocus: e.target.value })}>
          <option value="land">مزادات الأراضي فقط</option>
          <option value="real_estate">كل المزادات العقارية</option>
          <option value="all">كل أنواع المزادات</option>
        </select>
        <h2 className="pt-2 font-semibold">النطاق الجغرافي الافتراضي</h2>
        <select className="input" value={s.defaultGeo} onChange={(e) => setS({ ...s, defaultGeo: e.target.value })}>
          <option value="riyadh_city">مدينة الرياض فقط</option>
          <option value="riyadh_region">منطقة الرياض بالكامل (الخرج، الدرعية، المزاحمية…)</option>
          <option value="all">جميع مدن السعودية</option>
        </select>
      </div>
      <div className="card space-y-3 p-4">
        <h2 className="font-semibold">Telegram</h2>
        <p className="muted text-xs">{s.telegramTokenConfigured ? 'تم ضبط TELEGRAM_BOT_TOKEN في البيئة.' : 'أضف TELEGRAM_BOT_TOKEN في ملف .env لتفعيل القناة.'}</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.telegram.enabled} onChange={(e) => setS({ ...s, telegram: { ...s.telegram, enabled: e.target.checked } })} /> تفعيل إرسال الإشعارات إلى Telegram</label>
        <input className="input" dir="ltr" placeholder="Chat ID" value={s.telegram.chatId} onChange={(e) => setS({ ...s, telegram: { ...s.telegram, chatId: e.target.value } })} />
      </div>
      <div className="flex items-center gap-3"><button className="btn btn-primary" onClick={save}>حفظ الإعدادات</button>{saved && <span className="text-sm">{saved}</span>}</div>
    </div>
  );
}
