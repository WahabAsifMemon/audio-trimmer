// src/App.js

import React from 'react';
import './App.css';
import AudioEditor from './components/AudioEditor';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Audio Editor</h1>
        <AudioEditor />
      </header>
    </div>
  );
}

export default App;
