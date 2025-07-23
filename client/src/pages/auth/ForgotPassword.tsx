import { Box, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ForgotPasswordForm from "../../components/forms/ForgotPasswordForm";
import AuthPageLayout from "../../layouts/AuthPageLayout";

const ForgotPassword = () => {
  const navigate = useNavigate();

  return (
    <AuthPageLayout
      title="Reset Password"
      subtitle="Enter your email address and we'll send you a link to reset your password."
      icon="/reset-icon.svg"
      showLogo={true}
      iconTransformY={10}
    >
      <ForgotPasswordForm />
      
      <Box mt={2} textAlign={"center"}>
        <Button 
          variant="text" 
          onClick={() => navigate("/login")}
          sx={{ textTransform: 'none' }}
        >
          Back to Login
        </Button>
      </Box>
    </AuthPageLayout>
  );
};

export default ForgotPassword;