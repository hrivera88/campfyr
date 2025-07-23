import type { TypingUser } from "@/hooks/useChatSocket";
import { capitalizeWords } from "@/utils/capitalizeWords";
import { Avatar, Box, Typography } from "@mui/material";
import { motion, AnimatePresence, easeInOut } from "framer-motion";

type TypingIndicatorProps = {
  typingUsers: TypingUser[];
  theme: any;
};

const typingContainerVariants = {
  initial: { opacity: 0, x: -50, y: 10 },
  animate: { opacity: 1, x: 0, y: 0 },
  exit: { opacity: 0, x: -50, y: 0 },
};
const typingDotVariants = {
  animate: (i: number) => ({
    y: [0, -3, 0],
    transition: {
      repeat: Infinity,
      duration: 0.5,
      ease: easeInOut,
      delay: i * 0.2,
    },
  }),
};

const TypingIndicator = ({ typingUsers, theme }: TypingIndicatorProps) => {
  if (typingUsers.length === 0) return null;
  return (
    <AnimatePresence>
      {typingUsers.map((user) => (
        <motion.div
          key={`typing-${user.userId}`}
          variants={typingContainerVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          layout
          transition={{ duration: 0.25, ease: easeInOut }}
          style={{
            alignSelf: "flex-start",
            marginBottom: "0.5rem",
          }}
        >
          <Box sx={{display: "flex", flexDirection: "row", alignItems: "center", gap: 1}}>
            <Avatar
              src={user.avatarUrl || "/default-avatar.png"}
              alt="User avatar"
              sx={{ width: 32, height: 32 }}
            />
            <Box
              sx={{
                borderRadius: 2,
                backgroundColor: `${theme.palette.primary.light}`,
                py: 1,
                px: 2,
                width: "fit-content",
                minWidth: "200px",
                display: "flex",
                flexDirection: "column",
                mb: 2,
              }}
            >
              <Typography sx={{ fontSize: ".85rem", fontWeight: 700 }}>
                {capitalizeWords(user.username || 'Anonymous')}
              </Typography>
              <Box display="flex" gap={0.5} alignItems="center" height={18}>
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    custom={i}
                    variants={typingDotVariants}
                    animate="animate"
                    style={{
                      display: "block",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      backgroundColor: theme.palette.primary.main,
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </motion.div>
      ))}
    </AnimatePresence>
  );
};

export default TypingIndicator;
