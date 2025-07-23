import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  useTheme,
} from '@mui/material';

interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

interface UserDetailsDialogProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
}

const UserDetailsDialog = ({ open, user, onClose }: UserDetailsDialogProps) => {
  const theme = useTheme();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>User Details</DialogTitle>
      <DialogContent>
        {user && (
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>Username:</strong> {user.username}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>Email:</strong> {user.email}
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>Joined:</strong>{' '}
              {new Date(user.createdAt).toLocaleDateString()}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          sx={{ color: `${theme.palette.success.dark}` }}
          onClick={onClose}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserDetailsDialog;
