import { useSocket } from "@/hooks/useSocket";
import { useVideoCallSocket } from "@/hooks/useVideoCallSocket";
import type { RootState } from "@/store";
import { VideocamOffOutlined, VideocamOutlined } from "@mui/icons-material";
import { IconButton, Tooltip, useTheme } from "@mui/material";
import { useSelector } from "react-redux";

type VideoCallButtonProps = {
  conversationId: string;
  otherUserId: string;
  disabled?: boolean;
};

const VideoCallButton = ({ conversationId, otherUserId, disabled = false }: VideoCallButtonProps) => {
  const theme = useTheme();
  const socket = useSocket();
  const { user } = useSelector((state: RootState) => state.auth);
  const { currentCall, userCallStatus } = useSelector((state: RootState) => state.video);
  
  const { initiateCall } = useVideoCallSocket({ socket, userId: user?.id });

  const isCallActive = currentCall && currentCall.conversationId === conversationId;
  const isAnyCallActive = currentCall !== null;
  const isCallInProgress = userCallStatus === "calling" || userCallStatus === "ringing" || userCallStatus === "in-call";

  const handleVideoCall = async () => {
    if (!user?.id || !socket || disabled) return;

    try {
      await initiateCall(conversationId, otherUserId);
    } catch (error) {
      console.error("Failed to initiate video call:", error);
    }
  };

  const getTooltipText = () => {
    if (disabled) return "Video call unavailable";
    if (isAnyCallActive && !isCallActive) return "Another call is active";
    if (isCallInProgress) return "Call in progress";
    return "Start video call";
  };

  const getIcon = () => {
    if (isCallActive && isCallInProgress) {
      return <VideocamOutlined fontSize="small" sx={{ color: theme.palette.success.main }} />;
    }
    return <VideocamOffOutlined fontSize="small" />;
  };

  return (
    <Tooltip title={getTooltipText()}>
      <span>
        <IconButton
          onClick={handleVideoCall}
          disabled={disabled || (isAnyCallActive && !isCallActive)}
          size="small"
          sx={{
            padding: 0.5,
            "&:hover": {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          {getIcon()}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export default VideoCallButton;