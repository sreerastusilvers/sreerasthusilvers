import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { WaIconButton } from './WaKit';

/** The everyday set; a full picker would be most of a megabyte for a shop inbox. */
const EMOJI = [
  '🙏', '😊', '👍', '🙂', '😀', '😂', '❤️', '🎉',
  '✨', '💍', '💎', '🎁', '🛍️', '📦', '🚚', '✅',
  '👌', '🤝', '👏', '🌸', '🌺', '🪔', '😍', '🥰',
  '😇', '🤔', '😅', '😢', '🙌', '👋', '⏰', '📞',
  '📷', '📸', '🧾', '💰', '₹', '⭐', '🔔', '📍',
];

export function WaEmojiPicker({ onPick, disabled }: { onPick: (emoji: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <WaIconButton label="Emoji" disabled={disabled} className="mb-1 md:mb-0">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 14.2c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2" />
            <circle cx="9" cy="10" r=".9" fill="currentColor" stroke="none" />
            <circle cx="15" cy="10" r=".9" fill="currentColor" stroke="none" />
          </svg>
        </WaIconButton>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[296px] p-2">
        <div className="grid grid-cols-8 gap-0.5" role="listbox" aria-label="Emoji">
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                onPick(e);
                setOpen(false);
              }}
              className="grid h-9 w-9 place-items-center rounded-md text-[22px] leading-none hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884]"
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
