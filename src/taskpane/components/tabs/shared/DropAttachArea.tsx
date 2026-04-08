// src/taskpane/components/tabs/email/DropAttachArea.tsx
import React, { useState, useCallback } from 'react';
import './DropAttachArea.css';
import LoadPanel from 'devextreme-react/load-panel';
import { getLogger } from '@infra/logger';
import { useTranslation } from 'react-i18next';

const logger = getLogger();

export default function DropAttachArea() {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading]   = useState(false);
  const { t: translate } = useTranslation('common');

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

      logger.debug('All files attached', 'DropAttachArea');
    } catch (err) {
      logger.error('Attachment error', 'DropAttachArea', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <>
      <LoadPanel
        visible={loading}
        shading
        message={translate('dragDrop.attachingFiles')}
      />

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`drop-attach-area${dragOver ? ' drop-attach-area--active' : ''}`}
      >
        {dragOver
          ? translate('dragDrop.releaseToAttach')
          : translate('dragDrop.dragFilesHere')}
      </div>
    </>
  );
}
