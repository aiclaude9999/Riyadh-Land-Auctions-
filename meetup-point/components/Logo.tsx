/** Logo: two people's paths (blue, pink) meeting at one green pin. Also used for the app icons. */
export default function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#1F6F5C" />
      <path d="M10 50 C 20 46, 22 36, 30 30" stroke="#7FB8E6" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M54 50 C 44 46, 42 36, 34 30" stroke="#F2A7C3" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="10" cy="50" r="4" fill="#7FB8E6" />
      <circle cx="54" cy="50" r="4" fill="#F2A7C3" />
      <path d="M32 8c-7.2 0-13 5.6-13 12.6C19 30 32 40 32 40s13-10 13-19.4C45 13.6 39.2 8 32 8z" fill="#F6F0E6" />
      <circle cx="32" cy="20.5" r="5" fill="#1F6F5C" />
    </svg>
  );
}
