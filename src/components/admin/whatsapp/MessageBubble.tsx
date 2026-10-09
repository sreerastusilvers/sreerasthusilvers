/**
 * One message in the inbox timeline: customer message, team reply (with
 * delivery ticks) or internal note. Media loads only when an admin asks for
 * it, through the admin-only proxy, so nothing is downloaded by default.
 */
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  Lock,
  MapPin,
  Mic,
  Film,
  Sticker,
  UserRound,
  LayoutTemplate,
} from 'lucide-react';
import { whatsappAdminApi } from '@/services/whatsappAdminApi';
import { formatWhatsAppText } from './WhatsAppPreviewBubble';
import { describeSendError, formatBubbleTime, type DeliveryStatus, type ThreadMessage } from './inboxModel';
import { WaBubble, WaTicks } from '@/components/wa/WaKit';

export const DeliveryTicks = ({ status, className = '' }: { status?: DeliveryStatus | null; className?: string }) => (
  <WaTicks status={status} className={className} />
);

const MEDIA_META: Record<string, { label: string; Icon: typeof ImageIcon }> = {
  image: { label: 'Photo', Icon: ImageIcon },
  sticker: { label: 'Sticker', Icon: Sticker },
  video: { label: 'Video', Icon: Film },
  audio: { label: 'Audio', Icon: Mic },
  document: { label: 'Document', Icon: FileText },
};

export const MediaBlock = ({ m, demo }: { m: ThreadMessage; demo: boolean }) => {
  const type = m.type || 'document';
  const meta = MEDIA_META[type] || MEDIA_META.document;
  const label = type === 'audio' && m.media?.voice ? 'Voice message' : meta.label;
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const load = async () => {
    if (!m.media?.id) return;
    if (demo) {
      setError('Demo data: media loads on the live site.');
      setState('error');
      return;
    }
    setState('loading');
    try {
      const objectUrl = await whatsappAdminApi.mediaObjectUrl(m.media.id);
      setUrl(objectUrl);
      setState('idle');
      if (type === 'document') {
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = m.media.filename || 'whatsapp-document';
        a.click();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load media.');
      setState('error');
    }
  };

  if (url && (type === 'image' || type === 'sticker')) {
    return <img src={url} alt={m.media?.caption || label} className={`mb-1 rounded-[6px] ${type === 'sticker' ? 'h-32 w-32 object-contain' : 'max-h-[340px] w-full min-w-[220px] object-cover'}`} />;
  }
  if (url && type === 'video') return <video src={url} controls className="mb-1 max-h-80 w-full rounded-md" />;
  if (url && type === 'audio') return <audio src={url} controls className="mb-1 w-64 max-w-full" />;

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={load}
        disabled={state === 'loading' || !m.media?.id}
        className="flex w-full min-w-[12rem] items-center gap-3 rounded-md bg-black/[0.04] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-black/[0.07] disabled:cursor-default dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
      >
        <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white text-[#54656f] dark:bg-[#111b21] dark:text-[#aebac1]">
          {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <meta.Icon className="h-4 w-4" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{type === 'document' ? m.media?.filename || label : label}</span>
          <span className="block text-[11px] text-[#667781] dark:text-[#8696a0]">
            {state === 'loading' ? 'Loading…' : type === 'document' ? 'Tap to download' : 'Tap to view'}
          </span>
        </span>
        {type === 'document' && state !== 'loading' && <Download className="h-4 w-4 flex-none text-[#667781]" aria-hidden />}
      </button>
      {state === 'error' && <p className="mt-1 text-[11px] text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
};

export const LocationBlock = ({ m }: { m: ThreadMessage }) => {
  const l = m.location!;
  const href = `https://www.google.com/maps?q=${encodeURIComponent(`${l.latitude},${l.longitude}`)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-1 flex min-w-[12rem] items-center gap-3 rounded-md bg-black/[0.04] px-3 py-2.5 transition-colors duration-150 hover:bg-black/[0.07] dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
    >
      <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white text-[#d93025] dark:bg-[#111b21]">
        <MapPin className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium">{l.name || 'Shared location'}</span>
        <span className="block truncate text-[11px] text-[#667781] dark:text-[#8696a0]">{l.address || 'Open in Google Maps'}</span>
      </span>
    </a>
  );
};

/** One timeline entry: customer message, team reply (with ticks) or internal note. */
export const MessageBubble = ({ m, demo = false, tail = true }: { m: ThreadMessage; demo?: boolean; tail?: boolean }) => {
  if (m.direction === 'note') {
    return (
      <li className="my-2 flex justify-center px-[4%] md:px-[7%]">
        <div className="w-full max-w-[92%] rounded-[7.5px] bg-[var(--wa-note)] px-3 py-2 text-[13.5px] leading-[19px] text-[var(--wa-note-text)] shadow-[var(--wa-shadow)] md:max-w-[72%]">
          <p className="mb-0.5 flex items-center gap-1 text-[11.5px] font-medium opacity-80">
            <Lock className="h-3 w-3" aria-hidden /> Internal note · only your team sees this
          </p>
          <p className="whitespace-pre-wrap break-words">{m.text}</p>
          <p className="mt-0.5 text-right text-[11px] opacity-75">
            {m.actorName || m.actorEmail || 'Team'} · {formatBubbleTime(m.createdAt)}
          </p>
        </div>
      </li>
    );
  }

  const outbound = m.direction === 'outbound';
  const isMedia = !!m.media && !!MEDIA_META[m.type || ''];
  const isTemplate = m.type === 'template';
  const showText = !!m.text && !(isTemplate && m.text.startsWith('[template:'));
  const sender = outbound ? m.actorName || m.actorEmail : null;

  return (
    <WaBubble
      out={outbound}
      tail={tail}
      time={formatBubbleTime(m.createdAt)}
      // Messages sent before status tracking have no status: Meta accepted them.
      status={outbound ? m.status || (m.providerMessageId ? 'sent' : 'accepted') : undefined}
      header={
        isTemplate || sender ? (
          <p className="mb-0.5 flex items-center gap-1 text-[12px] font-medium leading-[18px] text-[var(--wa-teal)]">
            {isTemplate && <LayoutTemplate className="h-3 w-3" aria-hidden />}
            {[sender, isTemplate ? `Template · ${m.template?.name || ''}` : null].filter(Boolean).join(' · ')}
          </p>
        ) : null
      }
      media={
        isMedia ? (
          <MediaBlock m={m} demo={demo} />
        ) : m.type === 'location' && m.location ? (
          <LocationBlock m={m} />
        ) : null
      }
      footer={
        outbound && m.status === 'failed' ? (
          <p className="mt-1 flex items-start justify-end gap-1 text-right text-[11.5px] text-red-700 dark:text-red-300" role="status">
            <AlertCircle className="mt-[2px] h-3 w-3 flex-none" aria-hidden />
            {describeSendError(m.error)}
          </p>
        ) : null
      }
    >
      {m.type === 'contacts' && (
        <span className="flex items-center gap-1.5 text-[13px]">
          <UserRound className="h-4 w-4" aria-hidden /> Shared a contact
        </span>
      )}
      {showText && m.type !== 'location' && formatWhatsAppText(m.text || '')}
      {isTemplate && !showText && m.template?.params?.length ? m.template.params.join(' · ') : null}
      {!showText && !isMedia && !isTemplate && m.type !== 'location' && m.type !== 'contacts' && (
        <span className="italic text-[var(--wa-muted)]">Empty message</span>
      )}
    </WaBubble>
  );
};

export default MessageBubble;
