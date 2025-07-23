import { configureStore } from "@reduxjs/toolkit";
import roomReducer from '../../store/slice/chatRoomSlice';
import authReducer from '../../store/slice/authSlice';
import sidebarReducer from '../../store/slice/sidebarSlice';
import conversationReducer from '../../store/slice/conversationSlice';
import videoReducer from '../../store/slice/videoSlice';
import type { RootState } from "@/store";

export const createMockStore = (customState: Partial<RootState> = {}) => {
    const preloadedState: RootState = {
        room: {
            activeRoom: { id: "room-1", name: "General", createdAt: "1751469587284" },
            isMember: true,
            ...customState.room,
        },
        auth: {
            user: { username: "Hal", id: "user-1", email: 'hello@email.com', avatarUrl: 'test-avatar-url' },
            isAuthenticated: true,
            status: "idle",
            ...customState.auth,
        },
        sidebar: {
            mode: 'chat' as const,
            mobileNavigationVisibility: false,
            ...customState.sidebar,
        },
        conversation: {
            activeConversation: null,
            ...customState.conversation,
        },
        video: {
            currentCall: null,
            incomingCall: null,
            webrtc: {
                localStream: null,
                remoteStream: null,
                peerConnection: null,
                isConnected: false,
                connectionState: 'new' as RTCPeerConnectionState,
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
            userCallStatus: 'available' as const,
            ...customState.video,
        },
    };

    return configureStore({
        reducer: {
            room: roomReducer,
            auth: authReducer,
            sidebar: sidebarReducer,
            conversation: conversationReducer,
            video: videoReducer,
        },
        preloadedState,
    });
  };