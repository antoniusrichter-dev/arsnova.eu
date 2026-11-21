/**
 * ============================================================================
 * VERSUCHSCODE – KEIN PRODUKTPFAD (Referat Thema 2, Schritt 6.1, gemeinsam)
 * ============================================================================
 * Kleiner SVG-Baukasten für die Abbildungen 2A/2B/2C. Die SVG-Einheiten sind Punkte (1/72 Zoll);
 * `speichere` rastert mit `sharp` (bereits Repo-Abhängigkeit, keine Installation) auf 300 dpi.
 *
 * Farben: Referenzpalette des Dataviz-Leitfadens, heller Modus (Druck). Kategorial nur die
 * Slots 1–3 (alle Paare CVD-geprüft); Status nur mit Textlabel, nie Farbe allein.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const FARBE = {
  flaeche: '#ffffff',
  text: '#0b0b0b',
  text2: '#52514e',
  gitter: '#e4e3df',
  achse: '#8a8984',
  serie: ['#2a78d6', '#eb6834', '#1baf7a'] as const,
  gut: '#0ca30c',
  kritisch: '#d03b3b',
  neutral: '#d9d8d3',
} as const;

export const SCHRIFT = "'DejaVu Sans', sans-serif";

export function esc(s: string | number): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Deutsche Zahl mit fester Nachkommazahl. */
export function de(n: number, stellen = 0): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
}

export function skala(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

export interface TextOpt {
  groesse?: number;
  farbe?: string;
  anker?: 'start' | 'middle' | 'end';
  fett?: boolean;
  drehen?: number;
  basis?: 'auto' | 'middle' | 'hanging';
}

export function text(x: number, y: number, s: string, o: TextOpt = {}): string {
  const rot = o.drehen ? ` transform="rotate(${o.drehen} ${x} ${y})"` : '';
  return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-family="${SCHRIFT}" font-size="${o.groesse ?? 8}" fill="${o.farbe ?? FARBE.text}" text-anchor="${o.anker ?? 'start'}"${o.fett ? ' font-weight="bold"' : ''}${o.basis ? ` dominant-baseline="${o.basis}"` : ''}${rot}>${esc(s)}</text>`;
}

export function linie(x1: number, y1: number, x2: number, y2: number, farbe: string, breite = 1, strich?: string): string {
  return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${farbe}" stroke-width="${breite}"${strich ? ` stroke-dasharray="${strich}"` : ''}/>`;
}

export function pfad(punkte: [number, number][], farbe: string, breite = 1.5): string {
  if (punkte.length < 2) return '';
  const d = punkte.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  return `<path d="${d}" fill="none" stroke="${farbe}" stroke-width="${breite}" stroke-linejoin="round" stroke-linecap="round"/>`;
}

export function rechteck(x: number, y: number, b: number, h: number, fuell: string, extra = ''): string {
  return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${b.toFixed(2)}" height="${h.toFixed(2)}" fill="${fuell}"${extra ? ` ${extra}` : ''}/>`;
}

export function kreis(x: number, y: number, r: number, fuell: string, rand = FARBE.flaeche, randBreite = 1): string {
  return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r}" fill="${fuell}" stroke="${rand}" stroke-width="${randBreite}"/>`;
}

/** Kopf mit Titel und Untertitel, Fußzeile mit Quelle. */
export function rahmen(breite: number, hoehe: number, titel: string, unter: string, quelle: string, inhalt: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${breite}" height="${hoehe}" viewBox="0 0 ${breite} ${hoehe}">`,
    rechteck(0, 0, breite, hoehe, FARBE.flaeche),
    text(24, 26, titel, { groesse: 11, fett: true }),
    text(24, 40, unter, { groesse: 8, farbe: FARBE.text2 }),
    inhalt,
    text(24, hoehe - 10, quelle, { groesse: 6.5, farbe: FARBE.text2 }),
    '</svg>',
  ].join('\n');
}

/** Schreibt PNG (300 dpi) und behält das SVG daneben als nachvollziehbare Quelle. */
export async function speichere(svg: string, ziel: string): Promise<{ breite: number; hoehe: number }> {
  mkdirSync(path.dirname(ziel), { recursive: true });
  writeFileSync(ziel.replace(/\.png$/u, '.svg'), `${svg}\n`);
  const info = await sharp(Buffer.from(svg), { density: 300 }).png().withMetadata({ density: 300 }).toFile(ziel);
  return { breite: info.width, hoehe: info.height };
}
