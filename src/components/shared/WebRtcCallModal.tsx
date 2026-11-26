import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { UserProfile } from '../../types';
import { UserAvatar } from './LmBrandMark';
import { RTC_CONFIG, sendWsSignal, subscribeWs } from '../../lib/wsHub';

export interface CallLaunchRequest {
  targetUserId?: string | null;
  targetName: string;
  targetInitials: string;
  targetAvatarUrl?: string | null;
  mode: 'audio' | 'video';
  convId?: string;
}

interface IncomingOfferPayload {
  callId: string;
  mode: 'audio' | 'video';
  sdp: RTCSessionDescriptionInit;
  fromClientId: string;
  fromUserId: string;
  callerName: string;
  callerInitials: string;
  callerAvatarUrl?: string | null;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function WebRtcCallController({
  currentUser,
  outgoingRequest,
  onClearOutgoing,
}: {
  currentUser: UserProfile;
  outgoingRequest: CallLaunchRequest | null;
  onClearOutgoing: () => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'ringing_out' | 'ringing_in' | 'connected'>('idle');
  const [mode, setMode] = useState<'audio' | 'video'>('audio');
  const [peerInfo, setPeerInfo] = useState<{
    userId?: string | null;
    clientId?: string | null;
    name: string;
    initials: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [statusText, setStatusText] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  const callIdRef = useRef<string | null>(null);
  const peerTargetRef = useRef<{ userId?: string | null; clientId?: string | null }>({});
  const incomingOfferRef = useRef<IncomingOfferPayload | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const attachStreams = useCallback(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current;
    }
    if (remoteAudioRef.current && remoteStreamRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
    }
  }, []);

  const cleanupCall = useCallback(
    (notifyRemote = false) => {
      if (notifyRemote && callIdRef.current) {
        sendWsSignal('rtc:call:hangup', {
          callId: callIdRef.current,
          targetClientId: peerTargetRef.current.clientId || undefined,
          targetUserId: peerTargetRef.current.userId || undefined,
        });
      }
      pcRef.current?.close();
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      remoteStreamRef.current = null;
      pendingIceRef.current = [];
      incomingOfferRef.current = null;
      callIdRef.current = null;
      peerTargetRef.current = {};
      setPhase('idle');
      setPeerInfo(null);
      setStatusText('');
      setElapsedSec(0);
      setMicMuted(false);
      setCamOff(false);
      setHasRemoteVideo(false);
      onClearOutgoing();
    },
    [onClearOutgoing]
  );

  const acquireMedia = useCallback(async (callMode: 'audio' | 'video'): Promise<MediaStream | null> => {
    if (!navigator.mediaDevices?.getUserMedia) return null;
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callMode === 'video' ? { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } } : false,
      });
    } catch {
      if (callMode === 'video') {
        try {
          setCamOff(true);
          return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch {
          return null;
        }
      }
      return null;
    }
  }, []);

  const createPeerConnection = useCallback(
    (callId: string) => {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;

      pc.ontrack = ev => {
        ev.streams[0]?.getTracks().forEach(track => {
          remoteStream.addTrack(track);
        });
        if (!ev.streams[0] && ev.track) {
          remoteStream.addTrack(ev.track);
        }
        if (ev.track.kind === 'video') setHasRemoteVideo(true);
        attachStreams();
      };

      pc.onicecandidate = ev => {
        if (!ev.candidate) return;
        sendWsSignal('rtc:call:ice', {
          callId,
          candidate: ev.candidate.toJSON(),
          targetClientId: peerTargetRef.current.clientId || undefined,
          targetUserId: peerTargetRef.current.userId || undefined,
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setPhase('connected');
          setStatusText('متصل الآن');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setStatusText('انقطع الاتصال');
        }
      };

      return pc;
    },
    [attachStreams]
  );

  // Start Outgoing Call when triggered from ChatView
  useEffect(() => {
    if (!outgoingRequest || phase !== 'idle') return;
    let cancelled = false;

    (async () => {
      const cid = `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      callIdRef.current = cid;
      peerTargetRef.current = { userId: outgoingRequest.targetUserId || null, clientId: null };
      setMode(outgoingRequest.mode);
      setPeerInfo({
        userId: outgoingRequest.targetUserId,
        name: outgoingRequest.targetName,
        initials: outgoingRequest.targetInitials,
        avatarUrl: outgoingRequest.targetAvatarUrl,
      });
      setPhase('ringing_out');
      setStatusText('جارٍ الاتصال...');

      const stream = await acquireMedia(outgoingRequest.mode);
      if (cancelled) {
        stream?.getTracks().forEach(t => t.stop());
        return;
      }
      localStreamRef.current = stream;

      const pc = createPeerConnection(cid);
      stream?.getTracks().forEach(track => pc.addTrack(track, stream));
      setTimeout(attachStreams, 80);

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: outgoingRequest.mode === 'video',
        });
        await pc.setLocalDescription(offer);
        sendWsSignal('rtc:call:offer', {
          callId: cid,
          mode: outgoingRequest.mode,
          sdp: offer,
          targetUserId: outgoingRequest.targetUserId || undefined,
          fromUserId: currentUser.id,
          callerName: currentUser.displayName,
          callerInitials: currentUser.avatarInitials,
          callerAvatarUrl: currentUser.avatarUrl,
        });
        setStatusText('في انتظار رد الطرف الآخر...');
      } catch {
        setStatusText('تعذر بدء الاتصال');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [outgoingRequest, phase, currentUser, acquireMedia, createPeerConnection, attachStreams]);

  // Listen to ALL WebRTC Call Signals via zero-drop wsHub
  useEffect(() => {
    return subscribeWs(async frame => {
      const p = (frame.payload || {}) as Record<string, unknown>;

      if (frame.event === 'rtc:call:offer') {
        const offer = p as unknown as IncomingOfferPayload;
        if (!offer?.callId || offer.fromUserId === currentUser.id) return;
        if (callIdRef.current && callIdRef.current !== offer.callId) {
          sendWsSignal('rtc:call:reject', {
            callId: offer.callId,
            targetClientId: offer.fromClientId,
            reason: 'busy',
          });
          return;
        }
        callIdRef.current = offer.callId;
        incomingOfferRef.current = offer;
        peerTargetRef.current = { userId: offer.fromUserId, clientId: offer.fromClientId };
        setMode(offer.mode || 'audio');
        setPeerInfo({
          userId: offer.fromUserId,
          clientId: offer.fromClientId,
          name: offer.callerName || 'مستخدم LM',
          initials: offer.callerInitials || 'LM',
          avatarUrl: offer.callerAvatarUrl || null,
        });
        setStatusText(offer.mode === 'video' ? 'مكالمة فيديو واردة...' : 'مكالمة صوتية واردة...');
        setPhase('ringing_in');
        return;
      }

      if (frame.event === 'rtc:call:answer') {
        if (!callIdRef.current || p.callId !== callIdRef.current || !pcRef.current) return;
        if (typeof p.fromClientId === 'string') {
          peerTargetRef.current.clientId = p.fromClientId;
        }
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(p.sdp as RTCSessionDescriptionInit));
          for (const cand of pendingIceRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          pendingIceRef.current = [];
          setPhase('connected');
          setStatusText('متصل الآن');
          setTimeout(attachStreams, 80);
        } catch {
          // ignore duplicate answer
        }
        return;
      }

      if (frame.event === 'rtc:call:ice') {
        if (!callIdRef.current || p.callId !== callIdRef.current || !p.candidate) return;
        const cand = p.candidate as RTCIceCandidateInit;
        if (pcRef.current && pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        } else {
          pendingIceRef.current.push(cand);
        }
        return;
      }

      if (frame.event === 'rtc:call:reject') {
        if (!callIdRef.current || p.callId !== callIdRef.current) return;
        setStatusText(p.reason === 'busy' ? 'الطرف الآخر مشغول الآن' : 'تم رفض المكالمة');
        setTimeout(() => cleanupCall(false), 1200);
        return;
      }

      if (frame.event === 'rtc:call:hangup') {
        if (!callIdRef.current || p.callId !== callIdRef.current) return;
        setStatusText('انتهت المكالمة');
        setTimeout(() => cleanupCall(false), 700);
      }
    });
  }, [currentUser.id, attachStreams, cleanupCall]);

  // Call duration timer
  useEffect(() => {
    if (phase !== 'connected') return;
    const t = window.setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  // Re-attach video elements when phase changes
  useEffect(() => {
    if (phase !== 'idle') {
      const t = window.setTimeout(attachStreams, 60);
      return () => window.clearTimeout(t);
    }
  }, [phase, hasRemoteVideo, camOff, attachStreams]);

  async function acceptIncomingCall() {
    const offer = incomingOfferRef.current;
    if (!offer) return;
    setStatusText('جارٍ الربط...');
    const stream = await acquireMedia(offer.mode);
    localStreamRef.current = stream;

    const pc = createPeerConnection(offer.callId);
    stream?.getTracks().forEach(track => pc.addTrack(track, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(offer.sdp));
    for (const cand of pendingIceRef.current) {
      await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
    }
    pendingIceRef.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendWsSignal('rtc:call:answer', {
      callId: offer.callId,
      sdp: answer,
      targetClientId: offer.fromClientId,
      targetUserId: offer.fromUserId,
    });
    setPhase('connected');
    setStatusText('متصل الآن');
    setTimeout(attachStreams, 80);
  }

  function rejectIncomingCall() {
    const offer = incomingOfferRef.current;
    if (offer) {
      sendWsSignal('rtc:call:reject', {
        callId: offer.callId,
        targetClientId: offer.fromClientId,
        targetUserId: offer.fromUserId,
        reason: 'declined',
      });
    }
    cleanupCall(false);
  }

  function toggleMute() {
    const next = !micMuted;
    setMicMuted(next);
    localStreamRef.current?.getAudioTracks().forEach(t => {
      t.enabled = !next;
    });
  }

  function toggleCamera() {
    const next = !camOff;
    setCamOff(next);
    localStreamRef.current?.getVideoTracks().forEach(t => {
      t.enabled = !next;
    });
  }

  if (phase === 'idle' || !peerInfo) return null;

  // Sleek Floating Incoming Call Banner (Appears above ANY tab!)
  if (phase === 'ringing_in') {
    return (
      <div className="fixed top-4 inset-x-4 z-[80] flex justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[390px] rounded-full bg-[#121218]/95 backdrop-blur-2xl border border-[#34D399]/35 px-3.5 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <UserAvatar initials={peerInfo.initials} avatarUrl={peerInfo.avatarUrl} size={44} online />
              <span className="absolute inset-0 rounded-full border-2 border-[#34D399]/60 animate-ping pointer-events-none" />
            </div>
            <div className="min-w-0 text-start">
              <div className="text-sm font-bold text-white truncate">{peerInfo.name}</div>
              <div className="text-[11px] text-[#6EE7B7] truncate">{statusText}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={rejectIncomingCall}
              title="رفض"
              className="w-10 h-10 rounded-full bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center cursor-pointer transition-transform active:scale-90"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={acceptIncomingCall}
              title="قبول"
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#10B981] to-[#34D399] text-black flex items-center justify-center cursor-pointer transition-transform active:scale-90 shadow-lg"
            >
              {mode === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full-Screen Immersive WebRTC Audio / Video Call Stage
  return (
    <div className="fixed inset-0 z-[80] bg-[#07070A]/98 backdrop-blur-2xl flex flex-col items-center justify-between p-6 select-none">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Full-bleed Remote Video when Connected */}
      {mode === 'video' && hasRemoteVideo && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Top Status Pill */}
      <div className="relative z-10 flex flex-col items-center gap-1.5 pt-4">
        <div className="px-3.5 py-1 rounded-full bg-black/55 backdrop-blur-xl border border-white/[0.12] text-[11px] font-medium text-[#6EE7B7] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
          <span>{phase === 'connected' ? fmtDuration(elapsedSec) : statusText}</span>
        </div>
        <div className="text-lg font-bold text-white drop-shadow">{peerInfo.name}</div>
      </div>

      {/* Center Stage (Avatar when audio-only or waiting; self-preview if ringing video) */}
      <div className="relative z-10 flex-1 flex items-center justify-center w-full max-w-[440px]">
        {mode === 'video' && !hasRemoteVideo && !camOff ? (
          <div className="w-full aspect-[3/4] max-h-[56vh] rounded-[30px] overflow-hidden border border-white/[0.14] bg-black shadow-2xl relative">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <div className="absolute bottom-3 inset-x-0 text-center text-xs text-white/80 drop-shadow">
              {statusText}
            </div>
          </div>
        ) : !hasRemoteVideo ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative p-2 rounded-full bg-gradient-to-tr from-[#10B981]/30 via-[#34D399]/20 to-transparent">
              <UserAvatar initials={peerInfo.initials} avatarUrl={peerInfo.avatarUrl} size={112} />
            </div>
            <div className="text-xs text-[#9E9EA8]">{statusText}</div>
          </div>
        ) : null}
      </div>

      {/* Picture-in-Picture Local Self Video when Remote Video is Live */}
      {mode === 'video' && hasRemoteVideo && !camOff && (
        <div className="fixed bottom-28 end-5 z-20 w-28 sm:w-36 aspect-[3/4] rounded-2xl overflow-hidden border border-white/25 bg-black shadow-2xl">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
        </div>
      )}

      {/* Floating Glass Bottom Call Controls */}
      <div className="relative z-10 flex items-center gap-4 px-5 py-3 rounded-full bg-[#13131A]/85 backdrop-blur-2xl border border-white/[0.12] shadow-2xl">
        <button
          type="button"
          onClick={toggleMute}
          title={micMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
          className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
            micMuted ? 'bg-white text-black' : 'bg-white/[0.09] hover:bg-white/[0.16] text-white'
          }`}
        >
          {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {mode === 'video' && (
          <button
            type="button"
            onClick={toggleCamera}
            title={camOff ? 'تشغيل الكاميرا' : 'إيقاف الكاميرا'}
            className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
              camOff ? 'bg-white text-black' : 'bg-white/[0.09] hover:bg-white/[0.16] text-white'
            }`}
          >
            {camOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>
        )}

        <button
          type="button"
          onClick={() => cleanupCall(true)}
          title="إنهاء المكالمة"
          className="w-14 h-12 rounded-full bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center cursor-pointer transition-transform active:scale-95 shadow-lg"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
