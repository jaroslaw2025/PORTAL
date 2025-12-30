import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

type Props = {
  title: string;
  preview: string;
};

// Minimal WebXR hit-test + tap placement. Uses viewer-space hit-test source.
export function ARCard({ title, preview }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("Tap Enter AR on Android Chrome with ARCore");
  const [session, setSession] = useState<XRSession | null>(null);

  useEffect(() => {
    return () => {
      session?.end().catch(() => undefined);
    };
  }, [session]);

  const startAR = async () => {
    if (!navigator.xr) {
      setStatus("WebXR not available");
      return;
    }
    try {
      const xrSession = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test", "local-floor"],
      });
      setSession(xrSession);
      setStatus("Scanning for surfaces...");
      setupThree(xrSession);
    } catch (err) {
      setStatus(`AR failed: ${String(err)}`);
    }
  };

  const setupThree = async (xrSession: XRSession) => {
    if (!containerRef.current) return;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.xr.enabled = true;
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1));
    const camera = new THREE.PerspectiveCamera();

    const reticleGeo = new THREE.RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI / 2);
    const reticleMat = new THREE.MeshBasicMaterial({ color: 0x40c4ff });
    const reticle = new THREE.Mesh(reticleGeo, reticleMat);
    reticle.visible = false;
    scene.add(reticle);

    const cardGroup = new THREE.Group();
    scene.add(cardGroup);

    const refSpace = await xrSession.requestReferenceSpace("local");
    const viewerSpace = await xrSession.requestReferenceSpace("viewer");
    const hitTestSource = await xrSession.requestHitTestSource({ space: viewerSpace });

    xrSession.addEventListener("select", () => {
      if (!reticle.visible) return;
      cardGroup.clear();
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#0b1021cc";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#40c4ff";
        ctx.font = "bold 36px sans-serif";
        ctx.fillText(title.slice(0, 24), 24, 70);
        ctx.fillStyle = "#ffffff";
        ctx.font = "24px sans-serif";
        wrapText(ctx, preview, 24, 120, 470, 30);
      }
      const texture = new THREE.CanvasTexture(canvas);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.4),
        new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true })
      );
      plane.position.setFromMatrixPosition(reticle.matrix);
      plane.quaternion.setFromRotationMatrix(reticle.matrix);
      cardGroup.add(plane);
      setStatus("Context card placed. Move to see it pinned.");
    });

    xrSession.addEventListener("end", () => {
      setStatus("Session ended");
      renderer.setAnimationLoop(null);
    });

    renderer.xr.setReferenceSpaceType("local");
    renderer.xr.setSession(xrSession);

    renderer.setAnimationLoop((timestamp, frame) => {
      if (!frame) return;
      const viewerPose = frame.getViewerPose(refSpace);
      const hits = frame.getHitTestResults(hitTestSource);
      if (hits.length > 0 && viewerPose) {
        const hit = hits[0];
        const pose = hit.getPose(refSpace);
        if (pose) {
          reticle.visible = true;
          reticle.matrix.fromArray(pose.transform.matrix);
        }
      } else {
        reticle.visible = false;
      }
      renderer.render(scene, camera);
    });
  };

  return (
    <div className="card">
      <div className="section-title">
        <h3>AR Context Card</h3>
        <button onClick={startAR}>Enter AR</button>
      </div>
      <div ref={containerRef} className="ar-container" />
      <p className="status">{status}</p>
    </div>
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(" ");
  let line = "";
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}
