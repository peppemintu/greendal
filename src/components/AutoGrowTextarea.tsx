'use client';

import { useEffect, useRef } from 'react';

/** A textarea that grows to fit its content — no scrollbar, no fixed rows. */
export function AutoGrowTextarea({
  value,
  onChange,
  className,
  placeholder,
  style,
  onKeyDown,
  autoFocus,
  'data-block-id': dataBlockId,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  style?: React.CSSProperties;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  autoFocus?: boolean;
  'data-block-id'?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      className={className}
      placeholder={placeholder}
      rows={1}
      autoFocus={autoFocus}
      data-block-id={dataBlockId}
      style={{ overflow: 'hidden', resize: 'none', display: 'block', width: '100%', ...style }}
    />
  );
}
