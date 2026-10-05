/**
 * One message in the inbox timeline: customer message, team reply (with
 * delivery ticks) or internal note. Media loads only when an admin asks for
 * it, through the admin-only proxy, so nothing is downloaded by default.
 */
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
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

export const DeliveryTicks = ({ status, className = '' }: { status?: DeliveryStatus | null; className?: string }) => {
  if (!status) return null;
  const common = `h-3.5 w-3.5 flex-none ${className}`;
  if (status === 'failed') return <AlertCircle className={`${common} text-red-600 dark:text-red-400`} aria-label="Not delivered" />;
  if (status === 'read') return <CheckCheck className={`${common} text-[#53bdeb]`} aria-label="Read" />;
  if (status === 'delivered') return <CheckCheck className={`${common} text-[#667781] dark:text-[#8696a0]`} aria-label="Delivered" />;
  if (status === 'sent') return <Check className={`${common} text-[#667781] dark:text-[#8696a0]`} aria-label="Sent" />;
  return <Clock className={`${common} text-[#667781] dark:text-[#8696a0]`} aria-label="Sending" />;
};

const MEDIA_META: Record<string, { label: string; Icon: typeof ImageIcon }> = {
  image: { label: 'Photo', Icon: ImageIcon },
  sticker: { label: 'Sticker', Icon: Sticker },
  video: { label: 'Video', Icon: Film },
  audio: { label: 'Audio', Icon: Mic },
  document: { label: 'Document', Icon: FileText },
};

const MediaBlock = ({ m, demo }: { m: ThreadMessage; demo: boolean }) => {
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
    return <img src={url} alt={m.media?.caption || label} className={`mb-1 rounded-md ${type === 'sticker' ? 'h-32 w-32 object-contain' : 'max-h-80 w-full object-cover'}`} />;
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

const LocationBlock = ({ m }: { m: ThreadMessage }) => {
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

export const MessageBubble = ({ m, demo = false }: { m: ThreadMessage; demo?: boolean }) => {
  if (m.direction === 'note') {
    return (
      <li className="flex justify-center px-1">
        <div className="w-full max-w-[92%] rounded-lg border border-[#f5d76e]/70 bg-[#fff6d6] px-3 py-2 text-[13.5px] text-[#4a3b00] shadow-[0_1px_0.5px_rgba(11,20,26,0.08)] dark:border-[#8a7420]/50 dark:bg-[#3a3418] dark:text-[#f3e6b0] md:max-w-[72%]">
          <p className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-[#7a6200] dark:text-[#d9c46e]">
            <Lock className="h-3 w-3" aria-hidden /> Internal note · only your team sees this
          </p>
          <p className="whitespace-pre-wrap break-words">{m.text}</p>
          <p className="mt-0.5 text-right text-[11px] text-[#7a6200]/80 dark:text-[#d9c46e]/80">
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

  return (
    <li className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[86%] md:max-w-[65%]">
        <div
          className={`rounded-lg px-2.5 pb-1.5 pt-1.5 text-[14.2px] leading-[1.38] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
            outbound
              ? 'rounded-tr-none bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]'
              : 'rounded-tl-none bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]'
          }`}
        >
          {isTemplate && (
            <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-[#667781] dark:text-[#aebac1]">
              <LayoutTemplate className="h-3 w-3" aria-hidden /> Template · {m.template?.name}
            </p>
          )}
          {isMedia && <MediaBlock m={m} demo={demo} />}
          {m.type === 'location' && m.location && <LocationBlock m={m} />}
          {m.type === 'contacts' && (
            <p className="mb-1 flex items-center gap-1.5 text-[13px]">
              <UserRound className="h-4 w-4" aria-hidden /> Shared a contact
            </p>
          )}
          {showText && m.type !== 'location' && <p className="whitespace-pre-wrap break-words">{formatWhatsAppText(m.text || '')}</p>}
          {isTemplate && !showText && m.template?.params?.length ? (
            <ol className="list-decimal pl-4 text-[13px]">
              {m.template.params.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ol>
          ) : null}
          {!showText && !isMedia && !isTemplate && m.type !== 'location' && m.type !== 'contacts' && (
            <p className="italic text-[#667781] dark:text-[#8696a0]">Empty message</p>
          )}
          <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[#667781] dark:text-[#8696a0]">
            {outbound && m.actorEmail ? <span className="mr-1 hidden truncate sm:inline">{m.actorName || m.actorEmail}</span> : null}
            {formatBubbleTime(m.createdAt)}
            {/* Messages sent before status tracking have no status: Meta accepted them. */}
            {outbound && <DeliveryTicks status={m.status || (m.providerMessageId ? 'sent' : 'accepted')} />}
          </p>
        </div>
        {outbound && m.status === 'failed' && (
          <p className="mt-1 flex items-start justify-end gap-1 text-right text-[11.5px] text-red-700 dark:text-red-300" role="status">
            <AlertCircle className="mt-[2px] h-3 w-3 flex-none" aria-hidden />
            {describeSendError(m.error)}
          </p>
        )}
      </div>
    </li>
  );
};

export default MessageBubble;
