'use client';
import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

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
  const row = (k: string, v: string, strong = false) => (
    <div className={`flex justify-between gap-3 border-b border-[var(--border)] py-1.5 ${strong ? 'font-bold' : ''}`}><span className={strong ? '' : 'muted'}>{k}</span><span className="num">{v}</span></div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">حاسبة المزايدة</h1>
        <p className="muted text-sm">كم يكلفك سعر الترسية فعلياً؟ النسب الافتراضية شائعة في المزادات العقارية — راجع كراسة شروط كل مزاد.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          {field('calc-price', 'سعر الترسية (المزايدة)', price, setPrice, 'ريال')}
          {field('calc-area', 'المساحة', area, setArea, 'م²')}
          {field('calc-deposit', 'العربون / مبلغ الدخول', deposit, setDeposit, 'ريال', 'يُخصم من المبلغ المطلوب أو يُسترد إن لم تفز')}
          {field('calc-bench', 'سعر متر الحي (للمقارنة)', bench, setBench, 'ريال/م²', 'يُملأ تلقائياً من صفحة العقار إن توفر')}
          {field('calc-commission', 'السعي (عمولة شركة المزاد)', commission, setCommission, '%')}
          {field('calc-vat', 'ضريبة القيمة المضافة على السعي', vat, setVat, '%')}
          {field('calc-rett', 'ضريبة التصرفات العقارية', rett, setRett, '%')}
          {field('calc-wl', 'رسوم الأراضي البيضاء (إن وجدت)', whiteLand, setWhiteLand, '% سنوياً', '0 إذا لا تنطبق؛ 2.5% إلى 10% حسب النطاق')}
        </div>
        <div className="card space-y-1 p-4 text-sm">
          {row('سعر الترسية', sar(r.p))}
          {row('السعي', sar(r.com))}
          {row('ضريبة القيمة المضافة على السعي', sar(r.comVat))}
          {row('ضريبة التصرفات العقارية', sar(r.tax))}
          {row('الإجمالي المطلوب', sar(r.total), true)}
          {r.d > 0 && row('بعد خصم العربون', sar(r.rest))}
          {r.a > 0 && row('سعر المتر (الترسية)', sar(r.ppm))}
          {r.a > 0 && row('سعر المتر شاملاً التكاليف', sar(r.totalPpm))}
          {r.yearlyFee > 0 && row('رسوم أراضٍ بيضاء تقديرية سنوياً', sar(r.yearlyFee))}
          {isFinite(r.maxBid) && (
            <div className="mt-3 rounded-lg bg-brand-50 p-3 dark:bg-brand-900/40">
              💡 حد أعلى مقترح للمزايدة حسب سعر الحي: <b className="num">{sar(r.maxBid)}</b> ريال
              <div className="muted text-xs">= سعر متر الحي × المساحة ÷ (1 + التكاليف). سعر ترسية أعلى منه يعني دفع أكثر من وسيط الحي.</div>
            </div>
          )}
          <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3">
            <b>التمويل (اختياري)</b>
            <div className="grid grid-cols-3 gap-2">
              {field('fin-down', 'الدفعة الأولى', downPct, setDownPct, '%')}
              {field('fin-rate', 'نسبة الربح السنوية', rate, setRate, '%')}
              {field('fin-years', 'المدة', years, setYears, 'سنة')}
            </div>
            {row('الدفعة الأولى', sar(fin.down))}
            {row('مبلغ التمويل', sar(fin.loan))}
            {row('القسط الشهري التقريبي', sar(fin.monthly), true)}
            {row('إجمالي الأرباح على المدة', sar(fin.interest))}
            {row('النقد المطلوب عند الترسية (الدفعة + التكاليف)', sar(fin.cashNeeded), true)}
            <p className="muted text-xs">حساب تقريبي بقسط ثابت (طريقة التمويل العقاري الشائعة). العرض الفعلي يحدده البنك.</p>
          </div>
          <p className="muted pt-2 text-xs">الأرقام تقديرية. تحقق من النسب في كراسة الشروط، ومن رسوم الأراضي البيضاء عبر idlelands.momah.gov.sa أو 920022440.</p>
        </div>
      </div>
    </div>
  );
}

export default function CalculatorPage() {
  return <Suspense fallback={<div className="muted p-6">…</div>}><Calculator /></Suspense>;
}
