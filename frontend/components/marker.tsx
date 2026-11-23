import * as React from "react";
import type { MarkerShape } from "@/lib/encodings";

/** Path for a marker centred at (0,0) with radius r. */
export function markerPath(shape: MarkerShape, r: number): string {
  const k = r;
  switch (shape) {
    case "circle":
      return `M ${-k} 0 A ${k} ${k} 0 1 0 ${k} 0 A ${k} ${k} 0 1 0 ${-k} 0 Z`;
    case "square": {
      const s = k * 0.88;
      return `M ${-s} ${-s} H ${s} V ${s} H ${-s} Z`;
    }
    case "triangle": {
      const h = k * 1.12;
      return `M 0 ${-h} L ${h * 0.95} ${h * 0.72} L ${-h * 0.95} ${h * 0.72} Z`;
    }
    case "triangleDown": {
      const h = k * 1.12;
      return `M 0 ${h} L ${h * 0.95} ${-h * 0.72} L ${-h * 0.95} ${-h * 0.72} Z`;
    }
    case "diamond": {
      const d = k * 1.2;
      return `M 0 ${-d} L ${d} 0 L 0 ${d} L ${-d} 0 Z`;
    }
    case "plus": {
      const a = k * 1.05;
      const b = k * 0.36;
      return `M ${-b} ${-a} H ${b} V ${-b} H ${a} V ${b} H ${b} V ${a} H ${-b} V ${b} H ${-a} V ${-b} H ${-b} Z`;
    }
    case "cross": {
      const a = k * 1.2;
      const b = k * 0.34;
      const plus: [number, number][] = [
        [-b, -a], [b, -a], [b, -b], [a, -b], [a, b], [b, b], [b, a], [-b, a], [-b, b], [-a, b], [-a, -b], [-b, -b],
      ];
      const c = Math.SQRT1_2;
      const rot = plus.map(([x, y]) => [(x - y) * c, (x + y) * c]);
      return `M ${rot.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" L ")} Z`;
    }
    case "pentagon": {
      const R = k * 1.1;
      const pts = Array.from({ length: 5 }, (_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        return `${(R * Math.cos(a)).toFixed(2)} ${(R * Math.sin(a)).toFixed(2)}`;
      });
      return `M ${pts.join(" L ")} Z`;
    }
  }
}

export function MarkerGlyph({
  shape,
  fill,
  size = 12,
  imputed,
  stroke = "var(--ink)",
  className,
}: {
  shape: MarkerShape;
  fill: string;
  size?: number;
  imputed?: boolean;
  stroke?: string;
  className?: string;
}) {
  const r = size / 2 - 1.5;
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} aria-hidden className={className}>
      <path d={markerPath(shape, r)} fill={fill} stroke={stroke} strokeWidth={1} strokeLinejoin="round" />
      {imputed ? <circle r={Math.max(1.3, r * 0.3)} fill="var(--canvas)" stroke="var(--ink)" strokeWidth={0.8} /> : null}
    </svg>
  );
}
