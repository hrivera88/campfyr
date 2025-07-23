import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "mailhog",
  port: 1025,
  secure: false,
});

/**
 * Sends an email invitation to join the app.
 * @param recipientEmail - The email address to invite
 * @param token - The unique invite token
 */

export async function sendInvitationalEmail(recipientEmail: string, token: string) {
  const inviteLink = `http://localhost:5173/invite/${token}`;

  await transporter.sendMail({
    from: '"Chat App" <no-reply@chatapp.local>',
    to: recipientEmail,
    subject: "You're Invited to Join Chat App",
    html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Chat App Invitation</title>
          </head>
          <body>
            <p>Hello,</p>
            <p>You have been invited to join Chat App.</p>
            <p>Click the link below to register your account:</p>
            <a href="${inviteLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Join Chat App</a>
            <p>Or copy and paste this link in your browser:</p>
            <p>${inviteLink}</p>
            <p>This invite will expire in 24 hours.</p>
          </body>
          </html>
        `,
  });
}

/**
 * Sends a password reset email with a reset token.
 * @param recipientEmail - The email address to send the reset link to
 * @param resetToken - The unique password reset token
 * @param username - The username for personalization
 */
export async function sendPasswordResetEmail(recipientEmail: string, resetToken: string, username: string) {
  const resetLink = `http://localhost:5173/reset-password/${resetToken}`;

  await transporter.sendMail({
    from: '"Chat App" <no-reply@chatapp.local>',
    to: recipientEmail,
    subject: "Password Reset Request - Chat App",
    html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset - Chat App</title>
          </head>
          <body>
            <p>Hello ${username},</p>
            <p>You requested a password reset for your Chat App account.</p>
            <p>Click the link below to reset your password:</p>
            <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p>Or copy and paste this link in your browser:</p>
            <p>${resetLink}</p>
            <p><strong>This link will expire in 1 hour for security reasons.</strong></p>
            <p>If you didn't request this password reset, please ignore this email.</p>
            <hr>
            <p style="color: #666; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
          </body>
          </html>
        `,
  });
}