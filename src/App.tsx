import React, { useEffect, useRef, useState } from 'react'
import { Cognite3DModel, Cognite3DViewer } from '@cognite/reveal'
import { CogniteClient } from '@cognite/sdk';

const client = new CogniteClient({ appId: "reveal.example.simple" });
client.loginWithOAuth({ project: "3ddemo" });

function App() {
  const canvasWrapper = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [viewer, setViewer] = useState<Cognite3DViewer>();
  const [model, setModel] = useState<Cognite3DModel>();

  useEffect(() => {
    const localViewer = new Cognite3DViewer({
      sdk: client,
      domElement: canvasWrapper.current!,
    });
    setViewer(localViewer);
    (async () => {
      const model = await localViewer.addModel({ modelId: 5641986602571236, revisionId: 5254077049582015 })
      localViewer.fitCameraToModel(model)
      setModel(model)
    })()
    return () => {
      localViewer.dispose();
      console.log('viewer disposed');
    }
  }, [])

  return (
    <div>
      <h1>Hello world</h1>
      <div>
        <div style={{display: 'flex'}}>
          <button>Use measurement</button>
        </div>
        <div ref={canvasWrapper} style={{maxHeight: '90vh'}}/>
      </div>
    </div>
  );
}

export default App;
