import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeCanvasProps {
  value: string;
  size?: number;
  className?: string;
}

export const QrCodeCanvas: React.FC<QrCodeCanvasProps> = ({ value, size = 180, className = '' }) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: Math.max(size * 2, 360),
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (mounted) setDataUrl(url);
      })
      .catch(() => {
        // Fallback silently
      });
    return () => {
      mounted = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 rounded-xl animate-pulse ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt="رمز الاستجابة السريعة لربط السوار"
      width={size}
      height={size}
      className={`block rounded-lg bg-white ${className}`}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  );
};
