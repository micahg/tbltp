import React from 'react';
import './App.css';
import RemoteDisplayComponent from '../RemoteDisplayComponent/RemoteDisplayComponent.lazy';
import ContentEditor from '../ContentEditor/ContentEditor';

function App() {
  return (
    <div className="App">
      {/* <RemoteDisplayComponent/> */}
      <ContentEditor/>
    </div>
  );
}

export default App;
