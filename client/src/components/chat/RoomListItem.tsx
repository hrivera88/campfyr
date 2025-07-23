import { setActiveConversation } from '@/store/slice/conversationSlice';
import { setSidebarMode } from '@/store/slice/sidebarSlice';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import OutgoingMail from '@mui/icons-material/OutgoingMail';
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  useTheme,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type {
  ChatRoomSchemaType,
  RoomUserSchemaType,
} from '../../schemas/chat';
import api from '../../services/axios';
import type { RootState } from '../../store';
import {
  setActiveRoom,
  setRoomMembership,
} from '../../store/slice/chatRoomSlice';
import { capitalizeWords } from '../../utils/capitalizeWords';

type RoomListItemProps = {
  room: ChatRoomSchemaType;
  isExpanded: boolean;
  onToggle: () => void;
  onUserSelect?: () => void;
};

const RoomListItem = ({
  room,
  isExpanded,
  onToggle,
  onUserSelect,
}: RoomListItemProps) => {
  const queryClient = useQueryClient();
  const currentUser = useSelector((state: RootState) => state.auth.user);
  const activeRoom = useSelector((state: RootState) => state.room.activeRoom);
  const isMember = useSelector((state: RootState) => state.room.isMember);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showDMDialog, setShowDMDialog] = useState<boolean>(false);
  const [targetUser, setTargetUser] = useState<RoomUserSchemaType | null>(null);
  const dispatch = useDispatch();
  const theme = useTheme();

  const { data: users, isLoading } = useQuery<RoomUserSchemaType[]>({
    queryKey: ['roomUsers', room.id],
    queryFn: async () => {
      const response = await api.get(`/api/rooms/${room.id}/users`);
      return response.data;
    },
    enabled: isExpanded,
  });

  const joinRoomMutation = useMutation({
    mutationFn: () => api.post(`/api/rooms/${room.id}/join`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roomUsers', room.id] });
      setShowJoinModal(false);
    },
  });

  const dbMutation = useMutation({
    mutationFn: () =>
      api.post('/api/direct/conversations', {
        recipientId: targetUser?.id,
      }),
    onSuccess: res => {
      queryClient.invalidateQueries({ queryKey: ['dms'] });
      dispatch(setSidebarMode('dm'));
      dispatch(setActiveRoom(null));
      dispatch(setActiveConversation(res.data));
      setShowDMDialog(false);
    },
  });

  const handleStartDirectConversation = () => {
    if (!targetUser) return;
    dbMutation.mutate();
  };

  useEffect(() => {
    if (!isLoading && users && activeRoom?.id === room.id) {
      const isUserInRoom = users.some(u => u.id === currentUser?.id);
      dispatch(setRoomMembership(isUserInRoom));
    }
  }, [isLoading, users, currentUser?.id, activeRoom?.id, room.id, dispatch]);

  return (
    <>
      <ListItem disablePadding>
        <ListItemButton
          selected={activeRoom?.name === room.name}
          onClick={() => {
            dispatch(setActiveRoom(room));
            onToggle();
          }}
          sx={{ px: 1 }}
        >
          <ListItemText
            primary={
              <Typography sx={{ fontSize: '.90rem' }}>{`# ${capitalizeWords(
                room.name
              )}`}</Typography>
            }
          />
          {isExpanded ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
      </ListItem>
      <Collapse in={isExpanded} timeout={'auto'} unmountOnExit>
        <List component={'div'} disablePadding sx={{ pl: 2 }}>
          {isLoading ? (
            <ListItem>
              <CircularProgress color="primary" size={16} />
            </ListItem>
          ) : isMember ? (
            users?.map(user => (
              <ListItem
                disablePadding
                key={user.id}
                sx={{ pl: user.isOnline ? 0 : 2, pr: 1 }}
                onClick={() => {
                  onUserSelect?.();
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    width: '100%',
                  }}
                >
                  {user.isOnline && (
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: `${theme.palette.success.main}`,
                      }}
                    />
                  )}
                  <ListItemText
                    primary={
                      <Typography sx={{ fontSize: '.90rem' }}>
                        {capitalizeWords(user.username)}
                      </Typography>
                    }
                  />
                  {user.id !== currentUser?.id && (
                    <IconButton
                      sx={{ ml: 'auto', mr: '-6px' }}
                      onClick={() => {
                        setTargetUser(user);
                        setShowDMDialog(true);
                      }}
                      color="primary"
                    >
                      <OutgoingMail fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </ListItem>
            ))
          ) : (
            <Box
              sx={{
                py: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
              }}
            >
              <Typography sx={{ fontSize: '.85rem', m: 0 }}>
                You are not part of this room.
              </Typography>
              <Button
                size="small"
                variant="text"
                onClick={() => setShowJoinModal(true)}
                sx={{ textTransform: 'none', p: 0, m: 0 }}
              >
                Click here to join.
              </Button>
            </Box>
          )}
        </List>
      </Collapse>

      {/* Join Chat Room Dialog */}
      <Dialog open={showJoinModal} onClose={() => setShowJoinModal(false)}>
        <DialogTitle sx={{ fontSize: '.90rem', m: 0, px: 2, py: 1.8 }}>
          Join Room
        </DialogTitle>{' '}
        <Divider />
        <DialogContent>
          <Typography>Are you sure you want to join {room.name}?</Typography>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 1.8 }}>
          <Button
            sx={{ color: `${theme.palette.success.dark}` }}
            size="small"
            onClick={() => setShowJoinModal(false)}
          >
            Cancel
          </Button>
          <Button
            size="small"
            onClick={() => joinRoomMutation.mutate()}
            variant="contained"
            color="primary"
            sx={{ color: 'white' }}
            disabled={joinRoomMutation.isPending}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
      {/* Start DM */}
      <Dialog open={showDMDialog} onClose={() => setShowDMDialog(false)}>
        <DialogTitle sx={{ fontSize: '.90rem', px: 2, py: 1.8 }}>
          Start Conversation
        </DialogTitle>
        <DialogContent>
          <Typography>
            Start a direct conversation with{' '}
            <strong>{capitalizeWords(targetUser?.username || '')}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 1.8 }}>
          <Button
            sx={{ color: `${theme.palette.success.dark}` }}
            size="small"
            onClick={() => setShowDMDialog(false)}
          >
            Cancel
          </Button>
          <Button
            size="small"
            onClick={handleStartDirectConversation}
            variant="contained"
            color="primary"
            sx={{ color: 'white' }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RoomListItem;
