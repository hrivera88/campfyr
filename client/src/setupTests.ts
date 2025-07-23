import '@testing-library/jest-dom';
import { beforeAll, vi } from 'vitest';

// Mock MUI icons to prevent loading too many files
vi.mock('@mui/icons-material', () => ({
  EmojiPeople: () => 'EmojiPeople',
  AddCircle: () => 'AddCircle',
  Groups2: () => 'Groups2',
  EmojiEmotions: () => 'EmojiEmotions',
  AttachFile: () => 'AttachFile',
  Mic: () => 'Mic',
  Close: () => 'Close',
  PlayCircle: () => 'PlayCircle',
  VolumeUp: () => 'VolumeUp',
  Download: () => 'Download',
  NavigateBefore: () => 'NavigateBefore',
  NavigateNext: () => 'NavigateNext',
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  
  // Mock ResizeObserver for react-medium-image-zoom
  global.ResizeObserver = class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    
    constructor(callback: any) {
      // Mock constructor
    }
  };
});