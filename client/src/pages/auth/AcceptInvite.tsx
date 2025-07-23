import { useParams, useNavigate } from "react-router-dom";
import { Box, Button, TextField, Typography, Alert, Stack } from "@mui/material";
import { useMemo, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import axios from "axios";
import AnimatedCloud from "@/components/graphics/AnimatedCloud";
import { useTheme } from "@mui/material";

const MotionBox = motion(Box);

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const theme = useTheme();
  const cloudControls = useAnimation();
  const cloudDelays = useMemo(
    () => Array.from({ length: 6 }, () => Math.random() * 1 + 0.2),
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axios.post("/api/auth/accept-invite", {
        token,
        username,
        password,
      });
      navigate("/login");
    } catch (err: any) {
      setError(err.response?.data.error || "Failed to accept invite");
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 450,
          zIndex: 1,
          pointerEvents: "none",
        }}
      >
        <Box
          component={"img"}
          src="/stream-one.svg"
          sx={{
            width: 320,
            height: "auto",
            position: "absolute",
            opacity: 0.56,
          }}
          style={{ top: 40, left: 120 }}
        />
        <Box
          component={"img"}
          src="/strat-two.svg"
          sx={{ width: 520, height: "auto", position: "absolute" }}
          style={{ top: 40, right: 120 }}
        />
      </Box>
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 450,
          zIndex: 1,
          background:
            "linear-gradient(to bottom,rgba(255, 255, 255, 0) 0%,rgba(225, 245, 254, .8) 80%, transparent 100%)",
          pointerEvents: "none",
        }}
      >
        <AnimatedCloud
          src="/cloud-1.svg"
          delay={cloudDelays[0]}
          style={{ top: 40, left: 120 }}
        />
        <AnimatedCloud
          src="/cloud-2.svg"
          delay={cloudDelays[1]}
          style={{ top: 90, left: 320 }}
        />
        <AnimatedCloud
          src="/cloud-2.svg"
          delay={cloudDelays[2]}
          style={{ top: 20, left: 720 }}
        />
        <AnimatedCloud
          src="/cloud-1.svg"
          delay={cloudDelays[3]}
          style={{ top: 60, right: 720 }}
        />
        <AnimatedCloud
          src="/cloud-2.svg"
          delay={cloudDelays[4]}
          style={{ top: 60, right: 120 }}
        />
        <AnimatedCloud
          src="/cloud-1.svg"
          delay={cloudDelays[5]}
          style={{ top: 120, right: 320 }}
        />
      </Box>
      <Box
        sx={{
          display: "flex",
          position: "relative",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          width: "100%",
          px: 2,
          overflow: "hidden",
          backgroundColor: "#ffffff",
          "&::after": {
            content: '""',
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "60vh",
            backgroundImage: `url(/building-scape.svg)`,
            backgroundRepeat: "repeat-x",
            backgroundPosition: "bottom left",
            backgroundSize: "auto 100%",
            transform: "translateY(30%)",
            pointerEvents: "none",
            zIndex: 0,
          },

          "& > *": {
            position: "relative",
            zIndex: 1,
          },

          "@media (max-width: 760px)": {
            backgroundSize: "contain",
            height: "30vh",
          },
        }}
      >
        <MotionBox
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
          onAnimationComplete={() => {
            cloudControls.start("visible");
          }}
          sx={{
            p: 4,
            width: "100%",
            maxWidth: 480,
            borderWidth: 2,
            borderStyle: "solid",
              borderColor: theme.palette.brandPurple.main,
            backgroundColor: "white"
          }}
        >
          <Stack
            flexDirection={"column"}
            justifyContent={"center"}
            alignItems={"center"}
            sx={{ width: "100%" }}
          >
            <Box
              sx={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                overflow: "hidden",
                mb: 2,
                border: `4px solid ${theme.palette.brandPurple.main}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Box
                component="img"
                src="/chat-people.svg"
                alt="locked"
                sx={{
                  width: 650,
                  height: "auto",
                  mb: 2,
                  transform: "translateY(20%)",
                }}
              />
            </Box>
            <Stack flexDirection={"row"} alignItems={"center"} gap={0.85}>
              <Typography
                variant="h6"
                align="center"
                color={theme.palette.text.primary}
                gutterBottom
              >
                Join in with
              </Typography>
              <Box
                component="img"
                src="/campfyr-logo.svg"
                alt="locked"
                sx={{
                  width: "auto",
                  height: 24,
                  mb: 1.23,
                }}
              />
            </Stack>
            <Box component={"form"} onSubmit={handleSubmit} noValidate>
              {error && (
                <Alert severity="error" sx={{ mt: 2, mb: 1 }}>
                  {error}
                </Alert>
              )}
              <TextField
                fullWidth
                label="username"
                variant="outlined"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                margin="normal"
              />
              <TextField
                fullWidth
                label="password"
                variant="outlined"
                value={password}
                type="password"
                onChange={(e) => setPassword(e.target.value)}
                required
                margin="normal"
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                disabled={loading}
                sx={{ mt: 2, color: "white" }}
              >
                {loading ? "Submitting..." : "Accept Invite"}
              </Button>
            </Box>
          </Stack>
        </MotionBox>
      </Box>
    </>
  );
}
