"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { get3DExtension } from "@/lib/utils";

function scaleToFit(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) object.scale.setScalar(2 / maxDim);
  box.setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
}

const MATERIAL = new THREE.MeshStandardMaterial({
  color: "#6366f1",
  roughness: 0.4,
  metalness: 0.1,
});

async function loadModel(url: string, ext: string): Promise<THREE.Object3D> {
  if (ext === "stl") {
    const geo = await new STLLoader().loadAsync(url);
    return new THREE.Mesh(geo, MATERIAL);
  }
  if (ext === "obj") {
    const obj = await new OBJLoader().loadAsync(url);
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).material = MATERIAL;
    });
    return obj;
  }
  if (ext === "3mf") {
    return await new ThreeMFLoader().loadAsync(url) as unknown as THREE.Object3D;
  }
  throw new Error(`Unsupported format: ${ext}`);
}

interface ModelViewerProps {
  url: string;
  filename: string;
}

export function ModelViewer({ url, filename }: ModelViewerProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const ext = get3DExtension(filename);

  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;

    let animId: number;
    let renderer: THREE.WebGLRenderer;

    const run = async () => {
      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#f1f5f9");

      // Camera
      const { clientWidth: w, clientHeight: h } = container;
      const camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 1000);
      camera.position.set(3, 2, 3);

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dir1 = new THREE.DirectionalLight(0xffffff, 1);
      dir1.position.set(5, 10, 5);
      scene.add(dir1);
      const dir2 = new THREE.DirectionalLight(0xffffff, 0.3);
      dir2.position.set(-5, -5, -5);
      scene.add(dir2);

      // Load model
      const model = await loadModel(url, ext);
      scaleToFit(model);
      scene.add(model);

      // Renderer
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(w, h);
      container.appendChild(renderer.domElement);

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enablePan = false;
      controls.minDistance = 1;
      controls.maxDistance = 10;
      controls.update();

      // Resize observer
      const ro = new ResizeObserver(() => {
        const { clientWidth: rw, clientHeight: rh } = container;
        camera.aspect = rw / rh;
        camera.updateProjectionMatrix();
        renderer.setSize(rw, rh);
      });
      ro.observe(container);

      // Animate
      function animate() {
        animId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      }
      animate();
    };

    run().catch(() => {
      setError(true);
    });

    return () => {
      cancelAnimationFrame(animId);
      renderer?.dispose();
      container.innerHTML = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ext]);

  if (error) {
    return (
      <div className="w-full h-64 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">
        Vorschau nicht verfügbar
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      role="img"
      aria-label="3D-Modellvorschau"
      className="w-full h-64 rounded-lg overflow-hidden bg-muted touch-none"
    />
  );
}
