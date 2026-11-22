/** Thin line icons drawn for this product (24px grid, 1.7 stroke, currentColor). Used instead of emoji. */
const ICONS = {
  gavel: <><path d="m14.5 4.5 5 5" /><path d="m12 7 5 5" /><path d="m13.2 5.8 4.9 4.9-3.4 3.4-4.9-4.9z" /><path d="M11.3 11.3 4 18.6a1.4 1.4 0 0 0 2 2l7.3-7.3" /><path d="M14 21h7" /></>,
  building: <><path d="M4 21V5.5L12 3v18" /><path d="M12 9h8v12" /><path d="M3 21h18" /><path d="M7.5 8v.01M7.5 11.5v.01M7.5 15v.01M15.5 13v.01M15.5 16.5v.01" strokeWidth="2.2" /></>,
  map: <><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z" /><path d="M9 4v14M15 6v14" /></>,
  deals: <><path d="M3 12.5V4h8.5l9 9-8.5 8.5z" /><circle cx="7.5" cy="8.5" r="1.3" /><path d="m11 13 2.5 2.5 3-5" /></>,
  tools: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  user: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5" /></>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  metro: <><rect x="6" y="3" width="12" height="14" rx="3" /><path d="M6 10h12" /><path d="M9.5 13.5v.01M14.5 13.5v.01" strokeWidth="2.2" /><path d="m8 21 2-4M16 21l-2-4" /></>,
  road: <><path d="M8 3 5 21M16 3l3 18" /><path d="M12 4v2.5M12 10.5V13M12 17.5V20" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 12h.01" strokeWidth="2.6" /></>,
  crane: <><path d="M6 21V4h1.5L19 7.5" /><path d="M6 7.5h13" /><path d="M16 7.5V11" /><rect x="14.5" y="11" width="3" height="2.5" /><path d="M3.5 21h6" /></>,
  warning: <><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.2M12 17v.01" /></>,
  search: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.6-4.6" /></>,
  trend: <><path d="M3.5 17 9 11.5l3.5 3.5L20 7.5" /><path d="M14.5 7.5H20V13" /></>,
  note: <><path d="M5 3.5h10l4 4v13H5z" /><path d="M14.5 3.5V8H19" /><path d="M8.5 12.5h7M8.5 16h5" /></>,
  pin: <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 9.5h16M8.5 3v4M15.5 3v4" /></>,
  ruler: <><path d="m3.5 15.5 12-12 5 5-12 12z" /><path d="m7 12 2 2M10 9l2 2M13 6l2 2" /></>,
  star: <><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
};
export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, className, fill }: { name: IconName; size?: number; className?: string; fill?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7"
      strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" className={`inline-block flex-none ${className ?? ''}`}>
      {ICONS[name]}
    </svg>
  );
}
