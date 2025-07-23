import { capitalizeWords } from "@/utils/capitalizeWords";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  CircularProgress,
} from "@mui/material";

interface Invitation {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
}

interface InvitationDetailsDialogProps {
  open: boolean;
  invitation: Invitation | null;
  onClose: () => void;
  onResend?: (invitation: Invitation) => void;
  isResending?: boolean;
}

const InvitationDetailsDialog = ({ 
  open, 
  invitation, 
  onClose, 
  onResend,
  isResending = false
}: InvitationDetailsDialogProps) => {
  const handleResend = () => {
    if (invitation && onResend) {
      onResend(invitation);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'warning';
      case 'accepted':
        return 'success';
      case 'expired':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: ".90rem", px: 2, py: 1.8 }}>
        Invitation Details
      </DialogTitle>
      <DialogContent>
        {invitation && (
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>Email:</strong> {invitation.email}
            </Typography>
            <Typography
              variant="body1"
              sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
            >
              <strong>Status:</strong>
              <Chip
                label={capitalizeWords(invitation.status)}
                sx={{ color: "white", letterSpacing: 1 }}
                color={getStatusColor(invitation.status)}
                size="small"
              />
            </Typography>
            <Typography variant="body1" sx={{ mb: 2 }}>
              <strong>Expires:</strong>{" "}
              {new Date(invitation.expiresAt).toLocaleDateString()}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ pb: 2, px: 1.8 }}>
        <Button onClick={onClose}>Close</Button>
        {invitation && onResend && invitation.status === "pending" && (
          <Button
            onClick={handleResend}
            variant="contained"
            color="primary"
            sx={{ color: "white" }}
            disabled={isResending}
            startIcon={isResending ? <CircularProgress size={20} /> : null}
          >
            {isResending ? "Resending..." : "Resend"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default InvitationDetailsDialog;