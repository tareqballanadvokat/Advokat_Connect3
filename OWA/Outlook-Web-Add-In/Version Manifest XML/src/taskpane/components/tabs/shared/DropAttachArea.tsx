// src/taskpane/components/tabs/email/DropAttachArea.tsx
import React, { useState, useCallback } from 'react';
import LoadPanel from 'devextreme-react/load-panel';

export default function DropAttachArea() {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading]   = useState(false);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (!files.length) return;

    setLoading(true);
    try {
      for (const file of files) {
        // 1) Read as base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1]);     // drop the data:… prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // 2) Attach to current message (Compose mode)
        await new Promise<void>((resolve, reject) => {
          Office.context.mailbox.item.addFileAttachmentFromBase64Async(
            base64,
            file.name,
            { isInline: false },
            result => {
              if (result.status === Office.AsyncResultStatus.Succeeded) resolve();
              else reject(result.error);
            }
          );
        });
      }

      console.log('📎 All files attached');
    } catch (err) {
      console.error('Attachment error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <>
      <LoadPanel
        visible={loading}
        shading
        message="Attaching files…"
      />

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          border: dragOver ? '2px dashed #0078d4' : '2px dashed #ccc',
          borderRadius: 4,
          padding: 20,
          textAlign: 'center',
          color: dragOver ? '#0078d4' : '#666',
          marginBottom: 16,
          transition: 'border-color .2s, color .2s'
        }}
      >
        {dragOver
          ? 'Release to attach files to this email'
          : 'Drag & drop files here to attach them'}
      </div>
    </>
  );
}
