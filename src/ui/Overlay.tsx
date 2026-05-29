import { useStore } from '../store';
import { TopBar } from './TopBar';
import { PhaseList } from './PhaseList';
import { AudioMeters } from './AudioMeters';
import { TransportBar } from './TransportBar';
import { AudioSetup } from './AudioSetup';

export function Overlay() {
  const showUI = useStore((s) => s.showUI);
  const fullscreenMode = useStore((s) => s.fullscreenMode);
  const isCapturing = useStore((s) => s.isCapturing);

  if (!isCapturing) {
    return <AudioSetup />;
  }

  // Fullscreen mode: hide all UI controls
  if (fullscreenMode) {
    return null;
  }

  return (
    <>
      {showUI && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4">
          <TopBar />
          <div className="flex-1 flex justify-between items-stretch py-4">
            <PhaseList />
            <AudioMeters />
          </div>
          <TransportBar />
        </div>
      )}
    </>
  );
}
