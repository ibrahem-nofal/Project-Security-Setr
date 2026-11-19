export default function BrandMark({ size = 38, className = '' }) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-[11px] bg-signal ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" width={size * 0.58} height={size * 0.58} fill="none">
        <path
          d="M10.5 15.2v-3.1c0-2.7 2.3-4.9 5.5-4.9s5.5 2.2 5.5 4.9v3.1"
          stroke="#ffffff"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <rect x="8.2" y="14.4" width="15.6" height="11.4" rx="3.6" fill="#ffffff" />
        <circle cx="16" cy="19.1" r="1.6" fill="#594ff4" />
        <path d="M16 20v2.7" stroke="#594ff4" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}
