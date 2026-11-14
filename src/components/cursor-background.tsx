"use client";

import { useEffect, useRef } from "react";

export default function CursorBackground() {
  const near = useRef<HTMLDivElement>(null);
  const far = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canAnimate = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let frame = 0;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      if (near.current) near.current.style.transform = `translate3d(${x * 18}px, ${y * 14}px, 0)`;
      if (far.current) far.current.style.transform = `translate3d(${x * -10}px, ${y * -8}px, 0)`;
    };
    const move = (event: PointerEvent) => {
      if (!canAnimate.matches || event.pointerType !== "mouse") return;
      x = (event.clientX / window.innerWidth - 0.5) * 2;
      y = (event.clientY / window.innerHeight - 0.5) * 2;
      if (!frame) frame = window.requestAnimationFrame(paint);
    };
    const reset = () => {
      x = 0;
      y = 0;
      if (!frame) frame = window.requestAnimationFrame(paint);
    };
    const onPreferenceChange = () => {
      if (!canAnimate.matches) reset();
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("blur", reset);
    canAnimate.addEventListener("change", onPreferenceChange);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("blur", reset);
      canAnimate.removeEventListener("change", onPreferenceChange);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="cursor-background" aria-hidden="true">
      <div className="cursor-grid" />
      <div ref={far} className="cursor-layer cursor-far">
        <svg viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" fill="none">
          <g stroke="currentColor" strokeWidth="1">
            <path d="M-80 682C221 415 405 718 734 414S1193 154 1532 195" />
            <path d="M-80 712C224 445 407 748 736 444S1194 184 1532 225" />
            <path d="M-80 742C227 475 409 778 738 474S1195 214 1532 255" />
            <circle cx="734" cy="414" r="5" fill="currentColor" stroke="none" />
            <circle cx="1180" cy="177" r="5" fill="currentColor" stroke="none" />
          </g>
        </svg>
      </div>
      <div ref={near} className="cursor-layer cursor-near">
        <div className="cursor-drift">
          <svg viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" fill="none">
            <g stroke="currentColor" strokeWidth="1">
              <path d="M-40 224H208l75 75h195" />
              <path d="M1050 508h173l55-55h206" />
              <path d="M116 254h79l49 49" strokeDasharray="3 7" />
              <circle cx="208" cy="224" r="5" fill="var(--card, #fff)" />
              <circle cx="478" cy="299" r="5" fill="var(--card, #fff)" />
              <circle cx="1050" cy="508" r="5" fill="var(--card, #fff)" />
              <circle cx="1278" cy="453" r="5" fill="var(--card, #fff)" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
