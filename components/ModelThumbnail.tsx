"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";
import { FileText, Box } from "lucide-react";
import { get3DExtension } from "@/lib/utils";
import { cn } from "@/lib/utils";

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

function scaleToFit(object: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) object.scale.setScalar(2 / maxDim);
  box.setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
}

export interface ModelThumbnailProps {
  url: string;
  filename: string;
  noteCount?: number;
  onClick?: () => void;
  className?: string;
}

export function ModelThumbnail({ url, filename, noteCount, onClick, className }: ModelThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const ext = get3DExtension(filename);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | undefined;
    let cancelled = false;

    const run = async () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (w === 0 || h === 0) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#f1f5f9");

      const camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 1000);
      camera.position.set(2, 1.5, 2);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dir1 = new THREE.DirectionalLight(0xffffff, 1);
      dir1.position.set(5, 10, 5);
      scene.add(dir1);

      const model = await loadModel(url, ext);
      if (cancelled) return;
      scaleToFit(model);
      scene.add(model);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h);
      container.appendChild(renderer.domElement);

      renderer.render(scene, camera);
      if (!cancelled) setLoading(false);
    };

    run().catch(() => {
      if (!cancelled) {
        setError(true);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      renderer?.dispose();
      if (container.firstChild) container.innerHTML = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ext]);

  if (error) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="3D-Modell ansehen"
        className={cn(
          "relative w-full h-32 rounded-lg bg-muted flex flex-col items-center justify-center gap-1 text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer",
          className
        )}
      >
        <FileText className="h-6 w-6" />
        <span className="text-xs">Modell ansehen</span>
        {noteCount !== undefined && noteCount > 0 && (
          <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full bg-red-500 text-white font-medium leading-none">
            {noteCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full h-32 rounded-lg overflow-hidden bg-muted cursor-pointer group",
        className
      )}
      title="3D-Modell ansehen"
    >
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
          <Box className="h-5 w-5 animate-pulse" />
          <span className="text-xs">Lädt…</span>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-white bg-black/50 rounded px-2 py-1">
          Ansehen &amp; Notizen
        </span>
      </div>
      {noteCount !== undefined && noteCount > 0 && (
        <span className="absolute top-2 right-2 text-xs px-1.5 py-0.5 rounded-full bg-red-500 text-white font-medium leading-none">
          {noteCount}
        </span>
      )}
    </button>
  );
}
