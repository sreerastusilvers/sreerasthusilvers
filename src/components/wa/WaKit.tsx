/**
 * WhatsApp-style building blocks for the admin chat screens.
 *
 * Desktop follows WhatsApp Web: chat list on the left, conversation on the
 * right, grey headers, doodle wallpaper, bubbles with tails. Phones follow the
 * Android app: the list fills the screen, a conversation opens full screen
 * over everything (with the system back gesture closing it), a round green
 * send button and a floating action button.
 *
 * Purely presentational: data and sending live in the pages.
 */
import { forwardRef, useEffect, useLayoutEffect, useReducer, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import './wa.css';

// ── Icons drawn for this kit (WhatsApp-like, not WhatsApp's own assets) ────
export const WaCheck = ({ double, read, className }: { double?: boolean; read?: boolean; className?: string }) => (
  <svg viewBox="0 0 16 11" width="16" height="11" className={className} aria-hidden fill="none" stroke={read ? 'var(--wa-tick)' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {double ? (
      <>
        <path d="M1 6.2l2.9 2.9L10.5 1.8" />
        <path d="M6.6 8.4l.8.7L14 1.8" />
      </>
    ) : (
      <path d="M3 6.2l2.9 2.9L12.5 1.8" />
    )}
  </svg>
);

export const WaClock = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 16 16" width="15" height="15" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.8V8l2.2 1.4" />
  </svg>
);

export type WaStatus = 'accepted' | 'sent' | 'delivered' | 'read' | 'failed' | null | undefined;

export const WaTicks = ({ status, className }: { status: WaStatus; className?: string }) => {
  if (!status) return null;
  if (status === 'failed') {
    return (
      <svg viewBox="0 0 16 16" width="15" height="15" className={cn('text-[#ea0038]', className)} role="img" aria-label="Not delivered">
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path d="M8 4.5v4.2M8 11.2v.1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  const label = status === 'read' ? 'Read' : status === 'delivered' ? 'Delivered' : status === 'sent' ? 'Sent' : 'Sending';
  return (
    <span role="img" aria-label={label} className={cn('inline-flex', className)}>
      {status === 'accepted' ? <WaClock /> : <WaCheck double={status !== 'sent'} read={status === 'read'} />}
    </span>
  );
};

const TailOut = () => (
  <svg viewBox="0 0 8 13" width="8" height="13" className="absolute -right-2 top-0" aria-hidden>
    <path d="M0 0h6.6c1.2 0 1.8 1.4 1 2.3L0 12.8z" fill="var(--wa-out)" />
  </svg>
);
const TailIn = () => (
  <svg viewBox="0 0 8 13" width="8" height="13" className="absolute -left-2 top-0" aria-hidden>
    <path d="M8 0H1.4C.2 0-.4 1.4.4 2.3L8 12.8z" fill="var(--wa-in)" />
  </svg>
);

// ── Small pieces ─────────────────────────────────────────────────────────────
export const WaIconButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(
  ({ label, className, children, ...rest }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-10 w-10 flex-none items-center justify-center rounded-full text-[var(--wa-icon)] transition-colors duration-150 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wa-teal)] disabled:opacity-40 dark:hover:bg-white/10',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  ),
);
WaIconButton.displayName = 'WaIconButton';

/** WhatsApp's default "no photo" avatar, or a coloured glyph for businesses. */
export const WaAvatar = ({ size = 49, icon }: { size?: number; icon?: ReactNode }) => (
  <span
    className="grid flex-none place-items-center overflow-hidden rounded-full bg-[#dfe5e7] text-white dark:bg-[#6a7175] dark:text-[#cfd4d6]"
    style={{ width: size, height: size }}
    aria-hidden
  >
    {icon || (
      <svg viewBox="0 0 212 212" width={size} height={size}>
        <path
          fill="currentColor"
          d="M106 41c-21 0-38 17-38 38s17 38 38 38 38-17 38-38-17-38-38-38zm0 90c-35 0-66 15-82 39 19 26 49 42 82 42s63-16 82-42c-16-24-47-39-82-39z"
        />
      </svg>
    )}
  </span>
);

export const WaDayChip = ({ children }: { children: ReactNode }) => (
  <div className="sticky top-1.5 z-[2] my-2 flex justify-center">
    <span className="rounded-[7.5px] bg-[var(--wa-day)] px-3 py-[5px] text-[12.5px] uppercase leading-[21px] text-[var(--wa-day-text)] shadow-[var(--wa-shadow)]">
      {children}
    </span>
  </div>
);

/** The yellow system notice WhatsApp shows at the top of a chat. */
export const WaSystemNote = ({ children, icon }: { children: ReactNode; icon?: ReactNode }) => (
  <div className="my-2 flex justify-center px-6">
    <p className="flex max-w-[480px] items-start gap-1.5 rounded-[7.5px] bg-[var(--wa-system)] px-3 py-[6px] text-center text-[12.5px] leading-[18px] text-[var(--wa-system-text)] shadow-[var(--wa-shadow)]">
      {icon}
      <span>{children}</span>
    </p>
  </div>
);

export interface WaBubbleProps {
  out: boolean;
  /** First of a run from the same side: gets the tail and extra space above. */
  tail: boolean;
  time: string;
  status?: WaStatus;
  /** Above the text: sender name, template label, quoted ticket… */
  header?: ReactNode;
  /** Media, location or document card inside the bubble. */
  media?: ReactNode;
  children?: ReactNode;
  /** Below the bubble, e.g. a delivery error. */
  footer?: ReactNode;
}

export const WaBubble = ({ out, tail, time, status, header, media, children, footer }: WaBubbleProps) => (
  <li className={cn('flex px-[4%] md:px-[7%]', out ? 'justify-end' : 'justify-start', tail ? 'mt-3' : 'mt-0.5')}>
    <div className="max-w-[85%] md:max-w-[65%]">
      <div
        className={cn(
          'relative rounded-[7.5px] px-[9px] pb-[8px] pt-[6px] text-[14.2px] leading-[19px] text-[var(--wa-text)] shadow-[var(--wa-shadow)]',
          out ? 'bg-[var(--wa-out)]' : 'bg-[var(--wa-in)]',
          tail && (out ? 'rounded-tr-none' : 'rounded-tl-none'),
          media && 'px-[3px] pt-[3px]',
        )}
      >
        {tail && (out ? <TailOut /> : <TailIn />)}
        {header && <div className={cn(media && 'px-[6px] pt-[3px]')}>{header}</div>}
        {media}
        <div className={cn('whitespace-pre-wrap break-words', media && 'px-[6px]')}>
          {children}
          {/* Room for the time on the last line, as WhatsApp does. */}
          <span className={cn('inline-block align-bottom', out ? 'w-[72px]' : 'w-[52px]')} aria-hidden />
        </div>
        <span
          className="absolute bottom-[4px] right-[7px] flex items-center gap-[3px] text-[11px] leading-[15px]"
          style={{ color: out ? 'var(--wa-meta-out)' : 'var(--wa-meta)' }}
        >
          <span className="tabular-nums">{time}</span>
          {out && <WaTicks status={status} />}
        </span>
      </div>
      {footer}
    </div>
  </li>
);

// ── List side ────────────────────────────────────────────────────────────────
export const WaSearch = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <label className="relative block">
    <span className="sr-only">{placeholder}</span>
    <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--wa-muted)]" aria-hidden />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-full bg-[var(--wa-search)] pl-12 pr-10 text-[15px] text-[var(--wa-text)] placeholder:text-[var(--wa-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wa-teal)] [&::-webkit-search-cancel-button]:hidden"
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[var(--wa-muted)] hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Clear search"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    )}
  </label>
);

export function WaChips<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: Array<{ id: NoInfer<T>; label: string; count?: number }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="tablist" aria-label={label}>
      {items.map((f) => {
        const on = value === f.id;
        return (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(f.id)}
            className={cn(
              'inline-flex h-8 flex-none items-center gap-1 rounded-full px-3 text-[14px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wa-teal)]',
              on ? 'bg-[var(--wa-chip-on)] font-medium text-[var(--wa-chip-on-text)]' : 'bg-[var(--wa-chip)] text-[var(--wa-chip-text)] hover:brightness-95 dark:hover:brightness-125',
            )}
          >
            {f.label}
            {!!f.count && <span className="tabular-nums">{f.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export interface WaChatRowProps {
  title: string;
  time?: string;
  preview: ReactNode;
  unread?: number;
  active?: boolean;
  avatar?: ReactNode;
  /** Small tags under the preview (assigned, resolved, window…). */
  tags?: ReactNode;
  onOpen: () => void;
}

export const WaChatRow = ({ title, time, preview, unread = 0, active, avatar, tags, onOpen }: WaChatRowProps) => (
  <li>
    <button
      type="button"
      onClick={onOpen}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-[13px] pl-[13px] text-left transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--wa-teal)]',
        active ? 'bg-[var(--wa-active)]' : 'hover:bg-[var(--wa-hover)]',
      )}
    >
      {avatar || <WaAvatar />}
      <span className="flex min-h-[72px] min-w-0 flex-1 flex-col justify-center border-b border-[var(--wa-divider)] py-2.5 pr-[15px]">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[17px] leading-[21px] text-[var(--wa-text)]">{title}</span>
          {time && (
            <span className={cn('flex-none text-[12px] leading-[14px]', unread ? 'font-medium text-[var(--wa-time-unread)]' : 'text-[var(--wa-muted)]')}>
              {time}
            </span>
          )}
        </span>
        <span className="mt-[3px] flex items-center gap-1.5">
          <span className={cn('flex min-w-0 flex-1 items-center gap-1 truncate text-[14px] leading-[20px]', unread ? 'text-[var(--wa-text-2)]' : 'text-[var(--wa-muted)]')}>
            {preview}
          </span>
          {unread > 0 && (
            <span className="inline-flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-[var(--wa-badge)] px-[5px] text-[12px] font-semibold tabular-nums leading-none text-[var(--wa-badge-text)]">
              {unread > 99 ? '99+' : unread}
              <span className="sr-only"> unread</span>
            </span>
          )}
        </span>
        {tags && <span className="mt-1 flex flex-wrap items-center gap-1">{tags}</span>}
      </span>
    </button>
  </li>
);

export const WaTag = ({ tone = 'grey', children }: { tone?: 'grey' | 'green' | 'amber' | 'blue'; children: ReactNode }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-[4px] px-1.5 py-[1px] text-[11.5px] font-medium',
      tone === 'green' && 'bg-[#e7f6ec] text-[#0f6b3a] dark:bg-[#123d2a] dark:text-[#8ee3b0]',
      tone === 'amber' && 'bg-[#fff3cd] text-[#7a5a00] dark:bg-[#3d3216] dark:text-[#f0d27a]',
      tone === 'blue' && 'bg-[#e1f2fb] text-[#0b5a83] dark:bg-[#0e3245] dark:text-[#8fd2f5]',
      tone === 'grey' && 'bg-[var(--wa-chip)] text-[var(--wa-chip-text)]',
    )}
  >
    {children}
  </span>
);

// ── Layout ───────────────────────────────────────────────────────────────────
/**
 * The whole app. On md+ both panes sit side by side inside the admin panel.
 * On phones the list fills the page and an open conversation covers the whole
 * screen (portal to <body>, above the admin header), closed by its back arrow
 * or the phone's back gesture.
 */
export const WaApp = ({
  list,
  chat,
  empty,
  onCloseChat,
}: {
  list: ReactNode;
  chat: ReactNode | null;
  empty: ReactNode;
  onCloseChat: () => void;
}) => {
  const isPhone = useIsPhone();
  const open = !!chat;
  // Phone back gesture closes the conversation instead of leaving the page.
  useEffect(() => {
    if (!isPhone || !open) return;
    window.history.pushState({ waChat: true }, '');
    const onPop = () => onCloseChat();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (window.history.state?.waChat) window.history.back();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPhone, open]);
  // No page scroll behind a full-screen conversation.
  useEffect(() => {
    if (!isPhone || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isPhone, open]);

  if (isPhone) {
    return (
      <div className="wa -m-4 flex h-[calc(100dvh-64px)] flex-col overflow-hidden bg-[var(--wa-bg)]">
        {list}
        {open &&
          createPortal(
            <div className="wa wa-enter fixed inset-0 z-[45] flex flex-col bg-[var(--wa-chat)]" role="dialog" aria-modal="true">
              {chat}
            </div>,
            document.body,
          )}
      </div>
    );
  }
  return (
    <div className="wa -m-4 h-[calc(100dvh-64px)] min-h-[560px] overflow-hidden bg-[var(--wa-bg)] lg:-m-6 lg:h-[calc(100dvh-64px)]">
      <div className="grid h-full grid-cols-[minmax(320px,30%)_1fr] xl:grid-cols-[minmax(360px,30%)_1fr]">
        <aside className="flex min-h-0 flex-col overflow-hidden border-r border-[var(--wa-border)] bg-[var(--wa-bg)]">{list}</aside>
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">{chat || empty}</section>
      </div>
    </div>
  );
};

export function useIsPhone() {
  const query = '(max-width: 767px)';
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches;
  const ref = useRef(get());
  const [, force] = useStateTick();
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => {
      ref.current = mq.matches;
      force();
    };
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [force]);
  return ref.current;
}

function useStateTick() {
  return useReducer((n: number) => n + 1, 0);
}

/** List pane header: big "Chats"-style title, like WhatsApp Web / Android. */
export const WaListHeader = ({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) => (
  <header className="flex h-16 flex-none items-center gap-2 bg-[var(--wa-bg)] pl-4 pr-2.5">
    <div className="min-w-0 flex-1">
      <h1 className="truncate text-[22px] font-bold leading-7 text-[var(--wa-green)] md:text-[var(--wa-text)]">{title}</h1>
      {subtitle && <p className="truncate text-[12.5px] leading-4 text-[var(--wa-muted)]" aria-live="polite">{subtitle}</p>}
    </div>
    {actions}
  </header>
);

/** Conversation header: back (phones), avatar, name, subtitle, actions. */
export const WaChatHeader = ({
  title,
  subtitle,
  avatar,
  actions,
  onBack,
}: {
  title: string;
  subtitle?: ReactNode;
  avatar?: ReactNode;
  actions?: ReactNode;
  onBack: () => void;
}) => (
  <header className="flex h-[60px] flex-none items-center gap-1 bg-[var(--wa-header-m)] px-1 pt-[env(safe-area-inset-top)] shadow-[0_1px_0_var(--wa-divider)] md:h-[59px] md:gap-3 md:bg-[var(--wa-header)] md:px-4 md:shadow-none">
    <WaIconButton label="Back" onClick={onBack} className="md:hidden">
      <ArrowLeft className="h-6 w-6" aria-hidden />
    </WaIconButton>
    {avatar || <WaAvatar size={40} />}
    <div className="ml-1.5 min-w-0 flex-1 md:ml-0">
      <h2 className="truncate text-[16px] font-medium leading-[21px] text-[var(--wa-text)] md:font-normal">{title}</h2>
      {subtitle && <div className="truncate text-[13px] leading-[20px] text-[var(--wa-muted)]">{subtitle}</div>}
    </div>
    {actions}
  </header>
);

/**
 * Message list on the wallpaper. Stays pinned to the newest message unless the
 * reader scrolled up, including when pictures load or the composer grows.
 */
export const WaMessages = ({ children, label, resetKey, count }: { children: ReactNode; label: string; resetKey: string; count: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    stick.current = true;
    el.scrollTop = el.scrollHeight;
  }, [count, resetKey]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    const ro = new ResizeObserver(() => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', onScroll);
    };
  }, [resetKey]);
  return (
    <div ref={ref} className="wa-wallpaper wa-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3 pt-1" role="log" aria-label={label}>
      <div>{children}</div>
    </div>
  );
};

/**
 * Bottom bar. Web: grey bar, icons outside a white pill. Android: the pill
 * floats on the wallpaper and the round green button sits beside it.
 */
export const WaComposerBar = ({
  above,
  left,
  input,
  send,
}: {
  above?: ReactNode;
  left?: ReactNode;
  input: ReactNode;
  send: ReactNode;
}) => (
  <div className="flex-none bg-transparent px-1.5 pb-[max(6px,env(safe-area-inset-bottom))] pt-1 md:bg-[var(--wa-header)] md:px-4 md:py-[5px]">
    {above}
    <div className="flex items-end gap-1.5 md:gap-2">
      <div className="flex min-h-[48px] min-w-0 flex-1 items-end gap-0.5 rounded-[24px] bg-[var(--wa-input-m)] px-1 shadow-[var(--wa-shadow)] md:min-h-[52px] md:items-center md:rounded-none md:bg-transparent md:px-0 md:shadow-none">
        {left}
        <div className="min-w-0 flex-1 md:rounded-lg md:bg-[var(--wa-input)] md:px-3">{input}</div>
      </div>
      {send}
    </div>
  </div>
);

export const WaSendButton = ({ onClick, disabled, busy, label, icon }: { onClick: () => void; disabled?: boolean; busy?: boolean; label: string; icon?: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || busy}
    aria-label={label}
    title={label}
    className={cn(
      'grid h-12 w-12 flex-none place-items-center rounded-full bg-[var(--wa-green)] text-white shadow-[var(--wa-shadow)] transition-[transform,opacity] duration-150 active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--wa-teal)]',
      'md:mb-1 md:h-10 md:w-10 md:bg-transparent md:text-[var(--wa-icon)] md:shadow-none md:enabled:text-[var(--wa-teal)] md:hover:bg-black/5 md:dark:hover:bg-white/10 md:disabled:opacity-40 dark:text-[#111b21] md:dark:text-[var(--wa-icon)]',
    )}
  >
    {busy ? (
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
    ) : (
      icon || (
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
          <path fill="currentColor" d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.99.99 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
        </svg>
      )
    )}
  </button>
);

/** Auto-growing message box (up to ~6 lines). Enter sends on desktop. */
export const WaTextarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { onSubmit: () => void; value: string }
>(({ onSubmit, value, className, onKeyDown, ...rest }, outer) => {
  const inner = useRef<HTMLTextAreaElement>(null);
  const setRefs = (el: HTMLTextAreaElement | null) => {
    (inner as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
    if (typeof outer === 'function') outer(el);
    else if (outer) (outer as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
  };
  useEffect(() => {
    const ta = inner.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 132)}px`;
  }, [value]);
  return (
    <textarea
      ref={setRefs}
      rows={1}
      value={value}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) {
          e.preventDefault();
          onSubmit();
        }
      }}
      className={cn(
        'block max-h-[132px] min-h-[48px] w-full resize-none bg-transparent px-2 py-[13px] text-[16px] leading-[22px] text-[var(--wa-text)] placeholder:text-[var(--wa-muted)] focus:outline-none md:min-h-[42px] md:px-0 md:py-[10px] md:text-[15px] md:leading-[21px]',
        className,
      )}
      {...rest}
    />
  );
});
WaTextarea.displayName = 'WaTextarea';

/** Android-style floating action button (phones only). */
export const WaFab = ({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="fixed bottom-5 right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--wa-green)] text-white shadow-[0_2px_6px_rgba(11,20,26,0.25)] transition-transform duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--wa-teal)] dark:text-[#111b21] md:hidden"
  >
    {children}
  </button>
);

/** Right pane when no chat is open (WhatsApp Web's intro screen). */
export const WaEmpty = ({ title, text, footer }: { title: string; text: ReactNode; footer?: ReactNode }) => (
  <div className="flex h-full flex-col items-center justify-center bg-[var(--wa-empty)] px-10 text-center">
    <svg viewBox="0 0 220 140" width="300" height="190" aria-hidden className="mb-7 max-w-full">
      <rect x="40" y="18" width="140" height="90" rx="8" fill="none" stroke="var(--wa-muted)" strokeOpacity=".35" strokeWidth="3" />
      <path d="M22 116h176" stroke="var(--wa-muted)" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
      <rect x="128" y="40" width="44" height="80" rx="7" fill="var(--wa-empty)" stroke="var(--wa-teal)" strokeWidth="3" />
      <circle cx="150" cy="111" r="2.5" fill="var(--wa-teal)" />
      <path d="M62 50h46M62 62h34M62 74h40" stroke="var(--wa-muted)" strokeOpacity=".45" strokeWidth="3" strokeLinecap="round" />
      <path d="M138 58h24v14h-14l-6 5v-5h-4z" fill="var(--wa-green)" />
    </svg>
    <h2 className="text-[32px] font-light leading-[38px] text-[var(--wa-text)] [color:color-mix(in_srgb,var(--wa-text)_88%,transparent)]">{title}</h2>
    <p className="mt-4 max-w-[560px] text-[14px] leading-[20px] text-[var(--wa-muted)]">{text}</p>
    {footer && <p className="mt-10 flex items-center gap-1.5 text-[14px] text-[var(--wa-muted)]">{footer}</p>}
  </div>
);

// ── Helpers ──────────────────────────────────────────────────────────────────
type Millis = { toMillis: () => number } | null | undefined;

export function waTime(t: Millis) {
  if (!t) return '';
  return new Date(t.toMillis()).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
}

/** "10:42 am" today, "Yesterday", weekday this week, else 12/09/2026 (list column). */
export function waListTime(t: Millis, now = Date.now()) {
  if (!t) return '';
  const d = new Date(t.toMillis());
  const today = new Date(now);
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const ms = d.getTime();
  if (ms >= startToday) return waTime(t);
  if (ms >= startToday - 86400000) return 'Yesterday';
  if (ms >= startToday - 6 * 86400000) return d.toLocaleDateString('en-IN', { weekday: 'long' });
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function waDayLabel(t: Millis, now = Date.now()) {
  if (!t) return 'Today';
  const d = new Date(t.toMillis());
  const today = new Date(now);
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const ms = d.getTime();
  if (ms >= startToday) return 'Today';
  if (ms >= startToday - 86400000) return 'Yesterday';
  if (ms >= startToday - 6 * 86400000) return d.toLocaleDateString('en-IN', { weekday: 'long' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Split messages into days, and mark which start a run from one side (tail). */
export function waGroup<T extends { direction: string; createdAt?: Millis }>(messages: T[]) {
  const days: Array<{ label: string; items: Array<{ m: T; tail: boolean }> }> = [];
  let prevDir = '';
  for (const m of messages) {
    const label = waDayLabel(m.createdAt);
    let day = days[days.length - 1];
    if (!day || day.label !== label) {
      day = { label, items: [] };
      days.push(day);
      prevDir = '';
    }
    day.items.push({ m, tail: m.direction !== prevDir });
    prevDir = m.direction;
  }
  return days;
}
