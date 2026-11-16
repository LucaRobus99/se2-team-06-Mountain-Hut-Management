import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prepareAvatar } from '../../../../src/utils/avatar.js';

describe('avatar.js - prepareAvatar (White Box Tests)', () => {
  let originalCreateObjectURL;
  let originalRevokeObjectURL;
  let mockImageInstance;

  beforeEach(() => {
    vi.clearAllMocks();

    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    URL.revokeObjectURL = vi.fn();

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      drawImage: vi.fn(),
    });
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,mockedbase64string');

    mockImageInstance = {
      naturalWidth: 800,
      naturalHeight: 600,
      onload: null,
      onerror: null,
      set src(url) {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      },
    };

    // Use a proper constructor function so 'new Image()' works correctly
    vi.stubGlobal(
      'Image',
      vi.fn().mockImplementation(function () {
        return mockImageInstance;
      })
    );
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.unstubAllGlobals();
  });

  it('throws an error if file is missing or has an invalid type', async () => {
    const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });
    
    await expect(prepareAvatar(null)).rejects.toThrow('Choose a JPG, PNG or WebP photo.');
    await expect(prepareAvatar(invalidFile)).rejects.toThrow('Choose a JPG, PNG or WebP photo.');
  });

  it('throws an error if file size exceeds MAX_FILE_BYTES (8 MB)', async () => {
    const largeFile = {
      type: 'image/jpeg',
      size: 9 * 1024 * 1024,
    };

    await expect(prepareAvatar(largeFile)).rejects.toThrow('Choose a photo smaller than 8 MB.');
  });

  it('successfully resizes and returns base64 data URL for a valid image', async () => {
    const validFile = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(validFile, 'size', { value: 1024 * 1024 });

    const result = await prepareAvatar(validFile);

    expect(result).toBe('data:image/jpeg;base64,mockedbase64string');
    expect(URL.createObjectURL).toHaveBeenCalledWith(validFile);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('throws an error if image dimensions are empty (0 width or height)', async () => {
    const validFile = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
    mockImageInstance.naturalWidth = 0;
    mockImageInstance.naturalHeight = 0;

    await expect(prepareAvatar(validFile)).rejects.toThrow('This photo is empty.');
  });

  it('throws an error if Image fails to load (onerror triggered)', async () => {
    const validFile = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
    
    vi.stubGlobal(
      'Image',
      vi.fn().mockImplementation(function () {
        return {
          set src(url) {
            setTimeout(() => {
              if (this.onerror) this.onerror();
            }, 0);
          },
        };
      })
    );

    await expect(prepareAvatar(validFile)).rejects.toThrow('This photo cannot be opened.');
  });

  it('throws an error if canvas context (getContext) is not supported', async () => {
    const validFile = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);

    await expect(prepareAvatar(validFile)).rejects.toThrow('Photo processing is not supported by this browser.');
  });

  it('throws an error if resized image data exceeds MAX_UPLOAD_BYTES', async () => {
    const validFile = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
    const largeBase64Data = 'data:image/jpeg;base64,' + 'A'.repeat(600 * 1024);
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue(largeBase64Data);

    await expect(prepareAvatar(validFile)).rejects.toThrow('This photo is too large after resizing. Try another image.');
  });
});