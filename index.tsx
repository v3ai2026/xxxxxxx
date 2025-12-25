
// @google/genai guidelines followed: No manual API key prompts or UI for keys.
import React from 'react';
import ReactDOM from 'react-dom/client';
import RootApp from './RootApp';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);