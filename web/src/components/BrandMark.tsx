export function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <defs>
          <linearGradient id="drop-fill" x1="12" y1="4" x2="36" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7ff0e0" />
            <stop offset="1" stopColor="#2aa8b0" />
          </linearGradient>
        </defs>
        <path
          className="brand-drop"
          d="M24 6C24 6 10 20.5 10 29.5C10 37.5 16.3 43 24 43C31.7 43 38 37.5 38 29.5C38 20.5 24 6 24 6Z"
          fill="url(#drop-fill)"
        />
        <path
          d="M18 30.5C19.2 34.2 21.4 36.5 24.2 36.5"
          fill="none"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle className="brand-ripple" cx="24" cy="31" r="7" />
      </svg>
    </div>
  );
}
