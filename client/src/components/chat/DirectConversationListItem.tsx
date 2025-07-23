import type { DirectConversationSchemaType } from "@/schemas/direct";
import api from "@/services/axios";
import { capitalizeWords } from "@/utils/capitalizeWords";
import { Box, CircularProgress, ListItem, ListItemButton, ListItemText, Typography, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import VideoCallButton from "./VideoCallButton";

type DirectConversationListItemProps = {
    conversation: DirectConversationSchemaType;
    onSelect: () => void;
    selected: boolean;
    currentUserId?: string;
}

const DirectConversationListItem = ({ conversation, onSelect, selected, currentUserId }: DirectConversationListItemProps) => { 
    const theme = useTheme();

  const otherUserId = conversation.user1Id === currentUserId ? conversation.user2Id : conversation.user1Id;
    const { data: user, isLoading: userIsLoading } = useQuery({
        queryKey: ["user", otherUserId],
        queryFn: async () => { 
            const response = await api.get(`/api/users/${otherUserId}`);
            return response.data;
        }
    });
    return (
      <>
        {userIsLoading ? (
          <ListItem
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress color="primary" size={16} />
          </ListItem>
        ) : (
          <ListItem disablePadding>
            <ListItemButton selected={selected} onClick={onSelect}>
              {user?.isOnline && (
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: `${theme.palette.success.dark}`,
                  }}
                />
              )}
              <ListItemText
                primary={
                  <Typography sx={{ fontSize: ".90rem" }}>
                    {user && !userIsLoading
                      ? capitalizeWords(user.username)
                      : "Loading..."}
                  </Typography>
                }
              />
              {user && !userIsLoading && (
                <VideoCallButton
                  conversationId={conversation.id}
                  otherUserId={otherUserId}
                  disabled={!user.isOnline}
                />
              )}
            </ListItemButton>
          </ListItem>
        )}
      </>
    );
};
export default DirectConversationListItem;