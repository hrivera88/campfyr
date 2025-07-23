import React, { useEffect, useState, useRef } from "react";
import { Box, IconButton, Typography, Dialog, DialogContent, Button, Stack } from "@mui/material";
import { Close, NavigateBefore, NavigateNext, Download } from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";

export type MediaItem = {
  url: string;
  type: "image" | "video";
  caption?: string | null;
  fileName?: string;
};

type MediaGalleryModalProps = {
  open: boolean;
  items: MediaItem[];
  initialIndex?: number;
  onClose: () => void;
};

const MediaGalleryModal = ({
  open,
  items,
  initialIndex = 0,
  onClose,
}: MediaGalleryModalProps) => {
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const containerRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => { 
    if (open) setCurrentIndex(initialIndex);
  }, [open, initialIndex]);
  
  useEffect(() => { 
    const handleKey = (e: KeyboardEvent) => { 
      if (e.key === "Enter") setCurrentIndex((prev) => Math.max(prev - 1, 0));
      if (e.key === "ArrowRight")
        setCurrentIndex((prev) => Math.min(prev + 1, items.length - 1));
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [items.length, onClose]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => setCurrentIndex((prev) => Math.min(prev + 1, items.length - 1)),
    onSwipedRight: () => setCurrentIndex((prev) => Math.max(prev - 1, 0)),
    trackMouse: true,
  });

  const currentItem = items[currentIndex];

  return (
    <Dialog fullScreen open={open} onClose={onClose} data-testid="media-gallery-modal">
      <DialogContent
        sx={{ position: "relative", bgcolor: "black" }}
        {...swipeHandlers}
        ref={containerRef}
      >
        <IconButton
          onClick={onClose}
          sx={{
            position: "absolute",
            top: 16,
            right: 16,
            color: "white",
            zIndex: 5,
          }}
        >
          <Close fontSize="large" />
        </IconButton>
        <AnimatePresence>
          <motion.div
            key={currentItem.url}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            {currentItem.type === "image" ? (
              <Zoom>
                <Box
                  component="img"
                  src={currentItem.url}
                  sx={{ maxHeight: "80vh", maxWidth: "100%" }}
                  alt="gallery item"
                />
              </Zoom>
            ) : (
              <Box
                component="video"
                controls
                src={currentItem.url}
                sx={{ maxHeight: "80vh", maxWidth: "100%" }}
              />
            )}
            {currentItem.caption && (
              <Typography
                mt={2}
                color="white"
                variant="body2"
                textAlign="center"
              >
                {currentItem.caption}
              </Typography>
            )}
            <Button
              href={currentItem.url}
              download={currentItem.fileName || true}
              startIcon={<Download />}
              sx={{ mt: 2, color: "white", borderColor: "white" }}
              variant="outlined"
            >
              Download
            </Button>
          </motion.div>
        </AnimatePresence>
        <IconButton
          onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
          sx={{
            position: "absolute",
            top: "50%",
            left: 16,
            color: "white",
            zIndex: 5,
          }}
        >
          <NavigateBefore fontSize="large" />
        </IconButton>
        <IconButton
          onClick={() =>
            setCurrentIndex((prev) => Math.min(prev + 1, items.length - 1))
          }
          sx={{
            position: "absolute",
            top: "50%",
            right: 16,
            color: "white",
            zIndex: 5,
          }}
        >
          <NavigateNext fontSize="large" />
        </IconButton>
        {/* Hidden test elements for testing purposes */}
        <Box sx={{ display: 'none' }}>
          <span data-testid="gallery-items-count">{items.length}</span>
          <span data-testid="active-index">{currentIndex}</span>
        </Box>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            position: "absolute",
            bottom: 16,
            left: 0,
            right: 0,
            justifyContent: "center",
            zIndex: 5,
          }}
        >
          {items.map((item, idx) => (
            <Box
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              sx={{
                width: 50,
                height: 50,
                border:
                  currentIndex === idx ? "2px solid white" : "1px solid grey",
                cursor: "pointer",
              }}
            >
              {item.type === "image" ? (
                <Box
                  component="img"
                  src={item.url}
                  sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Box
                  sx={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "grey.900",
                  }}
                >
                  <Box component="span" sx={{ color: "white", fontSize: 10 }}>
                    Video
                  </Box>
                </Box>
              )}
            </Box>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default MediaGalleryModal;
