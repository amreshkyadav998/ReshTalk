import React, { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, Mic, MicOff, Users, Shuffle, Play } from 'lucide-react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const socket = io('https://reshtalk.onrender.com/'); // Update to your backend URL in production

function App() {
  const myVideoRef = useRef(null);
  const partnerVideoRef = useRef(null);
  const peerRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [inCall, setInCall] = useState(false);
  const [status, setStatus] = useState('Ready to connect');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [partnersFound, setPartnersFound] = useState(Math.floor(Math.random() * 1000) + 500);

  useEffect(() => {
    // Get user media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = currentStream;
        }
      })
      .catch((err) => {
        console.error('Media error:', err);
        setStatus('Camera access denied');
      });

    // Socket events
    socket.on('matched', ({ partnerId, initiator }) => {
      setStatus('Matched! Connecting...');
      setInCall(true);
      setIsConnecting(false);
      const peer = new Peer({
        initiator,
        trickle: false,
        stream,
      });

      peer.on('signal', (signal) => {
        socket.emit('signal', { to: partnerId, signal });
      });

      peer.on('stream', (partnerStream) => {
        partnerVideoRef.current.srcObject = partnerStream;
        setStatus('Connected! Say hello!');
      });

      peerRef.current = peer;
    });

    socket.on('signal', ({ signal, from }) => {
      if (peerRef.current) {
        peerRef.current.signal(signal);
      }
    });

    socket.on('partnerLeft', () => {
      setStatus('Partner left. Finding new match...');
      setInCall(false);
      setIsConnecting(true);
      cleanupPeer();
      socket.emit('joinQueue');
    });

    // Simulate partner count updates
    const interval = setInterval(() => {
      setPartnersFound(prev => prev + Math.floor(Math.random() * 3) - 1);
    }, 5000);

    return () => {
      socket.off();
      clearInterval(interval);
      cleanupPeer();
    };
  }, [stream]);

  const startChat = () => {
    setStatus('Finding a match...');
    setIsConnecting(true);
    socket.emit('joinQueue');
  };

  const nextChat = () => {
    setStatus('Finding next match...');
    setIsConnecting(true);
    setInCall(false);
    socket.emit('next');
    cleanupPeer();
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
      }
    }
  };

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
      }
    }
  };

  const cleanupPeer = () => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (partnerVideoRef.current) {
      partnerVideoRef.current.srcObject = null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      {/* Header */}
      <header className="p-4 sm:p-6 border-b border-white/10 backdrop-blur-sm bg-black/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-violet-500 rounded-full flex items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-pink-400 to-violet-400 bg-clip-text text-transparent">
                VideoConnect
              </h1>
              <p className="text-xs sm:text-sm text-gray-300 hidden sm:block">Random video chat with strangers</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 text-sm bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5">
            <Users className="w-4 h-4 text-green-400" />
            <span className="text-green-400 font-medium">{partnersFound.toLocaleString()}</span>
            <span className="text-gray-300 hidden sm:inline">online</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Status Bar */}
          <div className="text-center mb-6">
            <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm ${
              inCall ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
              isConnecting ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
              'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}>
              {isConnecting && (
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
              )}
              <span>{status}</span>
            </div>
          </div>

          {/* Video Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-8">
            {/* My Video */}
            <div className="relative group">
              <div className="relative aspect-video bg-black/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                <video 
                  ref={myVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover"
                />
                {!videoEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <VideoOff className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-medium">
                  You
                </div>
                <div className="absolute top-4 right-4 flex space-x-2">
                  {!audioEnabled && (
                    <div className="w-8 h-8 bg-red-500/80 backdrop-blur-sm rounded-full flex items-center justify-center">
                      <MicOff className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Partner Video */}
            <div className="relative group">
              <div className="relative aspect-video bg-black/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                <video 
                  ref={partnerVideoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                {!inCall && !isConnecting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                    <div className="w-20 h-20 bg-gradient-to-r from-pink-500/20 to-violet-500/20 rounded-full flex items-center justify-center mb-4 border border-white/20">
                      <Users className="w-10 h-10 text-gray-400" />
                    </div>
                    <p className="text-gray-400 text-lg font-medium">Waiting for connection</p>
                    <p className="text-gray-500 text-sm mt-1">Click start to find someone to chat with</p>
                  </div>
                )}
                {isConnecting && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-900/50 to-purple-900/50">
                    <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-blue-300 text-lg font-medium">Connecting...</p>
                  </div>
                )}
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-medium">
                  {inCall ? 'Stranger' : 'No connection'}
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
            {/* Media Controls */}
            <div className="flex space-x-3">
              <button
                onClick={toggleVideo}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                  videoEnabled 
                    ? 'bg-white/20 hover:bg-white/30 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
                title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
              
              <button
                onClick={toggleAudio}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                  audioEnabled 
                    ? 'bg-white/20 hover:bg-white/30 text-white' 
                    : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
                title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
            </div>

            {/* Main Action Button */}
            {!inCall ? (
              <button 
                onClick={startChat} 
                disabled={isConnecting}
                className="bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed px-8 py-3 rounded-full font-semibold text-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-xl flex items-center space-x-2 min-w-[160px] justify-center"
              >
                {isConnecting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    <span>Start Chat</span>
                  </>
                )}
              </button>
            ) : (
              <button 
                onClick={nextChat} 
                disabled={isConnecting}
                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed px-8 py-3 rounded-full font-semibold text-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-xl flex items-center space-x-2 min-w-[160px] justify-center"
              >
                {isConnecting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Finding...</span>
                  </>
                ) : (
                  <>
                    <Shuffle className="w-5 h-5" />
                    <span>Next Person</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-gray-400 text-sm border-t border-white/10 backdrop-blur-sm bg-black/20">
        <p>Stay safe online • Be respectful • Have fun connecting with people worldwide</p>
      </footer>
    </div>
  );
}

export default App;