
import React, { useState, useRef } from 'react';
import JazzCanvas from './components/JazzCanvas';
import { AppState, GameGenre } from './types';
import { audioEngine } from './services/audioEngine';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [isRecording, setIsRecording] = useState(false);
  const [currentGenre, setCurrentGenre] = useState<GameGenre>(GameGenre.JAZZ);
  
  // Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingMimeTypeRef = useRef<string>(''); 

  const startExperience = async (genre: GameGenre) => {
    setCurrentGenre(genre);
    setAppState(AppState.LOADING);
    try {
      await audioEngine.loadGenre(genre);
      setAppState(AppState.RUNNING);
    } catch (e) {
      console.error(e);
      setAppState(AppState.ERROR);
    }
  };

  const handleReturnToMenu = () => {
    stopVideoRecording();
    audioEngine.stop();
    setAppState(AppState.IDLE);
  };

  const handleToggleRecord = async () => {
    if (!isRecording) startVideoRecording();
    else stopVideoRecording();
  };

  const getSupportedMimeType = (): string => {
    const types = ['video/mp4; codecs=h264,aac', 'video/mp4', 'video/webm; codecs=vp9,opus', 'video/webm'];
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  };

  const startVideoRecording = () => {
    const canvasElement = document.querySelector('canvas');
    if (!canvasElement) return;
    const canvasStream = (canvasElement as any).captureStream(30);
    const audioStream = audioEngine.getAudioStream();
    if (!audioStream) return;
    
    const combinedStream = new MediaStream([canvasStream.getVideoTracks()[0], audioStream.getAudioTracks()[0]]);
    const chosenMimeType = getSupportedMimeType();
    
    try {
        const recorder = new MediaRecorder(combinedStream, chosenMimeType ? { mimeType: chosenMimeType } : undefined);
        recordingMimeTypeRef.current = chosenMimeType || recorder.mimeType;
        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
        recorder.onstop = saveVideoRecording;
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
    } catch (e) { console.error(e); }
  };

  const stopVideoRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  const saveVideoRecording = () => {
      const mimeType = recordingMimeTypeRef.current || 'video/webm';
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.download = `Hands_Of_Rhythm_${currentGenre}.${extension}`;
      anchor.href = url;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
      recordedChunksRef.current = [];
  };

  return (
    <div className="relative w-screen h-screen bg-black text-white font-sans overflow-hidden">
      
      {(appState === AppState.RUNNING || appState === AppState.LOADING) && (
        <JazzCanvas appState={appState} setAppState={setAppState} genre={currentGenre} />
      )}

      {appState === AppState.RUNNING && (
        <>
            <button 
                onClick={handleReturnToMenu}
                className="absolute top-6 left-6 z-50 px-6 py-2 rounded-full font-bold border border-white text-white bg-black/20 hover:bg-white hover:text-black transition-all shadow-lg backdrop-blur-md"
            >
                ← MENU
            </button>

            <button 
                onClick={handleToggleRecord}
                className={`absolute top-6 right-6 z-50 px-6 py-2 rounded-full font-bold border transition-all shadow-lg flex items-center gap-2 ${
                    isRecording ? 'bg-red-600 border-red-600 animate-pulse' : 'bg-transparent border-white hover:bg-white hover:text-black'
                }`}
            >
                {isRecording ? 'STOP & SAVE' : 'REC VIDEO'}
            </button>
        </>
      )}

      {appState === AppState.IDLE && (
        <div id="start-screen" className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black p-6 text-center">
          <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter text-white">
            HANDS OF RHYTHM
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
            
            {/* JAZZ BUTTON */}
            <button 
                onClick={() => startExperience(GameGenre.JAZZ)}
                className="group relative h-64 border border-cyan-500/30 rounded-2xl bg-gradient-to-br from-gray-900 to-black hover:border-cyan-400 transition-all hover:scale-105 overflow-hidden"
            >
                <div className="absolute inset-0 bg-cyan-900/20 group-hover:bg-cyan-900/40 transition-colors"></div>
                <div className="relative z-10 flex flex-col items-center justify-center h-full">
                    <span className="text-4xl font-bold text-cyan-400 mb-2">JAZZ</span>
                    <span className="text-sm text-cyan-200 uppercase tracking-widest">Swing & Smooth</span>
                </div>
            </button>

            {/* ELECTRONIC BUTTON (Formerly ROCK) */}
            <button 
                onClick={() => startExperience(GameGenre.ELECTRONIC)}
                className="group relative h-64 border border-green-500/30 rounded-2xl bg-gradient-to-br from-gray-900 to-black hover:border-green-400 transition-all hover:scale-105 overflow-hidden"
            >
                <div className="absolute inset-0 bg-green-900/20 group-hover:bg-green-900/40 transition-colors"></div>
                <div className="relative z-10 flex flex-col items-center justify-center h-full">
                    <span className="text-4xl font-bold text-green-500 mb-2">ELECTRONIC</span>
                    <span className="text-sm text-green-200 uppercase tracking-widest">High Energy Synth & Beats</span>
                </div>
            </button>

            {/* FUNK BUTTON */}
            <button 
                onClick={() => startExperience(GameGenre.FUNK)}
                className="group relative h-64 border border-purple-500/30 rounded-2xl bg-gradient-to-br from-gray-900 to-black hover:border-purple-400 transition-all hover:scale-105 overflow-hidden"
            >
                <div className="absolute inset-0 bg-purple-900/20 group-hover:bg-purple-900/40 transition-colors"></div>
                <div className="relative z-10 flex flex-col items-center justify-center h-full">
                    <span className="text-4xl font-bold text-purple-400 mb-2">FUNK</span>
                    <span className="text-sm text-purple-200 uppercase tracking-widest">Groove & Wah-Wah</span>
                </div>
            </button>

          </div>
          <p className="mt-12 text-gray-500">Select a genre to begin. Requires Camera & Audio.</p>
        </div>
      )}

      {appState === AppState.LOADING && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
        </div>
      )}

      {appState === AppState.ERROR && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black p-8 text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold mb-2">System Failure</h2>
          <p className="text-gray-400">Please check your permissions and reload.</p>
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 border border-white rounded">Reload</button>
        </div>
      )}
    </div>
  );
};

export default App;
