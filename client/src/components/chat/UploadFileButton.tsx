import { Button } from "@mui/material";
import { AttachFile } from "@mui/icons-material";
import React, { useRef } from "react";

type UploadFileButtonProps = {
    onFileSelect: (files: FileList) => void;
};

const UploadFileButton = ({ onFileSelect }: UploadFileButtonProps) => { 
    const fileInputRef = useRef<HTMLInputElement | null>(null);
 
    const handleClick = () => { 
        fileInputRef.current?.click();
    }
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
        if (e.target.files && e.target.files.length > 0) {
            onFileSelect(e.target.files);
            e.target.value = "";
        }
    };
    return (
      <>
        <input
          type="file"
          hidden
          ref={fileInputRef}
          onChange={handleChange}
          accept="image/*,video/*,application/pdf" // adjust as needed
          data-testid="upload-file-button"
          aria-label="Upload files (images, videos, or PDFs)"
          multiple
        />
        <Button sx={{ minWidth: 0, p: 1 }} onClick={handleClick}>
          <AttachFile fontSize="small" />
        </Button>
      </>
    );
}

export default UploadFileButton;