import React, { useRef, useEffect, useCallback, useState } from "react";
import * as THREE from "three";
import { WcaEventId } from "../../types";

export interface CubeVisualizationProps {
  scramble: string;
  puzzleId: WcaEventId;
  appliedMoves?: string[];
  size?: number;
  interactive?: boolean;
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

// Create a single cubie (small cube piece) for NxN cube
function createCubie(x: number, y: number, z: number, cubeSize: number, offset: number): THREE.Mesh {
  const cubieSize = 0.95;
  const geometry = new THREE.BoxGeometry(cubieSize, cubieSize, cubieSize);

  // Determine face colors based on position (edge positions)
  const maxPos = cubeSize - 1;
  const materials: THREE.MeshBasicMaterial[] = [];

  // Order: +X, -X, +Y, -Y, +Z, -Z (right, left, top, bottom, front, back)
  materials.push(new THREE.MeshBasicMaterial({
    color: x === maxPos ? FACE_COLORS.R : 0x111111
  })); // Right
  materials.push(new THREE.MeshBasicMaterial({
    color: x === 0 ? FACE_COLORS.L : 0x111111
  })); // Left
  materials.push(new THREE.MeshBasicMaterial({
    color: y === maxPos ? FACE_COLORS.U : 0x111111
  })); // Up
  materials.push(new THREE.MeshBasicMaterial({
    color: y === 0 ? FACE_COLORS.D : 0x111111
  })); // Down
  materials.push(new THREE.MeshBasicMaterial({
    color: z === maxPos ? FACE_COLORS.F : 0x111111
  })); // Front
  materials.push(new THREE.MeshBasicMaterial({
    color: z === 0 ? FACE_COLORS.B : 0x111111
  })); // Back

  const mesh = new THREE.Mesh(geometry, materials);
  // Position cubie with offset so cube is centered
  mesh.position.set(x - offset, y - offset, z - offset);

  return mesh;
}

// Parse a move for NxN cube (handles wide moves like Rw, 2R, 3Rw, etc.)
function parseMoveNxN(move: string, cubeSize: number): {
  axis: "x" | "y" | "z";
  layers: number[]; // which layers to rotate (0-indexed from the face)
  angle: number;
} | null {
  // Match patterns: U, U', U2, Uw, Uw', Uw2, 2U, 2U', 2U2, 3Uw, 3Uw', etc.
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

  // Map faces to axis and direction
  const faceMap: Record<string, { axis: "x" | "y" | "z"; positive: boolean; dir: number }> = {
    U: { axis: "y", positive: true, dir: -1 },
    D: { axis: "y", positive: false, dir: 1 },
    R: { axis: "x", positive: true, dir: -1 },
    L: { axis: "x", positive: false, dir: 1 },
    F: { axis: "z", positive: true, dir: -1 },
    B: { axis: "z", positive: false, dir: 1 },
    M: { axis: "x", positive: false, dir: 1 }, // middle slice
    E: { axis: "y", positive: false, dir: 1 },
    S: { axis: "z", positive: true, dir: -1 },
    x: { axis: "x", positive: true, dir: -1 },
    y: { axis: "y", positive: true, dir: -1 },
    z: { axis: "z", positive: true, dir: -1 },
  };

  const f = faceMap[face];
  if (!f) return null;

  // Calculate which layers to rotate
  const layers: number[] = [];

  if (face === "x" || face === "y" || face === "z") {
    // Whole cube rotation - all layers
    for (let i = 0; i < cubeSize; i++) {
      layers.push(Math.round(i - offset));
    }
  } else if (face === "M" || face === "E" || face === "S") {
    // Middle slice (only makes sense for odd cubes)
    layers.push(0);
  } else {
    // Regular or wide move
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

// Apply a rotation to the cube group (for NxN cubes)
function applyMoveToGroupNxN(group: THREE.Group, move: string, cubeSize: number) {
  const parsed = parseMoveNxN(move, cubeSize);
  if (!parsed) return;

  const { axis, layers, angle } = parsed;

  // Get cubies to rotate
  const cubiesToRotate: THREE.Object3D[] = [];

  group.children.forEach((cubie) => {
    const pos = cubie.position;
    let shouldRotate = false;

    const coord = axis === "x" ? pos.x : axis === "y" ? pos.y : pos.z;
    shouldRotate = layers.includes(Math.round(coord));

    if (shouldRotate) {
      cubiesToRotate.push(cubie);
    }
  });

  // Create rotation matrix
  const rotationAxis = new THREE.Vector3(
    axis === "x" ? 1 : 0,
    axis === "y" ? 1 : 0,
    axis === "z" ? 1 : 0
  );

  const quaternion = new THREE.Quaternion();
  quaternion.setFromAxisAngle(rotationAxis, angle);

  // Apply rotation
  cubiesToRotate.forEach((cubie) => {
    cubie.position.applyQuaternion(quaternion);
    // Round to nearest 0.5 for proper alignment
    cubie.position.x = Math.round(cubie.position.x * 2) / 2;
    cubie.position.y = Math.round(cubie.position.y * 2) / 2;
    cubie.position.z = Math.round(cubie.position.z * 2) / 2;
    cubie.quaternion.premultiply(quaternion);
  });
}

export function CubeVisualization({
  scramble,
  puzzleId,
  appliedMoves = [],
  size = 200,
  interactive = true,
}: CubeVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cubeGroupRef = useRef<THREE.Group | null>(null);
  const isDraggingRef = useRef(false);
  const previousMouseRef = useRef({ x: 0, y: 0 });
  const rotationRef = useRef({ x: -0.5, y: 0.5 });
  const [isHovered, setIsHovered] = useState(false);

  // Get cube dimension from puzzle ID
  const cubeSize = getCubeSize(puzzleId);
  const offset = (cubeSize - 1) / 2;

  // Check if puzzle is a cube (NxN)
  const isCube = ["222", "333", "444", "555", "666", "777"].includes(puzzleId);

  // Only show for cube puzzles
  if (!isCube) {
    return (
      <div style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-text-muted)",
        fontSize: "12px",
        textAlign: "center"
      }}>
        3D view available for NxN cubes only
      </div>
    );
  }

  // Create all cubies for the NxN cube
  const createCubies = (group: THREE.Group) => {
    // Clear existing
    while (group.children.length > 0) {
      const child = group.children[0];
      if (child) group.remove(child);
    }

    // Create cubies for each position
    for (let x = 0; x < cubeSize; x++) {
      for (let y = 0; y < cubeSize; y++) {
        for (let z = 0; z < cubeSize; z++) {
          // Only create cubies on the surface (at least one coordinate is 0 or max)
          if (x === 0 || x === cubeSize - 1 ||
              y === 0 || y === cubeSize - 1 ||
              z === 0 || z === cubeSize - 1) {
            const cubie = createCubie(x, y, z, cubeSize, offset);
            group.add(cubie);
          }
        }
      }
    }
  };

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // Camera - adjust distance based on cube size
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = cubeSize * 2.5;
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create cube group
    const cubeGroup = new THREE.Group();
    cubeGroupRef.current = cubeGroup;

    // Create cubies
    createCubies(cubeGroup);

    scene.add(cubeGroup);

    // Apply scramble
    const scrambleMoves = scramble.trim().split(/\s+/).filter(Boolean);
    scrambleMoves.forEach((move) => applyMoveToGroupNxN(cubeGroup, move, cubeSize));

    // Apply additional moves
    appliedMoves.forEach((move) => applyMoveToGroupNxN(cubeGroup, move, cubeSize));

    // Set initial rotation
    cubeGroup.rotation.x = rotationRef.current.x;
    cubeGroup.rotation.y = rotationRef.current.y;

    // Animation loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      renderer.dispose();
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [size, cubeSize]);

  // Update cube when scramble or moves change
  useEffect(() => {
    if (!cubeGroupRef.current || !sceneRef.current) return;

    // Create fresh cubies
    createCubies(cubeGroupRef.current);

    // Apply scramble
    const scrambleMoves = scramble.trim().split(/\s+/).filter(Boolean);
    scrambleMoves.forEach((move) => applyMoveToGroupNxN(cubeGroupRef.current!, move, cubeSize));

    // Apply additional moves
    appliedMoves.forEach((move) => applyMoveToGroupNxN(cubeGroupRef.current!, move, cubeSize));

    // Restore rotation
    cubeGroupRef.current.rotation.x = rotationRef.current.x;
    cubeGroupRef.current.rotation.y = rotationRef.current.y;
  }, [scramble, appliedMoves.join(","), cubeSize]);

  // Update camera position when cube size changes
  useEffect(() => {
    if (cameraRef.current) {
      cameraRef.current.position.z = cubeSize * 2.5;
    }
  }, [cubeSize]);

  // Mouse handlers for rotation
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!interactive) return;
    isDraggingRef.current = true;
    previousMouseRef.current = { x: e.clientX, y: e.clientY };
  }, [interactive]);

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

  return (
    <div
      ref={containerRef}
      style={{
        width: size,
        height: size,
        cursor: interactive ? (isHovered ? "grab" : "default") : "default",
        borderRadius: "8px",
        overflow: "hidden",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        setIsHovered(false);
      }}
      onMouseEnter={() => setIsHovered(true)}
    />
  );
}

export default CubeVisualization;
