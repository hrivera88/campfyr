import { Box, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../../components/forms/LoginForm';
import AuthPageLayout from '../../layouts/AuthPageLayout';

const Login = () => {
  const navigate = useNavigate();

  return (
    <AuthPageLayout title="Gather round the " showLogo={true}>
      <LoginForm />

      <Box mt={2} textAlign={'center'}>
        <Button
          variant="text"
          onClick={() => navigate('/register')}
          sx={{ textTransform: 'none' }}
        >
          Need an account? Sign Up
        </Button>
      </Box>
    </AuthPageLayout>
  );
};

export default Login;
