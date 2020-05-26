import React, { useEffect, useRef, useState } from "react";
import { CogniteClient } from "@cognite/sdk";
import * as THREE from "three";
import {
  CadNode,
  intersectCadNodes,
  RevealManager,
} from "@cognite/reveal/experimental";
import CameraControls from "camera-controls";
import { Scene, WebGLRenderer } from "three";
import * as holdEvent from "hold-event";

CameraControls.install({ THREE });

function addWASDHandling(cameraControls: CameraControls) {
  const KEYCODE = {
    W: 87,
    A: 65,
    S: 83,
    D: 68,
    ARROW_LEFT: 37,
    ARROW_UP: 38,
    ARROW_RIGHT: 39,
    ARROW_DOWN: 40,
  };

  const wKey = new holdEvent.KeyboardKeyHold(KEYCODE.W, 100);
  const aKey = new holdEvent.KeyboardKeyHold(KEYCODE.A, 100);
  const sKey = new holdEvent.KeyboardKeyHold(KEYCODE.S, 100);
  const dKey = new holdEvent.KeyboardKeyHold(KEYCODE.D, 100);
  aKey.addEventListener("holding", function (event: any) {
    cameraControls.truck(-0.05 * event.deltaTime, 0, true);
  });
  dKey.addEventListener("holding", function (event: any) {
    cameraControls.truck(0.05 * event.deltaTime, 0, true);
  });
  wKey.addEventListener("holding", function (event: any) {
    cameraControls.forward(0.05 * event.deltaTime, true);
  });
  sKey.addEventListener("holding", function (event: any) {
    cameraControls.forward(-0.05 * event.deltaTime, true);
  });

  const leftKey = new holdEvent.KeyboardKeyHold(KEYCODE.ARROW_LEFT, 100);
  const rightKey = new holdEvent.KeyboardKeyHold(KEYCODE.ARROW_RIGHT, 100);
  const upKey = new holdEvent.KeyboardKeyHold(KEYCODE.ARROW_UP, 100);
  const downKey = new holdEvent.KeyboardKeyHold(KEYCODE.ARROW_DOWN, 100);
  leftKey.addEventListener("holding", function (event: any) {
    cameraControls.rotate(
      -0.1 * THREE.MathUtils.DEG2RAD * event.deltaTime,
      0,
      true
    );
  });
  rightKey.addEventListener("holding", function (event: any) {
    cameraControls.rotate(
      0.1 * THREE.MathUtils.DEG2RAD * event.deltaTime,
      0,
      true
    );
  });
  upKey.addEventListener("holding", function (event: any) {
    cameraControls.rotate(
      0,
      -0.05 * THREE.MathUtils.DEG2RAD * event.deltaTime,
      true
    );
  });
  downKey.addEventListener("holding", function (event: any) {
    cameraControls.rotate(
      0,
      0.05 * THREE.MathUtils.DEG2RAD * event.deltaTime,
      true
    );
  });
}

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
  const [measuredDistance, setMeasuredDistance] = useState<any>();

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
      let isRenderRequired = true;
      const revealManager = new RevealManager(client, () => {
        isRenderRequired = true;
      });

      const model: CadNode = await revealManager.addModelFromUrl(
        "https://localhost:3000/primitives"
      );
      scene.add(model);

      // without light there is no colors for custom geometry (like our spheres)
      var light = new THREE.AmbientLight(0xffffff); // soft white light
      scene.add(light);

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

      addWASDHandling(controls);

      controls.update(0.0); // rm ??? why do I need this
      camera.updateMatrixWorld(); // rm ??? why do I need this

      const clock = new THREE.Clock();

      const render = () => {
        const delta = clock.getDelta();
        const controlsNeedUpdate = controls.update(delta);
        if (controlsNeedUpdate) {
          isRenderRequired = true
          revealManager.update(camera);
        }
        if (isRenderRequired) {
          renderer.render(scene, camera);
          isRenderRequired = false;
        }
        requestAnimationFrame(render);
      };
      revealManager.update(camera);
      render();

      let points: Array<THREE.Mesh> = [];
      let line: THREE.Line | null = null;

      // add point on alt+click
      renderer.domElement.addEventListener("mousedown", (event: MouseEvent) => {
        if (!event.altKey) {
          return;
        }
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
          const pointMesh = createSphere(revealPickResult.point, "#f5f500");
          scene.add(pointMesh);
          model.requestNodeUpdate([revealPickResult.treeIndex]);
          isRenderRequired = true;

          if (line) {
            scene.remove(...points);
            scene.remove(line);
            line = null;
            points = [];
          }

          points.push(pointMesh);

          if (points.length === 2) {
            const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
            const geometry = new THREE.BufferGeometry().setFromPoints(
              points.map((p) => {
                return p.position;
              })
            );
            line = new THREE.Line(geometry, material);
            scene.add(line);
            isRenderRequired = true;
            setMeasuredDistance(
              points[0].position.distanceTo(points[1].position)
            );
          }
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
      <h4>Hold "ALT" and click to add point</h4>
      <div>{measuredDistance && <>Distance: {measuredDistance}</>}</div>
      <div>
        <div style={{ display: "flex" }}></div>
        <div ref={canvasWrapper} style={{ maxHeight: "90vh" }} />
      </div>
    </div>
  );
}

export default App;
