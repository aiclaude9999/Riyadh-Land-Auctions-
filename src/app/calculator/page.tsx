'use client';
import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Icon } from '@/components/Icon';

const sar = (n: number) => (isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—');
const numOf = (s: string) => {
  const n = Number(String(s).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d.]/g, ''));
  return isFinite(n) ? n : 0;
};

/** Bid calculator: what a winning bid really costs (commission + VAT, transaction tax, deposit). */
function Calculator() {
  const sp = useSearchParams();
  const [price, setPrice] = useState(sp.get('price') ?? '1000000');
  const [area, setArea] = useState(sp.get('area') ?? '');
  const [deposit, setDeposit] = useState(sp.get('deposit') ?? '');
  const [commission, setCommission] = useState('2.5');
  const [vat, setVat] = useState('15');
  const [rett, setRett] = useState('5');
  const [bench, setBench] = useState(sp.get('bench') ?? '');
  const [whiteLand, setWhiteLand] = useState('0');
  const [downPct, setDownPct] = useState('30');
  const [rate, setRate] = useState('5.5');
  const [years, setYears] = useState('20');

  const r = useMemo(() => {
    const p = numOf(price), a = numOf(area), d = numOf(deposit), b = numOf(bench);
    const com = (p * numOf(commission)) / 100;
    const comVat = (com * numOf(vat)) / 100;
    const tax = (p * numOf(rett)) / 100;
    const total = p + com + comVat + tax;
    const yearlyFee = (p * numOf(whiteLand)) / 100;
    return { p, a, d, com, comVat, tax, total, rest: total - d, ppm: a ? p / a : NaN, totalPpm: a ? total / a : NaN, b, yearlyFee,
      maxBid: a && b ? (a * b) / (1 + (numOf(commission) / 100) * (1 + numOf(vat) / 100) + numOf(rett) / 100) : NaN };
  }, [price, area, deposit, commission, vat, rett, bench, whiteLand]);

  // financing: the bank pays (price − down payment); costs are paid in cash
  const fin = useMemo(() => {
    const p = numOf(price);
    const down = (p * numOf(downPct)) / 100;
    const loan = Math.max(0, p - down);
    const i = numOf(rate) / 100 / 12;
    const n = Math.round(numOf(years) * 12);
    const monthly = !n ? NaN : i ? (loan * i) / (1 - (1 + i) ** -n) : loan / n;
    return { down, loan, monthly, totalPaid: monthly * n, interest: monthly * n - loan, cashNeeded: down + (r.total - p) };
  }, [price, downPct, rate, years, r.total]);

  const field = (id: string, label: string, v: string, set: (s: string) => void, suffix: string, hint?: string) => (
    <label htmlFor={id} className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input id={id} className="input num" inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} />
        <span className="muted whitespace-nowrap text-xs">{suffix}</span>
      </div>
      {hint && <span className="muted text-xs">{hint}</span>}
    </label>
  );
  const line = (k: string, v: string, hint?: string) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="muted">{k}{hint && <span className="block text-[11px]">{hint}</span>}</span>
      <span className="num font-semibold">{v}</span>
    </div>
  );
  const big = (label: string, v: string, sub?: string, accent = false) => (
    <div className={`rounded-xl px-4 py-3 ${accent ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'bg-[var(--sunk)]'}`}>
      <div className={`text-xs font-semibold ${accent ? 'opacity-80' : 'muted'}`}>{label}</div>
      <div className="num text-[28px] font-bold leading-tight tracking-tight">{v} <span className="text-sm font-semibold opacity-70">ريال</span></div>
      {sub && <div className={`text-xs ${accent ? 'opacity-80' : 'muted'}`}>{sub}</div>}
    </div>
  );
  const pctOf = (x: number) => (r.p ? ` (${((x / r.p) * 100).toFixed(2).replace(/\.?0+$/, '')}%)` : '');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">حاسبة المزايدة</h1>
        <p className="muted text-sm">كم يكلفك سعر الترسية فعلياً؟ النسب الافتراضية شائعة في المزادات العقارية — راجع كراسة شروط كل مزاد.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <section className="card space-y-3 p-4">
            <h2 className="font-bold">المزاد</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field('calc-price', 'سعر الترسية (المزايدة)', price, setPrice, 'ريال')}
              {field('calc-area', 'المساحة', area, setArea, 'م²')}
              {field('calc-deposit', 'العربون / مبلغ الدخول', deposit, setDeposit, 'ريال', 'يُخصم من المبلغ المطلوب أو يُسترد إن لم تفز')}
              {field('calc-bench', 'سعر متر الحي (للمقارنة)', bench, setBench, 'ريال/م²', 'يُملأ تلقائياً من صفحة العقار إن توفر')}
            </div>
          </section>
          <section className="card space-y-3 p-4">
            <h2 className="font-bold">الرسوم والضرائب</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field('calc-commission', 'السعي (عمولة شركة المزاد)', commission, setCommission, '%')}
              {field('calc-vat', 'ضريبة القيمة المضافة على السعي', vat, setVat, '%')}
              {field('calc-rett', 'ضريبة التصرفات العقارية', rett, setRett, '%')}
              {field('calc-wl', 'رسوم الأراضي البيضاء (إن وجدت)', whiteLand, setWhiteLand, '% سنوياً', '0 إذا لا تنطبق؛ 2.5% إلى 10% حسب النطاق')}
            </div>
          </section>
          <section className="card space-y-3 p-4">
            <h2 className="font-bold">التمويل (اختياري)</h2>
            <div className="grid grid-cols-3 gap-2">
              {field('fin-down', 'الدفعة الأولى', downPct, setDownPct, '%')}
              {field('fin-rate', 'نسبة الربح السنوية', rate, setRate, '%')}
              {field('fin-years', 'المدة', years, setYears, 'سنة')}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {big('القسط الشهري التقريبي', sar(fin.monthly))}
              {big('النقد المطلوب عند الترسية', sar(fin.cashNeeded), 'الدفعة الأولى + التكاليف')}
            </div>
            <div className="divide-y divide-[var(--border)] text-sm">
              {line('الدفعة الأولى', sar(fin.down))}
              {line('مبلغ التمويل', sar(fin.loan))}
              {line('إجمالي الأرباح على المدة', sar(fin.interest))}
            </div>
            <p className="muted text-xs">حساب تقريبي بقسط ثابت (طريقة التمويل العقاري الشائعة). العرض الفعلي يحدده البنك.</p>
          </section>
        </div>

        {/* the receipt: what you will actually pay, largest first */}
        <aside className="lg:col-span-2">
          <div className="card sticky top-24 space-y-3 p-4" aria-live="polite">
            <h2 className="font-bold">الفاتورة التقديرية</h2>
            {big('الإجمالي المطلوب', sar(r.total), r.d > 0 ? `بعد خصم العربون: ${sar(r.rest)} ريال` : undefined, true)}
            <div className="divide-y divide-[var(--border)] text-sm">
              {line('سعر الترسية', sar(r.p))}
              {line(`السعي${pctOf(r.com)}`, sar(r.com))}
              {line('ضريبة القيمة المضافة على السعي', sar(r.comVat))}
              {line(`ضريبة التصرفات العقارية${pctOf(r.tax)}`, sar(r.tax))}
              {r.a > 0 && line('سعر المتر (الترسية)', sar(r.ppm))}
              {r.a > 0 && line('سعر المتر شاملاً التكاليف', sar(r.totalPpm))}
              {r.yearlyFee > 0 && line('رسوم أراضٍ بيضاء تقديرية سنوياً', sar(r.yearlyFee))}
            </div>
            {isFinite(r.maxBid) ? (
              <div className="rounded-xl border-2 border-[var(--accent)] px-4 py-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)]"><Icon name="target" size={15} />حد أعلى مقترح للمزايدة</div>
                <div className="num text-[26px] font-bold leading-tight">{sar(r.maxBid)} <span className="text-sm font-semibold opacity-70">ريال</span></div>
                <div className="muted text-xs">= سعر متر الحي × المساحة ÷ (1 + التكاليف). أعلى منه يعني دفع أكثر من وسيط الحي.</div>
                {r.p > 0 && <div className={`mt-1 text-xs font-semibold ${r.p > r.maxBid ? 'text-[var(--danger)]' : 'text-[var(--accent)]'}`}>{r.p > r.maxBid ? `سعرك أعلى من الحد بـ ${sar(r.p - r.maxBid)} ريال` : `سعرك أقل من الحد بـ ${sar(r.maxBid - r.p)} ريال`}</div>}
              </div>
            ) : (
              <p className="muted rounded-lg bg-[var(--sunk)] p-3 text-xs">أدخل المساحة وسعر متر الحي لحساب حد أعلى مقترح للمزايدة.</p>
            )}
            <p className="muted text-xs">الأرقام تقديرية. تحقق من النسب في كراسة الشروط، ومن رسوم الأراضي البيضاء عبر idlelands.momah.gov.sa أو 920022440.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function CalculatorPage() {
  return <Suspense fallback={<div className="muted p-6">…</div>}><Calculator /></Suspense>;
}
