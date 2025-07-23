
import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export interface VideoCallParticipant {
    id: string;
    username: string;
    avatarUrl?: string;
}

export interface VideoCall {
    id: string;
    conversationId: string;
    initiator: VideoCallParticipant;
    participant: VideoCallParticipant;
    status: 'pending' | 'active' | 'ended' | 'rejected' | 'cancelled';
    startedAt: string;
    endedAt?: string;
    duration?: number;
}

export interface IncomingCall {
    videoCallId: string;
    conversationId: string;
    initiator: VideoCallParticipant;
    participant: VideoCallParticipant;
}

export interface WebRTCConnectionState {
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    peerConnection: RTCPeerConnection | null;
    isConnected: boolean;
    connectionState: RTCPeerConnectionState;
}

export interface CallControls {
    isMuted: boolean;
    isCameraOff: boolean;
    isSpeakerOn: boolean;
}

interface VideoCallState {
    // Current call state
    currentCall: VideoCall | null;
    incomingCall: IncomingCall | null;
    
    // WebRTC connection state
    webrtc: WebRTCConnectionState;
    
    // Call controls
    controls: CallControls;
    
    // UI state
    isCallWindowOpen: boolean;
    isIncomingCallModalOpen: boolean;
    callError: string | null;
    
    // Call history
    callHistory: VideoCall[];
    isLoadingHistory: boolean;
    
    // User call status for presence
    userCallStatus: 'available' | 'calling' | 'ringing' | 'in-call' | null;
}

const initialState: VideoCallState = {
    currentCall: null,
    incomingCall: null,
    webrtc: {
        localStream: null,
        remoteStream: null,
        peerConnection: null,
        isConnected: false,
        connectionState: 'new',
    },
    controls: {
        isMuted: false,
        isCameraOff: false,
        isSpeakerOn: true,
    },
    isCallWindowOpen: false,
    isIncomingCallModalOpen: false,
    callError: null,
    callHistory: [],
    isLoadingHistory: false,
    userCallStatus: 'available',
};

const videoSlice = createSlice({
    name: 'video',
    initialState,
    reducers: {
        // Call management
        setCurrentCall(state, action: PayloadAction<VideoCall | null>) {
            state.currentCall = action.payload;
            if (action.payload) {
                state.isCallWindowOpen = true;
                state.userCallStatus = action.payload.status === 'active' ? 'in-call' : 'calling';
            } else {
                state.isCallWindowOpen = false;
                state.userCallStatus = 'available';
            }
        },

        updateCallStatus(state, action: PayloadAction<{ callId: string; status: VideoCall['status']; duration?: number; endedAt?: string }>) {
            if (state.currentCall && state.currentCall.id === action.payload.callId) {
                state.currentCall.status = action.payload.status;
                if (action.payload.duration !== undefined) {
                    state.currentCall.duration = action.payload.duration;
                }
                if (action.payload.endedAt) {
                    state.currentCall.endedAt = action.payload.endedAt;
                }
                
                // Update user status based on call status
                if (['ended', 'rejected', 'cancelled'].includes(action.payload.status)) {
                    state.userCallStatus = 'available';
                } else if (action.payload.status === 'active') {
                    state.userCallStatus = 'in-call';
                }
            }
        },

        // Incoming call management
        setIncomingCall(state, action: PayloadAction<IncomingCall | null>) {
            state.incomingCall = action.payload;
            state.isIncomingCallModalOpen = !!action.payload;
            if (action.payload) {
                state.userCallStatus = 'ringing';
            }
        },

        // WebRTC state management
        setLocalStream(state, action: PayloadAction<MediaStream | null>) {
            state.webrtc.localStream = action.payload;
        },

        setRemoteStream(state, action: PayloadAction<MediaStream | null>) {
            state.webrtc.remoteStream = action.payload;
        },

        setPeerConnection(state, action: PayloadAction<RTCPeerConnection | null>) {
            state.webrtc.peerConnection = action.payload;
        },

        setWebRTCConnectionState(state, action: PayloadAction<RTCPeerConnectionState>) {
            state.webrtc.connectionState = action.payload;
            state.webrtc.isConnected = action.payload === 'connected';
        },

        // Call controls
        toggleMute(state) {
            state.controls.isMuted = !state.controls.isMuted;
        },

        toggleCamera(state) {
            state.controls.isCameraOff = !state.controls.isCameraOff;
        },

        toggleSpeaker(state) {
            state.controls.isSpeakerOn = !state.controls.isSpeakerOn;
        },

        setCallControls(state, action: PayloadAction<Partial<CallControls>>) {
            state.controls = { ...state.controls, ...action.payload };
        },

        // UI state management
        setCallWindowOpen(state, action: PayloadAction<boolean>) {
            state.isCallWindowOpen = action.payload;
        },

        setIncomingCallModalOpen(state, action: PayloadAction<boolean>) {
            state.isIncomingCallModalOpen = action.payload;
        },

        setCallError(state, action: PayloadAction<string | null>) {
            state.callError = action.payload;
        },

        // Call history management
        setCallHistory(state, action: PayloadAction<VideoCall[]>) {
            state.callHistory = action.payload;
        },

        addToCallHistory(state, action: PayloadAction<VideoCall>) {
            const existingIndex = state.callHistory.findIndex(call => call.id === action.payload.id);
            if (existingIndex >= 0) {
                state.callHistory[existingIndex] = action.payload;
            } else {
                state.callHistory.unshift(action.payload);
            }
        },

        setLoadingHistory(state, action: PayloadAction<boolean>) {
            state.isLoadingHistory = action.payload;
        },

        // User status management
        setUserCallStatus(state, action: PayloadAction<VideoCallState['userCallStatus']>) {
            state.userCallStatus = action.payload;
        },

        // Reset state (for cleanup)
        resetVideoState(state) {
            return {
                ...initialState,
                callHistory: state.callHistory, // Preserve call history
            };
        },

        resetWebRTCState(state) {
            state.webrtc = {
                localStream: null,
                remoteStream: null,
                peerConnection: null,
                isConnected: false,
                connectionState: 'new',
            };
        },
    },
});

export const {
    setCurrentCall,
    updateCallStatus,
    setIncomingCall,
    setLocalStream,
    setRemoteStream,
    setPeerConnection,
    setWebRTCConnectionState,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    setCallControls,
    setCallWindowOpen,
    setIncomingCallModalOpen,
    setCallError,
    setCallHistory,
    addToCallHistory,
    setLoadingHistory,
    setUserCallStatus,
    resetVideoState,
    resetWebRTCState,
} = videoSlice.actions;

export default videoSlice.reducer;