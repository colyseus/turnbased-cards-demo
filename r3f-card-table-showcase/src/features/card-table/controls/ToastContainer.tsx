import React, { useRef, useState } from 'react';
import type { ToastRef } from '../types';

export const ToastContainer = React.forwardRef<ToastRef>((_props, ref) => {
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useImperativeHandle(ref, () => ({
    show: (msg: string) => {
      setMessage(msg);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setMessage(null), 3000);
    },
  }));

  return (
    <div className={`toast ${message ? 'show' : ''}`} id="feedback-toast">
      {message}
    </div>
  );
});

ToastContainer.displayName = 'ToastContainer';
