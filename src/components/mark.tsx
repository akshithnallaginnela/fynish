// A scalable version of Fynish's circuit mark, used wherever the assistant speaks.
export default function Mark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 160 130"
      width={size}
      height={Math.round(size * 130 / 160)}
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="#ed2828"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M30 10c19-5 34 3 46 18M19 20l10 10h35l14 14h12M12 30v53M12 88l9 9h29l19-19V59M30 38c-8 5-11 13-11 24v14l10 10M30 11h.1M19 20h.1M12 30h.1M12 88h.1M21 97h.1M30 38h.1" />
      <path d="M29 110c23 9 39 3 50-15l13 14M30 97h.1M30 110h.1M92 109h.1M57 55c-7-8-14-8-19-4-8 6-8 23-2 29 6 7 14 4 20-4l7-7V58M57 55h.1M63 58h.1M57 76h.1" />
      <path d="M88 16l13 14h20l15 15M101 10c22-3 40 9 46 32M93 50c13-15 26-13 33-3 8 11 4 27-6 31-8 3-17-1-23-8V60M93 50h.1M97 60h.1M97 70h.1M88 16h.1M101 10h.1M147 42h.1M136 45h.1" />
      <path d="M147 54v10l-17 17v13l-19 18M147 54h.1M147 66h.1M111 112h.1M144 69c-4 20-13 34-28 42M104 96l16-15M104 96h.1M80 60v19l20 19M80 60h.1" />
      <g fill="#fffdf5">
        {[[30,10],[19,20],[12,30],[12,88],[21,97],[30,38],[30,110],[92,109],[57,55],[63,58],[57,76],[88,16],[101,10],[147,42],[136,45],[93,50],[97,60],[97,70],[147,54],[147,66],[111,112],[104,96],[80,60]].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.3" />
        ))}
      </g>
    </svg>
  );
}

