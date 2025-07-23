import {
  Box,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
  Typography,
} from "@mui/material";
import {
  Mic,
  MicOff,
  Videocam,
  VideocamOff,
  CallEnd,
  VolumeUp,
  VolumeOff,
  Fullscreen,
  FullscreenExit,
} from "@mui/icons-material";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useVideoCallSocket } from "@/hooks/useVideoCallSocket";
import { useSocket } from "@/hooks/useSocket";
import { useState } from "react";

type CallControlsProps = {
  onEndCall: () => void;
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
  showMinimal?: boolean;
};

const CallControls = ({
  onEndCall,
  onFullscreenToggle,
  isFullscreen = false,
  showMinimal = false,
}: CallControlsProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const socket = useSocket();
  const { user } = useSelector((state: RootState) => state.auth);
  const { currentCall, controls, webrtc } = useSelector(
    (state: RootState) => state.video
  );
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);

  const { toggleMute, toggleCamera, endCall } = useVideoCallSocket({
    socket: socket || null,
    userId: user?.id,
  });

  const handleMicToggle = async () => {
    if (currentCall) {
      await toggleMute();
    }
  };

  const handleCameraToggle = async () => {
    if (currentCall) {
      await toggleCamera();
    }
  };

  const handleEndCall = async () => {
    if (currentCall) {
      await endCall(currentCall.id);
    }
    onEndCall();
  };

  const handleSpeakerToggle = () => {
    setIsSpeakerMuted(!isSpeakerMuted);
    // This would typically control the audio output volume
    // Implementation depends on how audio is handled in your WebRTC service
  };

  const getConnectionStatusColor = () => {
    switch (webrtc.connectionState) {
      case "connected":
        return theme.palette.success.main;
      case "connecting":
        return theme.palette.warning.main;
      case "disconnected":
        return theme.palette.error.main;
      default:
        return theme.palette.text.disabled;
    }
  };

  if (showMinimal) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          gap: 1,
          p: 1,
          backgroundColor: `${theme.palette.background.paper}95`,
          borderRadius: 3,
          backdropFilter: "blur(10px)",
        }}
      >
        <IconButton
          onClick={handleMicToggle}
          sx={{
            backgroundColor: controls.isMuted ? theme.palette.error.main : theme.palette.action.disabled,
            color: theme.palette.common.white,
            width: 40,
            height: 40,
            "&:hover": {
              backgroundColor: controls.isMuted ? theme.palette.error.dark : theme.palette.action.hover,
            },
          }}
        >
          {controls.isMuted ? <MicOff /> : <Mic />}
        </IconButton>

        <IconButton
          onClick={handleCameraToggle}
          sx={{
            backgroundColor: controls.isCameraOff ? theme.palette.error.main : theme.palette.action.disabled,
            color: theme.palette.common.white,
            width: 40,
            height: 40,
            "&:hover": {
              backgroundColor: controls.isCameraOff ? theme.palette.error.dark : theme.palette.action.hover,
            },
          }}
        >
          {controls.isCameraOff ? <VideocamOff /> : <Videocam />}
        </IconButton>

        <IconButton
          onClick={handleEndCall}
          sx={{
            backgroundColor: theme.palette.error.main,
            color: theme.palette.common.white,
            width: 40,
            height: 40,
            "&:hover": {
              backgroundColor: theme.palette.error.dark,
            },
          }}
        >
          <CallEnd />
        </IconButton>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 2,
        p: 2,
        backgroundColor: `${theme.palette.background.paper}95`,
        borderRadius: 3,
        backdropFilter: "blur(10px)",
        minHeight: 72,
      }}
    >
      {/* Connection Status */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mr: 2,
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: getConnectionStatusColor(),
            animation: webrtc.connectionState === "connecting" ? "pulse 1s infinite" : "none",
          }}
        />
        <Typography variant="caption" color="text.secondary">
          {webrtc.connectionState}
        </Typography>
      </Box>

      {/* Control Buttons */}
      <Box sx={{ display: "flex", gap: 1 }}>
        <Tooltip title={controls.isMuted ? "Unmute microphone" : "Mute microphone"}>
          <IconButton
            onClick={handleMicToggle}
            sx={{
              backgroundColor: controls.isMuted ? theme.palette.error.main : theme.palette.action.disabled,
              color: theme.palette.common.white,
              width: isMobile ? 48 : 56,
              height: isMobile ? 48 : 56,
              "&:hover": {
                backgroundColor: controls.isMuted ? theme.palette.error.dark : theme.palette.action.hover,
              },
            }}
          >
            {controls.isMuted ? <MicOff /> : <Mic />}
          </IconButton>
        </Tooltip>

        <Tooltip title={controls.isCameraOff ? "Turn on camera" : "Turn off camera"}>
          <IconButton
            onClick={handleCameraToggle}
            sx={{
              backgroundColor: controls.isCameraOff ? theme.palette.error.main : theme.palette.action.disabled,
              color: theme.palette.common.white,
              width: isMobile ? 48 : 56,
              height: isMobile ? 48 : 56,
              "&:hover": {
                backgroundColor: controls.isCameraOff ? theme.palette.error.dark : theme.palette.action.hover,
              },
            }}
          >
            {controls.isCameraOff ? <VideocamOff /> : <Videocam />}
          </IconButton>
        </Tooltip>

        <Tooltip title={isSpeakerMuted ? "Unmute speaker" : "Mute speaker"}>
          <IconButton
            onClick={handleSpeakerToggle}
            sx={{
              backgroundColor: isSpeakerMuted ? theme.palette.error.main : theme.palette.action.disabled,
              color: theme.palette.common.white,
              width: isMobile ? 48 : 56,
              height: isMobile ? 48 : 56,
              "&:hover": {
                backgroundColor: isSpeakerMuted ? theme.palette.error.dark : theme.palette.action.hover,
              },
            }}
          >
            {isSpeakerMuted ? <VolumeOff /> : <VolumeUp />}
          </IconButton>
        </Tooltip>

        {onFullscreenToggle && (
          <Tooltip title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
            <IconButton
              onClick={onFullscreenToggle}
              sx={{
                backgroundColor: theme.palette.action.disabled,
                color: theme.palette.common.white,
                width: isMobile ? 48 : 56,
                height: isMobile ? 48 : 56,
                "&:hover": {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="End call">
          <IconButton
            onClick={handleEndCall}
            sx={{
              backgroundColor: theme.palette.error.main,
              color: theme.palette.common.white,
              width: isMobile ? 48 : 56,
              height: isMobile ? 48 : 56,
              "&:hover": {
                backgroundColor: theme.palette.error.dark,
              },
            }}
          >
            <CallEnd />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default CallControls;