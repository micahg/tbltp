import React from 'react';
import './App.css';
import RemoteDisplayComponent from '../RemoteDisplayComponent/RemoteDisplayComponent.lazy';
import ContentEditor from '../ContentEditor/ContentEditor';

function App() {
  let query = new URLSearchParams(document.location.search);
  let view = query.get('view');
  return (
    <div className="App">
      {/* <ContentEditor/> */}
      {view !== 'edit' && <RemoteDisplayComponent/>}
      {view === 'edit' && <ContentEditor/>}
    </div>
  );
}

export default App;
