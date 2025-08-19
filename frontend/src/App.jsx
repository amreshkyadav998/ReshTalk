import React, { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, Mic, MicOff, Users, Shuffle, Play } from 'lucide-react';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const socket = io('https://reshtalk.onrender.com/', {
  transports: ['websocket'],
  secure: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

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
    // Check camera permissions
    navigator.permissions.query({ name: 'camera' }).then((result) => {
      if (result.state === 'denied') {
        setStatus('Camera access denied. Please enable in browser settings.');
      } else if (result.state === 'granted') {
        setStatus('Camera access granted. Click Start to connect.');
      }
    });

    // Handle resize for mobile
    const handleResize = () => {
      if (myVideoRef.current && myVideoRef.current.srcObject) {
        myVideoRef.current.play().catch((err) => console.error('Resize play error:', err));
      }
      if (partnerVideoRef.current && partnerVideoRef.current.srcObject) {
        partnerVideoRef.current.play().catch((err) => console.error('Partner resize play error:', err));
      }
    };
    window.addEventListener('resize', handleResize);

    // Socket events
    socket.on('connect', () => {
      console.log('Socket connected');
      setStatus('Ready to connect');
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      setStatus('Failed to connect to server. Please try again.');
    });

    socket.on('matched', ({ partnerId, initiator }) => {
      console.log(`Matched with ${partnerId}, initiator: ${initiator}`);
      setStatus('Matched! Connecting...');
      setInCall(true);
      setIsConnecting(false);
      const peer = new Peer({
        initiator,
        trickle: true,
        stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      const timeout = setTimeout(() => {
        if (!peerRef.current?.connected) {
          console.log('Connection timed out');
          setStatus('Connection timed out. Trying again...');
          cleanupPeer();
          socket.emit('joinQueue');
        }
      }, 10000);

      peer.on('signal', (signal) => {
        socket.emit('signal', { to: partnerId, signal });
      });

      peer.on('stream', (partnerStream) => {
        clearTimeout(timeout);
        if (partnerVideoRef.current) {
          partnerVideoRef.current.srcObject = partnerStream;
          partnerVideoRef.current.play().catch((err) => {
            console.error('Partner video play error:', err);
            setStatus('Failed to play partner video. Trying again...');
          });
        }
        setStatus('Connected! Say hello!');
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        clearTimeout(timeout);
        setStatus('Connection failed. Trying again...');
        cleanupPeer();
        socket.emit('joinQueue');
      });

      peer.on('connect', () => {
        console.log('Peer connected');
        clearTimeout(timeout);
      });

      peerRef.current = peer;
    });

    socket.on('signal', ({ signal, from }) => {
      console.log(`Received signal from ${from}`);
      if (peerRef.current) {
        peerRef.current.signal(signal);
      } else {
        console.log('No peer instance available');
      }
    });

    socket.on('partnerLeft', () => {
      setStatus('Partner left. Finding new match...');
      setInCall(false);
      setIsConnecting(true);
      cleanupPeer();
      socket.emit('joinQueue');
    });

    socket.on('joiningQueue', () => {
      setStatus('Finding a match...');
      setIsConnecting(true);
    });

    const interval = setInterval(() => {
      setPartnersFound((prev) => prev + Math.floor(Math.random() * 3) - 1);
    }, 5000);

    return () => {
      socket.off();
      window.removeEventListener('resize', handleResize);
      clearInterval(interval);
      cleanupPeer();
    };
  }, [stream]);

  const startChat = () => {
    setStatus('Accessing camera...');
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 15 } },
      audio: true,
    })
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = currentStream;
          myVideoRef.current.play().catch((err) => console.error('Video play error:', err));
        }
        setStatus('Finding a match...');
        setIsConnecting(true);
        socket.emit('joinQueue');
      })
      .catch((err) => {
        console.error('Media error:', err);
        setStatus(`Failed to access camera: ${err.message}. Please ensure permissions are granted.`);
      });
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
      <main className="flex-1 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6">
            <div
              className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm ${
                inCall
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : isConnecting
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}
            >
              {isConnecting && (
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin-slow"></div>
              )}
              <span>{status}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-8">
            <div className="relative group">
              <div className="relative w-full max-h-[45vh] bg-black rounded-2xl border border-white/20">
                <video
                  ref={myVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-auto max-h-[45vh] rounded-2xl bg-black"
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
            <div className="relative group">
              <div className="relative w-full max-h-[45vh] bg-black rounded-2xl border border-white/20">
                <video
                  ref={partnerVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-auto max-h-[45vh] rounded-2xl bg-black"
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
                    <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin-slow mb-4"></div>
                    <p className="text-blue-300 text-lg font-medium">Connecting...</p>
                  </div>
                )}
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-medium">
                  {inCall ? 'Stranger' : 'No connection'}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
            <div className="flex space-x-3">
              <button
                onClick={toggleVideo}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                  videoEnabled ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
                title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
              <button
                onClick={toggleAudio}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                  audioEnabled ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
                title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
            </div>
            {!inCall ? (
              <button
                onClick={startChat}
                disabled={isConnecting}
                className="bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-600 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed px-8 py-3 rounded-full font-semibold text-lg transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-xl flex items-center space-x-2 min-w-[160px] justify-center"
              >
                {isConnecting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin-slow"></div>
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
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin-slow"></div>
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
      <footer className="p-4 text-center text-gray-400 text-sm border-t border-white/10 backdrop-blur-sm bg-black/20">
        <p>Stay safe online • Be respectful • Have fun connecting with people worldwide</p>
      </footer>
    </div>
  );
}

export default App;