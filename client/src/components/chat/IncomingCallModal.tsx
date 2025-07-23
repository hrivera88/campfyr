import {
  Dialog,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Avatar,
  IconButton,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { Call, CallEnd, VideocamOutlined } from "@mui/icons-material";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useVideoCallSocket } from "@/hooks/useVideoCallSocket";
import { useSocket } from "@/hooks/useSocket";
import { useQuery } from "@tanstack/react-query";
import api from "@/services/axios";
import { capitalizeWords } from "@/utils/capitalizeWords";
import { useEffect, useState } from "react";

const IncomingCallModal = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const socket = useSocket();
  const { user } = useSelector((state: RootState) => state.auth);
  const { incomingCall, userCallStatus } = useSelector((state: RootState) => state.video);
  const [ringTone, setRingTone] = useState<HTMLAudioElement | null>(null);

  const { acceptCall, rejectCall } = useVideoCallSocket({ socket: socket || null, userId: user?.id });

  // Fetch caller information
  const { data: caller } = useQuery({
    queryKey: ["user", incomingCall?.initiator.id],
    queryFn: async () => {
      if (!incomingCall?.initiator.id) return null;
      const response = await api.get(`/api/users/${incomingCall.initiator.id}`);
      return response.data;
    },
    enabled: !!incomingCall?.initiator.id,
  });

  // Play ring tone when call comes in
  useEffect(() => {
    if (incomingCall && userCallStatus === "ringing") {
      const audio = new Audio("/sounds/incoming-call.mp3");
      audio.loop = true;
      audio.play().catch(() => {
        // Fallback if audio fails to play
        console.log("Could not play ring tone");
      });
      setRingTone(audio);
    }

    return () => {
      if (ringTone) {
        ringTone.pause();
        ringTone.currentTime = 0;
      }
    };
  }, [incomingCall, userCallStatus]);

  // Stop ring tone when modal closes
  useEffect(() => {
    return () => {
      if (ringTone) {
        ringTone.pause();
        ringTone.currentTime = 0;
      }
    };
  }, []);

  const handleAccept = async () => {
    if (ringTone) {
      ringTone.pause();
      ringTone.currentTime = 0;
    }
    if (incomingCall) {
      await acceptCall(incomingCall.videoCallId);
    }
  };

  const handleReject = async () => {
    if (ringTone) {
      ringTone.pause();
      ringTone.currentTime = 0;
    }
    if (incomingCall) {
      await rejectCall(incomingCall.videoCallId);
    }
  };

  const isOpen = !!incomingCall && userCallStatus === "ringing";

  if (!isOpen || !incomingCall) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={() => {}} // Prevent closing by clicking outside
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          background: `linear-gradient(135deg, ${theme.palette.primary.main}20, ${theme.palette.secondary.main}20)`,
          backdropFilter: "blur(10px)",
        },
      }}
    >
      <DialogContent
        sx={{
          textAlign: "center",
          py: 4,
          px: 3,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Avatar
            sx={{
              width: 80,
              height: 80,
              mb: 2,
              border: `3px solid ${theme.palette.primary.main}`,
              animation: "pulse 2s infinite",
              "@keyframes pulse": {
                "0%": {
                  transform: "scale(1)",
                  boxShadow: `0 0 0 0 ${theme.palette.primary.main}40`,
                },
                "70%": {
                  transform: "scale(1.05)",
                  boxShadow: `0 0 0 10px ${theme.palette.primary.main}00`,
                },
                "100%": {
                  transform: "scale(1)",
                  boxShadow: `0 0 0 0 ${theme.palette.primary.main}00`,
                },
              },
            }}
          >
            {caller?.avatar ? (
              <img
                src={`/uploads/avatars/${caller.avatar}`}
                alt={caller.username}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <Typography variant="h3" color="primary">
                {caller?.username?.charAt(0).toUpperCase() || "?"}
              </Typography>
            )}
          </Avatar>

          <Typography variant="h6" color="text.primary" gutterBottom>
            {caller ? capitalizeWords(caller.username) : capitalizeWords(incomingCall.initiator.username)}
          </Typography>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <VideocamOutlined color="primary" />
            <Typography variant="body1" color="text.secondary">
              Incoming video call
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {incomingCall.conversationId ? "Direct message" : "Group call"}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          justifyContent: "space-around",
          pb: 3,
          px: 3,
        }}
      >
        <IconButton
          onClick={handleReject}
          sx={{
            backgroundColor: theme.palette.error.main,
            color: theme.palette.error.contrastText,
            width: 64,
            height: 64,
            "&:hover": {
              backgroundColor: theme.palette.error.dark,
            },
            animation: "fadeIn 0.3s ease-in-out",
          }}
        >
          <CallEnd />
        </IconButton>

        <IconButton
          onClick={handleAccept}
          sx={{
            backgroundColor: theme.palette.success.main,
            color: theme.palette.success.contrastText,
            width: 64,
            height: 64,
            "&:hover": {
              backgroundColor: theme.palette.success.dark,
            },
            animation: "fadeIn 0.3s ease-in-out",
          }}
        >
          <Call />
        </IconButton>
      </DialogActions>

      {isMobile && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            pb: 2,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Swipe actions not available - use buttons above
          </Typography>
        </Box>
      )}
    </Dialog>
  );
};

export default IncomingCallModal;