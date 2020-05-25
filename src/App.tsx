import React, { useEffect, useRef } from "react";
import { CogniteClient } from "@cognite/sdk";
import * as THREE from "three";
import { CadNode, RevealManager } from "@cognite/reveal/experimental";
import CameraControls from "camera-controls";
import { Scene, WebGLRenderer } from "three";

CameraControls.install({ THREE });

function App() {
  const canvasWrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let scene: Scene | undefined;
    let renderer: WebGLRenderer | undefined;
    (async () => {
      if (!canvasWrapper.current) {
        return;
      }

      const client = new CogniteClient({ appId: "reveal.example.measurement" });
      client.loginWithOAuth({ project: "publicdata" });

      const scene = new THREE.Scene();
      let modelsNeedUpdate = true; // rm ??? why do I need this
      const revealManager = new RevealManager(client, () => {
        modelsNeedUpdate = true;
      });

      const model: CadNode = await revealManager.addModelFromUrl(
        "https://localhost:3000/primitives"
      );
      scene.add(model);

      const renderer = new THREE.WebGLRenderer();
      const width = window.innerWidth / 2;
      const height = window.innerHeight / 2;

      renderer.setClearColor("#444");
      renderer.setSize(width, height);
      canvasWrapper.current.appendChild(renderer.domElement);

      const { position, target, near, far } = model.suggestCameraConfig();
      const camera = new THREE.PerspectiveCamera(75, width / height, near, far);
      const controls = new CameraControls(camera, renderer.domElement);
      controls.setLookAt(
        position.x,
        position.y,
        position.z,
        target.x,
        target.y,
        target.z
      );

      controls.update(0.0); // rm ??? why do I need this
      camera.updateMatrixWorld(); // rm ??? why do I need this

      const clock = new THREE.Clock();

      const render = () => {
        const delta = clock.getDelta();
        const controlsNeedUpdate = controls.update(delta);
        if (controlsNeedUpdate) {
          revealManager.update(camera);
        }
        if (controlsNeedUpdate || modelsNeedUpdate) {
          renderer.render(scene, camera);
        }
        requestAnimationFrame(render);
      };
      revealManager.update(camera);
      render();
    })();

    return () => {
      scene?.dispose();
      renderer?.dispose();
    };
  }, []);

  return (
    <div>
      <h1>Hello world</h1>
      <div>
        <div style={{ display: "flex" }}>
          <button>Use measurement</button>
        </div>
        <div ref={canvasWrapper} style={{ maxHeight: "90vh" }} />
      </div>
    </div>
  );
}

export default App;
