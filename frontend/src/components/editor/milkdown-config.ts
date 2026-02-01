import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { nord } from '@milkdown/theme-nord';
import { history } from '@milkdown/plugin-history';
import { clipboard } from '@milkdown/plugin-clipboard';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { upload, uploadConfig, type Uploader } from '@milkdown/plugin-upload';
import type { Node } from '@milkdown/prose/model';

export interface EditorConfig {
  defaultValue?: string;
  onChange?: (markdown: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  readonly?: boolean;
}

/**
 * Get dev auth header if in dev mode.
 */
function getDevAuthHeader(): Record<string, string> {
  if (localStorage.getItem('dev_auth') === 'true') {
    const token = '00000000-0000-0000-0000-000000000001:dev@example.com:contributor,reviewer,publisher,administrator';
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Upload image to server and return URL.
 */
async function uploadImageToServer(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/v1/uploads/image', {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers: {
      ...getDevAuthHeader(),
      // Note: Don't set Content-Type for FormData - browser sets it with boundary
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to upload image');
  }

  const result = await response.json();
  return result.data.url;
}

/**
 * Default uploader that uploads images to the server.
 * Returns URLs instead of base64 to keep markdown small and avoid serialization issues.
 */
export const defaultImageUploader: Uploader = async (files, schema) => {
  const images: File[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files.item(i);
    if (!file || !file.type.includes('image')) continue;
    images.push(file);
  }

  const nodes: Node[] = await Promise.all(
    images.map(async (image) => {
      try {
        const src = await uploadImageToServer(image);
        console.log('[ImageUploader] Uploaded image:', src);
        return schema.nodes.image.createAndFill({
          src,
          alt: image.name,
        }) as Node;
      } catch (error) {
        console.error('[ImageUploader] Failed to upload:', error);
        // Fallback: create placeholder node
        return schema.nodes.image.createAndFill({
          src: '',
          alt: `Failed to upload: ${image.name}`,
        }) as Node;
      }
    })
  );

  return nodes;
};

/**
 * Read an image file as a base64 data URL (kept for fallback/testing).
 */
export function readImageAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as base64'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Create a configured Milkdown editor instance.
 */
export async function createEditor(
  root: HTMLElement,
  config: EditorConfig
): Promise<Editor> {
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);

      if (config.defaultValue) {
        ctx.set(defaultValueCtx, config.defaultValue);
      }

      // Configure listener for content changes
      ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
        config.onChange?.(markdown);
      });

      // Configure upload plugin for image handling
      ctx.update(uploadConfig.key, (prev) => ({
        ...prev,
        uploader: defaultImageUploader,
        enableHtmlFileUploader: true,
      }));
    })
    .config(nord)
    .use(commonmark)
    .use(gfm)
    .use(history)
    .use(clipboard)
    .use(listener)
    .use(upload)
    .create();

  return editor;
}

/**
 * Get markdown content from an editor instance.
 */
export function getMarkdownFromEditor(editor: Editor): string {
  // The editor serializes to markdown via the listener
  // This is a fallback for direct extraction
  const root = editor.ctx.get(rootCtx);
  if (root instanceof HTMLElement) {
    // The markdown is available through the editor's internal state
    // For now, return empty - actual implementation uses listener
    return '';
  }
  return '';
}

export { Editor };
