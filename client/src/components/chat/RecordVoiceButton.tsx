import {
  Delete,
  Mic,
  MicOff,
  Pause,
  PlayArrow,
  Send,
  Stop,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';

interface RecordVoiceButtonProps {
  onVoiceRecorded: (audioBlob: Blob, duration: number) => void;
  onTyping: () => void;
  disabled?: boolean;
}

const RecordVoiceButton = ({
  onVoiceRecorded,
  onTyping,
  disabled,
}: RecordVoiceButtonProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const theme = useTheme();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const MAX_RECORDING_TIME = 300; // 5 minutes in seconds

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startTypingIndicator = () => {
    // Emit typing immediately when recording starts
    onTyping();

    // Set up interval to emit typing every 1.5 seconds during recording
    typingIntervalRef.current = setInterval(() => {
      onTyping();
    }, 1500);
  };

  const stopTypingIndicator = () => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      return stream;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setPermissionDenied(true);
      return null;
    }
  };

  const startRecording = async () => {
    const stream = await requestMicrophonePermission();
    if (!stream) return;

    try {
      // Use webm with opus codec for best compression and quality
      const options = { mimeType: 'audio/webm;codecs=opus' };
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: 'audio/webm;codecs=opus',
        });
        setAudioBlob(blob);

        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setDialogOpen(true);
      setRecordingTime(0);

      // Start typing indicator
      startTypingIndicator();

      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_RECORDING_TIME) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const pauseRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Stop typing indicator when paused
      stopTypingIndicator();
    }
  };

  const resumeRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'paused'
    ) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);

      // Restart typing indicator when resumed
      startTypingIndicator();

      // Resume timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_RECORDING_TIME) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    setIsPaused(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Stop typing indicator when recording stops
    stopTypingIndicator();

    // Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const playAudio = () => {
    if (audioBlob && !isPlaying) {
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current = new Audio(audioUrl);

      audioRef.current.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      audioRef.current.play();
      setIsPlaying(true);
    } else if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const sendVoiceMessage = () => {
    if (audioBlob) {
      onVoiceRecorded(audioBlob, recordingTime);
      handleCloseDialog();
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setAudioBlob(null);
    setRecordingTime(0);
    setIsPlaying(false);

    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (isRecording) {
      stopRecording();
    }

    // Ensure typing indicator is stopped when dialog closes
    stopTypingIndicator();
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setIsPlaying(false);
    setDialogOpen(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  if (permissionDenied) {
    return (
      <Tooltip title="Microphone permission denied">
        <span>
          <IconButton disabled size="small">
            <MicOff />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  return (
    <>
      <Tooltip title="Record voice message">
        <Button
          onClick={startRecording}
          disabled={disabled || isRecording}
          size="small"
          sx={{ minWidth: 0, p: 1, color: `${theme.palette.success.dark}` }}
        >
          <Mic />
        </Button>
      </Tooltip>

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={isRecording}
      >
        <DialogTitle sx={{ pb: 1 }}>
          {isRecording ? 'Recording Voice Message' : 'Voice Message Preview'}
        </DialogTitle>

        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            {isRecording ? (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <IconButton
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    size="large"
                    sx={{ color: `${theme.palette.success.dark}` }}
                  >
                    {isPaused ? <PlayArrow /> : <Pause />}
                  </IconButton>
                  <IconButton
                    onClick={stopRecording}
                    size="large"
                    color="error"
                  >
                    <Stop />
                  </IconButton>
                </Box>

                <Typography variant="h6" sx={{ mb: 1 }}>
                  {formatTime(recordingTime)}
                </Typography>

                <LinearProgress
                  variant="determinate"
                  value={(recordingTime / MAX_RECORDING_TIME) * 100}
                  sx={{ mb: 1 }}
                />

                <Typography variant="caption" color="text.secondary">
                  {isPaused ? 'Recording paused' : 'Recording...'}
                </Typography>
              </>
            ) : audioBlob ? (
              <>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 2,
                    mb: 2,
                  }}
                >
                  <IconButton
                    onClick={playAudio}
                    size="large"
                    sx={{ color: `${theme.palette.success.dark}` }}
                  >
                    {isPlaying ? <Pause /> : <PlayArrow />}
                  </IconButton>
                  <IconButton
                    onClick={deleteRecording}
                    size="large"
                    color="error"
                  >
                    <Delete />
                  </IconButton>
                </Box>

                <Typography variant="body1" sx={{ mb: 1 }}>
                  Duration: {formatTime(recordingTime)}
                </Typography>

                <Typography variant="caption" color="text.secondary">
                  {isPlaying ? 'Playing...' : 'Ready to send'}
                </Typography>
              </>
            ) : null}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          {audioBlob && !isRecording && (
            <Button
              onClick={sendVoiceMessage}
              variant="contained"
              startIcon={<Send />}
              sx={{ color: 'white' }}
            >
              Send
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RecordVoiceButton;
