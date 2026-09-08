export function Atmosphere() {
  return (
    <div className="atmosphere" aria-hidden="true">
      <div className="atmosphere-glow atmosphere-glow-a" />
      <div className="atmosphere-glow atmosphere-glow-b" />
      <div className="atmosphere-rain" />
      <svg className="atmosphere-waves" viewBox="0 0 1440 220" preserveAspectRatio="none">
        <path
          className="wave-path wave-path-a"
          d="M0,120 C180,180 360,40 540,100 C720,160 900,60 1080,110 C1260,160 1380,90 1440,120 L1440,220 L0,220 Z"
        />
        <path
          className="wave-path wave-path-b"
          d="M0,150 C220,110 380,190 560,140 C740,90 920,180 1120,130 C1280,90 1380,160 1440,140 L1440,220 L0,220 Z"
        />
      </svg>
    </div>
  );
}
