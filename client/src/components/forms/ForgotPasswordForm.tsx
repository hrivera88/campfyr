import { useMutation } from "@tanstack/react-query";
import { Box, Button, TextField, Alert, CircularProgress, Typography } from "@mui/material";
import { zodResolver } from "@hookform/resolvers/zod";
import { ForgotPasswordSchema } from "../../schemas/auth";
import type { ForgotPasswordInput } from "../../schemas/auth";
import { useForm } from "react-hook-form";
import api from "../../services/axios";
import type { APIError } from "../../schemas/api.error";
import { useState } from "react";

const ForgotPasswordForm = () => {
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
  });

  const forgotPassword = (data: ForgotPasswordInput) => {
    return api.post("/api/auth/forgot-password", data).then((res) => res.data);
  };

  const mutation = useMutation({
    mutationFn: forgotPassword,
  });

  const onSubmit = (data: ForgotPasswordInput) => {
    mutation.mutate(data, {
      onSuccess: () => {
        setIsSuccess(true);
        reset();
      },
      onError: (error) => {
        console.error("Forgot password error: ", error);
        setIsSuccess(false);
      },
    });
  };

  if (isSuccess) {
    return (
      <Box sx={{ textAlign: "center", width: "100%" }}>
        <Alert severity="success" sx={{ mb: 2 }}>
          Password reset email sent successfully!
        </Alert>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Please check your email for instructions on how to reset your password.
        </Typography>
        <Button
          variant="outlined"
          onClick={() => setIsSuccess(false)}
          sx={{ mt: 1, textTransform: 'none' }}
        >
          Send Another Email
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
            "Failed to send reset email. Please try again."}
        </Alert>
      )}

      <TextField
        label="Email Address"
        fullWidth
        margin="normal"
        type="email"
        autoComplete="email"
        autoFocus
        {...register("email")}
        error={!!errors.email}
        helperText={errors.email?.message}
        disabled={mutation.isPending || isSubmitting}
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
        {mutation.isPending || isSubmitting ? "Sending..." : "Send Reset Email"}
      </Button>
    </Box>
  );
};

export default ForgotPasswordForm;