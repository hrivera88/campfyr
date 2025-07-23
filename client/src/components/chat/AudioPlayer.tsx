import {
  Download,
  Mic,
  Pause,
  PlayArrow,
  VolumeOff,
  VolumeUp,
} from "@mui/icons-material";
import {
  Box,
  IconButton,
  Slider,
  Tooltip,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";

interface AudioPlayerProps {
  src: string;
  fileName?: string;
  audioDuration?: number;
  isVoiceMessage?: boolean;
  theme: any;
  compact?: boolean;
}

const AudioPlayer = ({ 
  src, 
  fileName, 
  audioDuration, 
  isVoiceMessage = false,
  theme,
  compact = false 
}: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(audioDuration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setIsLoading(false);
      console.error('Error loading audio file');
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [src]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (_: Event, newValue: number | number[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    const seekTime = Array.isArray(newValue) ? newValue[0] : newValue;
    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleVolumeChange = (_: Event, newValue: number | number[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = Array.isArray(newValue) ? newValue[0] : newValue;
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleMuteToggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = fileName || 'audio-file';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compact mode for voice messages in chat
  if (compact && isVoiceMessage) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          borderRadius: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          mt: 1,
          minWidth: 200,
          maxWidth: 250,
        }}
      >
        <audio ref={audioRef} src={src} preload="metadata" />

        <IconButton
          onClick={handlePlayPause}
          disabled={isLoading}
          size="small"
          sx={{
            backgroundColor: theme.palette.primary.main,
            color: 'white',
            width: 28,
            height: 28,
            '&:hover': {
              backgroundColor: theme.palette.primary.dark,
            },
            '&:disabled': {
              backgroundColor: theme.palette.action.disabled,
            },
          }}
        >
          {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
        </IconButton>

        <Box sx={{ flex: 1, mx: 1 }}>
          <Slider
            value={currentTime}
            max={duration}
            onChange={handleSeek}
            disabled={isLoading}
            size="small"
            sx={{
              color: theme.palette.primary.main,
              height: 3,
              '& .MuiSlider-thumb': {
                width: 10,
                height: 10,
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
            {formatTime(currentTime)}
          </Typography>
        </Box>
      </Box>
    );
  }

  // Full audio player for regular audio files
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1.5,
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        mt: 1,
        minWidth: 280,
        maxWidth: 350,
      }}
    >
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* Voice message indicator */}
      {isVoiceMessage && (
        <Mic 
          sx={{ 
            color: theme.palette.primary.main, 
            fontSize: 16 
          }} 
        />
      )}

      {/* Play/Pause Button */}
      <IconButton
        onClick={handlePlayPause}
        disabled={isLoading}
        size="small"
        sx={{
          backgroundColor: theme.palette.primary.main,
          color: 'white',
          '&:hover': {
            backgroundColor: theme.palette.primary.dark,
          },
          '&:disabled': {
            backgroundColor: theme.palette.action.disabled,
          },
        }}
      >
        {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
      </IconButton>

      {/* Progress and Time */}
      <Box sx={{ flex: 1, mx: 1 }}>
        <Slider
          value={currentTime}
          max={duration}
          onChange={handleSeek}
          disabled={isLoading}
          size="small"
          sx={{
            color: theme.palette.primary.main,
            height: 4,
            '& .MuiSlider-thumb': {
              width: 12,
              height: 12,
            },
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0 }}>
          <Typography variant="caption" color="text.secondary">
            {formatTime(currentTime)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatTime(duration)}
          </Typography>
        </Box>
      </Box>

      {/* Volume Control */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <IconButton
          onClick={handleMuteToggle}
          size="small"
        >
          {isMuted ? <VolumeOff fontSize="small" /> : <VolumeUp fontSize="small" />}
        </IconButton>
        <Slider
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          min={0}
          max={1}
          step={0.1}
          size="small"
          sx={{
            width: 60,
            color: theme.palette.primary.main,
          }}
        />
      </Box>

      {/* Download Button */}
      <Tooltip title="Download">
        <IconButton
          onClick={handleDownload}
          size="small"
        >
          <Download fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default AudioPlayer;