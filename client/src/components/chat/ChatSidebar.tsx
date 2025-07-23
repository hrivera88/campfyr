import type { DirectConversationSchemaType } from '@/schemas/direct';
import type { RootState } from '@/store';
import { setActiveConversation } from '@/store/slice/conversationSlice';
import { setSidebarMode, type SidebarMode } from '@/store/slice/sidebarSlice';
import { AddCircle, EmojiPeople, Groups2 } from '@mui/icons-material';
import {
  Box,
  Divider,
  IconButton,
  List,
  Tab,
  Tabs,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { ChatRoomSchemaType } from '../../schemas/chat';
import api from '../../services/axios';
import { setActiveRoom } from '../../store/slice/chatRoomSlice';
import CreateRoomDialog from '../dialogs/CreateRoomDialog';
import StartConversationDialog from '../dialogs/StartConversationDialog';
import DirectConversationListItem from './DirectConversationListItem';
import RoomListItem from './RoomListItem';

const ChatSidebar = () => {
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const dispatch = useDispatch();
  const mode = useSelector((state: RootState) => state.sidebar.mode);
  const activeConversation = useSelector(
    (state: RootState) => state.conversation.activeConversation
  );
  const user = useSelector((state: RootState) => state.auth.user);
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState<boolean>(false);
  const [isStartConversationOpen, setIsStartConversationOpen] =
    useState<boolean>(false);
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('md'));

  const { data: rooms = [] } = useQuery<ChatRoomSchemaType[]>({
    queryKey: ['rooms'],
    queryFn: async () => {
      const response = await api.get('/api/rooms');
      return response.data.data;
    },
    enabled: mode === 'chat',
  });
  const { data: dms = [] } = useQuery<DirectConversationSchemaType[]>({
    queryKey: ['dms'],
    queryFn: async () => {
      const response = await api.get('/api/direct/conversations');
      return response.data.data;
    },
    enabled: mode === 'dm',
  });
  const toggleRoom = (roomId: string) => {
    const nextRoomId = expandedRoomId === roomId ? null : roomId;
    setExpandedRoomId(nextRoomId);
    localStorage.setItem('expandedRoomId', JSON.stringify(nextRoomId));
  };
  const handleAddClick = () => {
    if (mode === 'chat') setIsCreateRoomOpen(true);
    if (mode === 'dm') setIsStartConversationOpen(true);
  };

  useEffect(() => {
    if (rooms.length === 0) return;
    const savedRoom = localStorage.getItem('activeRoom');
    const savedExpanded = localStorage.getItem('expandedRoomId');

    const parsedRoom = savedRoom ? JSON.parse(savedRoom) : null;
    const parsedExpanded = savedExpanded ? JSON.parse(savedExpanded) : null;

    const matchingRoom = parsedRoom
      ? rooms.find(r => r.id === parsedRoom.id)
      : null;

    if (matchingRoom) {
      dispatch(setActiveRoom(matchingRoom));
    } else {
      const generalRoom = rooms.find(r => r.name === 'General');
      if (generalRoom) {
        dispatch(setActiveRoom(generalRoom));
      }
    }
    if (parsedExpanded && rooms.find(r => r.id === parsedExpanded)) {
      setExpandedRoomId(parsedExpanded);
    }
  }, [rooms, dispatch]);

  const handleSidebarMode = (newValue: SidebarMode) => {
    if (newValue === 'dm') {
      dispatch(setActiveRoom(null));
    }
    if (newValue === 'chat') {
      dispatch(setActiveConversation(null));
    }
  };

  return (
    <Box
      sx={{
        width: isCompact ? '100%' : 300,
        height: isCompact ? 'unset' : '100%',
        borderRight: 1,
        borderColor: theme.palette.divider,
        p: 0,
      }}
    >
      {!isCompact && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexDirection: 'row',
              pr: isCompact ? 2 : 1,
            }}
          >
            <Tabs
              sx={{ p: 0, m: 0 }}
              value={mode}
              onChange={(_, newValue) => {
                dispatch(setSidebarMode(newValue));
                handleSidebarMode(newValue);
              }}
              indicatorColor="primary"
              textColor="primary"
            >
              <Tab
                sx={{
                  textTransform: 'none',
                  fontSize: '.90rem',
                  color: `${theme.palette.success.dark}`,
                  p: 1,
                  minHeight: isCompact ? 48 : 60,
                  flexDirection: isCompact ? 'column' : 'row',
                }}
                label="Rooms"
                icon={<Groups2 sx={{ fontSize: '1.4rem', mb: 0.6 }} />}
                iconPosition="start"
                value={'chat'}
              />
              <Tab
                sx={{
                  textTransform: 'none',
                  fontSize: '.90rem',
                  color: `${theme.palette.success.dark}`,
                  p: 1,
                  minHeight: isCompact ? 48 : 60,
                  flexDirection: isCompact ? 'column' : 'row',
                }}
                icon={<EmojiPeople sx={{ fontSize: '1.37em', mb: 0.6 }} />}
                iconPosition="start"
                label="DMs"
                value={'dm'}
              />
            </Tabs>
            <IconButton
              sx={{ p: 0, color: `${theme.palette.success.dark}` }}
              onClick={handleAddClick}
              aria-label={
                mode === 'chat' ? 'Create a room' : 'Start a conversation'
              }
            >
              <AddCircle fontSize="small" />
            </IconButton>
          </Box>
          <Divider sx={{ m: 0, p: 0 }} />
          {mode === 'chat' && (
            <List disablePadding>
              {/* Other Rooms */}
              {rooms.map(room => {
                return (
                  <RoomListItem
                    key={room.id}
                    room={room}
                    isExpanded={expandedRoomId === room.id}
                    onToggle={() => toggleRoom(room.id)}
                  />
                );
              })}
            </List>
          )}
          {mode === 'dm' && (
            <List disablePadding>
              {/* Other Rooms */}
              {dms.map(dm => {
                return (
                  <DirectConversationListItem
                    key={dm.id}
                    conversation={dm}
                    selected={activeConversation?.id === dm.id}
                    onSelect={() => dispatch(setActiveConversation(dm))}
                    currentUserId={user?.id}
                  />
                );
              })}
            </List>
          )}

          <Divider sx={{ mb: 1 }} />
        </>
      )}

      <CreateRoomDialog
        open={isCreateRoomOpen}
        onClose={() => setIsCreateRoomOpen(false)}
      />
      <StartConversationDialog
        open={isStartConversationOpen}
        onClose={() => setIsStartConversationOpen(false)}
      />
    </Box>
  );
};

export default ChatSidebar;
