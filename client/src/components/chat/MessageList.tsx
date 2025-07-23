import type { TypingUser } from '@/hooks/useChatSocket';
import { Avatar, Box, Typography } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type {
  UnifiedMessageSchemaType,
  UserMessageSchemaType,
} from '../../schemas/chat';
import { capitalizeWords } from '../../utils/capitalizeWords';
import { formatTimeStamp } from '../../utils/formatTimeStamp';
import MediaGalleryModal from '../media/MediaGalleryModal';
import AudioPlayer from './AudioPlayer';
import TypingIndicator from './TypingIndicator';

type MessageListProps = {
  messages: UserMessageSchemaType[];
  currentUsername?: string;
  theme: any;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  typingUsers: TypingUser[];
  topRef: React.RefObject<HTMLDivElement | null>;
};

/**
 * Animation Stuff - PIZAZZ
 */
const ownMessageVariants = {
  initial: { opacity: 0, x: 50, y: 10 },
  animate: { opacity: 1, x: 0, y: 0 },
  exit: { opacity: 0, y: -20 },
};
const otherMessageVariants = {
  initial: { opacity: 0, x: -50, y: 10 },
  animate: { opacity: 1, x: 0, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const MessageList = ({
  messages,
  currentUsername,
  theme,
  messagesEndRef,
  typingUsers,
  topRef,
}: MessageListProps) => {
  const [galleryOpen, setGalleryOpen] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const mediaMessages = messages.filter(
    msg =>
      ('fileUrl' in msg && msg.fileUrl && msg.mimeType?.startsWith('image/')) ||
      msg.mimeType?.startsWith('video/')
  );
  const mediaItems = mediaMessages.map(msg => ({
    url: msg.fileUrl!,
    type: msg.mimeType?.startsWith('image/')
      ? ('image' as const)
      : ('video' as const),
    caption: msg.fileName,
  }));
  const handleMediaLoad = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messagesEndRef]);

  return (
    <motion.div
      data-testid="hydrated"
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        maxHeight: '100%',
        minHeight: 0,
        overflowY: 'auto',
        flexDirection: 'column',
      }}
      layout
    >
      <div ref={topRef}></div>
      <AnimatePresence initial={true}>
        {messages.map((msg: UnifiedMessageSchemaType, idx: number) => {
          const sender = msg.sender;
          const isOwnMessage = sender.username === currentUsername;
          const avatarUrl: string = sender.avatarUrl ?? '/default-avatar.png';

          return (
            <motion.div
              key={msg.timestamp + sender.username}
              layout
              variants={
                isOwnMessage ? ownMessageVariants : otherMessageVariants
              }
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{
                delay: idx * 0.01,
                duration: 0.25,
                ease: [0.25, 0.31, 0.31, 0.25],
              }}
              style={{
                alignSelf: isOwnMessage ? 'flex-end' : 'flex-start',
                marginBottom: '0.5rem',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: isOwnMessage ? 'row-reverse' : 'row',
                  alignItems: 'flex-end',
                  gap: 1,
                }}
              >
                <Avatar
                  src={avatarUrl}
                  alt={'User avatar'}
                  sx={{ width: 32, height: 32 }}
                />
                <Box
                  key={idx}
                  sx={{
                    borderRadius: 2,
                    bgcolor: isOwnMessage
                      ? `${theme.palette.primary.contrastText}`
                      : `${theme.palette.primary.light}`,
                    py: 1,
                    px: 2,
                    width: 'fit-content',
                    minWidth: '200px',
                  }}
                >
                  <Typography sx={{ fontSize: '.85rem', fontWeight: 700 }}>
                    {capitalizeWords(sender.username)}{' '}
                    <Typography
                      variant="caption"
                      component="span"
                      sx={{
                        fontSize: '.65rem',
                        color: `${theme.palette.secondary.main}`,
                      }}
                    >
                      [{formatTimeStamp(msg.timestamp)}]
                    </Typography>
                  </Typography>
                  {msg.fileUrl && msg.mimeType?.startsWith('image/') && (
                    <Box
                      component="img"
                      src={msg.fileUrl}
                      alt={msg.fileName ?? 'image'}
                      onClick={() => {
                        const index = mediaMessages.findIndex(
                          m => m.fileUrl === msg.fileUrl
                        );
                        setActiveIndex(index);
                        setGalleryOpen(true);
                      }}
                      onLoad={handleMediaLoad}
                      sx={{
                        width: 'auto',
                        maxWidth: 80,
                        height: 'auto',
                        maxHeight: 80,
                        borderRadius: 1,
                        mt: 1,
                        cursor: 'pointer',
                      }}
                    />
                  )}
                  {msg.fileUrl && msg.mimeType?.startsWith('video/') && (
                    <Box
                      component="video"
                      role="application"
                      src={msg.fileUrl}
                      controls
                      onCanPlay={handleMediaLoad}
                      onClick={() => {
                        const index = mediaMessages.findIndex(
                          m => m.fileUrl === msg.fileUrl
                        );
                        setActiveIndex(index);
                        setGalleryOpen(true);
                      }}
                      sx={{
                        width: 200,
                        borderRadius: 1,
                        mt: 1,
                        cursor: 'pointer',
                      }}
                    />
                  )}
                  {msg.fileUrl && msg.mimeType?.startsWith('audio/') && (
                    <AudioPlayer
                      src={msg.fileUrl}
                      fileName={msg.fileName || undefined}
                      audioDuration={
                        ('audioDuration' in msg ? msg.audioDuration : null) ||
                        undefined
                      }
                      isVoiceMessage={
                        msg.fileName?.includes('voice-message') || false
                      }
                      compact={msg.fileName?.includes('voice-message') || false}
                      theme={theme}
                    />
                  )}
                  {msg.content && (
                    <Typography sx={{ fontSize: '.96rem' }}>
                      {msg.content}
                    </Typography>
                  )}
                </Box>
              </Box>
            </motion.div>
          );
        })}
        <TypingIndicator typingUsers={typingUsers} theme={theme} />
        {galleryOpen && (
          <MediaGalleryModal
            open={galleryOpen}
            items={mediaItems}
            initialIndex={activeIndex}
            onClose={() => setGalleryOpen(false)}
          />
        )}
      </AnimatePresence>
      <div style={{ marginTop: 4 }} ref={messagesEndRef}></div>
    </motion.div>
  );
};

export default MessageList;
