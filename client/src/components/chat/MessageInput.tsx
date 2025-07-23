import {
  Box,
  TextField,
  Button,
  Stack,
  IconButton,
  Typography,
} from "@mui/material";
import React, { useState } from "react";
import EmojiPickerButton from "./EmojiPickerButton";
import UploadFileButton from "./UploadFileButton";
import RecordVoiceButton from "./RecordVoiceButton";
import { PlayCircle, Close, VolumeUp } from "@mui/icons-material";
import type { MessageInputState } from "./ChatWindow";

type MessageInputProps = {
  input: MessageInputState;
  setInput: React.Dispatch<React.SetStateAction<MessageInputState>>;
  onSend: () => void;
  onTyping: () => void;
  theme: any;
};

const MessageInput = ({
  input,
  setInput,
  onSend,
  onTyping,
  theme,
}: MessageInputProps) => {
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<
    { file: File; previewUrl: string | null }[]
  >([]);
  const [, setFileErrors] = useState<string[]>([]);
  const [voiceMessages, setVoiceMessages] = useState<
    { blob: Blob; duration: number; previewUrl: string }[]
  >([]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput((prev) => ({
      ...prev,
      content: e.target.value,
    }));
    onTyping();
  };

  const handleEmojiClick = (emojiData: any) => {
    setInput((prev) => ({
      ...prev,
      content: prev.content + emojiData.emoji,
    }));
  };

  const handleMultipleFileSelect = (files: FileList) => {
    const validFiles: File[] = [];
    const previews: { file: File; previewUrl: string | null }[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} exceeds 5MB size limit.`);
        return;
      }

      validFiles.push(file);

      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setTimeout(() => {
            setFilePreviews((prev) => [
              ...prev,
              { file, previewUrl: reader.result as string },
            ]);
          }, 0);
        };
        reader.onerror = () => {
          // Handle FileReader errors gracefully by adding file without preview
          setTimeout(() => {
            setFilePreviews((prev) => [
              ...prev,
              { file, previewUrl: null },
            ]);
          }, 0);
        };
        try {
          reader.readAsDataURL(file);
        } catch (error) {
          // Handle synchronous errors from FileReader
          setTimeout(() => {
            setFilePreviews((prev) => [
              ...prev,
              { file, previewUrl: null },
            ]);
          }, 0);
        }
      } else {
        previews.push({ file, previewUrl: null });
      }
    });

    const updated = [...selectedFiles, ...validFiles];
    setSelectedFiles(updated);
    setTimeout(() => {
      setInput((prevInput) => ({ ...prevInput, files: updated }));
    }, 0);
    setFilePreviews((prev) => [...prev, ...previews]);
    setFileErrors(errors);
  };

  const handleRemoveFile = (fileToRemove: File) => {
    setFilePreviews((prev) => {
      const updated = prev.filter((preview) => preview.file !== fileToRemove);
      setInput((prevInput) => ({
        ...prevInput,
        files: prevInput.files.filter((f) => f !== fileToRemove),
      }));
      return updated;
    });
    setSelectedFiles((prev) => prev.filter((f) => f !== fileToRemove));
  };

  const handleVoiceRecorded = (audioBlob: Blob, duration: number) => {
    // Convert blob to File for consistency with existing file handling
    const audioFile = new File([audioBlob], `voice-message-${Date.now()}.webm`, {
      type: 'audio/webm;codecs=opus'
    });
    
    const previewUrl = URL.createObjectURL(audioBlob);
    
    setVoiceMessages((prev) => [...prev, { blob: audioBlob, duration, previewUrl }]);
    setSelectedFiles((prev) => [...prev, audioFile]);
    setInput((prevInput) => ({ 
      ...prevInput, 
      files: [...prevInput.files, audioFile],
      voiceMetadata: {
        ...prevInput.voiceMetadata,
        [audioFile.name]: { duration, blob: audioBlob }
      }
    }));
  };

  const handleRemoveVoiceMessage = (indexToRemove: number) => {
    setVoiceMessages((prev) => {
      const removedMessage = prev[indexToRemove];
      const updated = prev.filter((_, index) => index !== indexToRemove);
      
      // Find the corresponding file name to remove from metadata
      const voiceFileIndex = selectedFiles.length - (prev.length - indexToRemove);
      const fileToRemove = selectedFiles[voiceFileIndex];
      
      setSelectedFiles((prevFiles) => prevFiles.filter((_, index) => index !== voiceFileIndex));
      setInput((prevInput) => {
        const newVoiceMetadata = { ...prevInput.voiceMetadata };
        if (fileToRemove?.name) {
          delete newVoiceMetadata[fileToRemove.name];
        }
        
        return {
          ...prevInput,
          files: prevInput.files.filter((_, index) => index !== voiceFileIndex),
          voiceMetadata: newVoiceMetadata,
        };
      });
      
      // Clean up the preview URL
      if (removedMessage?.previewUrl) {
        URL.revokeObjectURL(removedMessage.previewUrl);
      }
      
      return updated;
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Stack direction={"column"}>
      {filePreviews.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap" }}>
          {filePreviews.map(({ file, previewUrl }, idx) => (
            <Box key={idx} sx={{ position: "relative", width: 100 }}>
              <IconButton
                size="small"
                onClick={() => handleRemoveFile(file)}
                sx={{
                  position: "absolute",
                  top: -10,
                  right: -10,
                  zIndex: 2,
                  backgroundColor: "white",
                  boxShadow: 1,
                }}
              >
                <Close fontSize="small" />
              </IconButton>
              {previewUrl ? (
                <Box
                  component="img"
                  src={previewUrl}
                  alt={file.name}
                  sx={{
                    width: 100,
                    height: 100,
                    objectFit: "cover",
                    borderRadius: 1,
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: 100,
                    height: 100,
                    display: "flex",
                    alignItems: "flex-start",
                    flexDirection: "column",
                    justifyContent: "center",
                    border: "1px dashed grey",
                    borderRadius: 1,
                    fontSize: 12,
                    textAlign: "left",
                    p: 1,
                  }}
                  title={file.name}
                >
                  <PlayCircle
                    fontSize="small"
                    sx={{ mb: 2, alignSelf: "center" }}
                  />
                  <Typography
                    sx={{
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      width: "100%",
                      textOverflow: "ellipsis",
                    }}
                    fontSize={"small"}
                  >
                    {file.name}
                  </Typography>
                </Box>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {voiceMessages.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap" }}>
          {voiceMessages.map(({ duration, previewUrl }, idx) => (
            <Box key={idx} sx={{ position: "relative", width: 200 }}>
              <IconButton
                size="small"
                onClick={() => handleRemoveVoiceMessage(idx)}
                sx={{
                  position: "absolute",
                  top: -10,
                  right: -10,
                  zIndex: 2,
                  backgroundColor: "white",
                  boxShadow: 1,
                }}
              >
                <Close fontSize="small" />
              </IconButton>
              <Box
                sx={{
                  width: 200,
                  height: 60,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: "1px solid grey",
                  borderRadius: 1,
                  px: 2,
                  backgroundColor: theme.palette.background.paper,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <VolumeUp fontSize="small" color="primary" />
                  <Typography variant="body2">
                    Voice {formatDuration(duration)}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => {
                    const audio = new Audio(previewUrl);
                    audio.play();
                  }}
                >
                  <PlayCircle fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Stack>
      )}

      <Stack direction={"row"} alignItems={"center"}>
        <EmojiPickerButton onEmojiClick={handleEmojiClick} />
        <UploadFileButton onFileSelect={handleMultipleFileSelect} />
        <RecordVoiceButton 
          onVoiceRecorded={handleVoiceRecorded} 
          onTyping={onTyping}
        />
      </Stack>
      <Stack direction={"row"} alignItems={"center"} spacing={1}>
        <TextField
          fullWidth
          multiline
          variant="outlined"
          sx={{
            "& .MuiOutlinedInput-root": {
              "&.Mui-focused fieldset": {
                borderColor: `${theme.palette.primary.main}`,
              },
            },
            "& label.Mui-focused": {
              color: `${theme.palette.primary.main}`,
            },
          }}
          placeholder="Type your message..."
          value={input.content}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
              setSelectedFiles([]);
              setVoiceMessages((prev) => {
                prev.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
                return [];
              });
              setInput((prevInput) => ({ 
                ...prevInput, 
                voiceMetadata: {} 
              }));
            }
          }}
          size="small"
        />
        <Button
          variant="contained"
          onClick={() => {
            onSend();
            setSelectedFiles([]);
            setFilePreviews([]);
            setFileErrors([]);
            setVoiceMessages((prev) => {
              prev.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
              return [];
            });
            setInput({ content: "", files: [], voiceMetadata: {} });
          }}
          disabled={!input.content?.trim() && input.files.length === 0 && selectedFiles.length === 0 && voiceMessages.length === 0}
          sx={{
            minWidth: "100px",
            backgroundColor: `${theme.palette.primary.main}`,
            color: "white",
          }}
        >
          Send
        </Button>
      </Stack>
    </Stack>
  );
};

export default MessageInput;
