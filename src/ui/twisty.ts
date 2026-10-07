import type { TwistyPlayerConfig } from "cubing/twisty";
import { getScrambleType } from "../core/events";

// cubing.js has no 3d model for these, they would only draw flat
const FLAT_ONLY = new Set(["square1", "clock"]);

export function hasGuide(typeId: string): boolean {
  const type = getScrambleType(typeId);
  return !!type.puzzle && !FLAT_ONLY.has(type.puzzle) && type.source.kind !== "relay";
}

export function playerConfig(typeId: string): TwistyPlayerConfig {
  return {
    puzzle: getScrambleType(typeId).puzzle as TwistyPlayerConfig["puzzle"],
    alg: "",
    visualization: "3D",
    background: "none",
    controlPanel: "none",
    hintFacelets: "none",
    // cubing paints a gray backdrop in its dark scheme, light keeps it transparent
    colorScheme: "light",
    viewerLink: "none",
  };
}

// relay labels and line breaks are not alg syntax
export function cleanAlg(s: string): string {
  return s.replace(/^[^:\n]+:\s*/gm, "").replace(/\s+/g, " ").trim();
}
