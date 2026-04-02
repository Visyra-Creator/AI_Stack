import React, { useEffect } from 'react';
import { openUriExternally } from '@/src/services/fileOpener';

interface PDFViewerProps {
  visible: boolean;
  uri: string;
  fileName: string;
  onClose: () => void;
  colors: any;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ visible, uri, fileName, onClose, colors }) => {
  useEffect(() => {
    if (!visible || !uri) return;
    void openUriExternally(uri).finally(() => {
      onClose();
    });
  }, [visible, uri, onClose]);

  return null;
};
