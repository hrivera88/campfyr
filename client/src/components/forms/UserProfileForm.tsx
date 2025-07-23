import { EditUserSchema, type EditUserSchemaType } from '@/schemas/user';
import api from '@/services/axios';
import { setUser } from '@/store/slice/authSlice';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

const UserProfileForm = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const [isSnackbarOpened, setIsSnackbarOpened] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>(
    'success'
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/jpg',
    'image/gif',
    'image/webp',
  ];
  const dispatch = useDispatch();

  const { data: userData, isLoading: userDataIsLoading } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const response = await api.get('/api/auth/me');
      return response.data;
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditUserSchemaType>({
    resolver: zodResolver(EditUserSchema),
  });

  const editUser = (
    data: EditUserSchemaType & { avatarFile?: File | null }
  ) => {
    const formData = new FormData();
    formData.append('username', data.username);
    formData.append('email', data.email);
    if (data.avatarFile) {
      formData.append('avatar', data.avatarFile);
    }
    return api
      .put('/api/auth/me', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(res => res.data);
  };

  const mutation = useMutation({
    mutationFn: editUser,
    onSuccess: async updatedUser => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      dispatch(
        setUser({
          id: updatedUser.id,
          email: updatedUser.email,
          username: updatedUser.username,
          avatarUrl: updatedUser.avatarUrl,
        })
      );
      setIsSnackbarOpened(true);
      setSnackbarMessage('Profile updated successfully');
      setSnackbarSeverity('success');
    },
    onError: () => {
      setIsSnackbarOpened(true);
      setSnackbarMessage('Failed to update profile');
      setSnackbarSeverity('error');
    },
  });

  const onSubmit = (data: EditUserSchemaType) => {
    const payload = {
      ...data,
      avatarFile,
      ...(data.password?.length
        ? {}
        : { password: undefined, confirmPassword: undefined }),
    };
    mutation.mutate(payload);
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setIsSnackbarOpened(true);
      setSnackbarMessage('Unsupported file type. Please upload a valid image.');
      setSnackbarSeverity('error');
    }
    setAvatarFile(file);
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
  };

  useEffect(() => {
    if (userData) {
      reset({
        username: userData.username || '',
        email: userData.email || '',
      });
      if (userData.avatarUrl) {
        const fullUrl = userData.avatarUrl.startsWith('http')
          ? userData.avatarUrl
          : `${import.meta.env.VITE_API_URL}${userData.avatarUrl}`;
        setAvatarPreview(fullUrl);
      }
    }
  }, [userData, reset]);

  if (userDataIsLoading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box
        component={'form'}
        onSubmit={handleSubmit(onSubmit)}
        sx={{ width: '100%', mx: 'auto' }}
      >
        <Stack
          direction={'column'}
          alignItems={'flex-start'}
          justifyContent={'flex-start'}
          sx={{ width: '100%' }}
        >
          <Typography variant="h6">Profile Picture</Typography>
          <Stack
            sx={{ mb: 4 }}
            direction={'row'}
            spacing={2}
            alignItems={'center'}
          >
            <Avatar
              src={avatarPreview || undefined}
              alt="profile picture"
              sx={{ width: 72, height: 72 }}
            />
            <Button
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose Avatar
            </Button>
            <input
              type="file"
              accept="image/png, image/jpeg, image/jpg, image/gif, image/webp"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              hidden
            />
          </Stack>
          <TextField
            label="Username"
            fullWidth
            margin="normal"
            {...register('username')}
            error={!!errors.username}
            helperText={errors.username?.message}
          />
          <TextField
            label="Email"
            fullWidth
            margin="normal"
            type="email"
            {...register('email')}
            error={!!errors.username}
            helperText={errors.email?.message}
          />
          <TextField
            label="New Password"
            fullWidth
            margin="normal"
            type="password"
            {...register('password')}
            error={!!errors.password}
            helperText={errors.password?.message}
          />
          <TextField
            label="Confirm New Password"
            fullWidth
            margin="normal"
            type="password"
            {...register('confirmPassword')}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword?.message}
          />

          <Stack
            direction={'row'}
            alignItems={'center'}
            justifyContent={'flex-start'}
            gap={2}
          >
            <Button
              variant="contained"
              type="submit"
              sx={{ mt: 2, pt: 1.25, color: 'white' }}
              startIcon={
                mutation.isPending || isSubmitting ? (
                  <CircularProgress size={20} />
                ) : null
              }
            >
              Update User
            </Button>
            <Button
              variant="text"
              type="button"
              onClick={() => {
                navigate('/chat');
              }}
              sx={{ mt: 2, pt: 1.25, color: `${theme.palette.success.dark}` }}
              startIcon={
                mutation.isPending || isSubmitting ? (
                  <CircularProgress color="primary" size={20} />
                ) : null
              }
            >
              Cancel
            </Button>
          </Stack>
        </Stack>
      </Box>
      <Snackbar
        open={isSnackbarOpened}
        autoHideDuration={4000}
        onClose={() => setIsSnackbarOpened(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbarSeverity}
          onClose={() => setIsSnackbarOpened(false)}
          variant="filled"
          sx={{ width: '100%', color: 'white' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default UserProfileForm;
