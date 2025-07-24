import {
  Alert,
  Box,
  Button,
  TextField,
} from '@mui/material';
import axios from 'axios';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const AcceptInviteForm = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post('/api/auth/accept-invite', {
        token,
        username,
        password,
      });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data.error || 'Failed to accept invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component={'form'} onSubmit={handleSubmit} noValidate>
      {error && (
        <Alert severity="error" sx={{ mt: 2, mb: 1 }}>
          {error}
        </Alert>
      )}
      <TextField
        fullWidth
        label="username"
        variant="outlined"
        value={username}
        onChange={e => setUsername(e.target.value)}
        required
        margin="normal"
      />
      <TextField
        fullWidth
        label="password"
        variant="outlined"
        value={password}
        type="password"
        onChange={e => setPassword(e.target.value)}
        required
        margin="normal"
      />
      <Button
        type="submit"
        fullWidth
        variant="contained"
        color="primary"
        disabled={loading}
        sx={{ mt: 2, color: 'white' }}
      >
        {loading ? 'Submitting...' : 'Accept Invite'}
      </Button>
    </Box>
  );
};

export default AcceptInviteForm;