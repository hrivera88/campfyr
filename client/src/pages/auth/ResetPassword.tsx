import { Box, Button } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ResetPasswordForm from "../../components/forms/ResetPasswordForm";
import AuthPageLayout from "../../layouts/AuthPageLayout";

const ResetPassword = () => {
  const navigate = useNavigate();

  return (
    <AuthPageLayout
      title="Set New Password"
      subtitle="Create a strong password for your account."
      icon="/reset-icon.svg"
      showLogo={true}
      iconTransformY="translateY(10px)"
    >
      <ResetPasswordForm />
      
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

export default ResetPassword;