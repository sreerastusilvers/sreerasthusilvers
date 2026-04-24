import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { VideoCall, type CallSession } from '@/services/videoCallService';
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, Loader2 } from 'lucide-react';

/**
 * /call               -> caller initiates a new call (?to=<uid>)
 * /call/:callId       -> callee answers an existing call
 */
const VideoCallPage = () => {
  const { callId: routeCallId } = useParams<{ callId?: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  const [session, setSession] = useState<CallSession | null>(null);
  const [status, setStatus] = useState<'init' | 'ringing' | 'connected' | 'ended' | 'error'>('init');
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [callId, setCallId] = useState<string | null>(routeCallId || null);

  const notifyIncomingCall = useCallback(async (nextCallId: string) => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const resp = await fetch('/api/send-call-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          callId: nextCallId,
          callerName: user.displayName || user.email?.split('@')[0] || 'Sreerasthu Silvers customer',
        }),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string };
        console.warn('[call] incoming notification failed:', data.error || resp.status);
      }
    } catch (err) {
      console.warn('[call] incoming notification failed:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const handlers = {
      onRemoteStream: (stream: MediaStream) => {
        if (remoteRef.current) {
          remoteRef.current.srcObject = stream;
          remoteRef.current.play().catch(() => {});
        }
        setStatus('connected');
      },
      onConnectionState: (s: RTCPeerConnectionState) => {
        if (s === 'connected') setStatus('connected');
      },
      onEnded: () => setStatus('ended'),
    };

    const init = async () => {
      try {
        let s: CallSession;
        if (routeCallId) {
          setStatus('ringing');
          s = await VideoCall.answerCall({ callId: routeCallId }, handlers);
        } else {
          const to = search.get('to');
          if (!to) throw new Error('Missing ?to=<uid>');
          setStatus('ringing');
          s = await VideoCall.startCall({ callerUid: user.uid, calleeUid: to }, handlers);
        }
        if (cancelled) {
          await s.cleanup();
          return;
        }
        setSession(s);
        setCallId(s.callId);
        if (localRef.current) {
          localRef.current.srcObject = s.localStream;
          localRef.current.play().catch(() => {});
        }
        if (!routeCallId) {
          void notifyIncomingCall(s.callId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start call');
        setStatus('error');
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [notifyIncomingCall, routeCallId, search, user]);

  const hangup = async () => {
    if (session) await session.cleanup();
    setStatus('ended');
    setTimeout(() => navigate(-1), 600);
  };

  const toggleMute = () => {
    if (!session) return;
    session.localStream.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted(!muted);
  };

  const toggleCam = () => {
    if (!session) return;
    session.localStream.getVideoTracks().forEach((t) => (t.enabled = camOff));
    setCamOff(!camOff);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <p className="text-sm font-semibold">Sreerasthu Silvers · Video Call</p>
          <p className="text-xs text-white/50">
            {status === 'ringing' && 'Ringing…'}
            {status === 'connected' && 'Connected'}
            {status === 'ended' && 'Call ended'}
            {status === 'error' && (error || 'Error')}
            {callId && status !== 'error' && ` · ID ${callId.slice(0, 6)}`}
          </p>
        </div>
      </div>

      <div className="flex-1 relative">
        <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover bg-neutral-900" />
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-24 right-4 w-32 h-44 sm:w-44 sm:h-60 rounded-xl object-cover border-2 border-white/20 shadow-xl bg-neutral-800"
        />
        {status === 'ringing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="text-center">
              <Loader2 className="h-10 w-10 mx-auto animate-spin text-white/70" />
              <p className="mt-3 text-sm text-white/80">Connecting…</p>
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-red-500/20 border border-red-400/40 rounded-xl px-4 py-3 text-sm">{error}</div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 py-6 border-t border-white/10">
        <button
          onClick={toggleMute}
          className={`h-12 w-12 rounded-full flex items-center justify-center ${muted ? 'bg-red-600' : 'bg-white/10 hover:bg-white/20'}`}
          aria-label="Mute"
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        <button
          onClick={hangup}
          className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center"
          aria-label="Hang up"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
        <button
          onClick={toggleCam}
          className={`h-12 w-12 rounded-full flex items-center justify-center ${camOff ? 'bg-red-600' : 'bg-white/10 hover:bg-white/20'}`}
          aria-label="Camera"
        >
          {camOff ? <VideoOff className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
};

export default VideoCallPage;
