
import React from 'react';
import CameraView from './components/CameraView';

const App: React.FC = () => {
  return (
    <div className="h-full w-full bg-black font-sans select-none">
      <CameraView />
    </div>
  );
};

export default App;
