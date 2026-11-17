import { useEffect, useRef } from "react";
import type { SceneId } from "@/lib/catalog";
import { cn } from "@/lib/cn";

const INK = "#0b0a08";
const BONE = "#f0cf8a";
const MUTED = "#8a6f42";

type Drop = { x: number; y: number; speed: number; len: number };

export function SceneCanvas({ scene, className }: { scene: SceneId; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const drops: Drop[] = [];
    let frame = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drops.length = 0;
      const count = Math.floor(width / 8);
      for (let i = 0; i < count; i += 1) {
        drops.push({
          x: Math.random() * width,
          y: Math.random() * height,
          speed: 4 + Math.random() * 9,
          len: 8 + Math.random() * 16,
        });
      }
    };

    const draw = (time: number) => {
      ctx.fillStyle = INK;
      ctx.fillRect(0, 0, width, height);
      if (scene === "rain") drawRain(ctx, drops, width, height);
      if (scene === "drive") drawDrive(ctx, width, height, time);
      if (scene === "ocean") drawOcean(ctx, width, height, time);
      if (scene === "blocks") drawBlocks(ctx, width, height, time);
      if (scene === "horizon") drawHorizon(ctx, width, height, time);
      if (scene === "grain") drawGrain(ctx, width, height);
    };

    resize();
    draw(0);
    if (reduce) return;
    const loop = (time: number) => {
      draw(time);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [scene]);

  return <canvas ref={ref} className={cn("block h-full w-full", className)} aria-hidden="true" />;
}

function drawRain(ctx: CanvasRenderingContext2D, drops: Drop[], width: number, height: number) {
  ctx.strokeStyle = "rgba(244,244,245,0.45)";
  ctx.lineWidth = 1;
  for (const drop of drops) {
    drop.y += drop.speed;
    if (drop.y > height) {
      drop.y = -drop.len;
      drop.x = Math.random() * width;
    }
    ctx.beginPath();
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x + 1.5, drop.y + drop.len);
    ctx.stroke();
  }
}

function drawDrive(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const horizon = height * 0.42;
  ctx.fillStyle = "#121214";
  ctx.fillRect(0, horizon, width, height - horizon);
  ctx.strokeStyle = MUTED;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(width, horizon);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(width * 0.5, horizon);
  ctx.lineTo(width * 0.08, height);
  ctx.moveTo(width * 0.5, horizon);
  ctx.lineTo(width * 0.92, height);
  ctx.stroke();
  const shift = (time * 0.35) % 40;
  ctx.strokeStyle = BONE;
  for (let i = 0; i < 12; i += 1) {
    const t = (i * 40 + shift) / 480;
    const y = horizon + t * t * (height - horizon);
    const spread = 4 + t * 28;
    ctx.globalAlpha = Math.min(1, t + 0.15);
    ctx.beginPath();
    ctx.moveTo(width * 0.5 - spread, y);
    ctx.lineTo(width * 0.5 - spread, y + 10 + t * 18);
    ctx.moveTo(width * 0.5 + spread, y);
    ctx.lineTo(width * 0.5 + spread, y + 10 + t * 18);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawOcean(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  for (let i = 0; i < 5; i += 1) {
    const base = height * (0.45 + i * 0.1);
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 8) {
      const y = base + Math.sin(x * 0.012 + time * 0.0008 + i) * (10 + i * 3) + Math.sin(x * 0.004 + time * 0.0004) * 8;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = `rgba(244,244,245,${0.05 + i * 0.04})`;
    ctx.fill();
  }
}

function drawBlocks(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  ctx.strokeStyle = "rgba(244,244,245,0.55)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i += 1) {
    const drift = ((time * 0.02 + i * 80) % (width + 160)) - 80;
    const w = 70 + (i % 3) * 36;
    const h = height * (0.25 + (i % 4) * 0.12);
    const y = height * 0.2 + (i % 3) * 24;
    ctx.strokeRect(drift, y, w, h);
  }
  ctx.beginPath();
  ctx.moveTo(0, height * 0.78);
  ctx.lineTo(width, height * 0.78);
  ctx.stroke();
}

function drawHorizon(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const y = height * 0.58;
  const bob = Math.sin(time * 0.0003) * 6;
  ctx.fillStyle = BONE;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(width * 0.5, y - height * 0.16 + bob, Math.min(width, height) * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = MUTED;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  for (let i = 0; i < 18; i += 1) {
    const sx = ((i * 97) % 100) / 100 * width;
    const sy = ((i * 53) % 50) / 100 * height;
    ctx.globalAlpha = 0.35 + (i % 4) * 0.1;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
}

function drawGrain(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = "rgba(244,244,245,0.35)";
  ctx.strokeRect(24, 24, width - 48, height - 48);
  ctx.fillStyle = BONE;
  ctx.font = `600 ${Math.max(28, width * 0.08)}px Syne, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Do.T", width / 2, height * 0.46);
  ctx.fillStyle = MUTED;
  ctx.font = `500 ${Math.max(14, width * 0.035)}px Outfit, sans-serif`;
  const label = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  ctx.fillText(label, width / 2, height * 0.56);
  ctx.fillText("LOCAL", width / 2, height * 0.63);
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 40; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillStyle = BONE;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}
