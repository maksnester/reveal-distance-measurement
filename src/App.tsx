import React, { useEffect, useRef } from "react";
import { CogniteClient } from "@cognite/sdk";
import * as THREE from "three";
import {
  CadNode,
  intersectCadNodes,
  RevealManager,
} from "@cognite/reveal/experimental";
import CameraControls from "camera-controls";
import { Scene, WebGLRenderer } from "three";

CameraControls.install({ THREE });

function getNormalizedCoords(
  event: MouseEvent,
  domElement: HTMLCanvasElement
): { x: number; y: number } {
  const rect = domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / domElement.clientWidth) * 2 - 1;
  const y = ((event.clientY - rect.top) / domElement.clientHeight) * -2 + 1;
  return { x, y };
}

function createSphere(point: THREE.Vector3, color: string): THREE.Mesh {
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.2),
    new THREE.MeshPhongMaterial({ color })
  );
  sphere.position.copy(point);
  return sphere;
}

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

      // without light there is no colors for custom geometry (like our spheres)
      var light = new THREE.AmbientLight( 0xffffff ); // soft white light
      scene.add( light );

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

      let pickingNeedsUpdate = false;

      const render = () => {
        const delta = clock.getDelta();
        const controlsNeedUpdate = controls.update(delta);
        if (controlsNeedUpdate) {
          revealManager.update(camera);
        }
        if (controlsNeedUpdate || modelsNeedUpdate || pickingNeedsUpdate) {
          console.log(
            "controlsNeedUpdate || modelsNeedUpdate || pickingNeedsUpdate",
            controlsNeedUpdate,
            modelsNeedUpdate,
            pickingNeedsUpdate
          );
          renderer.render(scene, camera);
          modelsNeedUpdate = false;
          pickingNeedsUpdate = false;
        }
        requestAnimationFrame(render);
      };
      revealManager.update(camera);
      render();

      renderer.domElement.addEventListener("click", (event: MouseEvent) => {
        const coords = getNormalizedCoords(event, renderer.domElement);

        // Pick in Reveal
        const revealPickResult = (() => {
          const intersections = intersectCadNodes([model], {
            renderer,
            camera,
            coords,
          });
          return intersections[0];
        })();

        if (revealPickResult) {
          scene.add(createSphere(revealPickResult.point, "#f5f500"));
          model.requestNodeUpdate([revealPickResult.treeIndex]);
          pickingNeedsUpdate = true;
        }
      });
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
