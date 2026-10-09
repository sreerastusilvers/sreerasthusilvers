/**
 * Dealer Chats: staff talk to manufacturers on WhatsApp under a display name.
 *
 * Staff never see a manufacturer's number or real name (they live in the
 * owner-only `dealerPrivate`); they send a dealer id and the server looks the
 * number up. A conversation starts with a ticket: the manufacturer gets the
 * approved template asking them to reply, and their reply opens WhatsApp's
 * 24-hour window, inside which staff chat freely (text, photos, documents).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, ClipboardList, FileText, Hourglass, Loader2, Lock, Paperclip, Plus, RotateCcw, Ticket, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { describeError } from '@/lib/errorMessage';
import { WhatsAppApiError, whatsappAdminApi } from '@/services/whatsappAdminApi';
import { ATTACH_ACCEPT, fileToBase64, prepareAttachment } from '@/components/admin/whatsapp/waMedia';
import { MediaBlock, LocationBlock } from '@/components/admin/whatsapp/MessageBubble';
import { formatWhatsAppText } from '@/components/admin/whatsapp/WhatsAppPreviewBubble';
import { describeSendError, formatCountdown, millisLeft, type ThreadMessage } from '@/components/admin/whatsapp/inboxModel';
import {
  setTicketStatus,
  subscribeDealerMessages,
  subscribeDealerPrivate,
  subscribeDealerTickets,
  subscribeDealers,
  type Dealer,
  type DealerMessage,
  type DealerPrivate,
  type DealerTicket,
} from '@/services/dealerService';
import {
  WaApp,
  WaAvatar,
  WaBubble,
  WaChatHeader,
  WaChatRow,
  WaChips,
  WaComposerBar,
  WaDayChip,
  WaEmpty,
  WaFab,
  WaIconButton,
  WaListHeader,
  WaMessages,
  WaSearch,
  WaSendButton,
  WaSystemNote,
  WaTag,
  WaTextarea,
  WaTicks,
  waGroup,
  waListTime,
  waTime,
} from '@/components/wa/WaKit';
import { WaEmojiPicker } from '@/components/wa/WaEmojiPicker';

type Filter = 'all' | 'unread' | 'open' | 'waiting';

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(i);
  }, [ms]);
  return now;
}

const FactoryAvatar = ({ size = 49 }: { size?: number }) => (
  <WaAvatar
    size={size}
    icon={
      <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} aria-hidden fill="currentColor">
        <path d="M2 21V9l6 3.5V9l6 3.5V5h3l1 6h2l2 10H2zm5-3h2v-2H7v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2z" />
      </svg>
    }
  />
);

export default function AdminDealerChats() {
  const { user, userProfile, isAdmin } = useAuth();
  const me = { uid: user?.uid || '', name: userProfile?.username || user?.email || 'Team' };
  const [params, setParams] = useSearchParams();
  const [dealers, setDealers] = useState<Dealer[] | null>(null);
  const [error, setError] = useState('');
  const [tickets, setTickets] = useState<DealerTicket[]>([]);
  const [priv, setPriv] = useState<Record<string, DealerPrivate>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [newTicketFor, setNewTicketFor] = useState<string | null | undefined>(undefined);
  const now = useNow();
  const activeId = params.get('dealer');
  const setActiveId = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('dealer', id);
    else next.delete('dealer');
    setParams(next, { replace: true });
  };

  useEffect(
    () =>
      subscribeDealers(
        (d) => setDealers(d.filter((x) => x.active !== false || isAdmin)),
        (e) => {
          setError(describeError(e));
          setDealers([]);
        },
      ),
    [isAdmin],
  );
  useEffect(() => subscribeDealerTickets(null, setTickets, () => setTickets([])), []);
  // The owner also sees real names here; staff never load them (and couldn't).
  useEffect(() => (isAdmin ? subscribeDealerPrivate(setPriv) : undefined), [isAdmin]);

  const openByDealer = useMemo(() => {
    const m: Record<string, number> = {};
    tickets.forEach((t) => {
      if (t.status === 'open') m[t.dealerId] = (m[t.dealerId] || 0) + 1;
    });
    return m;
  }, [tickets]);

  const list = dealers || [];
  const counts: Record<Filter, number> = {
    all: list.length,
    unread: list.filter((d) => (d.unreadCount || 0) > 0).length,
    open: list.filter((d) => openByDealer[d.id]).length,
    waiting: list.filter((d) => d.awaitingReply).length,
  };
  const visible = list.filter((d) => {
    if (filter === 'unread' && !(d.unreadCount || 0)) return false;
    if (filter === 'open' && !openByDealer[d.id]) return false;
    if (filter === 'waiting' && !d.awaitingReply) return false;
    const q = search.trim().toLowerCase();
    return !q || `${d.displayName} ${d.note || ''} ${priv[d.id]?.originalName || ''}`.toLowerCase().includes(q);
  });
  const active = list.find((d) => d.id === activeId) || null;

  const listPane = (
    <>
      <WaListHeader
        title="Dealer chats"
        subtitle={`${counts.unread ? `${counts.unread} unread · ` : ''}${tickets.filter((t) => t.status === 'open').length} open tickets`}
        actions={
          <WaIconButton label="New ticket" onClick={() => setNewTicketFor(null)} className="hidden md:inline-flex">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12.5V18a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h5.5" />
              <path d="M17.5 3.5v6M14.5 6.5h6" />
            </svg>
          </WaIconButton>
        }
      />
      <div className="flex-none space-y-3 px-4 pb-2">
        <WaSearch value={search} onChange={setSearch} placeholder="Search manufacturers" />
        <WaChips<Filter>
          label="Filter dealer chats"
          value={filter}
          onChange={setFilter}
          items={[
            { id: 'all', label: 'All' },
            { id: 'unread', label: 'Unread', count: counts.unread },
            { id: 'open', label: 'Open tickets', count: counts.open },
            { id: 'waiting', label: 'Waiting for reply', count: counts.waiting },
          ]}
        />
      </div>
      {dealers === null ? (
        <div className="grid flex-1 place-items-center text-sm text-[var(--wa-muted)]">
          <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…</span>
        </div>
      ) : error ? (
        <p className="px-6 py-10 text-center text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : list.length === 0 ? (
        <div className="grid flex-1 place-items-center px-8 text-center">
          <div className="space-y-1.5">
            <p className="text-[15px] text-[var(--wa-text)]">No manufacturers yet</p>
            <p className="text-[13px] text-[var(--wa-muted)]">
              {isAdmin ? 'Add them in Manufacturers. Staff will see only the display name.' : 'Ask the owner to add manufacturers.'}
            </p>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <p className="px-8 py-10 text-center text-[13px] text-[var(--wa-muted)]">Nothing matches.</p>
      ) : (
        <ul className="wa-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24 md:pb-0">
          {visible.map((d) => {
            const open = openByDealer[d.id] || 0;
            return (
              <WaChatRow
                key={d.id}
                title={d.displayName}
                time={waListTime(d.lastAt, now)}
                unread={d.unreadCount || 0}
                active={d.id === activeId}
                avatar={<FactoryAvatar />}
                onOpen={() => setActiveId(d.id)}
                preview={
                  <>
                    {d.lastDirection === 'outbound' && <WaTicks status={d.lastStatus || 'sent'} className="flex-none text-[var(--wa-muted)]" />}
                    <span className="truncate">{d.lastMessage || d.note || 'No messages yet'}</span>
                  </>
                }
                tags={
                  open || d.awaitingReply || (isAdmin && priv[d.id]) ? (
                    <>
                      {open > 0 && <WaTag tone="blue"><Ticket className="h-3 w-3" aria-hidden /> {open} open</WaTag>}
                      {d.awaitingReply && <WaTag tone="amber"><Hourglass className="h-3 w-3" aria-hidden /> Waiting for reply</WaTag>}
                      {isAdmin && priv[d.id] && <WaTag><Lock className="h-3 w-3" aria-hidden /> {priv[d.id].originalName}</WaTag>}
                    </>
                  ) : null
                }
              />
            );
          })}
        </ul>
      )}
      <WaFab label="New ticket" onClick={() => setNewTicketFor(null)}>
        <Plus className="h-6 w-6" aria-hidden />
      </WaFab>
    </>
  );

  return (
    <>
      <WaApp
        list={listPane}
        onCloseChat={() => setActiveId(null)}
        empty={
          <WaEmpty
            title="Dealer chats"
            text="Raise a ticket to a manufacturer and chat with them here. They get the message from the store's WhatsApp number; their number and real name stay private to the owner."
            footer={
              <>
                <Lock className="h-3.5 w-3.5" aria-hidden /> Manufacturer numbers are never shown to staff
              </>
            }
          />
        }
        chat={
          active ? (
            <DealerConversation
              key={active.id}
              dealer={active}
              priv={isAdmin ? priv[active.id] : undefined}
              tickets={tickets.filter((t) => t.dealerId === active.id)}
              now={now}
              me={me}
              onBack={() => setActiveId(null)}
              onNewTicket={() => setNewTicketFor(active.id)}
            />
          ) : null
        }
      />
      <NewTicketDialog
        open={newTicketFor !== undefined}
        dealerId={newTicketFor ?? null}
        dealers={list.filter((d) => d.active !== false)}
        onClose={() => setNewTicketFor(undefined)}
        onCreated={(dealerId) => {
          setNewTicketFor(undefined);
          setActiveId(dealerId);
        }}
      />
    </>
  );
}

// ===========================================================================
function DealerConversation({
  dealer,
  priv,
  tickets,
  now,
  me,
  onBack,
  onNewTicket,
}: {
  dealer: Dealer;
  priv?: DealerPrivate;
  tickets: DealerTicket[];
  now: number;
  me: { uid: string; name: string };
  onBack: () => void;
  onNewTicket: () => void;
}) {
  const [messages, setMessages] = useState<DealerMessage[] | null>(null);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  useEffect(() => subscribeDealerMessages(dealer.id, setMessages, () => setMessages([])), [dealer.id]);

  // Opening the chat marks it read (and sends blue ticks to the manufacturer).
  useEffect(() => {
    if (!dealer.unreadCount || document.visibilityState !== 'visible') return;
    whatsappAdminApi.dealerMarkRead(dealer.id).catch(() => {});
  }, [dealer.id, dealer.unreadCount]);

  const remaining = millisLeft(dealer.replyWindowClosesAt, now);
  const windowOpen = remaining > 0;
  const openTickets = tickets.filter((t) => t.status === 'open');
  const days = useMemo(() => waGroup(messages || []), [messages]);

  const subtitle = windowOpen
    ? `Replied · you can chat for ${formatCountdown(remaining)}`
    : dealer.awaitingReply
      ? 'Waiting for them to reply'
      : dealer.note || 'Raise a ticket to start';

  return (
    <>
      <WaChatHeader
        title={dealer.displayName}
        avatar={<FactoryAvatar size={40} />}
        onBack={onBack}
        subtitle={
          <span>
            {subtitle}
            {priv && (
              <span className="ml-1 inline-flex items-center gap-1 text-[var(--wa-text-2)]">
                · <Lock className="h-3 w-3" aria-label="Only you see this" /> {priv.originalName} {priv.phone}
              </span>
            )}
          </span>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setTicketsOpen(true)}
              className="inline-flex h-9 flex-none items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-[var(--wa-icon)] hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wa-teal)] dark:hover:bg-white/10"
              aria-label={`Tickets: ${openTickets.length} open`}
            >
              <ClipboardList className="h-5 w-5" aria-hidden />
              <span className="tabular-nums">{openTickets.length}</span>
            </button>
            <WaIconButton label="New ticket" onClick={onNewTicket}>
              <Plus className="h-5 w-5" aria-hidden />
            </WaIconButton>
          </>
        }
      />

      <WaMessages label={`Messages with ${dealer.displayName}`} resetKey={`${dealer.id}:${messages === null}`} count={messages?.length || 0}>
        <WaSystemNote icon={<Lock className="mt-[3px] h-3 w-3 flex-none" aria-hidden />}>
          Messages go from Sreerasthu Silvers' WhatsApp. The manufacturer's number stays private to the owner.
        </WaSystemNote>
        {messages === null ? (
          <div className="grid h-32 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--wa-muted)]" aria-label="Loading messages" /></div>
        ) : messages.length === 0 ? (
          <WaSystemNote>No messages yet. Raise a ticket to start the conversation.</WaSystemNote>
        ) : (
          days.map((d) => (
            <section key={d.label} aria-label={d.label}>
              <WaDayChip>{d.label}</WaDayChip>
              <ul>
                {d.items.map(({ m, tail }) => (
                  <DealerBubble key={m.id} m={m} tail={tail} ticket={tickets.find((t) => t.id === m.ticketId)} />
                ))}
              </ul>
            </section>
          ))
        )}
      </WaMessages>

      {windowOpen ? (
        <DealerComposer dealer={dealer} openTickets={openTickets} />
      ) : (
        <div className="flex-none bg-[var(--wa-header-m)] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 text-center shadow-[0_-1px_0_var(--wa-divider)] md:bg-[var(--wa-header)] md:shadow-none">
          <p className="text-[14px] text-[var(--wa-muted)]">
            {dealer.awaitingReply
              ? `Waiting for ${dealer.displayName} to reply to ${dealer.lastTicketNumber || 'the ticket'}. You can chat as soon as they reply.`
              : `To message ${dealer.displayName}, raise a ticket. They'll get it on WhatsApp and you can chat once they reply.`}
          </p>
          <button
            type="button"
            onClick={onNewTicket}
            className="mt-2 inline-flex h-10 items-center gap-2 rounded-full bg-[var(--wa-green)] px-5 text-[14px] font-medium text-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--wa-teal)] dark:text-[#111b21]"
          >
            <Ticket className="h-4 w-4" aria-hidden /> {dealer.awaitingReply ? 'Raise another ticket' : 'Raise a ticket'}
          </button>
        </div>
      )}

      <TicketsSheet open={ticketsOpen} onOpenChange={setTicketsOpen} dealer={dealer} tickets={tickets} me={me} onNewTicket={onNewTicket} />
    </>
  );
}

function DealerBubble({ m, tail, ticket }: { m: DealerMessage; tail: boolean; ticket?: DealerTicket }) {
  const out = m.direction === 'outbound';
  const isMedia = !!m.media && ['image', 'sticker', 'video', 'audio', 'document'].includes(m.type || '');
  const opening = out && ticket && m.id === ticket.openingMessageId;
  const asThread = m as unknown as ThreadMessage;
  return (
    <WaBubble
      out={out}
      tail={tail}
      time={waTime(m.createdAt)}
      status={out ? m.status || (m.providerMessageId ? 'sent' : 'accepted') : undefined}
      header={
        opening ? (
          <p className="mb-1 flex items-center gap-1 text-[12px] font-medium leading-[18px] text-[var(--wa-teal)]">
            <Ticket className="h-3 w-3" aria-hidden /> {m.ticketNumber} · {ticket?.subject}
            {m.sentByName ? <span className="font-normal text-[var(--wa-meta)]"> · {m.sentByName}</span> : null}
          </p>
        ) : out && m.sentByName ? (
          <p className="mb-0.5 text-[12px] font-medium leading-[18px] text-[var(--wa-teal)]">
            {m.sentByName}
            {m.ticketNumber ? <span className="font-normal text-[var(--wa-meta)]"> · {m.ticketNumber}</span> : null}
          </p>
        ) : !out && m.ticketNumber ? (
          <p className="mb-0.5 text-[12px] font-medium leading-[18px] text-[#a06a00] dark:text-[#f0d27a]">Re: {m.ticketNumber}</p>
        ) : null
      }
      media={isMedia ? <MediaBlock m={asThread} demo={false} /> : m.type === 'location' && m.location ? <LocationBlock m={asThread} /> : null}
      footer={
        out && m.status === 'failed' ? (
          <p className="mt-1 text-right text-[11.5px] text-red-700 dark:text-red-300" role="status">{describeSendError(m.error)}</p>
        ) : null
      }
    >
      {m.text ? formatWhatsAppText(m.text) : !isMedia && m.type !== 'location' ? <span className="italic text-[var(--wa-muted)]">{m.type === 'contacts' ? 'Shared a contact' : 'Message'}</span> : null}
    </WaBubble>
  );
}

// ===========================================================================
function DealerComposer({ dealer, openTickets }: { dealer: Dealer; openTickets: DealerTicket[] }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [ticketId, setTicketId] = useState<string>(dealer.lastTicketId || openTickets[0]?.id || '');
  const [attachment, setAttachment] = useState<{ file: File; kind: 'image' | 'document'; previewUrl: string | null } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
  }, [attachment]);

  const attach = async (file?: File) => {
    if (!file) return;
    setPreparing(true);
    try {
      const ready = await prepareAttachment(file);
      setAttachment({ ...ready, previewUrl: ready.kind === 'image' ? URL.createObjectURL(ready.file) : null });
      requestAnimationFrame(() => taRef.current?.focus());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not attach that file.');
    } finally {
      setPreparing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const submit = async () => {
    if (sending) return;
    const body = text.trim();
    if (!attachment && !body) return;
    setSending(true);
    try {
      if (attachment) {
        await whatsappAdminApi.dealerSendMedia({
          dealerId: dealer.id,
          media: { mime: attachment.file.type, filename: attachment.file.name, data: await fileToBase64(attachment.file) },
          caption: body || undefined,
          ticketId: ticketId || undefined,
        });
        setAttachment(null);
      } else {
        await whatsappAdminApi.dealerSend({ dealerId: dealer.id, text: body, ticketId: ticketId || undefined });
      }
      setText('');
      taRef.current?.focus();
    } catch (err) {
      toast.error(err instanceof WhatsAppApiError ? err.message : describeError(err));
    } finally {
      setSending(false);
    }
  };

  const insertEmoji = (e: string) => {
    const ta = taRef.current;
    const s = ta?.selectionStart ?? text.length;
    const en = ta?.selectionEnd ?? text.length;
    setText(text.slice(0, s) + e + text.slice(en));
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(s + e.length, s + e.length);
    });
  };

  return (
    <WaComposerBar
      above={
        <>
          {openTickets.length > 0 && (
            <label className="mb-1.5 flex items-center gap-2 px-1 text-[12.5px] text-[var(--wa-muted)] md:px-0">
              <Ticket className="h-3.5 w-3.5 flex-none" aria-hidden />
              <span className="flex-none">About</span>
              <select
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                className="h-8 min-w-0 flex-1 truncate rounded-full border-0 bg-[var(--wa-input-m)] px-3 text-[13px] text-[var(--wa-text)] shadow-[var(--wa-shadow)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wa-teal)] md:max-w-sm md:bg-[var(--wa-bg)] md:shadow-none"
                aria-label="Which ticket this message is about"
              >
                <option value="">No ticket</option>
                {openTickets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.number} · {t.subject}
                  </option>
                ))}
              </select>
            </label>
          )}
          {attachment && (
            <div className="mb-2 flex items-center gap-3 rounded-lg bg-[var(--wa-input-m)] p-2 pr-1 shadow-[var(--wa-shadow)] md:bg-[var(--wa-input)]">
              {attachment.previewUrl ? (
                <img src={attachment.previewUrl} alt="" className="h-12 w-12 flex-none rounded object-cover" />
              ) : (
                <span className="grid h-12 w-12 flex-none place-items-center rounded bg-[var(--wa-search)] text-[var(--wa-icon)]"><FileText className="h-5 w-5" aria-hidden /></span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-[var(--wa-text)]">{attachment.kind === 'image' ? 'Photo' : attachment.file.name}</span>
                <span className="block text-[11px] text-[var(--wa-muted)]">Your text is sent as the caption</span>
              </span>
              <WaIconButton label="Remove attachment" onClick={() => setAttachment(null)}><X className="h-4 w-4" aria-hidden /></WaIconButton>
            </div>
          )}
        </>
      }
      left={
        <>
          <WaEmojiPicker onPick={insertEmoji} />
          <input ref={fileRef} type="file" accept={ATTACH_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => attach(e.target.files?.[0])} />
          <WaIconButton label="Attach a photo or document (up to 3 MB)" onClick={() => fileRef.current?.click()} disabled={preparing || sending} className="mb-1 md:mb-0">
            {preparing ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Paperclip className="h-5 w-5 -rotate-45" aria-hidden />}
          </WaIconButton>
        </>
      }
      input={
        <>
          <label htmlFor="dealer-composer" className="sr-only">Message</label>
          <WaTextarea
            id="dealer-composer"
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onSubmit={submit}
            onPaste={(e) => {
              const file = Array.from(e.clipboardData.files)[0];
              if (file) {
                e.preventDefault();
                attach(file);
              }
            }}
            maxLength={attachment ? 1024 : 4096}
            placeholder={attachment ? 'Add a caption (optional)' : 'Type a message'}
          />
        </>
      }
      send={<WaSendButton onClick={submit} busy={sending} disabled={attachment ? preparing : !text.trim()} label={attachment ? 'Send attachment' : 'Send'} />}
    />
  );
}

// ===========================================================================
function TicketsSheet({
  open,
  onOpenChange,
  dealer,
  tickets,
  me,
  onNewTicket,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dealer: Dealer;
  tickets: DealerTicket[];
  me: { uid: string; name: string };
  onNewTicket: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const toggle = async (t: DealerTicket) => {
    setBusy(t.id);
    try {
      await setTicketStatus(t.id, t.status === 'open' ? 'closed' : 'open', me);
      toast.success(t.status === 'open' ? `${t.number} closed` : `${t.number} reopened`);
    } catch (e) {
      toast.error('Could not update the ticket', { description: describeError(e) });
    } finally {
      setBusy(null);
    }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Tickets with {dealer.displayName}</SheetTitle>
          <SheetDescription>Close a ticket when the requirement is sorted.</SheetDescription>
        </SheetHeader>
        <Button className="mt-4 w-full gap-2" onClick={() => { onOpenChange(false); onNewTicket(); }}>
          <Plus className="h-4 w-4" /> New ticket
        </Button>
        {tickets.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">No tickets yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {tickets.map((t) => (
              <li key={t.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {t.number} <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${t.status === 'open' ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300' : 'bg-muted text-muted-foreground'}`}>{t.status === 'open' ? 'Open' : 'Closed'}</span>
                    </p>
                    <p className="mt-0.5 text-sm">{t.subject}</p>
                    {t.details && <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">{t.details}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      By {t.createdByName || 'team'}
                      {t.createdAt ? ` · ${t.createdAt.toDate().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}
                      {t.lastDealerReplyAt ? ' · replied' : ''}
                      {t.status === 'closed' && t.closedByName ? ` · closed by ${t.closedByName}` : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toggle(t)} disabled={busy === t.id}>
                    {busy === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.status === 'open' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    {t.status === 'open' ? 'Close' : 'Reopen'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ===========================================================================
function NewTicketDialog({
  open,
  dealerId,
  dealers,
  onClose,
  onCreated,
}: {
  open: boolean;
  dealerId: string | null;
  dealers: Dealer[];
  onClose: () => void;
  onCreated: (dealerId: string) => void;
}) {
  const [pick, setPick] = useState('');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) {
      setPick(dealerId || '');
      setSubject('');
      setDetails('');
      setError('');
    }
  }, [open, dealerId]);

  const dealer = dealers.find((d) => d.id === pick);
  const windowOpen = dealer ? millisLeft(dealer.replyWindowClosesAt, Date.now()) > 0 : false;

  const submit = async () => {
    if (!pick || !subject.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const r = await whatsappAdminApi.dealerTicket({ dealerId: pick, subject: subject.trim(), details: details.trim() || undefined });
      toast.success(`Ticket ${r.number} sent to ${dealer?.displayName || 'the manufacturer'}`, {
        description: r.via === 'template' ? 'You can chat as soon as they reply.' : 'They can reply right away.',
      });
      onCreated(pick);
    } catch (err) {
      setError(err instanceof WhatsAppApiError ? err.message : describeError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !sending && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New ticket</DialogTitle>
          <DialogDescription>
            The manufacturer gets this on WhatsApp from the store's number. You can send photos once they reply.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div>
            <Label htmlFor="t-dealer">Manufacturer</Label>
            <select
              id="t-dealer"
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Choose…</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.displayName}
                  {d.note ? ` (${d.note})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="t-subject">What do you need?</Label>
            <Input id="t-subject" value={subject} maxLength={120} onChange={(e) => setSubject(e.target.value)} placeholder="Silver anklets, 2 pairs, about 40 g each" />
            <p className="mt-1 text-xs text-muted-foreground">One line. It's in the WhatsApp message the manufacturer sees.</p>
          </div>
          <div>
            <Label htmlFor="t-details">More details (optional)</Label>
            <Textarea id="t-details" rows={4} maxLength={1500} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Size, design, colour, when the customer needs it…" />
          </div>
          {dealer && (
            <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              {windowOpen
                ? `${dealer.displayName} wrote in the last 24 hours, so this goes as a normal message and you can keep chatting.`
                : `${dealer.displayName} gets the store's request message and is asked to reply. You can chat as soon as they do.`}
            </p>
          )}
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
            <Button type="submit" disabled={!pick || !subject.trim() || sending} className="gap-2 bg-[#008069] hover:bg-[#017561] text-white">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />} Send ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
