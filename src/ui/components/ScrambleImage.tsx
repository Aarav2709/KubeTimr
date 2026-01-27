import { useMemo } from "react";
import { WcaEventId } from "../../types";

export interface ScrambleImageProps {
  scramble: string;
  puzzleId: WcaEventId;
  size?: number;
}

// WCA standard colors
const COLORS: Record<string, string> = {
  U: "#ffffff", // White
  D: "#ffff00", // Yellow
  F: "#00d800", // Green
  B: "#0000ff", // Blue
  R: "#ff0000", // Red
  L: "#ff8c00", // Orange
};

// Cube state as a flat array for each face (9 stickers per face, row-major)
type FaceArray = [string, string, string, string, string, string, string, string, string];

interface CubeState {
  U: FaceArray;
  D: FaceArray;
  F: FaceArray;
  B: FaceArray;
  R: FaceArray;
  L: FaceArray;
}

function createSolvedCube(): CubeState {
  return {
    U: ["U", "U", "U", "U", "U", "U", "U", "U", "U"],
    D: ["D", "D", "D", "D", "D", "D", "D", "D", "D"],
    F: ["F", "F", "F", "F", "F", "F", "F", "F", "F"],
    B: ["B", "B", "B", "B", "B", "B", "B", "B", "B"],
    R: ["R", "R", "R", "R", "R", "R", "R", "R", "R"],
    L: ["L", "L", "L", "L", "L", "L", "L", "L", "L"],
  };
}

// Rotate face stickers clockwise (indices 0-8 in row-major order)
function rotateFaceCW(face: FaceArray): FaceArray {
  return [
    face[6], face[3], face[0],
    face[7], face[4], face[1],
    face[8], face[5], face[2],
  ];
}

function rotateFaceCCW(face: FaceArray): FaceArray {
  return [
    face[2], face[5], face[8],
    face[1], face[4], face[7],
    face[0], face[3], face[6],
  ];
}

// Helper function to swap values between arrays
function cycle4(
  a: FaceArray, ai: 0|1|2|3|4|5|6|7|8,
  b: FaceArray, bi: 0|1|2|3|4|5|6|7|8,
  c: FaceArray, ci: 0|1|2|3|4|5|6|7|8,
  d: FaceArray, di: 0|1|2|3|4|5|6|7|8
): void {
  const temp = a[ai];
  a[ai] = b[bi] as string;
  b[bi] = c[ci] as string;
  c[ci] = d[di] as string;
  d[di] = temp as string;
}

// Apply U move (clockwise)
function applyU(s: CubeState): void {
  s.U = rotateFaceCW(s.U);
  cycle4(s.F, 0, s.L, 0, s.B, 0, s.R, 0);
  cycle4(s.F, 1, s.L, 1, s.B, 1, s.R, 1);
  cycle4(s.F, 2, s.L, 2, s.B, 2, s.R, 2);
}

// Apply D move (clockwise)
function applyD(s: CubeState): void {
  s.D = rotateFaceCW(s.D);
  cycle4(s.F, 6, s.R, 6, s.B, 6, s.L, 6);
  cycle4(s.F, 7, s.R, 7, s.B, 7, s.L, 7);
  cycle4(s.F, 8, s.R, 8, s.B, 8, s.L, 8);
}

// Apply R move (clockwise)
function applyR(s: CubeState): void {
  s.R = rotateFaceCW(s.R);
  cycle4(s.F, 2, s.U, 2, s.B, 6, s.D, 2);
  cycle4(s.F, 5, s.U, 5, s.B, 3, s.D, 5);
  cycle4(s.F, 8, s.U, 8, s.B, 0, s.D, 8);
}

// Apply L move (clockwise)
function applyL(s: CubeState): void {
  s.L = rotateFaceCW(s.L);
  cycle4(s.F, 0, s.D, 0, s.B, 8, s.U, 0);
  cycle4(s.F, 3, s.D, 3, s.B, 5, s.U, 3);
  cycle4(s.F, 6, s.D, 6, s.B, 2, s.U, 6);
}

// Apply F move (clockwise)
function applyF(s: CubeState): void {
  s.F = rotateFaceCW(s.F);
  const t0 = s.U[6];
  const t1 = s.U[7];
  const t2 = s.U[8];
  s.U[6] = s.L[8];
  s.U[7] = s.L[5];
  s.U[8] = s.L[2];
  s.L[2] = s.D[0];
  s.L[5] = s.D[1];
  s.L[8] = s.D[2];
  s.D[0] = s.R[6];
  s.D[1] = s.R[3];
  s.D[2] = s.R[0];
  s.R[0] = t0;
  s.R[3] = t1;
  s.R[6] = t2;
}

// Apply B move (clockwise)
function applyB(s: CubeState): void {
  s.B = rotateFaceCW(s.B);
  const t0 = s.U[0];
  const t1 = s.U[1];
  const t2 = s.U[2];
  s.U[0] = s.R[2];
  s.U[1] = s.R[5];
  s.U[2] = s.R[8];
  s.R[2] = s.D[8];
  s.R[5] = s.D[7];
  s.R[8] = s.D[6];
  s.D[6] = s.L[0];
  s.D[7] = s.L[3];
  s.D[8] = s.L[6];
  s.L[0] = t2;
  s.L[3] = t1;
  s.L[6] = t0;
}

// Apply M move (middle layer, follows L direction)
function applyM(s: CubeState): void {
  cycle4(s.F, 1, s.D, 1, s.B, 7, s.U, 1);
  cycle4(s.F, 4, s.D, 4, s.B, 4, s.U, 4);
  cycle4(s.F, 7, s.D, 7, s.B, 1, s.U, 7);
}

// Apply E move (equatorial layer, follows D direction)
function applyE(s: CubeState): void {
  cycle4(s.F, 3, s.R, 3, s.B, 3, s.L, 3);
  cycle4(s.F, 4, s.R, 4, s.B, 4, s.L, 4);
  cycle4(s.F, 5, s.R, 5, s.B, 5, s.L, 5);
}

// Apply S move (standing layer, follows F direction)
function applyS(s: CubeState): void {
  const t0 = s.U[3];
  const t1 = s.U[4];
  const t2 = s.U[5];
  s.U[3] = s.L[7];
  s.U[4] = s.L[4];
  s.U[5] = s.L[1];
  s.L[1] = s.D[3];
  s.L[4] = s.D[4];
  s.L[7] = s.D[5];
  s.D[3] = s.R[7];
  s.D[4] = s.R[4];
  s.D[5] = s.R[1];
  s.R[1] = t0;
  s.R[4] = t1;
  s.R[7] = t2;
}

// Rotations (whole cube)
function applyX(s: CubeState): void {
  const tempU = [...s.U] as FaceArray;
  const tempF = [...s.F] as FaceArray;
  const tempD = [...s.D] as FaceArray;
  const tempB = [...s.B] as FaceArray;

  s.U = tempF;
  s.F = tempD;
  // B rotates 180 degrees when going down
  s.D = [tempB[8], tempB[7], tempB[6], tempB[5], tempB[4], tempB[3], tempB[2], tempB[1], tempB[0]];
  s.B = [tempU[8], tempU[7], tempU[6], tempU[5], tempU[4], tempU[3], tempU[2], tempU[1], tempU[0]];
  s.R = rotateFaceCW(s.R);
  s.L = rotateFaceCCW(s.L);
}

function applyY(s: CubeState): void {
  const tempF = [...s.F] as FaceArray;
  const tempR = [...s.R] as FaceArray;
  const tempB = [...s.B] as FaceArray;
  const tempL = [...s.L] as FaceArray;

  s.F = tempR;
  s.R = tempB;
  s.B = tempL;
  s.L = tempF;
  s.U = rotateFaceCW(s.U);
  s.D = rotateFaceCCW(s.D);
}

function applyZ(s: CubeState): void {
  const tempU = [...s.U] as FaceArray;
  const tempR = [...s.R] as FaceArray;
  const tempD = [...s.D] as FaceArray;
  const tempL = [...s.L] as FaceArray;

  // All faces rotate when doing z
  s.U = [tempL[6], tempL[3], tempL[0], tempL[7], tempL[4], tempL[1], tempL[8], tempL[5], tempL[2]];
  s.R = [tempU[6], tempU[3], tempU[0], tempU[7], tempU[4], tempU[1], tempU[8], tempU[5], tempU[2]];
  s.D = [tempR[6], tempR[3], tempR[0], tempR[7], tempR[4], tempR[1], tempR[8], tempR[5], tempR[2]];
  s.L = [tempD[6], tempD[3], tempD[0], tempD[7], tempD[4], tempD[1], tempD[8], tempD[5], tempD[2]];
  s.F = rotateFaceCW(s.F);
  s.B = rotateFaceCCW(s.B);
}

// Apply a single move to the cube
function applyMove(s: CubeState, move: string): void {
  const match = move.match(/^([UDFBRLMESxyz])(['2]?)$/);
  if (!match) return;

  const face = match[1]!;
  const modifier = match[2] || "";

  let count = 1;
  if (modifier === "'") count = 3;
  if (modifier === "2") count = 2;

  const applyFns: Record<string, (s: CubeState) => void> = {
    U: applyU, D: applyD, R: applyR, L: applyL, F: applyF, B: applyB,
    M: applyM, E: applyE, S: applyS, x: applyX, y: applyY, z: applyZ,
  };

  const fn = applyFns[face];
  if (fn) {
    for (let i = 0; i < count; i++) {
      fn(s);
    }
  }
}

function applyScramble(scramble: string): CubeState {
  const state = createSolvedCube();
  const moves = scramble.trim().split(/\s+/).filter(Boolean);
  for (const move of moves) {
    applyMove(state, move);
  }
  return state;
}

export function ScrambleImage({ scramble, puzzleId, size = 120 }: ScrambleImageProps) {
  const state = useMemo(() => applyScramble(scramble), [scramble]);

  // Only show for 3x3
  if (puzzleId !== "333") {
    return (
      <div style={{
        color: "var(--color-text-muted)",
        fontSize: "10px",
        textAlign: "center",
        padding: "20px"
      }}>
        Preview only available for 3x3
      </div>
    );
  }

  const cellSize = size / 12;
  const faceSize = cellSize * 3;
  const gap = 1;

  const renderFace = (face: FaceArray, x: number, y: number) => {
    return face.map((color, i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      return (
        <rect
          key={`${x}-${y}-${i}`}
          x={x + col * (cellSize + gap)}
          y={y + row * (cellSize + gap)}
          width={cellSize}
          height={cellSize}
          fill={COLORS[color] || "#888"}
          stroke="var(--color-border)"
          strokeWidth={0.5}
          rx={1}
        />
      );
    });
  };

  // Layout: cross pattern
  //     U
  //   L F R B
  //     D
  const faceOffset = faceSize + gap * 3;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${faceSize * 4 + gap * 12} ${faceSize * 3 + gap * 9}`}
      style={{ display: "block" }}
    >
      {/* U face */}
      {renderFace(state.U, faceOffset, 0)}
      {/* L face */}
      {renderFace(state.L, 0, faceOffset)}
      {/* F face */}
      {renderFace(state.F, faceOffset, faceOffset)}
      {/* R face */}
      {renderFace(state.R, faceOffset * 2, faceOffset)}
      {/* B face */}
      {renderFace(state.B, faceOffset * 3, faceOffset)}
      {/* D face */}
      {renderFace(state.D, faceOffset, faceOffset * 2)}
    </svg>
  );
}

export default ScrambleImage;
