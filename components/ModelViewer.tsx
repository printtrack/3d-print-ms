"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Maximize, Move, RotateCcw } from "lucide-react";
import { get3DExtension } from "@/lib/utils";

export interface NotePosition {
  id: string;
  posX: number;
  posY: number;
  posZ: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  resolved: boolean;
}

export interface ModelViewerProps {
  url: string;
  filename: string;
  notes?: NotePosition[];
  selectedNoteId?: string | null;
  annotationMode?: boolean;
  onAddNote?: (hit: { posX: number; posY: number; posZ: number; normalX: number; normalY: number; normalZ: number }) => void;
  onSelectNote?: (id: string) => void;
}

function scaleToFit(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) object.scale.setScalar(2 / maxDim);
  box.setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
}

const BASE_MATERIAL = new THREE.MeshStandardMaterial({
  color: "#6366f1",
  roughness: 0.4,
  metalness: 0.1,
});

async function loadModel(url: string, ext: string): Promise<THREE.Object3D> {
  if (ext === "stl") {
    const geo = await new STLLoader().loadAsync(url);
    return new THREE.Mesh(geo, BASE_MATERIAL);
  }
  if (ext === "obj") {
    const obj = await new OBJLoader().loadAsync(url);
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = BASE_MATERIAL;
    });
    return obj;
  }
  if (ext === "3mf") {
    return await new ThreeMFLoader().loadAsync(url) as unknown as THREE.Object3D;
  }
  throw new Error(`Unsupported format: ${ext}`);
}

const INITIAL_CAM = new THREE.Vector3(3, 2, 3);
const INITIAL_TARGET = new THREE.Vector3(0, 0, 0);

export function ModelViewer({
  url,
  filename,
  notes = [],
  selectedNoteId = null,
  annotationMode = false,
  onAddNote,
  onSelectNote,
}: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [navMode, setNavMode] = useState<"orbit" | "pan">("orbit");

  const sceneRef = useRef<{
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    model: THREE.Object3D;
    matrixWorld: THREE.Matrix4;
    matrixWorldInverse: THREE.Matrix4;
    bboxSize: number;
    meshes: THREE.Mesh[];
    renderer: THREE.WebGLRenderer;
  } | null>(null);

  // Tween state for fly-to / reset animation
  const tweenRef = useRef<{
    from: { cam: THREE.Vector3; target: THREE.Vector3 };
    to: { cam: THREE.Vector3; target: THREE.Vector3 };
    startTime: number;
    duration: number;
  } | null>(null);

  const ext = get3DExtension(filename);
  // Refs so the animate() closure always reads latest values without stale captures
  const notesRef = useRef(notes);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  const selectedNoteIdRef = useRef(selectedNoteId);
  useEffect(() => { selectedNoteIdRef.current = selectedNoteId; }, [selectedNoteId]);

  const projectToScreen = useCallback(
    (worldPos: THREE.Vector3, camera: THREE.PerspectiveCamera, container: HTMLDivElement) => {
      const v = worldPos.clone().project(camera);
      const { clientWidth: w, clientHeight: h } = container;
      return {
        x: ((v.x + 1) / 2) * w,
        y: ((-v.y + 1) / 2) * h,
        behind: v.z > 1,
      };
    },
    []
  );

  const resetView = useCallback(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    tweenRef.current = {
      from: { cam: sc.camera.position.clone(), target: sc.controls.target.clone() },
      to: { cam: INITIAL_CAM.clone(), target: INITIAL_TARGET.clone() },
      startTime: Date.now(),
      duration: 300,
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animId: number;
    let renderer: THREE.WebGLRenderer;
    let cancelled = false;

    const run = async () => {
      await new Promise<void>((resolve) => {
        const check = () => {
          if (container.clientWidth > 0 && container.clientHeight > 0) resolve();
          else requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      });
      if (cancelled) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#f1f5f9");

      const { clientWidth: w, clientHeight: h } = container;
      const camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 1000);
      camera.position.copy(INITIAL_CAM);

      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dir1 = new THREE.DirectionalLight(0xffffff, 1);
      dir1.position.set(5, 10, 5);
      scene.add(dir1);
      const dir2 = new THREE.DirectionalLight(0xffffff, 0.3);
      dir2.position.set(-5, -5, -5);
      scene.add(dir2);

      const model = await loadModel(url, ext);
      if (cancelled) return;
      scaleToFit(model);
      scene.add(model);
      model.updateMatrixWorld(true);

      const matrixWorld = model.matrixWorld.clone();
      const matrixWorldInverse = matrixWorld.clone().invert();
      const box = new THREE.Box3().setFromObject(model);
      const bboxSize = box.getSize(new THREE.Vector3()).length();

      const meshes: THREE.Mesh[] = [];
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
      });

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(w, h);

      if (canvasWrapRef.current) {
        canvasWrapRef.current.appendChild(renderer.domElement);
      } else {
        container.appendChild(renderer.domElement);
      }

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enablePan = true;
      controls.minDistance = 0.5;
      controls.maxDistance = 10;
      // Fusion-like: left=orbit, middle=pan, right=pan, shift+left=pan
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.PAN,
      };
      controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      };
      controls.update();

      sceneRef.current = { camera, controls, model, matrixWorld, matrixWorldInverse, bboxSize, meshes, renderer };
      if (!cancelled) setLoaded(true);

      // Keyboard shortcuts
      function onKeyDown(e: KeyboardEvent) {
        if (e.key === "f" || e.key === "F" || e.key === "r" || e.key === "R") {
          // Only when viewer is focused / pointer is inside
          if (containerRef.current?.matches(":hover") || containerRef.current?.contains(document.activeElement)) {
            tweenRef.current = {
              from: { cam: camera.position.clone(), target: controls.target.clone() },
              to: { cam: INITIAL_CAM.clone(), target: INITIAL_TARGET.clone() },
              startTime: Date.now(),
              duration: 300,
            };
          }
        }
      }
      window.addEventListener("keydown", onKeyDown);

      const ro = new ResizeObserver(() => {
        const { clientWidth: rw, clientHeight: rh } = container;
        camera.aspect = rw / rh;
        camera.updateProjectionMatrix();
        renderer.setSize(rw, rh);
      });
      ro.observe(container);

      // Shared raycaster for per-frame occlusion checks — allocated once, not per-marker
      const occlusionRaycaster = new THREE.Raycaster();
      let prevCamX = NaN;
      let prevCamY = NaN;
      let prevCamZ = NaN;

      function animate() {
        animId = requestAnimationFrame(animate);

        if (tweenRef.current) {
          const t = Math.min((Date.now() - tweenRef.current.startTime) / tweenRef.current.duration, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          camera.position.lerpVectors(tweenRef.current.from.cam, tweenRef.current.to.cam, ease);
          controls.target.lerpVectors(tweenRef.current.from.target, tweenRef.current.to.target, ease);
          controls.update();
          if (t >= 1) tweenRef.current = null;
        } else {
          controls.update();
        }

        renderer.render(scene, camera);

        // Update marker DOM positions
        const markerLayer = containerRef.current?.querySelector("[data-marker-layer]");
        if (!markerLayer || !containerRef.current) return;
        const markers = markerLayer.querySelectorAll<HTMLElement>("[data-note-id]");

        // Only re-run occlusion raycasts when the camera actually moved
        const camMoved =
          camera.position.x !== prevCamX ||
          camera.position.y !== prevCamY ||
          camera.position.z !== prevCamZ;
        if (camMoved) {
          prevCamX = camera.position.x;
          prevCamY = camera.position.y;
          prevCamZ = camera.position.z;
        }

        markers.forEach((el) => {
          const noteId = el.dataset.noteId!;
          const note = notesRef.current.find((n) => n.id === noteId);
          if (!note) return;

          const worldPos = new THREE.Vector3(note.posX, note.posY, note.posZ);
          const worldNormal = new THREE.Vector3(note.normalX, note.normalY, note.normalZ).normalize();
          const offsetPos = worldPos.clone().addScaledVector(worldNormal, 0.02);

          const { x, y, behind } = projectToScreen(offsetPos, camera, containerRef.current!);

          if (camMoved) {
            let occluded = behind;
            if (!behind) {
              const toMarker = worldPos.clone().sub(camera.position);
              const dist = toMarker.length();
              occlusionRaycaster.set(camera.position, toMarker.normalize());
              const hits = occlusionRaycaster.intersectObjects(meshes, false);
              // Occluded if a mesh surface is closer than the marker (epsilon matches offset)
              occluded = hits.length > 0 && hits[0].distance < dist - 0.05;
            }
            el.dataset.occluded = occluded ? "1" : "0";
          }

          const occluded = el.dataset.occluded === "1";
          const isSelected = noteId === selectedNoteIdRef.current;
          const isHovered = el.matches(":hover");
          const scale = isSelected ? 1.25 : isHovered ? 1.1 : 1;

          el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${scale})`;
          el.style.visibility = "visible";
          el.style.opacity = occluded ? "0" : "1";
          el.style.pointerEvents = occluded ? "none" : "auto";
        });
      }
      animate();

      return () => {
        ro.disconnect();
        window.removeEventListener("keydown", onKeyDown);
      };
    };

    run().catch(() => { if (!cancelled) setError(true); });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      renderer?.dispose();
      if (canvasWrapRef.current) canvasWrapRef.current.innerHTML = "";
      setLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ext]);

  // Sync nav mode → OrbitControls mouse buttons
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    if (navMode === "pan") {
      sc.controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      };
    } else {
      sc.controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.PAN,
      };
    }
  }, [navMode]);

  // Fly-to when selectedNoteId changes
  useEffect(() => {
    if (!selectedNoteId || !sceneRef.current) return;
    const note = notes.find((n) => n.id === selectedNoteId);
    if (!note) return;

    const { camera, controls, bboxSize } = sceneRef.current;
    // Coordinates stored in world space — use directly
    const worldPos = new THREE.Vector3(note.posX, note.posY, note.posZ);
    const worldNormal = new THREE.Vector3(note.normalX, note.normalY, note.normalZ).normalize();
    const idealDist = Math.max(bboxSize * 0.8, 1.5);
    const targetCam = worldPos.clone().addScaledVector(worldNormal, idealDist);

    tweenRef.current = {
      from: { cam: camera.position.clone(), target: controls.target.clone() },
      to: { cam: targetCam, target: worldPos },
      startTime: Date.now(),
      duration: 200,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoteId]);

  // Click handler for annotation mode
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc || !annotationMode || !onAddNote) return;

    const { camera, renderer, meshes } = sc;
    const canvas = renderer.domElement;

    let downX = 0;
    let downY = 0;
    let moved = false;

    function onPointerDown(e: PointerEvent) {
      downX = e.clientX;
      downY = e.clientY;
      moved = false;
    }
    function onPointerMove(e: PointerEvent) {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) moved = true;
    }
    function onPointerUp(e: PointerEvent) {
      if (moved) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      const hits = raycaster.intersectObjects(meshes, true);
      if (hits.length === 0 || !hits[0].face) return;

      const worldPoint = hits[0].point;
      const hitMesh = hits[0].object as THREE.Mesh;
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(hitMesh.matrixWorld);
      const worldNormal = hits[0].face.normal.clone().applyMatrix3(normalMatrix).normalize();

      // Ensure normal always faces the camera — some STL/OBJ files have inverted winding
      const camDir = camera.getWorldDirection(new THREE.Vector3());
      if (worldNormal.dot(camDir) > 0) worldNormal.negate();

      onAddNote?.({
        posX: worldPoint.x,
        posY: worldPoint.y,
        posZ: worldPoint.z,
        normalX: worldNormal.x,
        normalY: worldNormal.y,
        normalZ: worldNormal.z,
      });
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
    };
  }, [annotationMode, onAddNote]);

  if (error) {
    return (
      <div className="w-full h-full rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">
        Vorschau nicht verfügbar
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ cursor: annotationMode ? "crosshair" : undefined }}
    >
      {/* Canvas wrapper */}
      <div ref={canvasWrapRef} className="w-full h-full" />

      {/* Marker overlay — no overflow-hidden to avoid clipping near edges */}
      <div
        data-marker-layer="true"
        className="absolute inset-0 pointer-events-none"
      >
        {notes.map((note, idx) => (
          <button
            key={note.id}
            type="button"
            data-note-id={note.id}
            aria-selected={note.id === selectedNoteId}
            onClick={() => onSelectNote?.(note.id)}
            // Set visibility:hidden only on first mount — don't reset it on re-renders, which
            // would cause a one-frame flicker until animate() repositions the element.
            ref={(el) => {
              if (el && !el.dataset.initialized) {
                el.style.visibility = "hidden";
                el.dataset.initialized = "1";
              }
            }}
            style={{ top: 0, left: 0 }}
            className={`
              absolute pointer-events-auto z-10
              w-6 h-6 rounded-full border-2 border-white shadow-md
              flex items-center justify-center
              text-[10px] font-bold text-white
              ${note.id === selectedNoteId ? "ring-2 ring-white" : ""}
              bg-red-500
            `}
            title={`Notiz ${idx + 1}`}
          >
            {idx + 1}
          </button>
        ))}
      </div>

      {/* Navigation toolbar — bottom center */}
      {loaded && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-background/80 backdrop-blur rounded-lg px-1.5 py-1 shadow-sm border text-xs select-none z-10">
          <button
            type="button"
            onClick={() => setNavMode("orbit")}
            title="Drehen (Links-Drag)"
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
              navMode === "orbit"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <RotateCcw className="h-3 w-3" />
            <span>Drehen</span>
          </button>
          <button
            type="button"
            onClick={() => setNavMode("pan")}
            title="Verschieben (Links-Drag im Pan-Modus)"
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
              navMode === "pan"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Move className="h-3 w-3" />
            <span>Pan</span>
          </button>
          <div className="w-px h-3 bg-border mx-0.5" />
          <button
            type="button"
            onClick={resetView}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Ansicht zurücksetzen (F)"
          >
            <Maximize className="h-3 w-3" />
            <span>Reset</span>
            <kbd className="text-[9px] opacity-50">F</kbd>
          </button>
        </div>
      )}
    </div>
  );
}
