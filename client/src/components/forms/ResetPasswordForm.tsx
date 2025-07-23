import { zodResolver } from "@hookform/resolvers/zod";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import type { APIError } from "../../schemas/api.error";
import type { ResetPasswordInput } from "../../schemas/auth";
import { ResetPasswordSchema } from "../../schemas/auth";
import api from "../../services/axios";

const ResetPasswordForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
  });

  // Set the token from URL params
  useEffect(() => {
    if (token) {
      setValue('token', token);
    }
  }, [token, setValue]);

  const resetPassword = (data: ResetPasswordInput) => {
    // Only send fields the backend expects
    const payload = {
      token: data.token,
      newPassword: data.newPassword
    };
    return api.post("/api/auth/reset-password", payload).then((res) => res.data);
  };

  const mutation = useMutation({
    mutationFn: resetPassword,
  });

  const onSubmit = (data: ResetPasswordInput) => {
    mutation.mutate(data, {
      onSuccess: () => {
        setIsSuccess(true);
        reset();
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      },
      onError: (error) => {
        console.error("Reset password error: ", error);
        setIsSuccess(false);
      },
    });
  };

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleClickShowConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  // If no token is provided, show error
  if (!token) {
    return (
      <Box sx={{ textAlign: "center", width: "100%" }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Invalid or missing reset token
        </Alert>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          The password reset link appears to be invalid or has expired.
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/login')}
          sx={{ mt: 1, color: 'white', textTransform: 'none' }}
        >
          Back to Login
        </Button>
      </Box>
    );
  }

  if (isSuccess) {
    return (
      <Box sx={{ textAlign: "center", width: "100%" }}>
        <Alert severity="success" sx={{ mb: 2 }}>
          Password reset successful!
        </Alert>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Your password has been successfully updated. You will be redirected to the login page in a few seconds.
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/login')}
          sx={{ mt: 1, color: 'white', textTransform: 'none' }}
        >
          Go to Login
        </Button>
      </Box>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{ width: "100%" }}
    >

      {mutation.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(mutation.error as APIError)?.response?.data?.error ||
            "Failed to reset password. Please try again or request a new reset link."}
        </Alert>
      )}

      {/* Hidden token field */}
      <input
        type="hidden"
        {...register("token")}
      />

      <TextField
        label="New Password"
        fullWidth
        margin="normal"
        type={showPassword ? "text" : "password"}
        autoComplete="new-password"
        autoFocus
        {...register("newPassword")}
        error={!!errors.newPassword}
        helperText={errors.newPassword?.message}
        disabled={mutation.isPending || isSubmitting}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label="toggle password visibility"
                onClick={handleClickShowPassword}
                edge="end"
                disabled={mutation.isPending || isSubmitting}
              >
                {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <TextField
        label="Confirm New Password"
        fullWidth
        margin="normal"
        type={showConfirmPassword ? "text" : "password"}
        autoComplete="new-password"
        {...register("confirmPassword")}
        error={!!errors.confirmPassword}
        helperText={errors.confirmPassword?.message}
        disabled={mutation.isPending || isSubmitting}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label="toggle confirm password visibility"
                onClick={handleClickShowConfirmPassword}
                edge="end"
                disabled={mutation.isPending || isSubmitting}
              >
                {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <Button
        variant="contained"
        fullWidth
        type="submit"
        sx={{ 
          mt: 3, 
          mb: 2, 
          pt: 1.25, 
          color: 'white',
          textTransform: 'none'
        }}
        color="primary"
        disabled={mutation.isPending || isSubmitting}
        startIcon={
          mutation.isPending || isSubmitting ? (
            <CircularProgress size={20} />
          ) : null
        }
      >
        {mutation.isPending || isSubmitting ? "Resetting..." : "Reset Password"}
      </Button>
    </Box>
  );
};

export default ResetPasswordForm;