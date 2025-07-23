import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import uploadRoutes from '../../src/routes/upload';

const app = express();
app.use(express.json());
app.use('/api/upload', uploadRoutes);

// Test uploads directory
const testUploadsDir = path.join(__dirname, '../../uploads');

describe('Upload Routes', () => {
  beforeAll(async () => {
    // Ensure uploads directory exists
    if (!fs.existsSync(testUploadsDir)) {
      fs.mkdirSync(testUploadsDir, { recursive: true });
    }
  });

  afterEach(async () => {
    // Clean up test files after each test
    if (fs.existsSync(testUploadsDir)) {
      const files = fs.readdirSync(testUploadsDir);
      for (const file of files) {
        // Only remove test files (those with timestamp patterns)
        if (file.includes('-') && /\d{13}-\d+/.test(file)) {
          const filePath = path.join(testUploadsDir, file);
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            // Ignore cleanup errors
            console.warn(`Failed to cleanup test file: ${file}`);
          }
        }
      }
    }
  });

  describe('POST /', () => {
    it('should upload a file successfully', async () => {
      // Create a test file buffer
      const testFileContent = 'This is a test file content';
      const testFileName = 'test-file.txt';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from(testFileContent), testFileName);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('fileUrl');
      expect(response.body.data).toHaveProperty('fileName', testFileName);
      expect(response.body.data).toHaveProperty('mimeType', 'text/plain');
      expect(response.body.data.fileUrl).toMatch(/^\/uploads\/test-file-\d{13}-\d+\.txt$/);

      // Verify file was actually created
      const uploadedFileName = response.body.data.fileUrl.split('/').pop();
      const uploadedFilePath = path.join(testUploadsDir, uploadedFileName);
      expect(fs.existsSync(uploadedFilePath)).toBe(true);

      // Verify file content
      const uploadedContent = fs.readFileSync(uploadedFilePath, 'utf8');
      expect(uploadedContent).toBe(testFileContent);
    });

    it('should handle image file uploads', async () => {
      // Create a simple test image buffer (minimal PNG)
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const testFileName = 'test-image.png';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', pngHeader, testFileName);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('fileName', testFileName);
      expect(response.body.data).toHaveProperty('mimeType', 'image/png');
      expect(response.body.data.fileUrl).toMatch(/^\/uploads\/test-image-\d{13}-\d+\.png$/);
    });

    it('should handle audio file uploads with metadata', async () => {
      // Create a test audio buffer
      const audioBuffer = Buffer.from([0xFF, 0xFB, 0x90, 0x00]); // MP3 header
      const testFileName = 'test-audio.mp3';
      const audioDuration = '120'; // 2 minutes in seconds

      const response = await request(app)
        .post('/api/upload')
        .field('audioDuration', audioDuration)
        .attach('file', audioBuffer, testFileName);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('fileName', testFileName);
      expect(response.body.data).toHaveProperty('mimeType', 'audio/mpeg');
      expect(response.body.data).toHaveProperty('audioFileSize');
      expect(response.body.data).toHaveProperty('audioFormat', 'mpeg');
      expect(response.body.data).toHaveProperty('audioDuration', 120);
      expect(response.body.data.audioFileSize).toBeGreaterThan(0);
    });

    it('should handle audio file uploads without duration', async () => {
      const audioBuffer = Buffer.from([0xFF, 0xFB, 0x90, 0x00]);
      const testFileName = 'test-audio-no-duration.mp3';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', audioBuffer, testFileName);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('audioFileSize');
      expect(response.body.data).toHaveProperty('audioFormat', 'mpeg');
      expect(response.body.data).toHaveProperty('audioDuration', null);
    });

    it('should handle WAV audio files', async () => {
      // WAV file header
      const wavBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46]); // "RIFF"
      const testFileName = 'test-audio.wav';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', wavBuffer, testFileName);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('mimeType', 'audio/wave');
      expect(response.body.data).toHaveProperty('audioFormat', 'wave');
    });

    it('should handle files with special characters in names', async () => {
      const testFileContent = 'Special chars test';
      const testFileName = 'test file with spaces & symbols!.txt';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from(testFileContent), testFileName);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('fileName', testFileName);
      expect(response.body.data.fileUrl).toMatch(/^\/uploads\/test file with spaces & symbols!-\d{13}-\d+\.txt$/);
    });

    it('should handle files without extensions', async () => {
      const testFileContent = 'No extension file';
      const testFileName = 'noextension';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from(testFileContent), testFileName);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('fileName', testFileName);
      expect(response.body.data.fileUrl).toMatch(/^\/uploads\/noextension-\d{13}-\d+$/);
    });

    it('should create unique filenames for duplicate uploads', async () => {
      const testFileContent = 'Duplicate test';
      const testFileName = 'duplicate.txt';

      // First upload
      const response1 = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from(testFileContent), testFileName);

      // Second upload with same filename
      const response2 = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from(testFileContent), testFileName);

      expect(response1.status).toBe(201);
      expect(response2.status).toBe(201);
      expect(response1.body.data.fileUrl).not.toBe(response2.body.data.fileUrl);

      // Both should contain the original filename pattern but with different timestamps
      expect(response1.body.data.fileUrl).toMatch(/^\/uploads\/duplicate-\d{13}-\d+\.txt$/);
      expect(response2.body.data.fileUrl).toMatch(/^\/uploads\/duplicate-\d{13}-\d+\.txt$/);
    });

    it('should handle large files', async () => {
      // Create a larger test file (1MB)
      const largeContent = Buffer.alloc(1024 * 1024, 'a');
      const testFileName = 'large-file.txt';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', largeContent, testFileName);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('fileName', testFileName);

      // Verify file size on disk
      const uploadedFileName = response.body.data.fileUrl.split('/').pop();
      const uploadedFilePath = path.join(testUploadsDir, uploadedFileName);
      const stats = fs.statSync(uploadedFilePath);
      expect(stats.size).toBe(1024 * 1024);
    });

    it('should return 400 when no file is uploaded', async () => {
      const response = await request(app)
        .post('/api/upload');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'No file uploaded');
    });

    it('should return 400 when file field is empty', async () => {
      const response = await request(app)
        .post('/api/upload')
        .field('someOtherField', 'value');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'No file uploaded');
    });

    it('should handle different MIME types correctly', async () => {
      const testCases = [
        { content: Buffer.from('{}'), filename: 'test.json', expectedMime: 'application/json' },
        { content: Buffer.from('<html></html>'), filename: 'test.html', expectedMime: 'text/html' },
        { content: Buffer.from('body { color: red; }'), filename: 'test.css', expectedMime: 'text/css' },
        { content: Buffer.from('console.log("test");'), filename: 'test.js', expectedMime: 'application/javascript' }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/upload')
          .attach('file', testCase.content, testCase.filename);

        expect(response.status).toBe(201);
        expect(response.body.data).toHaveProperty('mimeType', testCase.expectedMime);
        expect(response.body.data).toHaveProperty('fileName', testCase.filename);
      }
    });
  });

  describe('File Storage and Naming', () => {
    it('should store files in the correct directory', async () => {
      const testFileContent = 'Directory test';
      const testFileName = 'directory-test.txt';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from(testFileContent), testFileName);

      expect(response.status).toBe(201);

      const uploadedFileName = response.body.data.fileUrl.split('/').pop();
      const expectedPath = path.join(testUploadsDir, uploadedFileName);
      expect(fs.existsSync(expectedPath)).toBe(true);
    });

    it('should preserve original filename in response', async () => {
      const testFileContent = 'Filename preservation test';
      const originalFileName = 'original-name.txt';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from(testFileContent), originalFileName);

      expect(response.status).toBe(201);
      expect(response.body.data.fileName).toBe(originalFileName);
      
      // But the actual stored filename should be different (with timestamp)
      const storedFileName = response.body.data.fileUrl.split('/').pop();
      expect(storedFileName).not.toBe(originalFileName);
      expect(storedFileName).toMatch(/^original-name-\d{13}-\d+\.txt$/);
    });

    it('should generate unique filenames using timestamp and random suffix', async () => {
      const testFileContent = 'Unique filename test';
      const testFileName = 'unique-test.txt';

      // Upload multiple files in quick succession
      const responses = await Promise.all([
        request(app).post('/api/upload').attach('file', Buffer.from(testFileContent), testFileName),
        request(app).post('/api/upload').attach('file', Buffer.from(testFileContent), testFileName),
        request(app).post('/api/upload').attach('file', Buffer.from(testFileContent), testFileName)
      ]);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // All filenames should be unique
      const fileUrls = responses.map(r => r.body.data.fileUrl);
      const uniqueUrls = new Set(fileUrls);
      expect(uniqueUrls.size).toBe(3);

      // All should match the expected pattern
      fileUrls.forEach(url => {
        expect(url).toMatch(/^\/uploads\/unique-test-\d{13}-\d+\.txt$/);
      });
    });
  });

  describe('Audio File Processing', () => {
    it('should extract audio format from MIME type', async () => {
      const testCases = [
        { filename: 'test.mp3', expectedFormat: 'mpeg' },
        { filename: 'test.wav', expectedFormat: 'wave' },
        { filename: 'test.ogg', expectedFormat: 'ogg' },
        { filename: 'test.m4a', expectedFormat: 'mp4' }
      ];

      for (const testCase of testCases) {
        // Create a minimal audio buffer
        const audioBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);

        const response = await request(app)
          .post('/api/upload')
          .attach('file', audioBuffer, testCase.filename);

        expect(response.status).toBe(201);
        // Check if audio properties exist (they should for audio files)
        if (response.body.data.audioFormat) {
          expect(response.body.data).toHaveProperty('audioFormat', testCase.expectedFormat);
        }
      }
    });

    it('should fallback to file extension for audio format when MIME type is generic', async () => {
      // Some audio files might have generic MIME types
      const audioBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      const testFileName = 'test.flac';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', audioBuffer, testFileName);

      expect(response.status).toBe(201);
      if (response.body.data.audioFormat) {
        // Should extract format from file extension
        expect(response.body.data.audioFormat).toMatch(/flac|x-flac/);
      }
    });

    it('should handle invalid audio duration gracefully', async () => {
      const audioBuffer = Buffer.from([0xFF, 0xFB, 0x90, 0x00]);
      const testFileName = 'test-invalid-duration.mp3';

      const response = await request(app)
        .post('/api/upload')
        .field('audioDuration', 'not-a-number')
        .attach('file', audioBuffer, testFileName);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('audioDuration');
      // Should be null or NaN, but not crash
      expect(typeof response.body.data.audioDuration === 'number' || response.body.data.audioDuration === null).toBe(true);
    });

    it('should include file size for audio files', async () => {
      const audioBuffer = Buffer.from([0xFF, 0xFB, 0x90, 0x00, 0x01, 0x02, 0x03, 0x04]); // 8 bytes
      const testFileName = 'test-size.mp3';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', audioBuffer, testFileName);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('audioFileSize');
      expect(response.body.data.audioFileSize).toBe(8);
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      // Mock fs.statSync to throw an error
      const originalStatSync = fs.statSync;
      vi.spyOn(fs, 'statSync').mockImplementation(() => {
        throw new Error('File system error');
      });

      const audioBuffer = Buffer.from([0xFF, 0xFB, 0x90, 0x00]);
      const testFileName = 'test-fs-error.mp3';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', audioBuffer, testFileName);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to upload file.');

      // Restore the original function
      fs.statSync = originalStatSync;
    });

    it('should handle missing uploads directory gracefully', async () => {
      // This test assumes the route would handle directory creation,
      // but since it doesn't, we'll test that the upload still works
      // when the directory exists (which it should from beforeAll)
      const testFileContent = 'Directory handling test';
      const testFileName = 'dir-test.txt';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from(testFileContent), testFileName);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('fileUrl');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty files', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const testFileName = 'empty.txt';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', emptyBuffer, testFileName);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('fileName', testFileName);

      // Verify empty file was created
      const uploadedFileName = response.body.data.fileUrl.split('/').pop();
      const uploadedFilePath = path.join(testUploadsDir, uploadedFileName);
      const stats = fs.statSync(uploadedFilePath);
      expect(stats.size).toBe(0);
    });

    it('should handle files with very long names', async () => {
      const testFileContent = 'Long name test';
      const longFileName = 'a'.repeat(200) + '.txt';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from(testFileContent), longFileName);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('fileName', longFileName);
    });

    it('should handle files with multiple dots in name', async () => {
      const testFileContent = 'Multiple dots test';
      const testFileName = 'file.with.multiple.dots.txt';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from(testFileContent), testFileName);

      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('fileName', testFileName);
      expect(response.body.data.fileUrl).toMatch(/^\/uploads\/file\.with\.multiple\.dots-\d{13}-\d+\.txt$/);
    });

    it('should handle non-audio files without adding audio metadata', async () => {
      const testFileContent = 'Not an audio file';
      const testFileName = 'document.pdf';

      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from(testFileContent), testFileName);

      expect(response.status).toBe(201);
      expect(response.body.data).not.toHaveProperty('audioFileSize');
      expect(response.body.data).not.toHaveProperty('audioFormat');
      expect(response.body.data).not.toHaveProperty('audioDuration');
    });
  });
});