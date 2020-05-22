import React, { useEffect, useRef, useState } from 'react'
import { Cognite3DViewer } from '@cognite/reveal'
import { CogniteClient } from '@cognite/sdk';

const client = new CogniteClient({ appId: "reveal.example.simple" });
client.loginWithOAuth({ project: "3ddemo" });

function App() {
  const canvasWrapper = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [viewer, setViewer] = useState<Cognite3DViewer>();

  useEffect(() => {
    const localViewer = new Cognite3DViewer({
      sdk: client,
      domElement: canvasWrapper.current!,
    });
    setViewer(localViewer);
    localViewer.addModel({ modelId: 5641986602571236, revisionId: 5254077049582015 })
    return () => {
      localViewer.dispose();
      console.log('viewer disposed');
    }
  }, [])

  return (
    <div>
      <h1>Hello world</h1>
      <div ref={canvasWrapper}/>
    </div>
  );
}

export default App;
