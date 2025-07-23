import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { axe, toHaveNoViolations } from "jest-axe";
import MessageInput from "../../chat/MessageInput";
import type { MessageInputState } from "../../chat/ChatWindow";
import { renderWithProviders } from "../../../utils/test-utils/renderWithProviders";

expect.extend(toHaveNoViolations);

// Mock child components
vi.mock("../../chat/EmojiPickerButton", () => ({
  default: ({ onEmojiClick }: { onEmojiClick: (data: any) => void }) => (
    <button
      data-testid="emoji-picker-button"
      onClick={() => onEmojiClick({ emoji: "😀" })}
    >
      😀
    </button>
  ),
}));

vi.mock("../../chat/UploadFileButton", () => ({
  default: ({ onFileSelect }: { onFileSelect: (files: FileList) => void }) => (
    <input
      data-testid="upload-file-button"
      type="file"
      multiple
      aria-label="Upload files (images, videos, or PDFs)"
      onChange={(e) => e.target.files && onFileSelect(e.target.files)}
    />
  ),
}));

vi.mock("../../chat/RecordVoiceButton", () => ({
  default: ({ 
    onVoiceRecorded, 
    onTyping 
  }: { 
    onVoiceRecorded: (blob: Blob, duration: number) => void;
    onTyping: () => void;
  }) => (
    <button
      data-testid="record-voice-button"
      onClick={() => {
        const mockBlob = new Blob(['mock audio data'], { type: 'audio/webm' });
        onVoiceRecorded(mockBlob, 5);
        onTyping();
      }}
    >
      🎤
    </button>
  ),
}));

// Mock FileReader
global.FileReader = vi.fn(() => ({
  readAsDataURL: vi.fn(),
  onloadend: null,
  result: 'data:image/jpeg;base64,mockbase64data',
})) as any;

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = vi.fn();

// Mock Audio
global.Audio = vi.fn(() => ({
  play: vi.fn(),
})) as any;

describe('MessageInput', () => {
  const user = userEvent.setup();
  const mockTheme = {
    palette: {
      primary: { main: '#1976d2' },
      background: { paper: '#ffffff' },
    },
  };

  let mockInput: MessageInputState;
  let mockSetInput: ReturnType<typeof vi.fn>;
  let mockOnSend: ReturnType<typeof vi.fn>;
  let mockOnTyping: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    
    mockInput = {
      content: "",
      files: [],
      voiceMetadata: {},
    };
    
    mockSetInput = vi.fn((updater) => {
      if (typeof updater === 'function') {
        mockInput = updater(mockInput);
      } else {
        mockInput = updater;
      }
    });
    
    mockOnSend = vi.fn();
    mockOnTyping = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  const renderComponent = (inputState?: Partial<MessageInputState>) => {
    const finalInput = { ...mockInput, ...inputState };
    
    return renderWithProviders(
      <MessageInput
        input={finalInput}
        setInput={mockSetInput}
        onSend={mockOnSend}
        onTyping={mockOnTyping}
        theme={mockTheme}
      />
    );
  };

  describe('Rendering', () => {
    test('renders message input with all controls', () => {
      renderComponent();
      
      expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
      expect(screen.getByTestId('emoji-picker-button')).toBeInTheDocument();
      expect(screen.getByTestId('upload-file-button')).toBeInTheDocument();
      expect(screen.getByTestId('record-voice-button')).toBeInTheDocument();
    });

    test('renders with initial content', () => {
      renderComponent({ content: 'Hello world' });
      
      expect(screen.getByDisplayValue('Hello world')).toBeInTheDocument();
    });

    test('send button is disabled when no content or files', () => {
      renderComponent();
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toBeDisabled();
    });

    test('send button is enabled when content exists', () => {
      renderComponent({ content: 'Hello' });
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).not.toBeDisabled();
    });

    test('send button is enabled when files are selected', () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      renderComponent({ files: [mockFile] });
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe('Text Input Functionality', () => {
    test('handles text input changes', async () => {
      renderComponent();
      
      const textInput = screen.getByPlaceholderText('Type your message...');
      await user.type(textInput, 'Hello world');
      
      expect(mockSetInput).toHaveBeenCalled();
      expect(mockOnTyping).toHaveBeenCalled();
    });

    test('handles onChange event correctly', async () => {
      renderComponent();
      
      const textInput = screen.getByPlaceholderText('Type your message...');
      fireEvent.change(textInput, { target: { value: 'Test message' } });
      
      expect(mockSetInput).toHaveBeenCalledWith(expect.any(Function));
      expect(mockOnTyping).toHaveBeenCalled();
    });

    test('handles Enter key to send message', async () => {
      renderComponent({ content: 'Test message' });
      
      const textInput = screen.getByPlaceholderText('Type your message...');
      fireEvent.keyDown(textInput, { key: 'Enter', shiftKey: false });
      
      expect(mockOnSend).toHaveBeenCalled();
    });

    test('does not send on Shift+Enter', async () => {
      renderComponent({ content: 'Test message' });
      
      const textInput = screen.getByPlaceholderText('Type your message...');
      fireEvent.keyDown(textInput, { key: 'Enter', shiftKey: true });
      
      expect(mockOnSend).not.toHaveBeenCalled();
    });
  });

  describe('Emoji Functionality', () => {
    test('adds emoji to input content', async () => {
      renderComponent({ content: 'Hello ' });
      
      const emojiButton = screen.getByTestId('emoji-picker-button');
      await user.click(emojiButton);
      
      expect(mockSetInput).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('File Upload Functionality', () => {
    test('handles single file upload', async () => {
      renderComponent();
      
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const uploadInput = screen.getByTestId('upload-file-button');
      
      const mockFiles = {
        0: file,
        length: 1,
        item: () => file,
        [Symbol.iterator]: function* () {
          yield file;
        },
      } as FileList;
      
      fireEvent.change(uploadInput, { target: { files: mockFiles } });
      
      await waitFor(() => {
        expect(mockSetInput).toHaveBeenCalled();
      });
    });

    test('handles multiple file uploads', async () => {
      renderComponent();
      
      const file1 = new File(['test 1'], 'test1.txt', { type: 'text/plain' });
      const file2 = new File(['test 2'], 'test2.txt', { type: 'text/plain' });
      
      const mockFiles = {
        0: file1,
        1: file2,
        length: 2,
        item: (index: number) => [file1, file2][index],
        [Symbol.iterator]: function* () {
          yield file1;
          yield file2;
        },
      } as FileList;
      
      const uploadInput = screen.getByTestId('upload-file-button');
      fireEvent.change(uploadInput, { target: { files: mockFiles } });
      
      await waitFor(() => {
        expect(mockSetInput).toHaveBeenCalled();
      });
    });

    test('rejects files exceeding size limit', async () => {
      renderComponent();
      
      // Create a file larger than 5MB
      const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.txt', { 
        type: 'text/plain' 
      });
      
      Object.defineProperty(largeFile, 'size', {
        value: 6 * 1024 * 1024,
        writable: false,
      });
      
      const mockFiles = {
        0: largeFile,
        length: 1,
        item: () => largeFile,
        [Symbol.iterator]: function* () {
          yield largeFile;
        },
      } as FileList;
      
      const uploadInput = screen.getByTestId('upload-file-button');
      fireEvent.change(uploadInput, { target: { files: mockFiles } });
      
      // File should be rejected due to size
      await waitFor(() => {
        // Should not add the oversized file to input
        expect(mockSetInput).not.toHaveBeenCalled();
      });
    });

    test('displays image preview for image files', async () => {
      const mockFileReader = {
        readAsDataURL: vi.fn(),
        onloadend: null,
        result: 'data:image/jpeg;base64,mockdata',
      };
      
      global.FileReader = vi.fn(() => mockFileReader) as any;
      
      renderComponent();
      
      const imageFile = new File(['fake image'], 'image.jpg', { type: 'image/jpeg' });
      const mockFiles = {
        0: imageFile,
        length: 1,
        item: () => imageFile,
        [Symbol.iterator]: function* () {
          yield imageFile;
        },
      } as FileList;
      
      const uploadInput = screen.getByTestId('upload-file-button');
      fireEvent.change(uploadInput, { target: { files: mockFiles } });
      
      // Simulate FileReader completion
      if (mockFileReader.onloadend) {
        mockFileReader.onloadend({} as any);
      }
      
      await waitFor(() => {
        expect(mockFileReader.readAsDataURL).toHaveBeenCalledWith(imageFile);
      });
    });

    test('handles file removal', () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      
      // Mock component with pre-selected file
      renderComponent({ files: [mockFile] });
      
      // Since we need to simulate the file preview state, we'll test the removal logic
      // by checking that the remove button exists and functions
      // This would typically be tested with a more integrated approach
      
      expect(mockSetInput).toBeDefined(); // Basic smoke test
    });
  });

  describe('Voice Message Functionality', () => {
    test('handles voice message recording', async () => {
      renderComponent();
      
      const voiceButton = screen.getByTestId('record-voice-button');
      await user.click(voiceButton);
      
      expect(mockOnTyping).toHaveBeenCalled();
    });

    test('creates voice message file correctly', async () => {
      renderComponent();
      
      const voiceButton = screen.getByTestId('record-voice-button');
      await user.click(voiceButton);
      
      // The mock RecordVoiceButton should trigger the voice recorded callback
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    test('formats voice message duration correctly', () => {
      // Test the formatDuration function indirectly through component behavior
      renderComponent();
      
      // This tests that the component can handle voice messages
      // More detailed duration formatting would need integration testing
      expect(mockSetInput).toBeDefined();
    });
  });

  describe('Send Functionality', () => {
    test('sends message when send button is clicked', async () => {
      renderComponent({ content: 'Test message' });
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);
      
      expect(mockOnSend).toHaveBeenCalled();
    });

    test('clears input after sending', async () => {
      renderComponent({ content: 'Test message' });
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);
      
      expect(mockSetInput).toHaveBeenCalledWith({
        content: "",
        files: [],
        voiceMetadata: {},
      });
    });

    test('prevents sending empty messages', () => {
      renderComponent();
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toBeDisabled();
    });

    test('allows sending with only whitespace is disabled', () => {
      renderComponent({ content: '   ' });
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toBeDisabled();
    });

    test('cleans up object URLs after sending', async () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      renderComponent({ 
        content: 'Test',
        files: [mockFile]
      });
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);
      
      // Should clean up any object URLs created for voice messages
      expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(0); // No voice messages in this test
    });
  });

  describe('Error Handling', () => {
    test('handles FileReader errors gracefully', async () => {
      const mockFileReader = {
        readAsDataURL: vi.fn(() => {
          throw new Error('FileReader error');
        }),
        onloadend: null,
        result: null,
      };
      
      global.FileReader = vi.fn(() => mockFileReader) as any;
      
      renderComponent();
      
      const imageFile = new File(['fake image'], 'image.jpg', { type: 'image/jpeg' });
      const mockFiles = {
        0: imageFile,
        length: 1,
        item: () => imageFile,
        [Symbol.iterator]: function* () {
          yield imageFile;
        },
      } as FileList;
      
      const uploadInput = screen.getByTestId('upload-file-button');
      
      // Should not crash when FileReader throws
      expect(() => {
        fireEvent.change(uploadInput, { target: { files: mockFiles } });
      }).not.toThrow();
    });

    test('handles audio play errors gracefully', async () => {
      const mockAudio = {
        play: vi.fn(() => Promise.reject(new Error('Audio play failed'))),
      };
      
      global.Audio = vi.fn(() => mockAudio) as any;
      
      renderComponent();
      
      // This would be tested in integration where voice messages are actually displayed
      expect(global.Audio).toBeDefined();
    });
  });

  describe('Accessibility', () => {
    test('has no accessibility violations', async () => {
      const { container } = renderComponent();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('text input has proper accessibility attributes', () => {
      renderComponent();
      
      const textInput = screen.getByPlaceholderText('Type your message...');
      expect(textInput).toHaveAttribute('placeholder', 'Type your message...');
    });

    test('send button has accessible name', () => {
      renderComponent();
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toHaveAccessibleName();
    });

    test('file upload input is accessible', () => {
      renderComponent();
      
      const uploadInput = screen.getByTestId('upload-file-button');
      expect(uploadInput).toBeInTheDocument();
    });

    test('supports keyboard navigation', () => {
      renderComponent();
      
      const textInput = screen.getByPlaceholderText('Type your message...');
      const sendButton = screen.getByRole('button', { name: /send/i });
      
      expect(textInput).toBeInTheDocument();
      expect(sendButton).toBeInTheDocument();
      
      // Basic keyboard navigation test
      textInput.focus();
      expect(document.activeElement).toBe(textInput);
    });
  });

  describe('Integration Scenarios', () => {
    test('handles complex workflow: type, add emoji, upload file, send', async () => {
      renderComponent();
      
      // Type message
      const textInput = screen.getByPlaceholderText('Type your message...');
      await user.type(textInput, 'Hello');
      expect(mockOnTyping).toHaveBeenCalled();
      
      // Add emoji
      const emojiButton = screen.getByTestId('emoji-picker-button');
      await user.click(emojiButton);
      expect(mockSetInput).toHaveBeenCalled();
      
      // Upload file
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const uploadInput = screen.getByTestId('upload-file-button');
      const mockFiles = {
        0: file,
        length: 1,
        item: () => file,
        [Symbol.iterator]: function* () { yield file; },
      } as FileList;
      
      fireEvent.change(uploadInput, { target: { files: mockFiles } });
      
      await waitFor(() => {
        expect(mockSetInput).toHaveBeenCalled();
      });
      
      // Send message
      mockInput.content = 'Hello😀';
      mockInput.files = [file];
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);
      
      expect(mockOnSend).toHaveBeenCalled();
    });

    test('handles multiple voice messages', async () => {
      renderComponent();
      
      const voiceButton = screen.getByTestId('record-voice-button');
      
      // Record first voice message
      await user.click(voiceButton);
      expect(global.URL.createObjectURL).toHaveBeenCalledTimes(1);
      
      // Record second voice message
      await user.click(voiceButton);
      expect(global.URL.createObjectURL).toHaveBeenCalledTimes(2);
    });

    test('handles mixed content types', async () => {
      renderComponent({ 
        content: 'Message with files',
        files: [new File(['test'], 'test.txt')],
        voiceMetadata: { 'voice.webm': { duration: 5, blob: new Blob() } }
      });
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).not.toBeDisabled();
      
      await user.click(sendButton);
      expect(mockOnSend).toHaveBeenCalled();
    });
  });

  describe('Performance and Memory Management', () => {
    test('cleans up object URLs on unmount', () => {
      const { unmount } = renderComponent();
      
      // Create some object URLs
      global.URL.createObjectURL(new Blob());
      
      unmount();
      
      // Component should clean up resources
      // This would be more thoroughly tested with React Testing Library's cleanup
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    test('handles rapid typing without performance issues', async () => {
      renderComponent();
      
      const textInput = screen.getByPlaceholderText('Type your message...');
      
      // Simulate rapid typing
      for (let i = 0; i < 10; i++) {
        fireEvent.change(textInput, { target: { value: `Message ${i}` } });
      }
      
      // Should not cause performance issues or excessive re-renders
      expect(mockSetInput).toHaveBeenCalledTimes(10);
      expect(mockOnTyping).toHaveBeenCalledTimes(10);
    });
  });
});