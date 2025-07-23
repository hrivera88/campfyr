import { useSocket } from "@/hooks/useSocket";
import { useVideoCallSocket } from "@/hooks/useVideoCallSocket";
import api from "@/services/axios";
import type { RootState } from "@/store";
import { capitalizeWords } from "@/utils/capitalizeWords";
import { AspectRatio, Close, Minimize } from "@mui/icons-material";
import {
  Avatar,
  Backdrop,
  Box,
  Fade,
  IconButton,
  Paper,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import CallControls from "./CallControls";
import CallStatusIndicator from "./CallStatusIndicator";

type VideoCallWindowProps = {
  onClose: () => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isFullscreen?: boolean;
  onFullscreenToggle?: () => void;
};

const VideoCallWindow = ({
  onClose,
  onMinimize,
  isMinimized = false,
  isFullscreen = false,
  onFullscreenToggle,
}: VideoCallWindowProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const socket = useSocket();
  const { user } = useSelector((state: RootState) => state.auth);
  const { 
    currentCall, 
    userCallStatus,
    webrtc,
    controls
  } = useSelector((state: RootState) => state.video);

  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const { endCall } = useVideoCallSocket({ socket, userId: user?.id });

  // Get other participant info
  const otherParticipantId = currentCall?.participant.id !== user?.id ? currentCall?.participant.id : currentCall?.initiator.id;
  const { data: otherParticipant } = useQuery({
    queryKey: ["user", otherParticipantId],
    queryFn: async () => {
      if (!otherParticipantId) return null;
      const response = await api.get(`/api/users/${otherParticipantId}`);
      return response.data;
    },
    enabled: !!otherParticipantId,
  });

  // Set up video streams
  useEffect(() => {
    if (webrtc.localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = webrtc.localStream;
    }
  }, [webrtc.localStream]);

  useEffect(() => {
    if (webrtc.remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = webrtc.remoteStream;
    }
  }, [webrtc.remoteStream]);

  // Auto-hide controls after inactivity
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
      const timeout = setTimeout(() => {
        if (userCallStatus === "in-call") {
          setShowControls(false);
        }
      }, 3000);
      setControlsTimeout(timeout);
    };

    if (isFullscreen) {
      document.addEventListener("mousemove", handleMouseMove);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        if (controlsTimeout) {
          clearTimeout(controlsTimeout);
        }
      };
    }
  }, [isFullscreen, userCallStatus, controlsTimeout]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
    };
  }, [controlsTimeout]);

  const handleEndCall = async () => {
    if (currentCall) {
      await endCall(currentCall.id);
    }
    onClose();
  };

  if (!currentCall) return null;

  const VideoContent = () => (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: theme.palette.background.default,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      {!isFullscreen && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            p: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar sx={{ width: 32, height: 32 }}>
              {otherParticipant?.avatar ? (
                <img
                  src={`/uploads/avatars/${otherParticipant.avatar}`}
                  alt={otherParticipant.username}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Typography variant="body2">
                  {otherParticipant?.username?.charAt(0).toUpperCase() || "?"}
                </Typography>
              )}
            </Avatar>
            <Box>
              <Typography variant="subtitle2">
                {otherParticipant ? capitalizeWords(otherParticipant.username) : "Unknown User"}
              </Typography>
              <CallStatusIndicator variant="compact" />
            </Box>
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
            {onMinimize && (
              <IconButton onClick={onMinimize} size="small">
                <Minimize />
              </IconButton>
            )}
            {onFullscreenToggle && (
              <IconButton onClick={onFullscreenToggle} size="small">
                <AspectRatio />
              </IconButton>
            )}
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </Box>
      )}

      {/* Video Area */}
      <Box
        sx={{
          flex: 1,
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000",
          overflow: "hidden",
        }}
      >
        {/* Remote Video */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {webrtc.remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                color: theme.palette.common.white,
              }}
            >
              <Avatar sx={{ width: 120, height: 120 }}>
                {otherParticipant?.avatar ? (
                  <img
                    src={`/uploads/avatars/${otherParticipant.avatar}`}
                    alt={otherParticipant.username}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <Typography variant="h2">
                    {otherParticipant?.username?.charAt(0).toUpperCase() || "?"}
                  </Typography>
                )}
              </Avatar>
              <Typography variant="h6" align="center">
                {otherParticipant ? capitalizeWords(otherParticipant.username) : "Unknown User"}
              </Typography>
              <CallStatusIndicator />
            </Box>
          )}
        </Box>

        {/* Local Video (Picture-in-Picture) */}
        {!controls.isCameraOff && webrtc.localStream && (
          <Box
            sx={{
              position: "absolute",
              top: 16,
              right: 16,
              width: isMobile ? 80 : 120,
              height: isMobile ? 60 : 90,
              borderRadius: 1,
              overflow: "hidden",
              border: `2px solid ${theme.palette.primary.main}`,
              backgroundColor: "#000",
              zIndex: 10,
            }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scaleX(-1)", // Mirror effect
              }}
            />
          </Box>
        )}

        {/* Local Video Disabled Indicator */}
        {controls.isCameraOff && (
          <Box
            sx={{
              position: "absolute",
              top: 16,
              right: 16,
              width: isMobile ? 80 : 120,
              height: isMobile ? 60 : 90,
              borderRadius: 1,
              backgroundColor: theme.palette.grey[800],
              border: `2px solid ${theme.palette.error.main}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            <Typography variant="caption" color="white" align="center">
              Camera Off
            </Typography>
          </Box>
        )}
      </Box>

      {/* Controls */}
      <Fade in={showControls || userCallStatus !== "in-call"}>
        <Box
          sx={{
            position: isFullscreen ? "absolute" : "relative",
            bottom: isFullscreen ? 20 : 0,
            left: isFullscreen ? "50%" : 0,
            transform: isFullscreen ? "translateX(-50%)" : "none",
            width: isFullscreen ? "auto" : "100%",
            display: "flex",
            justifyContent: "center",
            p: isFullscreen ? 0 : 2,
            zIndex: 20,
          }}
        >
          <CallControls
            onEndCall={handleEndCall}
            onFullscreenToggle={onFullscreenToggle}
            isFullscreen={isFullscreen}
            showMinimal={isMinimized}
          />
        </Box>
      </Fade>
    </Box>
  );

  if (isFullscreen) {
    return (
      <Backdrop
        open={true}
        sx={{
          zIndex: theme.zIndex.modal + 1,
          backgroundColor: "#000",
        }}
      >
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <VideoContent />
        </Box>
      </Backdrop>
    );
  }

  if (isMinimized) {
    return (
      <Paper
        elevation={8}
        sx={{
          position: "fixed",
          bottom: 20,
          right: 20,
          width: 280,
          height: 200,
          zIndex: theme.zIndex.modal,
          borderRadius: 2,
          overflow: "hidden",
          cursor: "pointer",
          transition: "all 0.3s ease",
          "&:hover": {
            transform: "scale(1.05)",
          },
        }}
        onClick={onMinimize}
      >
        <VideoContent />
      </Paper>
    );
  }

  return (
    <Paper
      elevation={8}
      sx={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: isMobile ? "95vw" : "80vw",
        height: isMobile ? "80vh" : "70vh",
        maxWidth: 1200,
        maxHeight: 800,
        zIndex: theme.zIndex.modal,
        borderRadius: 2,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <VideoContent />
    </Paper>
  );
};

export default VideoCallWindow;