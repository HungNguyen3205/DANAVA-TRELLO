import { useState } from 'react';
import type React from 'react';
import { toast } from 'sonner';
import api from '../lib/axios';

const MAX_BYTES = 10 * 1024 * 1024; // backend limit: 10MB

export interface UploadedAttachment {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  size: number;
  userId: string;
  createdAt: string;
}

/**
 * Lets a description textarea accept images by paste (Ctrl+V) or drag & drop.
 * Each image is uploaded as a task attachment and a `![name](/storage/...)`
 * line is inserted at the cursor; SafeLinkifiedText renders it as an image.
 */
export function useDescriptionImageUpload(opts: {
  taskId: string | number | undefined;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  getValue: () => string;
  setValue: (next: string) => void;
  onUploaded?: (att: UploadedAttachment) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const insertAtCursor = (snippet: string) => {
    const el = opts.textareaRef.current;
    const value = opts.getValue() || '';
    const start = el ? el.selectionStart ?? value.length : value.length;
    const end = el ? el.selectionEnd ?? value.length : value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const pre = before && !before.endsWith('\n') ? '\n' : '';
    const post = after.startsWith('\n') ? '' : '\n';
    const next = before + pre + snippet + post + after;
    opts.setValue(next);
    const caret = (before + pre + snippet + post).length;
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  };

  const uploadImages = async (files: File[]) => {
    if (!opts.taskId || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > MAX_BYTES) {
          toast.error(`Ảnh "${file.name}" vượt quá 10MB`);
          continue;
        }
        const formData = new FormData();
        const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
        const name = file.name && file.name !== 'image.png' ? file.name : `anh-${Date.now()}.${ext}`;
        formData.append('file', file, name);
        try {
          const res = await api.post(`/tasks/${opts.taskId}/attachments`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const att: UploadedAttachment = {
            id: String(res.data.id),
            fileName: res.data.file_name,
            filePath: res.data.file_path,
            mimeType: res.data.mime_type,
            size: res.data.size,
            userId: String(res.data.user_id),
            createdAt: res.data.created_at,
          };
          const alt = att.fileName.replace(/[\[\]]/g, '');
          insertAtCursor(`![${alt}](/storage/${att.filePath})`);
          opts.onUploaded?.(att);
        } catch (err: any) {
          toast.error(err?.response?.data?.message || `Không tải được ảnh "${name}"`);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const imagesFrom = (list: FileList | DataTransferItemList | null | undefined): File[] => {
    if (!list) return [];
    const out: File[] = [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i] as File | DataTransferItem;
      const file = 'getAsFile' in item ? (item.kind === 'file' ? item.getAsFile() : null) : item;
      if (file && file.type.startsWith('image/')) out.push(file);
    }
    return out;
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = imagesFrom(e.clipboardData?.items);
    if (files.length === 0) return; // plain text paste: let it through
    e.preventDefault();
    void uploadImages(files);
  };

  const onDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    const files = imagesFrom(e.dataTransfer?.files);
    if (files.length === 0) return;
    e.preventDefault();
    void uploadImages(files);
  };

  const onDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (Array.from(e.dataTransfer?.types || []).includes('Files')) e.preventDefault();
  };

  return { uploading, onPaste, onDrop, onDragOver };
}
