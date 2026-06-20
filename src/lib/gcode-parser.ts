export type GcodeAnalysis = {
  materialGrams: number | null;
  filamentMeters: number | null;
  printSeconds: number | null;
  printHours: number | null;
  layerHeight: number | null;
  slicer: string | null;
};

function numberMatch(content: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) {
      const value = Number.parseFloat(match[1]);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

function parseDurationText(input: string) {
  const hours = Number.parseFloat(input.match(/(\d+(?:\.\d+)?)\s*h/i)?.[1] ?? "0");
  const minutes = Number.parseFloat(input.match(/(\d+(?:\.\d+)?)\s*m/i)?.[1] ?? "0");
  const seconds = Number.parseFloat(input.match(/(\d+(?:\.\d+)?)\s*s/i)?.[1] ?? "0");
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

function detectSlicer(content: string) {
  const firstLines = content.slice(0, 12000);
  if (/BambuStudio/i.test(firstLines)) return "Bambu Studio";
  if (/OrcaSlicer/i.test(firstLines)) return "OrcaSlicer";
  if (/PrusaSlicer/i.test(firstLines)) return "PrusaSlicer";
  if (/Cura_SteamEngine|Generated with Cura/i.test(firstLines)) return "Cura";
  if (/Simplify3D/i.test(firstLines)) return "Simplify3D";
  return null;
}

export function parseGcode(content: string): GcodeAnalysis {
  const materialGrams = numberMatch(content, [
    /;\s*filament used \[g\]\s*=\s*([\d.]+)/i,
    /;\s*total filament used \[g\]\s*[:=]\s*([\d.]+)/i,
    /;\s*filament weight\s*[:=]\s*([\d.]+)\s*g/i,
    /;\s*filament_used_g\s*[:=]\s*([\d.]+)/i,
    /;\s*material weight\s*[:=]\s*([\d.]+)\s*g/i
  ]);
  const filamentMeters = numberMatch(content, [
    /;\s*filament used\s*[:=]\s*([\d.]+)\s*m(?:\s|$)/i,
    /;\s*filament used \[mm\]\s*=\s*([\d.]+)/i
  ]);
  const normalizedMeters = filamentMeters && /filament used \[mm\]/i.test(content) ? filamentMeters / 1000 : filamentMeters;
  const directSeconds = numberMatch(content, [
    /;\s*TIME\s*:\s*(\d+(?:\.\d+)?)/i,
    /;\s*total estimated time\s*[:=]\s*(\d+(?:\.\d+)?)\s*s/i,
    /;\s*estimated printing time.*?[:=]\s*(\d+(?:\.\d+)?)\s*s/i
  ]);
  const durationText = content.match(/;\s*(?:estimated printing time[^:=]*|total estimated time|model printing time)\s*[:=]\s*([^\r\n]+)/i)?.[1] ?? "";
  const printSeconds = directSeconds ?? parseDurationText(durationText);
  const layerHeight = numberMatch(content, [
    /;\s*layer_height\s*=\s*([\d.]+)/i,
    /;\s*Layer height\s*[:=]\s*([\d.]+)/i
  ]);

  return {
    materialGrams,
    filamentMeters: normalizedMeters,
    printSeconds,
    printHours: printSeconds === null ? null : printSeconds / 3600,
    layerHeight,
    slicer: detectSlicer(content)
  };
}
