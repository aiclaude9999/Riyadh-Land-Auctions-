/** Grey placeholders in the shape of what is loading (instead of "جاري التحميل…"). */
export function Bar({ w = '100%', h = 12, className = '' }: { w?: string | number; h?: number; className?: string }) {
  return <span className={`skeleton block ${className}`} style={{ width: w, height: h }} />;
}
export function CardSkeleton({ cover = 'aspect-[16/9]' }: { cover?: string }) {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className={`skeleton rounded-none ${cover}`} />
      <div className="space-y-2.5 p-3"><Bar w="70%" h={16} /><Bar w="45%" /><Bar w="90%" /><Bar w="60%" /></div>
    </div>
  );
}
export function GridSkeleton({ n = 6, className, cover }: { n?: number; className: string; cover?: string }) {
  return <div className={className} role="status" aria-label="جاري التحميل">{Array.from({ length: n }, (_, i) => <CardSkeleton key={i} cover={cover} />)}</div>;
}
export function PageSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="جاري التحميل">
      <Bar w="40%" h={28} /><Bar w="25%" />
      <div className="grid gap-4 lg:grid-cols-5"><div className="skeleton aspect-[16/10] lg:col-span-3" /><div className="card space-y-3 p-4 lg:col-span-2"><Bar w="80%" h={22} /><Bar w="50%" /><Bar h={56} /><Bar h={56} /></div></div>
    </div>
  );
}
