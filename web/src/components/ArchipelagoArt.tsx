export function ArchipelagoArt() {
  return (
    <svg
      className="archipelago-art pointer-events-none hidden h-[132px] w-[220px] shrink-0 lg:block"
      viewBox="0 0 220 132"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(78,224,200,0.18)" />
          <stop offset="100%" stopColor="rgba(255,93,115,0.12)" />
        </linearGradient>
      </defs>
      <rect x="8" y="10" width="204" height="112" rx="28" fill="url(#sea)" />
      <g className="art-rain" stroke="rgba(126,230,214,0.45)" strokeWidth="1.4" strokeLinecap="round">
        <line x1="42" y1="22" x2="36" y2="34" />
        <line x1="68" y1="18" x2="62" y2="30" />
        <line x1="96" y1="24" x2="90" y2="36" />
        <line x1="128" y1="16" x2="122" y2="28" />
        <line x1="158" y1="22" x2="152" y2="34" />
        <line x1="186" y1="18" x2="180" y2="30" />
      </g>
      <g fill="#4ee0c8">
        <ellipse cx="78" cy="78" rx="18" ry="11" opacity="0.95" />
        <ellipse cx="108" cy="68" rx="14" ry="8" opacity="0.8" />
        <ellipse cx="132" cy="86" rx="22" ry="10" opacity="0.9" />
        <ellipse cx="164" cy="74" rx="10" ry="6" opacity="0.7" />
        <circle cx="54" cy="70" r="5" opacity="0.8" />
        <circle cx="188" cy="88" r="4" opacity="0.65" />
      </g>
      <path
        className="art-wave"
        d="M28 104 C58 92 78 112 108 100 C138 88 158 110 192 98"
        fill="none"
        stroke="#ff8aa0"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle className="art-pin" cx="132" cy="86" r="3.5" fill="#ff5d73" />
    </svg>
  );
}
