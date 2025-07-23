import type { Socket } from 'socket.io-client';

export interface WebRTCConfig {
    iceServers: RTCIceServer[];
}

// Default STUN servers - you can add TURN servers for production
const defaultConfig: WebRTCConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export class WebRTCService {
    private peerConnection: RTCPeerConnection | null = null;
    private localStream: MediaStream | null = null;
    private remoteStream: MediaStream | null = null;
    private socket: Socket | null = null;
    private videoCallId: string | null = null;
    private config: WebRTCConfig;

    // Event handlers
    public onLocalStream?: (stream: MediaStream) => void;
    public onRemoteStream?: (stream: MediaStream) => void;
    public onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
    public onError?: (error: Error) => void;

    constructor(config: WebRTCConfig = defaultConfig) {
        this.config = config;
    }

    // Initialize WebRTC service with socket and call ID
    public initialize(socket: Socket, videoCallId: string): void {
        this.socket = socket;
        this.videoCallId = videoCallId;
        this.setupPeerConnection();
    }

    // Set up RTCPeerConnection with event handlers
    private setupPeerConnection(): void {
        try {
            this.peerConnection = new RTCPeerConnection(this.config);

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate && this.socket && this.videoCallId) {
                    this.socket.emit('video:call:ice-candidate', {
                        videoCallId: this.videoCallId,
                        candidate: event.candidate,
                    });
                }
            };

            // Handle remote stream
            this.peerConnection.ontrack = (event) => {
                console.log('Received remote stream');
                this.remoteStream = event.streams[0];
                if (this.onRemoteStream) {
                    this.onRemoteStream(this.remoteStream);
                }
            };

            // Handle connection state changes
            this.peerConnection.onconnectionstatechange = () => {
                const state = this.peerConnection?.connectionState;
                console.log('WebRTC connection state:', state);
                if (state && this.onConnectionStateChange) {
                    this.onConnectionStateChange(state);
                }

                // Handle connection failures
                if (state === 'failed' || state === 'disconnected') {
                    this.handleConnectionError();
                }
            };

            // Handle ICE connection state changes
            this.peerConnection.oniceconnectionstatechange = () => {
                console.log('ICE connection state:', this.peerConnection?.iceConnectionState);
            };

        } catch (error) {
            console.error('Failed to create peer connection:', error);
            if (this.onError) {
                this.onError(error as Error);
            }
        }
    }

    // Get user media (camera and microphone)
    public async getUserMedia(constraints: MediaStreamConstraints = { video: true, audio: true }): Promise<MediaStream> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.localStream = stream;
            
            // Add tracks to peer connection
            if (this.peerConnection) {
                stream.getTracks().forEach(track => {
                    this.peerConnection!.addTrack(track, stream);
                });
            }

            if (this.onLocalStream) {
                this.onLocalStream(stream);
            }

            return stream;
        } catch (error) {
            console.error('Failed to get user media:', error);
            if (this.onError) {
                this.onError(error as Error);
            }
            throw error;
        }
    }

    // Create and send offer (for call initiator)
    public async createOffer(): Promise<void> {
        if (!this.peerConnection || !this.socket || !this.videoCallId) {
            throw new Error('WebRTC not properly initialized');
        }

        try {
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
            });

            await this.peerConnection.setLocalDescription(offer);

            this.socket.emit('video:call:offer', {
                videoCallId: this.videoCallId,
                offer: offer,
            });

            console.log('Offer created and sent');
        } catch (error) {
            console.error('Failed to create offer:', error);
            if (this.onError) {
                this.onError(error as Error);
            }
            throw error;
        }
    }

    // Handle incoming offer (for call receiver)
    public async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
        if (!this.peerConnection || !this.socket || !this.videoCallId) {
            throw new Error('WebRTC not properly initialized');
        }

        try {
            await this.peerConnection.setRemoteDescription(offer);

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.socket.emit('video:call:answer', {
                videoCallId: this.videoCallId,
                answer: answer,
            });

            console.log('Answer created and sent');
        } catch (error) {
            console.error('Failed to handle offer:', error);
            if (this.onError) {
                this.onError(error as Error);
            }
            throw error;
        }
    }

    // Handle incoming answer (for call initiator)
    public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }

        try {
            await this.peerConnection.setRemoteDescription(answer);
            console.log('Answer received and set');
        } catch (error) {
            console.error('Failed to handle answer:', error);
            if (this.onError) {
                this.onError(error as Error);
            }
            throw error;
        }
    }

    // Handle incoming ICE candidate
    public async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
        if (!this.peerConnection) {
            throw new Error('Peer connection not initialized');
        }

        try {
            await this.peerConnection.addIceCandidate(candidate);
            console.log('ICE candidate added');
        } catch (error) {
            console.error('Failed to add ICE candidate:', error);
            if (this.onError) {
                this.onError(error as Error);
            }
        }
    }

    // Media control methods
    public toggleMute(): boolean {
        if (!this.localStream) return false;

        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            return !audioTrack.enabled; // Return true if muted
        }
        return false;
    }

    public toggleCamera(): boolean {
        if (!this.localStream) return false;

        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            return !videoTrack.enabled; // Return true if camera off
        }
        return false;
    }

    public isMuted(): boolean {
        if (!this.localStream) return false;
        const audioTrack = this.localStream.getAudioTracks()[0];
        return audioTrack ? !audioTrack.enabled : false;
    }

    public isCameraOff(): boolean {
        if (!this.localStream) return false;
        const videoTrack = this.localStream.getVideoTracks()[0];
        return videoTrack ? !videoTrack.enabled : false;
    }

    // Get current streams
    public getLocalStream(): MediaStream | null {
        return this.localStream;
    }

    public getRemoteStream(): MediaStream | null {
        return this.remoteStream;
    }

    public getConnectionState(): RTCPeerConnectionState | null {
        return this.peerConnection?.connectionState || null;
    }

    // Handle connection errors
    private handleConnectionError(): void {
        console.warn('WebRTC connection error, attempting to restart ICE');
        if (this.peerConnection) {
            this.peerConnection.restartIce();
        }
    }

    // Cleanup and disconnect
    public async cleanup(): Promise<void> {
        console.log('Cleaning up WebRTC service');

        // Stop local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
            });
            this.localStream = null;
        }

        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Reset state
        this.remoteStream = null;
        this.socket = null;
        this.videoCallId = null;

        // Clear event handlers
        this.onLocalStream = undefined;
        this.onRemoteStream = undefined;
        this.onConnectionStateChange = undefined;
        this.onError = undefined;
    }

    // Check if WebRTC is supported
    public static isSupported(): boolean {
        return !!(
            navigator.mediaDevices &&
            typeof navigator.mediaDevices.getUserMedia === 'function' &&
            window.RTCPeerConnection
        );
    }

    // Get available media devices
    public static async getAvailableDevices(): Promise<{
        audioInputs: MediaDeviceInfo[];
        videoInputs: MediaDeviceInfo[];
        audioOutputs: MediaDeviceInfo[];
    }> {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return {
                audioInputs: devices.filter(d => d.kind === 'audioinput'),
                videoInputs: devices.filter(d => d.kind === 'videoinput'),
                audioOutputs: devices.filter(d => d.kind === 'audiooutput'),
            };
        } catch (error) {
            console.error('Failed to enumerate devices:', error);
            return { audioInputs: [], videoInputs: [], audioOutputs: [] };
        }
    }
}

// Singleton instance for global use
export const webrtcService = new WebRTCService();