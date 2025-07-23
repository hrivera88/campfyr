import AnimatedCloud from '@/components/graphics/AnimatedCloud';
import { Box, Paper, Stack, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

type AuthPageLayoutProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  icon?: string;
  showLogo?: boolean;
  maxWidth?: number;
  iconTransformY?: string | number;
};

const AuthPageLayout = ({
  children,
  title,
  subtitle,
  icon = '/chat-people.svg',
  showLogo = true,
  maxWidth = 480,
  iconTransformY = '20%',
}: AuthPageLayoutProps) => {
  const theme = useTheme();
  const MotionPaper = motion(Paper);
  const cloudDelays = useMemo(
    () => Array.from({ length: 6 }, () => Math.random() * 1 + 0.2),
    []
  );

  // Helper function to format the transform value
  const getIconTransform = () => {
    if (typeof iconTransformY === 'number') {
      return `translateY(${iconTransformY}%)`;
    }
    if (typeof iconTransformY === 'string') {
      // If it already includes units or transform function, use as-is
      if (
        iconTransformY.includes('translateY') ||
        iconTransformY.includes('px') ||
        iconTransformY.includes('%')
      ) {
        return iconTransformY.includes('translateY')
          ? iconTransformY
          : `translateY(${iconTransformY})`;
      }
      // Otherwise assume it's a percentage
      return `translateY(${iconTransformY}%)`;
    }
    return `translateY(${iconTransformY})`;
  };

  return (
    <>
      {/* Background Graphics */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 450,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <Box
          component={'img'}
          src="/strat-one.svg"
          sx={{
            width: 320,
            height: 'auto',
            position: 'absolute',
            opacity: 0.56,
          }}
          style={{ top: 40, left: 120 }}
        />
        <Box
          component={'img'}
          src="/strat-two.svg"
          sx={{ width: 520, height: 'auto', position: 'absolute' }}
          style={{ top: 40, right: 120 }}
        />
      </Box>

      {/* Animated Clouds */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 450,
          zIndex: 1,
          background:
            'linear-gradient(to bottom,rgba(255, 255, 255, 0) 0%,rgba(225, 245, 254, .8) 80%, transparent 100%)',
          pointerEvents: 'none',
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

      {/* Main Content Container */}
      <Box
        sx={{
          display: 'flex',
          position: 'relative',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          width: '100%',
          px: 2,
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '60vh',
            backgroundImage: `url(/building-scape.svg)`,
            backgroundRepeat: 'repeat-x',
            backgroundPosition: 'bottom left',
            backgroundSize: 'auto 100%',
            transform: 'translateY(30%)',
            pointerEvents: 'none',
            zIndex: 0,
          },
          '& > *': {
            position: 'relative',
            zIndex: 1,
          },
          '@media (max-width: 760px)': {
            backgroundSize: 'contain',
            height: '30vh',
          },
        }}
      >
        <MotionPaper
          elevation={3}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          sx={{
            p: 4,
            width: '100%',
            maxWidth: maxWidth,
            borderWidth: 2,
            borderStyle: 'solid',
            borderColor: theme.palette.brandPurple.main,
          }}
        >
          <Stack
            direction={'column'}
            justifyContent={'center'}
            alignItems={'center'}
            sx={{ width: '100%' }}
          >
            {/* Icon */}
            <Box
              sx={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                overflow: 'hidden',
                mb: 2,
                border: `4px solid ${theme.palette.brandPurple.main}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box
                component="img"
                src={icon}
                alt="auth icon"
                sx={{
                  width: 650,
                  height: 'auto',
                  mb: 2,
                  transform: getIconTransform(),
                }}
              />
            </Box>

            {/* Title and Logo */}
            <Stack flexDirection={'row'} alignItems={'center'} gap={0.85}>
              <Typography
                variant="h6"
                align="center"
                color={theme.palette.text.primary}
                gutterBottom
              >
                {title}
              </Typography>
              {showLogo && (
                <Box
                  component="img"
                  src="/campfyr-logo.svg"
                  alt="Campfyr logo"
                  sx={{
                    width: 'auto',
                    height: 24,
                    mb: 1.23,
                  }}
                />
              )}
            </Stack>

            {/* Subtitle */}
            {subtitle && (
              <Typography
                variant="body2"
                align="center"
                color={theme.palette.text.secondary}
                sx={{ mb: 2, maxWidth: 400 }}
              >
                {subtitle}
              </Typography>
            )}

            {/* Form Content */}
            {children}
          </Stack>
        </MotionPaper>
      </Box>
    </>
  );
};

export default AuthPageLayout;
