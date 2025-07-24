import { Box, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import RegisterForm from '../../components/forms/RegisterForm';
import AuthPageLayout from '../../layouts/AuthPageLayout';

const Register = () => {
  const navigate = useNavigate();

  return (
    <AuthPageLayout
      title="Join the camp "
      showLogo={true}
      maxWidth={480}
      iconTransformY="22%"
    >
      <RegisterForm />

      <Box mt={2} textAlign={'center'}>
        <Button
          variant="text"
          onClick={() => navigate('/login')}
          sx={{ textTransform: 'none' }}
        >
          Have an account? Sign In
        </Button>
      </Box>
    </AuthPageLayout>
  );
};

export default Register;
