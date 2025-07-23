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

const SendInvitationDialog = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const [email, setEmail] = useState<string>('');
  const queryClient = useQueryClient();
  const isCompact = useMediaQuery('(max-width: 920px)');
  const theme = useTheme();

  const handleSend = async () => {
    if (!email.trim()) return;
    try {
      await api.post('/api/users/invite', { email: email.trim() });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      onClose();
    } catch (error) {
      console.error('Send invite failed, ', error);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: '.90rem', px: 1.8, py: 1.8 }}>
        Invite someone to join in
      </DialogTitle>
      <DialogContent sx={{ px: 1.8 }}>
        <TextField
          autoFocus
          label="Email Address"
          fullWidth
          value={email}
          type="email"
          sx={{ minWidth: isCompact ? 'unset' : 360, mt: 0.8 }}
          onChange={e => setEmail(e.target.value)}
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
          sx={{ color: 'white', pt: 1 }}
          onClick={handleSend}
          variant="contained"
        >
          Send Invite
        </Button>
      </DialogActions>
    </Dialog>
  );
};
export default SendInvitationDialog;
