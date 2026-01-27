import React, { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { WcaEventId } from "../../types";

export interface ScrambleVisualizationModalProps {
  scramble: string;
  puzzleId: WcaEventId;
  puzzleLabel: string;
  onClose: () => void;
}

// WCA standard colors for cube faces
const FACE_COLORS: Record<string, number> = {
  U: 0xffffff, // White
  D: 0xffff00, // Yellow
  F: 0x00d800, // Green
  B: 0x0000ff, // Blue
  R: 0xff0000, // Red
  L: 0xff8c00, // Orange
};

// Get cube dimension from puzzle ID
function getCubeSize(puzzleId: WcaEventId): number {
  const sizeMap: Record<string, number> = {
    "222": 2,
    "333": 3,
    "444": 4,
    "555": 5,
    "666": 6,
    "777": 7,
  };
  return sizeMap[puzzleId] || 3;
}

// Create a single cubie for NxN cube
function createCubie(x: number, y: number, z: number, cubeSize: number, offset: number): THREE.Mesh {
  const cubieSize = 0.95;
  const geometry = new THREE.BoxGeometry(cubieSize, cubieSize, cubieSize);
  const maxPos = cubeSize - 1;
  const materials: THREE.MeshBasicMaterial[] = [];

  materials.push(new THREE.MeshBasicMaterial({ color: x === maxPos ? FACE_COLORS.R : 0x111111 }));
  materials.push(new THREE.MeshBasicMaterial({ color: x === 0 ? FACE_COLORS.L : 0x111111 }));
  materials.push(new THREE.MeshBasicMaterial({ color: y === maxPos ? FACE_COLORS.U : 0x111111 }));
  materials.push(new THREE.MeshBasicMaterial({ color: y === 0 ? FACE_COLORS.D : 0x111111 }));
  materials.push(new THREE.MeshBasicMaterial({ color: z === maxPos ? FACE_COLORS.F : 0x111111 }));
  materials.push(new THREE.MeshBasicMaterial({ color: z === 0 ? FACE_COLORS.B : 0x111111 }));

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.position.set(x - offset, y - offset, z - offset);
  return mesh;
}

// Parse move for NxN cube
function parseMoveNxN(move: string, cubeSize: number): {
  axis: "x" | "y" | "z";
  layers: number[];
  angle: number;
} | null {
  const match = move.match(/^(\d*)([UDFBRLMESxyz])w?(['2]?)$/);
  if (!match) return null;

  const widthStr = match[1] || "";
  const face = match[2]!;
  const modifier = match[3] || "";
  const isWide = move.includes("w") || (widthStr !== "" && !move.includes("w"));
  const width = widthStr ? parseInt(widthStr, 10) : (isWide ? 2 : 1);

  let angle = Math.PI / 2;
  if (modifier === "'") angle = -Math.PI / 2;
  if (modifier === "2") angle = Math.PI;

  const offset = (cubeSize - 1) / 2;
  const maxLayer = cubeSize - 1;

  const faceMap: Record<string, { axis: "x" | "y" | "z"; positive: boolean; dir: number }> = {
    U: { axis: "y", positive: true, dir: -1 },
    D: { axis: "y", positive: false, dir: 1 },
    R: { axis: "x", positive: true, dir: -1 },
    L: { axis: "x", positive: false, dir: 1 },
    F: { axis: "z", positive: true, dir: -1 },
    B: { axis: "z", positive: false, dir: 1 },
    M: { axis: "x", positive: false, dir: 1 },
    E: { axis: "y", positive: false, dir: 1 },
    S: { axis: "z", positive: true, dir: -1 },
    x: { axis: "x", positive: true, dir: -1 },
    y: { axis: "y", positive: true, dir: -1 },
    z: { axis: "z", positive: true, dir: -1 },
  };

  const f = faceMap[face];
  if (!f) return null;

  const layers: number[] = [];

  if (face === "x" || face === "y" || face === "z") {
    for (let i = 0; i < cubeSize; i++) {
      layers.push(Math.round(i - offset));
    }
  } else if (face === "M" || face === "E" || face === "S") {
    layers.push(0);
  } else {
    for (let i = 0; i < width && i < cubeSize; i++) {
      if (f.positive) {
        layers.push(Math.round(maxLayer - i - offset));
      } else {
        layers.push(Math.round(i - offset));
      }
    }
  }

  return { axis: f.axis, layers, angle: angle * f.dir };
}

const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 3];

export function ScrambleVisualizationModal({
  scramble,
  puzzleId,
  puzzleLabel,
  onClose,
}: ScrambleVisualizationModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cubeGroupRef = useRef<THREE.Group | null>(null);
  const animationIdRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const previousMouseRef = useRef({ x: 0, y: 0 });
  const rotationRef = useRef({ x: -0.5, y: 0.5 });

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [speedIndex, setSpeedIndex] = useState(2); // 1x default
  const [isAnimating, setIsAnimating] = useState(false);

  const cubeSize = getCubeSize(puzzleId);
  const offset = (cubeSize - 1) / 2;
  const scrambleMoves = scramble.trim().split(/\s+/).filter(Boolean);
  const size = 320;

  // Create cubies for the cube
  const createCubies = useCallback((group: THREE.Group) => {
    while (group.children.length > 0) {
      const child = group.children[0];
      if (child) group.remove(child);
    }

    for (let x = 0; x < cubeSize; x++) {
      for (let y = 0; y < cubeSize; y++) {
        for (let z = 0; z < cubeSize; z++) {
          if (x === 0 || x === cubeSize - 1 ||
              y === 0 || y === cubeSize - 1 ||
              z === 0 || z === cubeSize - 1) {
            const cubie = createCubie(x, y, z, cubeSize, offset);
            group.add(cubie);
          }
        }
      }
    }
  }, [cubeSize, offset]);

  // Apply a move instantly
  const applyMoveInstant = useCallback((group: THREE.Group, move: string) => {
    const parsed = parseMoveNxN(move, cubeSize);
    if (!parsed) return;

    const { axis, layers, angle } = parsed;
    const rotationAxis = new THREE.Vector3(
      axis === "x" ? 1 : 0,
      axis === "y" ? 1 : 0,
      axis === "z" ? 1 : 0
    );

    const quaternion = new THREE.Quaternion();
    quaternion.setFromAxisAngle(rotationAxis, angle);

    group.children.forEach((cubie) => {
      const coord = axis === "x" ? cubie.position.x : axis === "y" ? cubie.position.y : cubie.position.z;
      if (layers.includes(Math.round(coord))) {
        cubie.position.applyQuaternion(quaternion);
        cubie.position.x = Math.round(cubie.position.x * 2) / 2;
        cubie.position.y = Math.round(cubie.position.y * 2) / 2;
        cubie.position.z = Math.round(cubie.position.z * 2) / 2;
        cubie.quaternion.premultiply(quaternion);
      }
    });
  }, [cubeSize]);

  // Animate a move with smooth rotation - using incremental rotation to avoid deformation
  const animateMove = useCallback((group: THREE.Group, move: string, duration: number): Promise<void> => {
    return new Promise((resolve) => {
      const parsed = parseMoveNxN(move, cubeSize);
      if (!parsed) {
        resolve();
        return;
      }

      const { axis, layers, angle } = parsed;
      const rotationAxis = new THREE.Vector3(
        axis === "x" ? 1 : 0,
        axis === "y" ? 1 : 0,
        axis === "z" ? 1 : 0
      );

      // Find cubies to rotate and store their initial states
      const cubiesToAnimate: THREE.Object3D[] = [];
      const initialPositions: THREE.Vector3[] = [];
      const initialQuaternions: THREE.Quaternion[] = [];

      group.children.forEach((cubie) => {
        const coord = axis === "x" ? cubie.position.x : axis === "y" ? cubie.position.y : cubie.position.z;
        if (layers.includes(Math.round(coord))) {
          cubiesToAnimate.push(cubie);
          initialPositions.push(cubie.position.clone());
          initialQuaternions.push(cubie.quaternion.clone());
        }
      });

      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentAngle = angle * eased;

        const currentQuat = new THREE.Quaternion();
        currentQuat.setFromAxisAngle(rotationAxis, currentAngle);

        // Apply rotation from initial state
        cubiesToAnimate.forEach((cubie, i) => {
          const initPos = initialPositions[i]!;
          const initQuat = initialQuaternions[i]!;

          // Rotate position around axis
          const newPos = initPos.clone().applyQuaternion(currentQuat);
          cubie.position.copy(newPos);

          // Rotate the cubie itself
          cubie.quaternion.copy(initQuat).premultiply(currentQuat);
        });

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Animation complete - snap positions to grid
          cubiesToAnimate.forEach((cubie) => {
            cubie.position.x = Math.round(cubie.position.x * 2) / 2;
            cubie.position.y = Math.round(cubie.position.y * 2) / 2;
            cubie.position.z = Math.round(cubie.position.z * 2) / 2;
          });
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }, [cubeSize]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = cubeSize * 2.5;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const cubeGroup = new THREE.Group();
    cubeGroupRef.current = cubeGroup;
    createCubies(cubeGroup);
    scene.add(cubeGroup);

    cubeGroup.rotation.x = rotationRef.current.x;
    cubeGroup.rotation.y = rotationRef.current.y;

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationIdRef.current);
      renderer.dispose();
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [size, cubeSize, createCubies]);

  // Play/pause scramble animation
  useEffect(() => {
    if (!isPlaying || !cubeGroupRef.current || isAnimating) return;

    const playNextMove = async () => {
      if (currentMoveIndex >= scrambleMoves.length - 1) {
        setIsPlaying(false);
        return;
      }

      const nextIndex = currentMoveIndex + 1;
      const move = scrambleMoves[nextIndex];
      if (!move || !cubeGroupRef.current) return;

      setIsAnimating(true);
      setCurrentMoveIndex(nextIndex);

      const speed = SPEEDS[speedIndex] ?? 1;
      const duration = 300 / speed;

      await animateMove(cubeGroupRef.current, move, duration);
      setIsAnimating(false);
    };

    playNextMove();
  }, [isPlaying, currentMoveIndex, scrambleMoves, speedIndex, animateMove, isAnimating]);

  // Reset cube to solved state
  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentMoveIndex(-1);
    if (cubeGroupRef.current) {
      createCubies(cubeGroupRef.current);
      cubeGroupRef.current.rotation.x = rotationRef.current.x;
      cubeGroupRef.current.rotation.y = rotationRef.current.y;
    }
  }, [createCubies]);

  // Skip to end (apply all moves)
  const handleSkipToEnd = useCallback(() => {
    setIsPlaying(false);
    if (cubeGroupRef.current) {
      createCubies(cubeGroupRef.current);
      scrambleMoves.forEach((move) => applyMoveInstant(cubeGroupRef.current!, move));
      cubeGroupRef.current.rotation.x = rotationRef.current.x;
      cubeGroupRef.current.rotation.y = rotationRef.current.y;
    }
    setCurrentMoveIndex(scrambleMoves.length - 1);
  }, [scrambleMoves, createCubies, applyMoveInstant]);

  // Step forward one move
  const handleStepForward = useCallback(async () => {
    if (currentMoveIndex >= scrambleMoves.length - 1 || isAnimating) return;
    setIsPlaying(false);

    const nextIndex = currentMoveIndex + 1;
    const move = scrambleMoves[nextIndex];
    if (!move || !cubeGroupRef.current) return;

    setIsAnimating(true);
    setCurrentMoveIndex(nextIndex);

    const speed = SPEEDS[speedIndex] ?? 1;
    await animateMove(cubeGroupRef.current, move, 300 / speed);
    setIsAnimating(false);
  }, [currentMoveIndex, scrambleMoves, speedIndex, animateMove, isAnimating]);

  // Step backward one move
  const handleStepBackward = useCallback(() => {
    if (currentMoveIndex < 0 || isAnimating) return;
    setIsPlaying(false);

    // Rebuild cube up to previous move
    const newIndex = currentMoveIndex - 1;
    if (cubeGroupRef.current) {
      createCubies(cubeGroupRef.current);
      for (let i = 0; i <= newIndex; i++) {
        const move = scrambleMoves[i];
        if (move) applyMoveInstant(cubeGroupRef.current, move);
      }
      cubeGroupRef.current.rotation.x = rotationRef.current.x;
      cubeGroupRef.current.rotation.y = rotationRef.current.y;
    }
    setCurrentMoveIndex(newIndex);
  }, [currentMoveIndex, scrambleMoves, createCubies, applyMoveInstant, isAnimating]);

  // Mouse handlers for rotation
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true;
    previousMouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || !cubeGroupRef.current) return;

    const deltaX = e.clientX - previousMouseRef.current.x;
    const deltaY = e.clientY - previousMouseRef.current.y;

    rotationRef.current.y += deltaX * 0.01;
    rotationRef.current.x += deltaY * 0.01;

    cubeGroupRef.current.rotation.x = rotationRef.current.x;
    cubeGroupRef.current.rotation.y = rotationRef.current.y;

    previousMouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        onClose();
      } else if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === "ArrowRight") {
        handleStepForward();
      } else if (e.code === "ArrowLeft") {
        handleStepBackward();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, handleStepForward, handleStepBackward]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "12px",
          padding: "20px",
          border: "1px solid var(--color-border)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          maxWidth: "90vw",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <span style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}>
            {puzzleLabel} Scramble
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-text-muted)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 3D Cube */}
        <div
          ref={containerRef}
          style={{
            width: size,
            height: size,
            cursor: "grab",
            borderRadius: "8px",
            overflow: "hidden",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Controls */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}>
          <button onClick={handleReset} title="Reset (R)" style={buttonStyle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>

          <button onClick={handleStepBackward} title="Previous (←)" style={buttonStyle} disabled={currentMoveIndex < 0 || isAnimating}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="19 20 9 12 19 4 19 20" />
              <rect x="5" y="4" width="2" height="16" />
            </svg>
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            style={{
              ...buttonStyle,
              backgroundColor: isPlaying ? "var(--color-focus)" : "var(--color-surface-raised)",
              color: isPlaying ? "white" : "var(--color-text-secondary)",
              width: "44px",
              height: "44px",
            }}
            disabled={isAnimating && !isPlaying}
          >
            {isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          <button onClick={handleStepForward} title="Next (→)" style={buttonStyle} disabled={currentMoveIndex >= scrambleMoves.length - 1 || isAnimating}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4" />
              <rect x="17" y="4" width="2" height="16" />
            </svg>
          </button>

          <button onClick={handleSkipToEnd} title="Skip to end" style={buttonStyle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4" />
              <rect x="17" y="4" width="4" height="16" />
            </svg>
          </button>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            marginLeft: "8px",
            padding: "4px 8px",
            backgroundColor: "var(--color-surface-raised)",
            border: "1px solid var(--color-border)",
            borderRadius: "6px",
            fontSize: "12px",
            color: "var(--color-text-muted)",
          }}>
            <button
              onClick={() => setSpeedIndex((i) => Math.max(0, i - 1))}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "2px" }}
            >
              −
            </button>
            <span style={{ minWidth: "36px", textAlign: "center" }}>{SPEEDS[speedIndex]}x</span>
            <button
              onClick={() => setSpeedIndex((i) => Math.min(SPEEDS.length - 1, i + 1))}
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "2px" }}
            >
              +
            </button>
          </div>
        </div>

        {/* Hint */}
        <div style={{
          textAlign: "center",
          color: "var(--color-text-disabled)",
          fontSize: "10px",
        }}>
          Drag to rotate • Space to play/pause • Arrow keys to step
        </div>
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "36px",
  height: "36px",
  backgroundColor: "var(--color-surface-raised)",
  border: "1px solid var(--color-border)",
  borderRadius: "6px",
  color: "var(--color-text-secondary)",
  cursor: "pointer",
  transition: "all 100ms ease-out",
};

export default ScrambleVisualizationModal;
