import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RegisterSchema } from "../../schemas/auth";
import type { RegisterInput } from '../../schemas/auth';
import { TextField, Button, Box, CircularProgress } from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import api from "../../services/axios";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setUser } from "../../store/slice/authSlice";

const RegisterForm = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema),
  });
    
    const registerUser = (data: RegisterInput) => { 
        return api.post('/api/auth/register', data).then(res => res.data);
    }

    const mutation = useMutation({mutationFn: registerUser});

  const onSubmit = (data: RegisterInput) => {
      mutation.mutate(data, {
        onSuccess: async (data: {token: string}) => { 
          console.log('Registered!, ', data);
          localStorage.setItem("token", data.token);
          try { 
            const meResponse = await api.get("/api/auth/me", {
              headers: {
                Authorization: `Bearer ${data.token}`,
              }
            });
            const user = meResponse.data;
            dispatch(setUser({
              id: user.id,
              email: user.email,
              username: user.username,
              avatarUrl: user.avatarUrl,
            }));
            navigate('/chat');
          } catch (error) {
            console.log('Failed to fetch user profile, ', error);
           }
          },
          onError: (error) => { 
              console.error('Error registering!, ', error);
          }
      });
  };
    
  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{ maxWidth: 400, mx: "auto", mt: 4 }}
    >
      <TextField
        label="Organization name"
        fullWidth
        margin="normal"
        {...register("organizationName")}
        error={!!errors.organizationName}
        helperText={errors.organizationName?.message}
      />
      <TextField
        label="Email"
        fullWidth
        margin="normal"
        {...register("email")}
        error={!!errors.email}
        helperText={errors.email?.message}
      />
      <TextField
        label="Username"
        fullWidth
        margin="normal"
        {...register("username")}
        error={!!errors.username}
        helperText={errors.username?.message}
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
        sx={{ mt: 2, pt: 1.25, color: "white" }}
        startIcon={
          mutation.isPending || isSubmitting ? (
            <CircularProgress size={20} />
          ) : null
        }
      >
        Register
      </Button>
    </Box>
  );
};

export default RegisterForm;
