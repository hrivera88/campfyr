import { Box, Typography, useTheme } from "@mui/material";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { useEffect, useState } from "react";

type CallStatusIndicatorProps = {
  showDuration?: boolean;
  variant?: "compact" | "detailed";
};

const CallStatusIndicator = ({ 
  showDuration = true, 
  variant = "detailed" 
}: CallStatusIndicatorProps) => {
  const theme = useTheme();
  const { currentCall, userCallStatus, webrtc } = useSelector(
    (state: RootState) => state.video
  );
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Update duration counter
  useEffect(() => {
    if (currentCall?.status === "active" && !startTime) {
      setStartTime(Date.now());
    }

    if (currentCall?.status !== "active") {
      setStartTime(null);
      setDuration(0);
      return;
    }

    const interval = setInterval(() => {
      if (startTime) {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentCall?.status, startTime]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Get status text and color
  const getStatusInfo = () => {
    switch (userCallStatus) {
      case "calling":
        return {
          text: "Calling...",
          color: theme.palette.warning.main,
          pulse: true,
        };
      case "ringing":
        return {
          text: "Ringing...",
          color: theme.palette.info.main,
          pulse: true,
        };
      case "in-call":
        return {
          text: showDuration ? formatDuration(duration) : "Connected",
          color: theme.palette.success.main,
          pulse: false,
        };
      case "available":
        return {
          text: "Available",
          color: theme.palette.success.main,
          pulse: false,
        };
      default:
        return {
          text: "Unknown",
          color: theme.palette.text.disabled,
          pulse: false,
        };
    }
  };

  // Get connection quality indicator
  const getConnectionQualityColor = () => {
    switch (webrtc.connectionState) {
      case "connected":
        return theme.palette.success.main;
      case "connecting":
        return theme.palette.warning.main;
      case "disconnected":
        return theme.palette.error.main;
      case "failed":
        return theme.palette.error.main;
      default:
        return theme.palette.text.disabled;
    }
  };

  if (!currentCall) return null;

  const statusInfo = getStatusInfo();

  if (variant === "compact") {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1,
          py: 0.5,
          backgroundColor: `${theme.palette.background.paper}90`,
          borderRadius: 1,
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: statusInfo.color,
            animation: statusInfo.pulse ? "pulse 1.5s infinite" : "none",
            "@keyframes pulse": {
              "0%": { opacity: 1 },
              "50%": { opacity: 0.5 },
              "100%": { opacity: 1 },
            },
          }}
        />
        <Typography variant="caption" color="text.secondary">
          {statusInfo.text}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
        p: 2,
        backgroundColor: `${theme.palette.background.paper}95`,
        borderRadius: 2,
        backdropFilter: "blur(10px)",
        minWidth: 200,
      }}
    >
      {/* Main Status */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: statusInfo.color,
            animation: statusInfo.pulse ? "pulse 1.5s infinite" : "none",
            "@keyframes pulse": {
              "0%": { opacity: 1 },
              "50%": { opacity: 0.5 },
              "100%": { opacity: 1 },
            },
          }}
        />
        <Typography variant="body2" color="text.primary" fontWeight="medium">
          {statusInfo.text}
        </Typography>
      </Box>

      {/* Connection Quality */}
      {userCallStatus === "in-call" && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: getConnectionQualityColor(),
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {webrtc.connectionState}
          </Typography>
        </Box>
      )}

      {/* Call Duration (if different from main status) */}
      {userCallStatus === "in-call" && !showDuration && (
        <Typography variant="caption" color="text.secondary">
          {formatDuration(duration)}
        </Typography>
      )}
    </Box>
  );
};

export default CallStatusIndicator;