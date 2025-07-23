import { Box, Container } from "@mui/material";
import { Outlet } from "react-router-dom";
import TopBar from "../components/navigation/TopBar";
import { useTheme } from "@mui/material";
import { useSelector } from "react-redux";
import type { RootState } from "../store";
import IncomingCallModal from "../components/chat/IncomingCallModal";
import VideoCallWindow from "../components/chat/VideoCallWindow";
import { useState } from "react";

const AppLayout = () => {
  const theme = useTheme();
  const { currentCall, isCallWindowOpen } = useSelector((state: RootState) => state.video);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [isCallFullscreen, setIsCallFullscreen] = useState(false);

  const handleCloseCall = () => {
    setIsCallMinimized(false);
    setIsCallFullscreen(false);
  };

  const handleMinimizeCall = () => {
    setIsCallMinimized(!isCallMinimized);
  };

  const handleFullscreenToggle = () => {
    setIsCallFullscreen(!isCallFullscreen);
  };

  return (
      <Box
        sx={{
          backgroundColor: `#ffffff`,
          height: "100vh",
        }}
      >
        <Box
          sx={{
            background: `linear-gradient(to top, ${theme.palette.primary.main} 0%,rgba(3, 168, 244, 0.4) 25%, transparent 100%)`,
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            width: "100%",
          }}
        >
          <TopBar />
          <Box component={"main"} sx={{flex: 1, overflow: "auto", display: "flex", flexDirection: "column", justifyContent: "center"}}>
            <Container
              sx={{
                p: {xs: 0, sm: 2},
              }}
              maxWidth="lg"
            >
              <Outlet />
            </Container>
          </Box>
        </Box>

        {/* Video Call Components */}
        <IncomingCallModal />
        
        {currentCall && isCallWindowOpen && (
          <VideoCallWindow
            onClose={handleCloseCall}
            onMinimize={handleMinimizeCall}
            isMinimized={isCallMinimized}
            isFullscreen={isCallFullscreen}
            onFullscreenToggle={handleFullscreenToggle}
          />
        )}
      </Box>
    );
 }

export default AppLayout;
