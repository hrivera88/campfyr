import { Paper, useMediaQuery, useTheme } from "@mui/material";
import ChatWindow from "../../components/chat/ChatWindow";
import ChatSidebar from "../../components/chat/ChatSidebar";

const Chat = () => {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("md"));
  return (
    <Paper
      elevation={3}
      sx={{
        display: "flex",
        mt: isCompact ? .35 : 0,
        flexDirection: isCompact ? "column" : "row",
        height: isCompact ? "calc(100vh - 64px)" : "calc(100vh - 64px - 62px)",
        overflowY: "hidden",
      }}
    >
      <ChatSidebar />
      <ChatWindow />
    </Paper>
  );
};

export default Chat;
