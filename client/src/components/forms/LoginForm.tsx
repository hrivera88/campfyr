import { useMutation } from "@tanstack/react-query";
import { Box, Button, TextField, Alert, CircularProgress, Typography } from "@mui/material";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema } from "../../schemas/auth";
import type { LoginInput } from "../../schemas/auth";
import { useForm } from "react-hook-form";
import api from "../../services/axios";
import { useDispatch } from "react-redux";
import { setUser } from "../../store/slice/authSlice";
import type { APIError } from "../../schemas/api.error";
import { useNavigate } from "react-router-dom";

const LoginForm = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
  });

  const loginUser = (data: LoginInput) => {
    return api.post("/api/auth/login", data).then((res) => res.data);
  };

  const mutation = useMutation({
    mutationFn: loginUser,
  });

  const onSubmit = (data: LoginInput) => {
    mutation.mutate(data, {
      onSuccess: async (data: { token: string }) => {
        localStorage.setItem("token", data.token);
        try {
          const meResponse = await api.get("/api/auth/me", {
            headers: {
              Authorization: `Bearer ${data.token}`,
            },
          });
          const user = meResponse.data;
          dispatch(
            setUser({
              id: user.id,
              email: user.email,
              username: user.username,
              avatarUrl: user.avatarUrl,
            })
          );
          navigate('/chat');
        } catch (error) {
          console.log("Failed to fetch user profile, ", error);
        }
      },
      onError: (error) => {
        console.error("Log In error!, ", error);
      },
    });
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{ maxWidth: 400, mx: "auto", mt: 4 }}
    >
      {mutation.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(mutation.error as APIError)?.response?.data?.error ||
            "Login Failed"}
        </Alert>
      )}
      <TextField
        label="Email"
        fullWidth
        margin="normal"
        {...register("email")}
        error={!!errors.email}
        helperText={errors.email?.message}
      />
      <TextField
        label="Password"
        fullWidth
        type="password"
        margin="normal"
        {...register("password")}
        error={!!errors.password}
        helperText={errors.password?.message}
      />
      <Button
        variant="contained"
        fullWidth
        type="submit"
        sx={{ mt: 2, pt: 1.25, color: 'white' }}
        color="primary"
        disabled={mutation.isPending || isSubmitting}
        startIcon={
          mutation.isPending || isSubmitting ? (
            <CircularProgress size={20} />
          ) : null
        }
      >
        Login
      </Button>

      <Box sx={{ textAlign: "center", mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Forgot your password?{" "}
          <Button
            variant="text"
            size="small"
            onClick={() => navigate('/forgot-password')}
            sx={{ textTransform: 'none', p: 0, minWidth: 'auto' }}
          >
            Reset it here
          </Button>
        </Typography>
      </Box>
    </Box>
  );
};

export default LoginForm;
