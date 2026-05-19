"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Layers, Maximize, Move, RotateCcw } from "lucide-react";
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

export interface OrientationQuaternion {
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

export interface ModelViewerProps {
  url: string;
  filename: string;
  notes?: NotePosition[];
  selectedNoteId?: string | null;
  annotationMode?: boolean;
  onAddNote?: (hit: { posX: number; posY: number; posZ: number; normalX: number; normalY: number; normalZ: number }) => void;
  onSelectNote?: (id: string) => void;
  // Orientation feature
  buildVolume?: { x: number; y: number; z: number };
  initialOrientation?: OrientationQuaternion;
  onOrientationChange?: (q: OrientationQuaternion) => void;
  orientationEditable?: boolean;
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

const HIGHLIGHT_MATERIAL = new THREE.MeshBasicMaterial({
  color: "#f59e0b",
  transparent: true,
  opacity: 0.45,
  depthTest: false,
  side: THREE.DoubleSide,
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

// Z-up convention: camera looks down from above, build plate is in the XY plane
const INITIAL_CAM = new THREE.Vector3(3, -3, 2.5);
const INITIAL_TARGET = new THREE.Vector3(0, 0, 0);

// Re-positions the model so its bbox is centered in XY and bottom sits at Z=0
function sitOnPlate(model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= center.y;
  model.position.z -= box.min.z;
}

// Builds a set of coplanar faces (same world normal within tolerance) from a non-indexed STL mesh
function buildCoplanarFaceGeometry(mesh: THREE.Mesh, targetNormal: THREE.Vector3): THREE.BufferGeometry | null {
  const geo = mesh.geometry;
  const posAttr = geo.attributes.position;
  if (!posAttr) return null;

  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const positions: number[] = [];

  if (geo.index) {
    // Indexed geometry: iterate triangles
    const idx = geo.index;
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
      const vA = new THREE.Vector3().fromBufferAttribute(posAttr, a).applyMatrix4(mesh.matrixWorld);
      const vB = new THREE.Vector3().fromBufferAttribute(posAttr, b).applyMatrix4(mesh.matrixWorld);
      const vC = new THREE.Vector3().fromBufferAttribute(posAttr, c).applyMatrix4(mesh.matrixWorld);
      const edge1 = vB.clone().sub(vA), edge2 = vC.clone().sub(vA);
      const n = edge1.cross(edge2).normalize().applyMatrix3(normalMatrix).normalize();
      if (Math.abs(n.dot(targetNormal)) > 0.98) {
        positions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, vC.x, vC.y, vC.z);
      }
    }
  } else {
    // Non-indexed (STL): 3 vertices per face
    for (let i = 0; i < posAttr.count; i += 3) {
      const vA = new THREE.Vector3().fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
      const vB = new THREE.Vector3().fromBufferAttribute(posAttr, i + 1).applyMatrix4(mesh.matrixWorld);
      const vC = new THREE.Vector3().fromBufferAttribute(posAttr, i + 2).applyMatrix4(mesh.matrixWorld);
      const edge1 = vB.clone().sub(vA), edge2 = vC.clone().sub(vA);
      const n = edge1.cross(edge2).normalize();
      if (Math.abs(n.dot(targetNormal)) > 0.98) {
        positions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z, vC.x, vC.y, vC.z);
      }
    }
  }

  if (positions.length === 0) return null;
  const outGeo = new THREE.BufferGeometry();
  outGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  return outGeo;
}

export function ModelViewer({
  url,
  filename,
  notes = [],
  selectedNoteId = null,
  annotationMode = false,
  onAddNote,
  onSelectNote,
  buildVolume,
  initialOrientation,
  onOrientationChange,
  orientationEditable = false,
}: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [navMode, setNavMode] = useState<"orbit" | "pan" | "face-select">("orbit");

  const sceneRef = useRef<{
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    model: THREE.Object3D;
    matrixWorld: THREE.Matrix4;
    matrixWorldInverse: THREE.Matrix4;
    bboxSize: number;
    meshes: THREE.Mesh[];
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    plateMesh: THREE.Mesh | null;
    gridHelper: THREE.GridHelper | null;
    highlightMesh: THREE.Mesh | null;
    rawMaxDim: number;
  } | null>(null);

  // Tween state for fly-to / reset animation
  const tweenRef = useRef<{
    from: { cam: THREE.Vector3; target: THREE.Vector3 };
    to: { cam: THREE.Vector3; target: THREE.Vector3 };
    startTime: number;
    duration: number;
  } | null>(null);

  const ext = get3DExtension(filename);
  const notesRef = useRef(notes);
  useEffect(() => { notesRef.current = notes; }, [notes]);
  const selectedNoteIdRef = useRef(selectedNoteId);
  useEffect(() => { selectedNoteIdRef.current = selectedNoteId; }, [selectedNoteId]);
  const navModeRef = useRef(navMode);
  useEffect(() => { navModeRef.current = navMode; }, [navMode]);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

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
      camera.up.set(0, 0, 1); // Z-up convention

      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dir1 = new THREE.DirectionalLight(0xffffff, 1);
      dir1.position.set(5, -5, 10);
      scene.add(dir1);
      const dir2 = new THREE.DirectionalLight(0xffffff, 0.3);
      dir2.position.set(-5, 5, -5);
      scene.add(dir2);

      const model = await loadModel(url, ext);
      if (cancelled) return;

      // Apply user-chosen orientation before scaling so bbox is correct
      if (initialOrientation) {
        model.quaternion.set(
          initialOrientation.qx,
          initialOrientation.qy,
          initialOrientation.qz,
          initialOrientation.qw
        );
      }

      // Track raw size BEFORE scaling (STL units ≈ mm by convention) for plate sizing
      model.updateMatrixWorld(true);
      const rawBox = new THREE.Box3().setFromObject(model);
      const rawSize = rawBox.getSize(new THREE.Vector3());
      const rawMaxDim = Math.max(rawSize.x, rawSize.y, rawSize.z) || 1;

      scaleToFit(model);
      scene.add(model);

      // Sit model on virtual plate (bottom at Z=0)
      sitOnPlate(model);
      model.updateMatrixWorld(true);

      const matrixWorld = model.matrixWorld.clone();
      const matrixWorldInverse = matrixWorld.clone().invert();
      const box = new THREE.Box3().setFromObject(model);
      const bboxSize = box.getSize(new THREE.Vector3()).length();

      const meshes: THREE.Mesh[] = [];
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
      });

      // Build plate and grid (only if buildVolume is provided)
      let plateMesh: THREE.Mesh | null = null;
      let gridHelper: THREE.GridHelper | null = null;
      if (buildVolume) {
        const scaleF = 2 / rawMaxDim; // same scale applied by scaleToFit
        const plateW = buildVolume.x * scaleF;
        const plateD = buildVolume.y * scaleF;
        const plateGeo = new THREE.PlaneGeometry(plateW, plateD);
        const plateMat = new THREE.MeshBasicMaterial({
          color: "#94a3b8",
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
        });
        plateMesh = new THREE.Mesh(plateGeo, plateMat);
        plateMesh.position.z = 0;
        scene.add(plateMesh);

        const gridSize = Math.max(plateW, plateD);
        gridHelper = new THREE.GridHelper(gridSize, 10, 0xaab4be, 0xcbd5e1);
        gridHelper.rotation.x = Math.PI / 2; // XZ grid → XY plane for Z-up
        gridHelper.position.z = 0.001; // slightly above plate to avoid z-fighting
        scene.add(gridHelper);
      }

      // Highlight mesh — rebuilt when hovered face changes
      let highlightMesh: THREE.Mesh | null = null;

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

      sceneRef.current = {
        camera,
        controls,
        model,
        matrixWorld,
        matrixWorldInverse,
        bboxSize,
        meshes,
        renderer,
        scene,
        plateMesh,
        gridHelper,
        highlightMesh,
        rawMaxDim,
      };
      if (!cancelled) setLoaded(true);

      // Keyboard shortcuts
      function onKeyDown(e: KeyboardEvent) {
        if (e.key === "f" || e.key === "F" || e.key === "r" || e.key === "R") {
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

      const occlusionRaycaster = new THREE.Raycaster();
      let prevCamX = NaN, prevCamY = NaN, prevCamZ = NaN;
      let lastHoverNormalKey = "";

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

        // Build plate fade based on camera elevation angle
        const sc = sceneRef.current;
        if (sc && (sc.plateMesh || sc.gridHelper)) {
          const camElevation = Math.atan2(
            camera.position.z - controls.target.z,
            Math.hypot(camera.position.x - controls.target.x, camera.position.y - controls.target.y)
          );
          // Fade out when camera goes below plate level (~< -11°)
          const fade = Math.max(0, Math.min(1, (camElevation + 0.2) / 0.4));
          if (sc.plateMesh) (sc.plateMesh.material as THREE.MeshBasicMaterial).opacity = 0.2 * fade;
          if (sc.gridHelper) {
            sc.gridHelper.visible = fade > 0.05;
            (sc.gridHelper.material as THREE.LineBasicMaterial).opacity = 0.8 * fade;
          }
        }

        // Face-select mode: update highlight from mouse position
        if (sc && navModeRef.current === "face-select" && mousePosRef.current) {
          const mouse = mousePosRef.current;
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(new THREE.Vector2(mouse.x, mouse.y), camera);
          const hits = raycaster.intersectObjects(sc.meshes, true);
          if (hits.length > 0 && hits[0].face) {
            const hitMesh = hits[0].object as THREE.Mesh;
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(hitMesh.matrixWorld);
            const worldNormal = hits[0].face.normal.clone().applyMatrix3(normalMatrix).normalize();
            // Ensure normal faces camera
            const camDir = camera.getWorldDirection(new THREE.Vector3());
            if (worldNormal.dot(camDir) > 0) worldNormal.negate();

            const normalKey = `${worldNormal.x.toFixed(3)},${worldNormal.y.toFixed(3)},${worldNormal.z.toFixed(3)},${hitMesh.uuid}`;
            if (normalKey !== lastHoverNormalKey) {
              lastHoverNormalKey = normalKey;
              // Remove old highlight
              if (sc.highlightMesh) {
                sc.scene.remove(sc.highlightMesh);
                sc.highlightMesh.geometry.dispose();
                sc.highlightMesh = null;
              }
              const highlightGeo = buildCoplanarFaceGeometry(hitMesh, worldNormal);
              if (highlightGeo) {
                sc.highlightMesh = new THREE.Mesh(highlightGeo, HIGHLIGHT_MATERIAL);
                sc.scene.add(sc.highlightMesh);
              }
            }
          } else if (lastHoverNormalKey !== "") {
            lastHoverNormalKey = "";
            if (sc && sc.highlightMesh) {
              sc.scene.remove(sc.highlightMesh);
              sc.highlightMesh.geometry.dispose();
              sc.highlightMesh = null;
            }
          }
        }

        renderer.render(scene, camera);

        // Update marker DOM positions
        const markerLayer = containerRef.current?.querySelector("[data-marker-layer]");
        if (!markerLayer || !containerRef.current) return;
        const markers = markerLayer.querySelectorAll<HTMLElement>("[data-note-id]");

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
      // orbit and face-select both use left=rotate
      sc.controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.PAN,
      };
    }
    // Clear highlight when leaving face-select mode
    if (navMode !== "face-select" && sc.highlightMesh) {
      sc.scene.remove(sc.highlightMesh);
      sc.highlightMesh.geometry.dispose();
      sc.highlightMesh = null;
    }
  }, [navMode]);

  // Fly-to when selectedNoteId changes
  useEffect(() => {
    if (!selectedNoteId || !sceneRef.current) return;
    const note = notes.find((n) => n.id === selectedNoteId);
    if (!note) return;

    const { camera, controls, bboxSize } = sceneRef.current;
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

  // Annotation mode click handler
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc || !annotationMode || !onAddNote) return;

    const { camera, renderer, meshes } = sc;
    const canvas = renderer.domElement;

    let downX = 0, downY = 0, moved = false;

    function onPointerDown(e: PointerEvent) { downX = e.clientX; downY = e.clientY; moved = false; }
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
      const camDir = camera.getWorldDirection(new THREE.Vector3());
      if (worldNormal.dot(camDir) > 0) worldNormal.negate();

      onAddNote?.({
        posX: worldPoint.x, posY: worldPoint.y, posZ: worldPoint.z,
        normalX: worldNormal.x, normalY: worldNormal.y, normalZ: worldNormal.z,
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

  // Face-select mouse tracking and click handler
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc || !orientationEditable || !onOrientationChange) return;
    // Non-null captured for use inside closures (guarded by the early return above)
    const scNN = sc;
    const onOrientationChangeNN = onOrientationChange;
    if (navMode !== "face-select") return;

    const { camera, renderer, meshes, model, scene } = sc;
    const canvas = renderer.domElement;

    let downX = 0, downY = 0, moved = false;

    function onPointerDown(e: PointerEvent) { downX = e.clientX; downY = e.clientY; moved = false; }
    function onPointerMoveLocal(e: PointerEvent) {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) moved = true;
      // Track for hover highlight
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current = {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };
    }
    function onPointerLeave() {
      mousePosRef.current = null;
      // Clear highlight
      if (scNN.highlightMesh) {
        scene.remove(scNN.highlightMesh);
        scNN.highlightMesh.geometry.dispose();
        scNN.highlightMesh = null;
      }
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

      const hitMesh = hits[0].object as THREE.Mesh;
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(hitMesh.matrixWorld);
      const worldNormal = hits[0].face.normal.clone().applyMatrix3(normalMatrix).normalize();
      const camDir = camera.getWorldDirection(new THREE.Vector3());
      if (worldNormal.dot(camDir) > 0) worldNormal.negate();

      // Quaternion that maps worldNormal → -Z (make face point down = onto plate)
      const DOWN = new THREE.Vector3(0, 0, -1);
      const delta = new THREE.Quaternion().setFromUnitVectors(worldNormal, DOWN);
      // Compose: new orientation = delta * current orientation
      model.quaternion.premultiply(delta);
      model.updateMatrixWorld(true);

      // Re-center model on plate
      sitOnPlate(model);
      model.updateMatrixWorld(true);

      const q = model.quaternion;
      onOrientationChangeNN({ qx: q.x, qy: q.y, qz: q.z, qw: q.w });

      // Snap camera to a nice viewing angle after pick
      tweenRef.current = {
        from: { cam: camera.position.clone(), target: scNN.controls.target.clone() },
        to: { cam: INITIAL_CAM.clone(), target: INITIAL_TARGET.clone() },
        startTime: Date.now(),
        duration: 400,
      };
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMoveLocal);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointerup", onPointerUp);
    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMoveLocal);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerup", onPointerUp);
      mousePosRef.current = null;
    };
  }, [navMode, orientationEditable, onOrientationChange]);

  if (error) {
    return (
      <div className="w-full h-full rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">
        Vorschau nicht verfügbar
      </div>
    );
  }

  const inFaceSelect = navMode === "face-select";

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ cursor: annotationMode ? "crosshair" : inFaceSelect ? "crosshair" : undefined }}
    >
      <div ref={canvasWrapRef} className="w-full h-full" />

      {/* Note markers */}
      <div data-marker-layer="true" className="absolute inset-0 pointer-events-none">
        {notes.map((note, idx) => (
          <button
            key={note.id}
            type="button"
            data-note-id={note.id}
            aria-selected={note.id === selectedNoteId}
            onClick={() => onSelectNote?.(note.id)}
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
        <div data-tutorial="viewer-controls" className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-background/80 backdrop-blur rounded-lg px-1.5 py-1 shadow-sm border text-xs select-none z-10">
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
          {orientationEditable && (
            <button
              type="button"
              onClick={() => setNavMode(inFaceSelect ? "orbit" : "face-select")}
              title="Fläche wählen, die auf der Druckplatte liegt"
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                inFaceSelect
                  ? "bg-amber-500 text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Layers className="h-3 w-3" />
              <span>Fläche</span>
            </button>
          )}
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

      {/* Hint overlay when face-select is active */}
      {loaded && inFaceSelect && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-50 border border-amber-300 text-amber-800 text-xs px-3 py-1 rounded-full shadow-sm select-none z-10">
          Fläche anklicken, die auf der Druckplatte liegen soll
        </div>
      )}
    </div>
  );
}
