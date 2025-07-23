import { useEffect, useRef, useState } from 'react';
import { Box, Button } from "@mui/material";
import EmojiPicker from "emoji-picker-react";
import { EmojiEmotions } from "@mui/icons-material";

type EmojiPickerButtonProps = {
    onEmojiClick: (emojiData: { emoji: string }) => void;
};

const EmojiPickerButton = ({ onEmojiClick }: EmojiPickerButtonProps) => {
    const [open, setOpen] = useState(false);
    const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
    const emojiPickerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => { 
        const handleClickOutside = (event: MouseEvent) => {
          if (
            emojiPickerRef.current &&
            !emojiPickerRef.current.contains(event.target as Node) &&
            emojiButtonRef.current &&
            !emojiButtonRef.current.contains(event.target as Node)
          ) {
            setOpen(false);
          }
        };
        if (open) {
          document.addEventListener("mousedown", handleClickOutside);
        } else {
          document.removeEventListener("mousedown", handleClickOutside);
        }
        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [open]);

  return (
    <Box sx={{ position: "relative" }}>
      <Button
        ref={emojiButtonRef}
        onClick={() => setOpen((prev) => !prev)}
        sx={{ minWidth: 0, p: 1 }}
      >
        <EmojiEmotions fontSize="small" />
      </Button>
      {open && (
        <Box
          ref={emojiPickerRef}
          sx={{
            position: "absolute",
            bottom: "40px",
            left: 0,
            zIndex: 10,
          }}
        >
          <EmojiPicker onEmojiClick={onEmojiClick} autoFocusSearch={false} />
        </Box>
      )}
    </Box>
  );
 };
export default EmojiPickerButton;