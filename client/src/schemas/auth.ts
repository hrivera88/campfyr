import { z } from 'zod';

export const RegisterSchema = z.object({
    email: z.string().nonempty('Email is required').email('Invalid Email'),
    organizationName: z.string().nonempty('Organization Name is required'),
    username: z.string().min(3, 'Username must be at least 3 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters')
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
    email: z.string().nonempty('Email is required').email('Invalid Email'),
    password: z.string().min(6, 'Password must be at least 6 characters')
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({
    email: z.string().nonempty('Email is required').email('Invalid Email')
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
    token: z.string().nonempty('Reset token is required'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password')
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"]
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;