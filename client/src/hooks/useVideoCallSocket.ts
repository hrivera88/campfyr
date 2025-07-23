import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { Socket } from 'socket.io-client';
import type { RootState } from '@/store';
import {
    setCurrentCall,
    setIncomingCall,
    updateCallStatus,
    setCallError,
    setLocalStream,
    setRemoteStream,
    setWebRTCConnectionState,
    resetWebRTCState,
    type VideoCall,
    type IncomingCall,
} from '@/store/slice/videoSlice';
import { webrtcService, WebRTCService } from '@/services/webrtc';

interface UseVideoCallSocketProps {
    socket: Socket | null;
    userId?: string;
}

export const useVideoCallSocket = ({ socket, userId }: UseVideoCallSocketProps) => {
    const dispatch = useDispatch();
    const { currentCall, userCallStatus } = useSelector((state: RootState) => state.video);

    // Initialize WebRTC event handlers
    const initializeWebRTCHandlers = useCallback(() => {
        webrtcService.onLocalStream = (stream: MediaStream) => {
            dispatch(setLocalStream(stream));
        };

        webrtcService.onRemoteStream = (stream: MediaStream) => {
            dispatch(setRemoteStream(stream));
        };

        webrtcService.onConnectionStateChange = (state: RTCPeerConnectionState) => {
            dispatch(setWebRTCConnectionState(state));
        };

        webrtcService.onError = (error: Error) => {
            console.error('WebRTC error:', error);
            dispatch(setCallError(error.message));
        };
    }, [dispatch]);

    // Socket event handlers
    useEffect(() => {
        if (!socket || !userId) return;

        // Handle incoming call
        const handleIncomingCall = (data: IncomingCall) => {
            console.log('Incoming video call:', data);
            dispatch(setIncomingCall(data));
        };

        // Handle call accepted
        const handleCallAccepted = async (data: { videoCallId: string; conversationId: string }) => {
            console.log('Call accepted:', data);
            
            if (currentCall && currentCall.id === data.videoCallId) {
                // Update call status to active
                dispatch(updateCallStatus({
                    callId: data.videoCallId,
                    status: 'active'
                }));

                // Initialize WebRTC and create offer (for initiator)
                try {
                    initializeWebRTCHandlers();
                    webrtcService.initialize(socket, data.videoCallId);
                    await webrtcService.getUserMedia();
                    await webrtcService.createOffer();
                } catch (error) {
                    console.error('Failed to start call:', error);
                    dispatch(setCallError('Failed to start video call'));
                }
            }
        };

        // Handle call rejected
        const handleCallRejected = (data: { videoCallId: string; conversationId: string }) => {
            console.log('Call rejected:', data);
            
            if (currentCall && currentCall.id === data.videoCallId) {
                dispatch(updateCallStatus({
                    callId: data.videoCallId,
                    status: 'rejected'
                }));
                dispatch(setCurrentCall(null));
                webrtcService.cleanup();
            }

            // Clear incoming call if it was rejected by us
            dispatch(setIncomingCall(null));
        };

        // Handle call ended
        const handleCallEnded = (data: { videoCallId: string; conversationId: string; duration?: number }) => {
            console.log('Call ended:', data);
            
            if (currentCall && currentCall.id === data.videoCallId) {
                dispatch(updateCallStatus({
                    callId: data.videoCallId,
                    status: 'ended',
                    duration: data.duration,
                    endedAt: new Date().toISOString()
                }));
                dispatch(setCurrentCall(null));
            }

            // Cleanup WebRTC resources
            webrtcService.cleanup();
            dispatch(resetWebRTCState());
        };

        // Handle WebRTC offer
        const handleOffer = async (data: { videoCallId: string; offer: RTCSessionDescriptionInit; from: string }) => {
            console.log('Received WebRTC offer:', data);
            
            if (currentCall && currentCall.id === data.videoCallId && data.from !== userId) {
                try {
                    initializeWebRTCHandlers();
                    webrtcService.initialize(socket, data.videoCallId);
                    await webrtcService.getUserMedia();
                    await webrtcService.handleOffer(data.offer);
                } catch (error) {
                    console.error('Failed to handle offer:', error);
                    dispatch(setCallError('Failed to handle video call offer'));
                }
            }
        };

        // Handle WebRTC answer
        const handleAnswer = async (data: { videoCallId: string; answer: RTCSessionDescriptionInit; from: string }) => {
            console.log('Received WebRTC answer:', data);
            
            if (currentCall && currentCall.id === data.videoCallId && data.from !== userId) {
                try {
                    await webrtcService.handleAnswer(data.answer);
                } catch (error) {
                    console.error('Failed to handle answer:', error);
                    dispatch(setCallError('Failed to handle video call answer'));
                }
            }
        };

        // Handle ICE candidate
        const handleIceCandidate = async (data: { videoCallId: string; candidate: RTCIceCandidateInit; from: string }) => {
            console.log('Received ICE candidate:', data);
            
            if (currentCall && currentCall.id === data.videoCallId && data.from !== userId) {
                try {
                    await webrtcService.handleIceCandidate(data.candidate);
                } catch (error) {
                    console.error('Failed to handle ICE candidate:', error);
                }
            }
        };

        // Handle call status updates
        const handleCallStatus = (data: { videoCallId: string; status: string; from: string }) => {
            console.log('Call status update:', data);
            // Handle status updates like mute/unmute, camera on/off from remote participant
        };

        // Handle call errors
        const handleCallError = (data: { message: string }) => {
            console.error('Call error:', data.message);
            dispatch(setCallError(data.message));
        };

        // Register socket event listeners
        socket.on('video:call:incoming', handleIncomingCall);
        socket.on('video:call:accepted', handleCallAccepted);
        socket.on('video:call:rejected', handleCallRejected);
        socket.on('video:call:ended', handleCallEnded);
        socket.on('video:call:offer', handleOffer);
        socket.on('video:call:answer', handleAnswer);
        socket.on('video:call:ice-candidate', handleIceCandidate);
        socket.on('video:call:status', handleCallStatus);
        socket.on('video:call:error', handleCallError);

        // Cleanup function
        return () => {
            socket.off('video:call:incoming', handleIncomingCall);
            socket.off('video:call:accepted', handleCallAccepted);
            socket.off('video:call:rejected', handleCallRejected);
            socket.off('video:call:ended', handleCallEnded);
            socket.off('video:call:offer', handleOffer);
            socket.off('video:call:answer', handleAnswer);
            socket.off('video:call:ice-candidate', handleIceCandidate);
            socket.off('video:call:status', handleCallStatus);
            socket.off('video:call:error', handleCallError);
        };
    }, [socket, userId, currentCall, dispatch, initializeWebRTCHandlers]);

    // API functions for initiating calls and controlling media
    const initiateCall = useCallback(async (conversationId: string, participantId: string): Promise<VideoCall | null> => {
        if (!socket || !userId) {
            console.error('Socket or userId not available');
            return null;
        }

        if (userCallStatus !== 'available') {
            console.error('User is not available for calls');
            dispatch(setCallError('You are already in a call or busy'));
            return null;
        }

        try {
            // Check WebRTC support
            if (!WebRTCService.isSupported()) {
                throw new Error('WebRTC is not supported in this browser');
            }

            // Make API call to create call record
            const response = await fetch('/api/video/call/initiate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    conversationId,
                    participantId
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to initiate call');
            }

            const { data: videoCall } = await response.json();

            // Set current call in Redux
            dispatch(setCurrentCall(videoCall));

            // Emit socket event to notify participant
            socket.emit('video:call:initiate', {
                conversationId,
                participantId
            });

            return videoCall;
        } catch (error) {
            console.error('Failed to initiate call:', error);
            dispatch(setCallError(error instanceof Error ? error.message : 'Failed to initiate call'));
            return null;
        }
    }, [socket, userId, userCallStatus, dispatch]);

    const acceptCall = useCallback(async (videoCallId: string): Promise<void> => {
        if (!socket || !userId) {
            console.error('Socket or userId not available');
            return;
        }

        try {
            socket.emit('video:call:accept', { videoCallId });
            dispatch(setIncomingCall(null));
        } catch (error) {
            console.error('Failed to accept call:', error);
            dispatch(setCallError('Failed to accept call'));
        }
    }, [socket, userId, dispatch]);

    const rejectCall = useCallback(async (videoCallId: string): Promise<void> => {
        if (!socket || !userId) {
            console.error('Socket or userId not available');
            return;
        }

        try {
            socket.emit('video:call:reject', { videoCallId });
            dispatch(setIncomingCall(null));
        } catch (error) {
            console.error('Failed to reject call:', error);
            dispatch(setCallError('Failed to reject call'));
        }
    }, [socket, userId, dispatch]);

    const endCall = useCallback(async (videoCallId: string): Promise<void> => {
        if (!socket || !userId) {
            console.error('Socket or userId not available');
            return;
        }

        try {
            socket.emit('video:call:end', { videoCallId });
            
            // Cleanup WebRTC resources
            await webrtcService.cleanup();
            dispatch(resetWebRTCState());
            dispatch(setCurrentCall(null));
        } catch (error) {
            console.error('Failed to end call:', error);
            dispatch(setCallError('Failed to end call'));
        }
    }, [socket, userId, dispatch]);

    // Media control functions
    const toggleMute = useCallback((): boolean => {
        const isMuted = webrtcService.toggleMute();
        
        // Optionally notify other participant
        if (socket && currentCall) {
            socket.emit('video:call:status', {
                videoCallId: currentCall.id,
                status: isMuted ? 'muted' : 'unmuted'
            });
        }
        
        return isMuted;
    }, [socket, currentCall]);

    const toggleCamera = useCallback((): boolean => {
        const isCameraOff = webrtcService.toggleCamera();
        
        // Optionally notify other participant
        if (socket && currentCall) {
            socket.emit('video:call:status', {
                videoCallId: currentCall.id,
                status: isCameraOff ? 'camera-off' : 'camera-on'
            });
        }
        
        return isCameraOff;
    }, [socket, currentCall]);

    return {
        // Call management
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        
        // Media controls
        toggleMute,
        toggleCamera,
        
        // Utility functions
        isWebRTCSupported: WebRTCService.isSupported,
        getAvailableDevices: WebRTCService.getAvailableDevices,
    };
};