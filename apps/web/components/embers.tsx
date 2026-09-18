"use client";

import { useEffect, useRef } from "react";

/**
 * Drifting embers over the hero, on a canvas rather than DOM nodes so a few
 * hundred particles cost one composited layer instead of hundreds.
 *
 * Bails out entirely under prefers-reduced-motion, and pauses when the tab is
 * hidden or the hero scrolls away so it never burns battery off-screen.
 */
export function Embers({ density = 46 }: { density?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Cap DPR: at 3x the fill cost triples for no visible gain on soft embers.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    type Particle = { x: number; y: number; r: number; vy: number; vx: number; life: number; max: number; hue: number };
    let particles: Particle[] = [];

    const spawn = (seeded: boolean): Particle => {
      const max = 240 + Math.random() * 300;
      return {
        x: Math.random() * width,
        // Seeded particles start scattered so the effect is already running on frame 1.
        y: seeded ? Math.random() * height : height + 10,
        r: 0.6 + Math.random() * 1.9,
        vy: -(0.16 + Math.random() * 0.42),
        vx: (Math.random() - 0.5) * 0.22,
        life: seeded ? Math.random() * max : 0,
        max,
        // Mostly brand gold, occasionally a hotter orange.
        hue: Math.random() < 0.78 ? 45 : 26,
      };
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Scale the count with area so a wide desktop hero isn't sparse.
      const target = Math.round((density * width) / 900) + 12;
      particles = Array.from({ length: target }, () => spawn(true));
    };

    resize();

    let frame = 0;
    let running = true;

    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      for (const p of particles) {
        p.life += 1;
        p.y += p.vy;
        // Lateral drift on a slow sine, so embers waver instead of tracking straight.
        p.x += p.vx + Math.sin((p.life + p.max) / 90) * 0.28;

        if (p.life > p.max || p.y < -20) Object.assign(p, spawn(false));

        // Fade in over the first fifth of life, then out across the rest.
        const t = p.life / p.max;
        const alpha = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;

        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        glow.addColorStop(0, `hsla(${p.hue}, 100%, 72%, ${alpha * 0.9})`);
        glow.addColorStop(0.4, `hsla(${p.hue}, 100%, 55%, ${alpha * 0.34})`);
        glow.addColorStop(1, `hsla(${p.hue}, 100%, 50%, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      frame = requestAnimationFrame(draw);
    };

    draw();

    const onVisibility = () => {
      const shouldRun = !document.hidden;
      if (shouldRun === running) return;
      running = shouldRun;
      if (running) draw();
      else cancelAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Stop once the hero is fully scrolled past.
    const observer = new IntersectionObserver(
      ([entry]) => {
        const shouldRun = entry.isIntersecting && !document.hidden;
        if (shouldRun === running) return;
        running = shouldRun;
        if (running) draw();
        else cancelAnimationFrame(frame);
      },
      { threshold: 0 },
    );
    observer.observe(canvas);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
      resizeObserver.disconnect();
    };
  }, [density]);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
