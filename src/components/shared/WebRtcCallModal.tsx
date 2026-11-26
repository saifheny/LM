import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Crown,
  Link2,
  Lock,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Search,
  Send,
  ShieldCheck,
  UserMinus,
  Users,
  Volume2,
  VolumeX,
  Globe,
} from 'lucide-react';
import { Lang, UserProfile, VoiceCallLogItem } from '../../types';
import { UserAvatar } from './LmBrandMark';
import { RTC_CONFIG, sendWsSignal, subscribeWs } from '../../lib/wsHub';
import { apiGet, apiPost, api } from '../../lib/api';

export interface CallLaunchRequest {
  targetUserId?: string | null;
  targetName: string;
  targetInitials: string;
  targetAvatarUrl?: string | null;
  callScope?: 'dm' | 'group' | 'community';
  convId?: string;
  joinRoomCode?: string;
}

interface IncomingOfferPayload {
  callId: string;
  roomCode?: string;
  sdp: RTCSessionDescriptionInit;
  fromClientId: string;
  fromUserId: string;
  callerName: string;
  callerInitials: string;
  callerAvatarUrl?: string | null;
}

interface CallParticipant {
  userId: string;
  clientId?: string | null;
  name: string;
  initials: string;
  avatarUrl?: string | null;
  isHost?: boolean;
  muted?: boolean;
}

interface PendingJoinRequest {
  userId: string;
  clientId?: string;
  name: string;
  initials: string;
  avatarUrl?: string | null;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function WebRtcCallController({
  currentUser,
  allUsers = [],
  lang = 'ar',
  outgoingRequest,
  onClearOutgoing,
}: {
  currentUser: UserProfile;
  allUsers?: UserProfile[];
  lang?: Lang;
  outgoingRequest: CallLaunchRequest | null;
  onClearOutgoing: () => void;
}) {
  const [phase, setPhase] = useState<
    'idle' | 'setup' | 'awaiting_approval' | 'denied' | 'ringing_out' | 'ringing_in' | 'connected'
  >('idle');

  // Active call metadata
  const [activeCallDbId, setActiveCallDbId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [callTitle, setCallTitle] = useState('');
  const [callScope, setCallScope] = useState<'dm' | 'group' | 'community'>('dm');
  const [callJoinMode, setCallJoinMode] = useState<'open' | 'approval' | 'invited'>('open');
  const [isHost, setIsHost] = useState(true);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  // Pre-call setup state (Groups & Communities)
  const [setupTitle, setSetupTitle] = useState('');
  const [setupJoinMode, setSetupJoinMode] = useState<'open' | 'approval' | 'invited'>('open');
  const [setupInvitedIds, setSetupInvitedIds] = useState<string[]>([]);
  const [setupSearch, setSetupSearch] = useState('');
  const [startingRoom, setStartingRoom] = useState(false);

  // Participants & Host moderation
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [joinRequests, setJoinRequests] = useState<PendingJoinRequest[]>([]);

  // Live audio controls & status
  const [statusText, setStatusText] = useState('');
  const [noticeText, setNoticeText] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sentToChat, setSentToChat] = useState(false);

  const [peerInfo, setPeerInfo] = useState<{
    userId?: string | null;
    clientId?: string | null;
    name: string;
    initials: string;
    avatarUrl?: string | null;
  } | null>(null);

  const callIdRef = useRef<string | null>(null);
  const roomCodeRef = useRef<string | null>(null);
  const callDbIdRef = useRef<string | null>(null);
  const isHostRef = useRef(true);
  const peerTargetRef = useRef<{ userId?: string | null; clientId?: string | null }>({});
  const incomingOfferRef = useRef<IncomingOfferPayload | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const flashNotice = useCallback((msg: string) => {
    setNoticeText(msg);
    window.setTimeout(() => setNoticeText(cur => (cur === msg ? null : cur)), 3000);
  }, []);

  const attachAudio = useCallback(() => {
    if (remoteAudioRef.current && remoteStreamRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current;
      remoteAudioRef.current.muted = speakerMuted;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [speakerMuted]);

  const cleanupCall = useCallback(
    (notifyRemote = false) => {
      if (notifyRemote) {
        if (callIdRef.current) {
          sendWsSignal('rtc:call:hangup', {
            callId: callIdRef.current,
            roomCode: roomCodeRef.current || undefined,
            fromUserId: currentUser.id,
            targetClientId: peerTargetRef.current.clientId || undefined,
            targetUserId: peerTargetRef.current.userId || undefined,
          });
        }
        if (callDbIdRef.current && isHostRef.current) {
          api(`/api/calls/${callDbIdRef.current}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'ended' }),
          }).catch(() => {});
        }
      }

      pcRef.current?.close();
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach(tr => tr.stop());
      localStreamRef.current = null;
      remoteStreamRef.current = null;
      pendingIceRef.current = [];
      incomingOfferRef.current = null;
      callIdRef.current = null;
      roomCodeRef.current = null;
      callDbIdRef.current = null;
      peerTargetRef.current = {};

      setPhase('idle');
      setActiveCallDbId(null);
      setRoomCode(null);
      setCallTitle('');
      setActiveConvId(null);
      setPeerInfo(null);
      setParticipants([]);
      setJoinRequests([]);
      setStatusText('');
      setNoticeText(null);
      setElapsedSec(0);
      setMicMuted(false);
      setSpeakerMuted(false);
      setCopiedLink(false);
      setSentToChat(false);
      onClearOutgoing();
    },
    [currentUser.id, onClearOutgoing]
  );

  const acquireAudio = useCallback(async (): Promise<MediaStream | null> => {
    if (!navigator.mediaDevices?.getUserMedia) return null;
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
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
        ev.streams[0]?.getTracks().forEach(track => remoteStream.addTrack(track));
        if (!ev.streams[0] && ev.track) remoteStream.addTrack(ev.track);
        attachAudio();
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
          setStatusText(lang === 'en' ? 'Connected' : 'متصل الآن');
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setStatusText(lang === 'en' ? 'Reconnecting...' : 'جارٍ إعادة الاتصال...');
        }
      };

      return pc;
    },
    [attachAudio, lang]
  );

  // Enter active room as participant or host
  const joinActiveRoomMedia = useCallback(
    async (call: VoiceCallLogItem, asHost: boolean) => {
      const cid = call.id;
      callIdRef.current = cid;
      roomCodeRef.current = call.roomCode;
      callDbIdRef.current = call.id;
      isHostRef.current = asHost;

      setActiveCallDbId(call.id);
      setRoomCode(call.roomCode);
      setCallTitle(call.title);
      setCallScope(call.callScope);
      setCallJoinMode(call.joinMode);
      setIsHost(asHost);
      setActiveConvId(call.convId || null);

      const selfPart: CallParticipant = {
        userId: currentUser.id,
        name: currentUser.displayName,
        initials: currentUser.avatarInitials,
        avatarUrl: currentUser.avatarUrl,
        isHost: asHost,
        muted: false,
      };
      const initialParts: CallParticipant[] = [selfPart];
      if (!asHost && call.hostId && call.hostId !== currentUser.id) {
        initialParts.unshift({
          userId: call.hostId,
          name: call.hostName,
          initials: call.hostInitials,
          avatarUrl: call.hostAvatarUrl,
          isHost: true,
          muted: false,
        });
      }
      setParticipants(initialParts);
      setPhase('connected');
      setStatusText(lang === 'en' ? 'Voice room active' : 'المكالمة الصوتية نشطة');

      const stream = await acquireAudio();
      localStreamRef.current = stream;

      if (!asHost) {
        peerTargetRef.current = { userId: call.hostId, clientId: null };
        sendWsSignal('rtc:call:room_join', {
          callId: cid,
          roomCode: call.roomCode,
          fromUserId: currentUser.id,
          name: currentUser.displayName,
          initials: currentUser.avatarInitials,
          avatarUrl: currentUser.avatarUrl,
        });
      }
    },
    [currentUser, acquireAudio, lang]
  );

  // React to outgoingRequest from ChatView or /call/:code deep-link!
  useEffect(() => {
    if (!outgoingRequest || phase !== 'idle') return;
    let cancelled = false;

    // Case 1: Joining an existing voice call room by roomCode (from link or Calls tab)
    if (outgoingRequest.joinRoomCode) {
      (async () => {
        try {
          const res = await apiGet<{ ok: boolean; call: VoiceCallLogItem }>(
            `/api/calls/${encodeURIComponent(outgoingRequest.joinRoomCode!)}`
          );
          if (cancelled) return;
          const call = res.call;
          if (!call || call.status === 'ended') {
            setCallTitle(call?.title || (lang === 'en' ? 'Voice Call' : 'مكالمة صوتية'));
            setStatusText(lang === 'en' ? 'This voice call has already ended.' : 'انتهت هذه المكالمة الصوتية.');
            setPhase('denied');
            return;
          }
          const amHost = call.hostId === currentUser.id;
          if (!amHost && call.joinMode === 'invited' && !call.invitedUserIds.includes(currentUser.id)) {
            setCallTitle(call.title);
            setStatusText(
              lang === 'en'
                ? 'Only invited members can join this voice call.'
                : 'هذه المكالمة مخصصة للأشخاص المدعوّين فقط.'
            );
            setPhase('denied');
            return;
          }
          if (!amHost && call.joinMode === 'approval') {
            callIdRef.current = call.id;
            roomCodeRef.current = call.roomCode;
            callDbIdRef.current = call.id;
            isHostRef.current = false;
            setCallTitle(call.title);
            setRoomCode(call.roomCode);
            setCallJoinMode('approval');
            setStatusText(
              lang === 'en' ? 'Waiting for the host to approve your join request...' : 'في انتظار موافقة المضيف على انضمامك...'
            );
            setPhase('awaiting_approval');
            sendWsSignal('rtc:call:join_request', {
              callId: call.id,
              roomCode: call.roomCode,
              targetUserId: call.hostId,
              fromUserId: currentUser.id,
              name: currentUser.displayName,
              initials: currentUser.avatarInitials,
              avatarUrl: currentUser.avatarUrl,
            });
            return;
          }
          await joinActiveRoomMedia(call, amHost);
        } catch {
          if (!cancelled) {
            setCallTitle(lang === 'en' ? 'Voice Call' : 'مكالمة صوتية');
            setStatusText(lang === 'en' ? 'Voice call room not found.' : 'تعذر العثور على غرفة المكالمة.');
            setPhase('denied');
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    // Case 2: Starting a Group or Community Voice Call -> Full-Screen Pre-Call Setup!
    if (outgoingRequest.callScope === 'group' || outgoingRequest.callScope === 'community') {
      setCallScope(outgoingRequest.callScope);
      setActiveConvId(outgoingRequest.convId || null);
      setSetupTitle(outgoingRequest.targetName || (lang === 'en' ? 'Voice Call' : 'مكالمة صوتية'));
      setSetupJoinMode('open');
      setSetupInvitedIds([]);
      setSetupSearch('');
      setPhase('setup');
      return;
    }

    // Case 3: 1-on-1 DM Voice Call -> Create Call Log + Instant WebRTC Audio Offer!
    (async () => {
      setCallScope('dm');
      setCallJoinMode('open');
      setActiveConvId(outgoingRequest.convId || null);
      setCallTitle(outgoingRequest.targetName);
      setIsHost(true);
      isHostRef.current = true;
      setPeerInfo({
        userId: outgoingRequest.targetUserId,
        name: outgoingRequest.targetName,
        initials: outgoingRequest.targetInitials,
        avatarUrl: outgoingRequest.targetAvatarUrl,
      });
      setParticipants([
        {
          userId: currentUser.id,
          name: currentUser.displayName,
          initials: currentUser.avatarInitials,
          avatarUrl: currentUser.avatarUrl,
          isHost: true,
          muted: false,
        },
        ...(outgoingRequest.targetUserId
          ? [
              {
                userId: outgoingRequest.targetUserId,
                name: outgoingRequest.targetName,
                initials: outgoingRequest.targetInitials,
                avatarUrl: outgoingRequest.targetAvatarUrl,
                isHost: false,
                muted: false,
              },
            ]
          : []),
      ]);
      setPhase('ringing_out');
      setStatusText(lang === 'en' ? 'Calling...' : 'جارٍ الاتصال الصوتي...');

      let createdCall: VoiceCallLogItem | null = null;
      try {
        const created = await apiPost<{ ok: boolean; call: VoiceCallLogItem }>('/api/calls', {
          convId: outgoingRequest.convId || null,
          hostId: currentUser.id,
          peerId: outgoingRequest.targetUserId || null,
          title: outgoingRequest.targetName,
          callScope: 'dm',
          joinMode: 'open',
        });
        createdCall = created.call;
      } catch {
        // fallback ephemeral id
      }
      if (cancelled) return;

      const cid = createdCall?.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const rCode = createdCall?.roomCode || `lm-${cid.slice(-8)}`;
      callIdRef.current = cid;
      callDbIdRef.current = createdCall?.id || null;
      roomCodeRef.current = rCode;
      setActiveCallDbId(createdCall?.id || null);
      setRoomCode(rCode);
      peerTargetRef.current = { userId: outgoingRequest.targetUserId || null, clientId: null };

      const stream = await acquireAudio();
      if (cancelled) {
        stream?.getTracks().forEach(tr => tr.stop());
        return;
      }
      localStreamRef.current = stream;

      const pc = createPeerConnection(cid);
      stream?.getTracks().forEach(track => pc.addTrack(track, stream));
      setTimeout(attachAudio, 80);

      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
        await pc.setLocalDescription(offer);
        sendWsSignal('rtc:call:offer', {
          callId: cid,
          roomCode: rCode,
          sdp: offer,
          targetUserId: outgoingRequest.targetUserId || undefined,
          fromUserId: currentUser.id,
          callerName: currentUser.displayName,
          callerInitials: currentUser.avatarInitials,
          callerAvatarUrl: currentUser.avatarUrl,
        });
        setStatusText(lang === 'en' ? 'Ringing...' : 'في انتظار رد الطرف الآخر...');
      } catch {
        setStatusText(lang === 'en' ? 'Could not start call' : 'تعذر بدء الاتصال الصوتي');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [outgoingRequest, phase, currentUser, acquireAudio, createPeerConnection, attachAudio, joinActiveRoomMedia, lang]);

  // Launch Group / Community Voice Room from Setup Screen
  async function launchGroupVoiceRoom(e: React.FormEvent) {
    e.preventDefault();
    if (startingRoom) return;
    setStartingRoom(true);
    try {
      const res = await apiPost<{ ok: boolean; call: VoiceCallLogItem }>('/api/calls', {
        convId: activeConvId,
        hostId: currentUser.id,
        title: setupTitle.trim() || (lang === 'en' ? 'Group Voice Call' : 'مكالمة صوتية جماعية'),
        callScope: callScope === 'community' ? 'community' : 'group',
        joinMode: setupJoinMode,
        invitedUserIds: setupJoinMode === 'invited' ? setupInvitedIds : [],
      });
      await joinActiveRoomMedia(res.call, true);
    } catch {
      flashNotice(lang === 'en' ? 'Failed to start room' : 'تعذر بدء غرفة المكالمة');
    } finally {
      setStartingRoom(false);
    }
  }

  // Listen to ALL WebRTC & Voice Room Moderation Signals
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
        roomCodeRef.current = offer.roomCode || null;
        incomingOfferRef.current = offer;
        isHostRef.current = false;
        setIsHost(false);
        setRoomCode(offer.roomCode || null);
        setCallScope('dm');
        setCallTitle(offer.callerName || 'مستخدم LM');
        peerTargetRef.current = { userId: offer.fromUserId, clientId: offer.fromClientId };
        setPeerInfo({
          userId: offer.fromUserId,
          clientId: offer.fromClientId,
          name: offer.callerName || 'مستخدم LM',
          initials: offer.callerInitials || 'LM',
          avatarUrl: offer.callerAvatarUrl || null,
        });
        setStatusText(lang === 'en' ? 'Incoming voice call...' : 'مكالمة صوتية واردة...');
        setPhase('ringing_in');
        return;
      }

      if (frame.event === 'rtc:call:answer') {
        if (!callIdRef.current || p.callId !== callIdRef.current || !pcRef.current) return;
        if (typeof p.fromClientId === 'string') peerTargetRef.current.clientId = p.fromClientId;
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(p.sdp as RTCSessionDescriptionInit));
          for (const cand of pendingIceRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          pendingIceRef.current = [];
          setPhase('connected');
          setStatusText(lang === 'en' ? 'Connected' : 'متصل الآن');
          setTimeout(attachAudio, 80);
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
        setStatusText(
          p.reason === 'busy'
            ? lang === 'en'
              ? 'User is busy'
              : 'الطرف الآخر مشغول الآن'
            : lang === 'en'
              ? 'Call declined'
              : 'تم رفض المكالمة'
        );
        setTimeout(() => cleanupCall(false), 1200);
        return;
      }

      if (frame.event === 'rtc:call:hangup') {
        if (!callIdRef.current || (p.callId !== callIdRef.current && p.roomCode !== roomCodeRef.current)) return;
        const leaverId = String(p.fromUserId || '');
        if (callScope !== 'dm' && !isHostRef.current && leaverId && leaverId !== currentUser.id) {
          // Host ended or someone left group call
          setParticipants(prev => prev.filter(x => x.userId !== leaverId));
          return;
        }
        if (callScope === 'dm') {
          setStatusText(lang === 'en' ? 'Call ended' : 'انتهت المكالمة');
          setTimeout(() => cleanupCall(false), 700);
        } else if (leaverId) {
          setParticipants(prev => prev.filter(x => x.userId !== leaverId));
        }
        return;
      }

      // Group Room Presence: Peer joined
      if (frame.event === 'rtc:call:room_join') {
        if (!roomCodeRef.current || p.roomCode !== roomCodeRef.current) return;
        const uid = String(p.fromUserId || '');
        if (!uid || uid === currentUser.id) return;
        setParticipants(prev => {
          if (prev.some(x => x.userId === uid)) return prev;
          return [
            ...prev,
            {
              userId: uid,
              clientId: typeof p.fromClientId === 'string' ? p.fromClientId : null,
              name: String(p.name || 'مشارك'),
              initials: String(p.initials || 'LM'),
              avatarUrl: p.avatarUrl ? String(p.avatarUrl) : null,
              isHost: false,
              muted: false,
            },
          ];
        });
        return;
      }

      // Host receives Join Approval Request
      if (frame.event === 'rtc:call:join_request') {
        if (!isHostRef.current || !roomCodeRef.current || p.roomCode !== roomCodeRef.current) return;
        const uid = String(p.fromUserId || '');
        if (!uid) return;
        setJoinRequests(prev => {
          if (prev.some(r => r.userId === uid)) return prev;
          return [
            ...prev,
            {
              userId: uid,
              clientId: typeof p.fromClientId === 'string' ? p.fromClientId : undefined,
              name: String(p.name || 'مستخدم LM'),
              initials: String(p.initials || 'LM'),
              avatarUrl: p.avatarUrl ? String(p.avatarUrl) : null,
            },
          ];
        });
        return;
      }

      // Guest receives Join Approval Response
      if (frame.event === 'rtc:call:join_response') {
        if (!roomCodeRef.current || p.roomCode !== roomCodeRef.current) return;
        if (p.approved) {
          try {
            const res = await apiGet<{ ok: boolean; call: VoiceCallLogItem }>(
              `/api/calls/${encodeURIComponent(roomCodeRef.current)}`
            );
            await joinActiveRoomMedia(res.call, false);
          } catch {
            cleanupCall(false);
          }
        } else {
          setStatusText(lang === 'en' ? 'Your join request was declined.' : 'تم رفض طلب الانضمام من المضيف.');
          setPhase('denied');
        }
        return;
      }

      // Host Moderation: Force Mute Peer
      if (frame.event === 'rtc:call:mute_peer') {
        if (!roomCodeRef.current || p.roomCode !== roomCodeRef.current) return;
        const targetUid = String(p.targetUserId || '');
        if (targetUid === currentUser.id) {
          setMicMuted(true);
          localStreamRef.current?.getAudioTracks().forEach(tr => {
            tr.enabled = false;
          });
          flashNotice(lang === 'en' ? 'Host muted your microphone' : 'قام المضيف بكتم ميكروفونك');
        }
        setParticipants(prev => prev.map(x => (x.userId === targetUid ? { ...x, muted: true } : x)));
        return;
      }

      // Host Moderation: Kick Peer
      if (frame.event === 'rtc:call:kick_peer') {
        if (!roomCodeRef.current || p.roomCode !== roomCodeRef.current) return;
        const targetUid = String(p.targetUserId || '');
        if (targetUid === currentUser.id) {
          setStatusText(lang === 'en' ? 'You were removed by the host.' : 'تم إخراجك من المكالمة بواسطة المضيف.');
          setPhase('denied');
          localStreamRef.current?.getTracks().forEach(tr => tr.stop());
          pcRef.current?.close();
        } else {
          setParticipants(prev => prev.filter(x => x.userId !== targetUid));
        }
      }
    });
  }, [currentUser.id, callScope, attachAudio, cleanupCall, joinActiveRoomMedia, flashNotice, lang]);

  // Call duration timer
  useEffect(() => {
    if (phase !== 'connected') return;
    const timer = window.setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = speakerMuted;
    }
  }, [speakerMuted]);

  async function acceptIncomingCall() {
    const offer = incomingOfferRef.current;
    if (!offer) return;
    setStatusText(lang === 'en' ? 'Connecting...' : 'جارٍ الربط الصوتي...');
    const stream = await acquireAudio();
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
    setParticipants([
      {
        userId: offer.fromUserId,
        clientId: offer.fromClientId,
        name: offer.callerName || 'مستخدم LM',
        initials: offer.callerInitials || 'LM',
        avatarUrl: offer.callerAvatarUrl || null,
        isHost: true,
        muted: false,
      },
      {
        userId: currentUser.id,
        name: currentUser.displayName,
        initials: currentUser.avatarInitials,
        avatarUrl: currentUser.avatarUrl,
        isHost: false,
        muted: false,
      },
    ]);
    setPhase('connected');
    setStatusText(lang === 'en' ? 'Connected' : 'متصل الآن');
    setTimeout(attachAudio, 80);
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
    localStreamRef.current?.getAudioTracks().forEach(tr => {
      tr.enabled = !next;
    });
    setParticipants(prev => prev.map(p => (p.userId === currentUser.id ? { ...p, muted: next } : p)));
  }

  function hostMuteParticipant(target: CallParticipant) {
    if (!isHost || !roomCodeRef.current) return;
    sendWsSignal('rtc:call:mute_peer', {
      roomCode: roomCodeRef.current,
      targetUserId: target.userId,
      targetClientId: target.clientId || undefined,
    });
    setParticipants(prev => prev.map(p => (p.userId === target.userId ? { ...p, muted: true } : p)));
    flashNotice(lang === 'en' ? `Muted ${target.name}` : `تم كتم ${target.name}`);
  }

  function hostKickParticipant(target: CallParticipant) {
    if (!isHost || !roomCodeRef.current) return;
    sendWsSignal('rtc:call:kick_peer', {
      roomCode: roomCodeRef.current,
      targetUserId: target.userId,
      targetClientId: target.clientId || undefined,
    });
    setParticipants(prev => prev.filter(p => p.userId !== target.userId));
    flashNotice(lang === 'en' ? `Removed ${target.name}` : `تم إخراج ${target.name}`);
  }

  function respondToJoinRequest(req: PendingJoinRequest, approved: boolean) {
    if (!roomCodeRef.current) return;
    sendWsSignal('rtc:call:join_response', {
      roomCode: roomCodeRef.current,
      targetUserId: req.userId,
      targetClientId: req.clientId,
      approved,
    });
    setJoinRequests(prev => prev.filter(r => r.userId !== req.userId));
    if (approved) {
      setParticipants(prev =>
        prev.some(p => p.userId === req.userId)
          ? prev
          : [
              ...prev,
              {
                userId: req.userId,
                clientId: req.clientId || null,
                name: req.name,
                initials: req.initials,
                avatarUrl: req.avatarUrl || null,
                isHost: false,
                muted: false,
              },
            ]
      );
    }
  }

  async function copyShareLink() {
    if (!roomCode) return;
    const url = `${window.location.origin}/call/${roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      flashNotice(lang === 'en' ? 'Call link copied' : 'تم نسخ رابط المكالمة');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      flashNotice(url);
    }
  }

  async function sendLinkToChat() {
    if (!activeConvId || !roomCode || sentToChat) return;
    const url = `${window.location.origin}/call/${roomCode}`;
    try {
      await apiPost(`/api/conversations/${activeConvId}/messages`, {
        senderId: currentUser.id,
        content:
          lang === 'en'
            ? `🎙️ Join our voice call "${callTitle}": ${url}`
            : `🎙️ انضم إلى المكالمة الصوتية «${callTitle}»: ${url}`,
        msgType: 'text',
      });
      setSentToChat(true);
      flashNotice(lang === 'en' ? 'Link shared to chat' : 'تم إرسال الرابط في المحادثة');
    } catch {
      // ignore
    }
  }

  if (phase === 'idle') return null;

  const BackIcon = lang === 'en' ? ArrowLeft : ArrowRight;

  // 1. Sleek Floating Incoming Voice Call Banner
  if (phase === 'ringing_in' && peerInfo) {
    return (
      <div className="fixed top-4 inset-x-4 z-[85] flex justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[390px] rounded-full bg-[#121218]/96 backdrop-blur-2xl border border-[#34D399]/35 px-3.5 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3">
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
              title={lang === 'en' ? 'Decline' : 'رفض'}
              className="w-10 h-10 rounded-full bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center cursor-pointer transition-transform active:scale-90"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={acceptIncomingCall}
              title={lang === 'en' ? 'Accept' : 'قبول'}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#10B981] to-[#34D399] text-black flex items-center justify-center cursor-pointer transition-transform active:scale-90 shadow-lg"
            >
              <Phone className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Full-Screen Pre-Call Setup (Groups & Communities)
  if (phase === 'setup') {
    const selectableUsers = allUsers
      .filter(u => u.id !== currentUser.id)
      .filter(
        u =>
          !setupSearch.trim() ||
          u.displayName.toLowerCase().includes(setupSearch.toLowerCase()) ||
          u.username.toLowerCase().includes(setupSearch.toLowerCase())
      );

    return (
      <div className="fixed inset-0 z-[85] bg-[#08080B] text-white flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-white/[0.08] flex items-center justify-between max-w-[600px] w-full mx-auto">
          <button
            type="button"
            onClick={() => cleanupCall(false)}
            className="w-10 h-10 rounded-full bg-white/[0.07] hover:bg-white/[0.14] text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <BackIcon className="w-5 h-5" />
          </button>
          <div className="text-center">
            <div className="text-sm font-bold text-white">
              {lang === 'en' ? 'Voice Call Studio' : 'إعداد المكالمة الصوتية'}
            </div>
            <div className="text-[11px] text-[#8E8E93]">
              {callScope === 'community'
                ? lang === 'en'
                  ? 'Community Audio Room'
                  : 'غرفة صوتية للمجتمع'
                : lang === 'en'
                  ? 'Group Voice Room'
                  : 'غرفة صوتية للمجموعة'}
            </div>
          </div>
          <div className="w-10" />
        </div>

        <form onSubmit={launchGroupVoiceRoom} className="flex-1 overflow-y-auto px-5 py-6 max-w-[600px] w-full mx-auto space-y-6">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#C4C4CC] block">
              {lang === 'en' ? 'Call Title' : 'عنوان المكالمة الصوتية'}
            </label>
            <input
              value={setupTitle}
              onChange={e => setSetupTitle(e.target.value)}
              placeholder={lang === 'en' ? 'Team voice chat...' : 'مثال: اجتماع الفريق الصوتي...'}
              className="w-full h-12 rounded-2xl bg-[#111116] border border-white/[0.12] focus:border-[#34D399]/60 px-4 text-sm text-white outline-none transition-colors"
            />
          </div>

          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-[#C4C4CC] block">
              {lang === 'en' ? 'Who can join this call?' : 'صلاحية الانضمام للمكالمة'}
            </label>
            <div className="space-y-2">
              {[
                {
                  id: 'open' as const,
                  icon: Globe,
                  title: lang === 'en' ? 'Open to everyone' : 'مفتوحة للجميع',
                  desc: lang === 'en' ? 'Anyone with the link or in the chat can join immediately' : 'يمكن لأي شخص لديه الرابط أو داخل المحادثة الانضمام فورًا',
                },
                {
                  id: 'approval' as const,
                  icon: ShieldCheck,
                  title: lang === 'en' ? 'Require host approval' : 'بطلب إذن منك (موافقة المضيف)',
                  desc: lang === 'en' ? 'Listeners request access and you approve or decline live' : 'يرسل المشارك طلبًا وتختار قبول دخوله أو رفضه مباشرة',
                },
                {
                  id: 'invited' as const,
                  icon: Lock,
                  title: lang === 'en' ? 'Invited people only' : 'أشخاص محددون فقط',
                  desc: lang === 'en' ? 'Select specific members permitted to join' : 'اختر أعضاءً محددين فقط يُسمح لهم بالدخول',
                },
              ].map(opt => {
                const Icon = opt.icon;
                const active = setupJoinMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSetupJoinMode(opt.id)}
                    className={`w-full p-3.5 rounded-2xl border text-start flex items-start gap-3 cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#10B981]/12 border-[#34D399]/50'
                        : 'bg-[#101015] border-white/[0.08] hover:border-white/[0.18]'
                    }`}
                  >
                    <span
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        active ? 'bg-[#34D399] text-black' : 'bg-white/[0.07] text-[#C4C4CC]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-white">{opt.title}</div>
                      <div className="text-[11px] text-[#8E8E93] mt-0.5 leading-relaxed">{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {setupJoinMode === 'invited' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#C4C4CC]">
                  {lang === 'en' ? 'Select invited members' : 'اختيار المدعوّين'}
                </span>
                <span className="text-[11px] font-mono-num text-[#34D399]">
                  {setupInvitedIds.length} {lang === 'en' ? 'selected' : 'محدّد'}
                </span>
              </div>
              <div className="h-10 rounded-full bg-[#111116] border border-white/[0.1] px-3.5 flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#7A7A85]" />
                <input
                  value={setupSearch}
                  onChange={e => setSetupSearch(e.target.value)}
                  placeholder={lang === 'en' ? 'Search members...' : 'ابحث بالاسم أو @اسم_المستخدم...'}
                  className="flex-1 bg-transparent text-xs text-white placeholder:text-[#63636C] outline-none"
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#0D0D12]">
                {selectableUsers.map(u => {
                  const chosen = setupInvitedIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        setSetupInvitedIds(prev =>
                          prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                        )
                      }
                      className="w-full px-3.5 py-2.5 flex items-center gap-3 hover:bg-white/[0.05] text-start cursor-pointer"
                    >
                      <UserAvatar initials={u.avatarInitials} avatarUrl={u.avatarUrl} size={34} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{u.displayName}</div>
                        <div className="text-[11px] text-[#7A7A85] font-mono-num truncate">@{u.username}</div>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          chosen ? 'bg-[#34D399] border-[#34D399] text-black' : 'border-white/25'
                        }`}
                      >
                        {chosen && <Check className="w-3 h-3" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={startingRoom}
              className="w-full h-12 rounded-full bg-gradient-to-r from-[#10B981] to-[#34D399] text-black font-bold text-sm flex items-center justify-center gap-2 cursor-pointer hover:opacity-95 disabled:opacity-50 transition-opacity"
            >
              <Phone className="w-4 h-4" />
              <span>
                {startingRoom
                  ? lang === 'en'
                    ? 'Starting...'
                    : 'جارٍ إنشاء الغرفة...'
                  : lang === 'en'
                    ? 'Start Voice Call Now'
                    : 'بدء المكالمة الصوتية الآن'}
              </span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  // 3. Awaiting Host Approval or Access Denied Screen
  if (phase === 'awaiting_approval' || phase === 'denied') {
    return (
      <div className="fixed inset-0 z-[85] bg-[#07070A] text-white flex flex-col items-center justify-center p-6 text-center space-y-5">
        <div className="w-20 h-20 rounded-full bg-white/[0.06] border border-white/[0.14] flex items-center justify-center">
          {phase === 'awaiting_approval' ? (
            <ShieldCheck className="w-9 h-9 text-[#34D399] animate-pulse" />
          ) : (
            <Lock className="w-9 h-9 text-[#FB7185]" />
          )}
        </div>
        <div className="space-y-1.5 max-w-[340px]">
          <div className="text-lg font-bold text-white">{callTitle}</div>
          <div className="text-xs text-[#A1A1AA] leading-relaxed">{statusText}</div>
        </div>
        <button
          type="button"
          onClick={() => cleanupCall(false)}
          className="px-6 py-2.5 rounded-full bg-white/[0.1] hover:bg-white/[0.18] text-xs font-semibold text-white cursor-pointer transition-colors"
        >
          {lang === 'en' ? 'Close' : 'إغلاق'}
        </button>
      </div>
    );
  }

  // 4. Full-Screen Immersive 2026 Voice-Only Call Studio (Borderless Floating Controls — ZERO Box Containers!)
  return (
    <div className="fixed inset-0 z-[85] bg-[#07070A] text-white flex flex-col justify-between p-5 sm:p-8 select-none overflow-hidden">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Subtle Radial Studio Ambient Atmosphere */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(circle at 50% 25%, rgba(16,185,129,0.16) 0%, rgba(10,10,12,0) 60%)',
        }}
      />

      {/* Top Call Header + Shareable Link Strip */}
      <div className="relative z-10 w-full max-w-[680px] mx-auto flex flex-col items-center gap-3 pt-2">
        <div className="flex items-center gap-2 text-[11.5px] font-medium text-[#6EE7B7]">
          <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
          <span className="font-mono-num">
            {phase === 'connected' ? fmtDuration(elapsedSec) : statusText}
          </span>
          <span className="text-white/30">·</span>
          <span className="text-white/75 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span className="font-mono-num">{participants.length || 1}</span>
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight text-center">
          {callTitle || peerInfo?.name}
        </h2>

        {/* Shareable Voice Call Link Controls */}
        {roomCode && (
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              type="button"
              onClick={copyShareLink}
              className="h-8 px-3.5 rounded-full bg-white/[0.07] hover:bg-white/[0.15] border border-white/[0.12] text-[11px] font-medium text-white flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-[#34D399]" /> : <Link2 className="w-3.5 h-3.5 text-[#34D399]" />}
              <span>
                {copiedLink
                  ? lang === 'en'
                    ? 'Copied'
                    : 'تم النسخ'
                  : lang === 'en'
                    ? 'Copy Call Link'
                    : 'نسخ رابط المكالمة'}
              </span>
            </button>

            {activeConvId && (
              <button
                type="button"
                onClick={sendLinkToChat}
                disabled={sentToChat}
                className="h-8 px-3.5 rounded-full bg-[#10B981]/15 hover:bg-[#10B981]/25 border border-[#34D399]/35 text-[11px] font-medium text-[#6EE7B7] flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60"
              >
                {sentToChat ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                <span>
                  {sentToChat
                    ? lang === 'en'
                      ? 'Sent to chat'
                      : 'تم الإرسال للمحادثة'
                    : lang === 'en'
                      ? 'Send to Chat'
                      : 'إرسال للمحادثة'}
                </span>
              </button>
            )}
          </div>
        )}

        {noticeText && (
          <div className="px-3.5 py-1 rounded-full bg-white/[0.12] text-[11px] font-medium text-white">
            {noticeText}
          </div>
        )}

        {/* Host Pending Join Requests Bar */}
        {isHost && joinRequests.length > 0 && (
          <div className="w-full max-w-[440px] space-y-2 pt-1">
            {joinRequests.map(req => (
              <div
                key={req.userId}
                className="px-3.5 py-2 rounded-full bg-[#14141C]/95 border border-[#34D399]/35 flex items-center justify-between gap-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <UserAvatar initials={req.initials} avatarUrl={req.avatarUrl} size={30} />
                  <div className="min-w-0 text-start">
                    <div className="text-xs font-semibold text-white truncate">{req.name}</div>
                    <div className="text-[10px] text-[#6EE7B7]">
                      {lang === 'en' ? 'Wants to join' : 'يطلب الانضمام للمكالمة'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => respondToJoinRequest(req, false)}
                    className="px-2.5 py-1 rounded-full bg-white/[0.08] hover:bg-[#EF4444]/30 text-[11px] text-white cursor-pointer"
                  >
                    {lang === 'en' ? 'Decline' : 'رفض'}
                  </button>
                  <button
                    type="button"
                    onClick={() => respondToJoinRequest(req, true)}
                    className="px-3 py-1 rounded-full bg-[#34D399] text-black text-[11px] font-bold cursor-pointer"
                  >
                    {lang === 'en' ? 'Approve' : 'قبول'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Center Participants Stage (Real Photos or Initials + Host Moderation!) */}
      <div className="relative z-10 flex-1 flex items-center justify-center w-full max-w-[740px] mx-auto overflow-y-auto py-6">
        <div
          className={`flex flex-wrap items-center justify-center gap-7 sm:gap-10 ${
            participants.length <= 2 ? '' : 'max-w-[660px]'
          }`}
        >
          {(participants.length > 0
            ? participants
            : [
                {
                  userId: currentUser.id,
                  name: currentUser.displayName,
                  initials: currentUser.avatarInitials,
                  avatarUrl: currentUser.avatarUrl,
                  isHost: true,
                  muted: micMuted,
                },
              ]
          ).map(p => {
            const isSelf = p.userId === currentUser.id;
            const isMuted = isSelf ? micMuted : Boolean(p.muted);
            return (
              <div key={p.userId} className="flex flex-col items-center gap-2.5">
                <div className="relative">
                  {/* Subtle live voice halo when unmuted */}
                  {!isMuted && phase === 'connected' && (
                    <span className="absolute -inset-2 rounded-full border border-[#34D399]/40 animate-pulse pointer-events-none" />
                  )}
                  <div className="p-[2.5px] rounded-full border border-white/[0.18]">
                    <UserAvatar
                      initials={p.initials}
                      avatarUrl={p.avatarUrl}
                      size={participants.length <= 2 ? 104 : 78}
                    />
                  </div>
                  {p.isHost && (
                    <span
                      title={lang === 'en' ? 'Host' : 'المضيف'}
                      className="absolute -top-1 -end-1 w-6 h-6 rounded-full bg-[#FBBF24] text-black flex items-center justify-center shadow-lg"
                    >
                      <Crown className="w-3.5 h-3.5" />
                    </span>
                  )}
                  {isMuted && (
                    <span className="absolute -bottom-1 -end-1 w-7 h-7 rounded-full bg-[#18181F] border border-white/20 text-[#FB7185] flex items-center justify-center shadow-lg">
                      <MicOff className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                <div className="text-center">
                  <div className="text-sm font-semibold text-white">
                    {p.name}
                    {isSelf && (
                      <span className="ms-1 text-[11px] text-[#8E8E93]">
                        ({lang === 'en' ? 'You' : 'أنت'})
                      </span>
                    )}
                  </div>
                  <div className="text-[10.5px] text-[#8E8E93]">
                    {isMuted
                      ? lang === 'en'
                        ? 'Muted'
                        : 'مكتوم'
                      : phase === 'connected'
                        ? lang === 'en'
                          ? 'Listening'
                          : 'متصل بالصوت'
                        : statusText}
                  </div>
                </div>

                {/* Host Moderation Controls on Remote Participants */}
                {isHost && !isSelf && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => hostMuteParticipant(p)}
                      title={lang === 'en' ? 'Mute participant' : 'كتم الميكروفون'}
                      className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.18] text-white/85 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <MicOff className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => hostKickParticipant(p)}
                      title={lang === 'en' ? 'Remove from call' : 'إخراج من المكالمة'}
                      className="w-8 h-8 rounded-full bg-[#EF4444]/20 hover:bg-[#EF4444]/40 text-[#FDA4AF] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Borderless Floating Bottom Call Orbs (ZERO Box Container Around Buttons!) */}
      <div className="relative z-10 flex items-center justify-center gap-6 pb-4">
        <button
          type="button"
          onClick={toggleMute}
          title={micMuted ? (lang === 'en' ? 'Unmute' : 'إلغاء كتم الصوت') : lang === 'en' ? 'Mute' : 'كتم الميكروفون'}
          className={`w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
            micMuted
              ? 'bg-white text-black'
              : 'bg-white/[0.1] hover:bg-white/[0.18] text-white'
          }`}
        >
          {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onClick={() => setSpeakerMuted(s => !s)}
          title={speakerMuted ? (lang === 'en' ? 'Unmute Speaker' : 'تشغيل السماعة') : lang === 'en' ? 'Mute Speaker' : 'كتم السماعة'}
          className={`w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
            speakerMuted
              ? 'bg-white text-black'
              : 'bg-white/[0.1] hover:bg-white/[0.18] text-white'
          }`}
        >
          {speakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        {roomCode && (
          <button
            type="button"
            onClick={copyShareLink}
            title={lang === 'en' ? 'Copy call link' : 'نسخ رابط المكالمة'}
            className="w-14 h-14 rounded-full bg-white/[0.1] hover:bg-white/[0.18] text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
          >
            {copiedLink ? <Check className="w-5 h-5 text-[#34D399]" /> : <Link2 className="w-5 h-5" />}
          </button>
        )}

        <button
          type="button"
          onClick={() => cleanupCall(true)}
          title={isHost ? (lang === 'en' ? 'End Call' : 'إنهاء المكالمة') : lang === 'en' ? 'Leave Call' : 'مغادرة المكالمة'}
          className="w-16 h-14 rounded-full bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center cursor-pointer transition-transform active:scale-95 shadow-lg"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
