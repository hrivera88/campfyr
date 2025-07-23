import express from 'express';
import path from 'path';
import multer from "multer";
import fs from 'fs';

const router = express.Router();
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${baseName}-${uniqueSuffix}${ext}`);
    },
});
const upload = multer({ storage });

router.post('/', upload.single('file'), async (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${file.filename}`;
    const filePath = path.join(__dirname, '../../uploads', file.filename);

    try {
        const responseData: any = {
            fileUrl,
            fileName: file.originalname,
            mimeType: file.mimetype
        };

        if (file.mimetype.startsWith('audio/')) {
            const stats = fs.statSync(filePath);
            responseData.audioFileSize = stats.size;

            const audioFormat = file.mimetype.split('/')[1]?.split(';')[0] ||
                path.extname(file.originalname).slice(1).toLowerCase();
            responseData.audioFormat = audioFormat;

            responseData.audioDuration = req.body.audioDuration ? parseInt(req.body.audioDuration) : null;
        }

        res.status(201).json({ success: true, data: responseData });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload file.' });
    }
});

export default router;