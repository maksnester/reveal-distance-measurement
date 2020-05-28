import React, { useEffect, useRef, useState } from "react";
import { CogniteClient } from "@cognite/sdk";
import * as THREE from "three";
import {
  CadNode,
  intersectCadNodes,
  RevealManager,
  utilities,
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
  event: MouseEvent | TouchEvent,
  domElement: HTMLCanvasElement
): { x: number; y: number } {
  const e = 'clientX' in event ? event : event.touches[0]
  const rect = domElement.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / domElement.clientWidth) * 2 - 1;
  const y = ((e.clientY - rect.top) / domElement.clientHeight) * -2 + 1;
  return { x, y };
}

function createSphere(point: THREE.Vector3, color: string): THREE.Mesh {
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.1),
    new THREE.MeshPhongMaterial({ color })
  );
  sphere.position.copy(point);
  return sphere;
}

function getMiddlePoint(p1: THREE.Vector3, p2: THREE.Vector3) {
  const x = (p2.x + p1.x) / 2;
  const y = (p2.y + p1.y) / 2;
  const z = (p2.z + p1.z) / 2;
  return new THREE.Vector3(x, y, z);
}

function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const distanceLabel = useRef<HTMLDivElement>(null);
  const [measuredDistance, setMeasuredDistance] = useState<any>();

  useEffect(() => {
    let scene: Scene | undefined;
    let renderer: WebGLRenderer | undefined;
    (async () => {
      if (!canvas.current || !distanceLabel.current) {
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
        `${window.location.origin}${process.env.PUBLIC_URL}/primitives`
      );
      scene.add(model);

      // without light there is no colors for custom geometry (like our spheres)
      var light = new THREE.AmbientLight(0xffffff); // soft white light
      scene.add(light);

      const renderer = new THREE.WebGLRenderer({
        canvas: canvas.current,
      });
      const width = Math.ceil(window.innerWidth * 0.75);
      const height = Math.ceil(window.innerHeight * 0.75);

      renderer.setClearColor("#444");
      renderer.setSize(width, height);

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

      const htmlOverlayHelper = new utilities.HtmlOverlayHelper();

      const clock = new THREE.Clock();

      const render = () => {
        const delta = clock.getDelta();
        const controlsNeedUpdate = controls.update(delta);
        if (controlsNeedUpdate) {
          isRenderRequired = true;
          revealManager.update(camera);
        }
        if (isRenderRequired) {
          renderer.render(scene, camera);
          htmlOverlayHelper.updatePositions(renderer, camera);
          isRenderRequired = false;
        }
        requestAnimationFrame(render);
      };
      revealManager.update(camera);
      render();

      let points: Array<THREE.Mesh> = [];
      let line: THREE.Line | null = null;

      const addMeasurePoint = (event: MouseEvent | TouchEvent) => {
        if ('button' in event && event.button !== THREE.MOUSE.LEFT) {
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
            setMeasuredDistance(0);
            htmlOverlayHelper.removeOverlayElement(distanceLabel.current!);
          }

          points.push(pointMesh);

          if (points.length === 2) {
            const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
            const geometry = new THREE.BufferGeometry().setFromPoints(
              points.map((p) => p.position)
            );
            line = new THREE.Line(geometry, material);
            scene.add(line);

            htmlOverlayHelper.addOverlayElement(
              distanceLabel.current!,
              getMiddlePoint(points[0].position, points[1].position)
            );
            setMeasuredDistance(
              points[0].position.distanceTo(points[1].position).toFixed(4)
            );

            isRenderRequired = true;
          }
        }
      }
      renderer.domElement.addEventListener("mousedown", addMeasurePoint);
      renderer.domElement.addEventListener("touchstart", addMeasurePoint);
    })();

    return () => {
      scene?.dispose();
      renderer?.dispose();
    };
  }, []);

  return (
    <div>
      <h1>Distance measurement</h1>
      <h4>Hold "ALT" and click to add point.</h4>
      <h5>Pixel ratio is {window.devicePixelRatio}</h5>
      <div>
        <div
          style={{
            maxWidth: "fit-content",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <canvas ref={canvas} style={{ display: "block" }} />
          <div
            ref={distanceLabel}
            style={{
              padding: "3px",
              position: "absolute",
              pointerEvents: "none",
              color: "rgb(255, 255, 255)",
              background: "rgba(35, 35, 35, 0.855)",
              borderRadius: "15%",
              display: measuredDistance ? "block" : "none",
            }}
          >
            {measuredDistance}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
