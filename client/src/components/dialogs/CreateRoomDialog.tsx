import api from '@/services/axios';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const CreateRoomDialog = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const [roomName, setRoomName] = useState('');
  const queryClient = useQueryClient();
  const isCompact = useMediaQuery('(max-width: 920px)');
  const theme = useTheme();

  const handleCreate = async () => {
    if (!roomName.trim()) return;
    try {
      await api.post('/api/rooms', { name: roomName.trim() });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      onClose();
    } catch (error) {
      console.error('Room creation failed, ', error);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle sx={{ fontSize: '.90rem', px: 2, py: 1.8 }}>
        Create New Room
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="Room Name"
          fullWidth
          value={roomName}
          sx={{ minWidth: isCompact ? 'unset' : 360, mt: 1 }}
          onChange={e => setRoomName(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ pb: 2, px: 1.8 }}>
        <Button
          sx={{ color: `${theme.palette.success.dark}` }}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          sx={{ color: 'white' }}
          onClick={handleCreate}
          variant="contained"
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateRoomDialog;
