/**
 * Admin WhatsApp team inbox, laid out like WhatsApp Web on a computer and the
 * WhatsApp app on a phone (see src/components/wa/WaKit.tsx).
 *
 * - Threads from `whatsappThreads` (filled by /api/whatsapp-webhook), with
 *   filters (All / Unread / Open / Resolved / Assigned to me) and search.
 * - Conversation timeline with delivery ticks, media on demand, locations
 *   and internal notes (stored as `direction: 'note'`, never sent).
 * - Assign to any admin, mark open / resolved, quick-reply snippets
 *   (`whatsappSnippets`).
 * - Composer respects Meta's 24-hour window: free-form text inside it,
 *   approved templates outside it (switches automatically when it closes).
 *
 * Sending, read receipts and media go through /api/whatsapp-reply with the
 * signed-in admin's Firebase token. DEV only: add ?demo=1 for sample data.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileText,
  LayoutTemplate,
  Loader2,
  Lock,
  MoreVertical,
  Paperclip,
  RotateCcw,
  Send,
  StickyNote,
  Trash2,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import MessageBubble, { DeliveryTicks } from '@/components/admin/whatsapp/MessageBubble';
import { SetupStatusButton, SetupStatusDialog, useWhatsAppSetupStatus } from '@/components/admin/whatsapp/SetupStatus';
import { useInboxData, type Actor } from '@/components/admin/whatsapp/useInboxData';
import { isSendableTemplate, statusStyle } from '@/components/admin/whatsapp/templateRules';
import { ATTACH_ACCEPT, prepareAttachment } from '@/components/admin/whatsapp/waMedia';
import {
  FILTERS,
  formatCountdown,
  maskPhone,
  matchesFilter,
  matchesSearch,
  millisLeft,
  renderTemplate,
  threadStatus,
  type Snippet,
  type TeamMember,
  type TemplateMeta,
  type Thread,
  type ThreadFilter,
  type ThreadMessage,
} from '@/components/admin/whatsapp/inboxModel';
import {
  WaApp,
  WaChatHeader,
  WaChatRow,
  WaChips,
  WaComposerBar,
  WaDayChip,
  WaEmpty,
  WaIconButton,
  WaListHeader,
  WaMessages,
  WaSearch,
  WaSendButton,
  WaSystemNote,
  WaTag,
  WaTextarea,
  waGroup,
  waListTime,
} from '@/components/wa/WaKit';
import { WaEmojiPicker } from '@/components/wa/WaEmojiPicker';

const iconBtn =
  'inline-flex h-10 w-10 flex-none items-center justify-center rounded-full text-[var(--wa-icon)] transition-colors duration-150 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wa-teal)] dark:hover:bg-white/10';

/** Re-render every 30 s so window countdowns stay current. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  return now;
}

const AdminWhatsApp = () => {
  const { user, userProfile } = useAuth();
  const actor: Actor = useMemo(
    () => ({
      uid: user?.uid || null,
      name: String((userProfile as { fullName?: string; username?: string } | null)?.fullName || userProfile?.username || userProfile?.email || user?.email || 'Admin'),
      email: userProfile?.email || user?.email || null,
    }),
    [user, userProfile],
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ThreadFilter>('all');
  const [search, setSearch] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const data = useInboxData(actor, activeId);
  const setup = useWhatsAppSetupStatus(data.demo);
  const now = useNow();

  const activeThread = useMemo(() => data.threads.find((t) => t.id === activeId) || null, [data.threads, activeId]);

  // Mark as read while the conversation is on screen.
  useEffect(() => {
    if (!activeThread || !activeThread.unreadCount) return;
    if (document.visibilityState !== 'visible') return;
    data.actions.markRead(activeThread);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThread?.id, activeThread?.unreadCount]);

  const counts = useMemo(() => {
    const c = {} as Record<ThreadFilter, number>;
    FILTERS.forEach((f) => {
      c[f.id] = data.threads.filter((t) => matchesFilter(t, f.id, actor.uid)).length;
    });
    return c;
  }, [data.threads, actor.uid]);
  const visible = useMemo(
    () => data.threads.filter((t) => matchesFilter(t, filter, actor.uid) && matchesSearch(t, search)),
    [data.threads, filter, search, actor.uid],
  );
  const totalUnread = data.threads.reduce((n, t) => n + ((t.unreadCount || 0) > 0 ? 1 : 0), 0);

  const list = (
    <>
      <WaListHeader
        title="Chats"
        subtitle={`${data.demo ? 'Demo data · ' : ''}Customer WhatsApp${totalUnread ? ` · ${totalUnread} unread` : ''}`}
        actions={<SetupStatusButton missing={setup.missing.length} onClick={() => setSetupOpen(true)} />}
      />

      {setup.missing.length > 0 && (
        <button
          type="button"
          onClick={() => setSetupOpen(true)}
          className="mx-3 mb-2 flex flex-none items-center gap-2 rounded-lg bg-[#fff3cd] px-3 py-2.5 text-left text-[13px] text-[#5c4400] transition-colors duration-150 hover:brightness-95 dark:bg-[#3d3216] dark:text-[#f0d27a]"
        >
          <AlertTriangle className="h-4 w-4 flex-none" aria-hidden />
          <span className="flex-1">
            Setup incomplete: {setup.missing.length} item{setup.missing.length === 1 ? '' : 's'} missing.
          </span>
          <span className="font-medium underline underline-offset-2">View</span>
        </button>
      )}

      <div className="flex-none space-y-3 px-4 pb-2">
        <WaSearch value={search} onChange={setSearch} placeholder="Search name or number" />
        <WaChips<ThreadFilter>
          label="Filter conversations"
          value={filter}
          onChange={setFilter}
          items={FILTERS.map((f) => ({ id: f.id, label: f.label, count: f.id !== 'all' ? counts[f.id] : 0 }))}
        />
      </div>

      {data.loadingThreads ? (
        <div className="grid flex-1 place-items-center text-sm text-[var(--wa-muted)]">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading chats…
          </span>
        </div>
      ) : data.threadsError ? (
        <div className="grid flex-1 place-items-center px-6 text-center text-sm text-red-700 dark:text-red-300">{data.threadsError}</div>
      ) : data.threads.length === 0 ? (
        <div className="grid flex-1 place-items-center px-8 text-center">
          <div className="space-y-2">
            <p className="text-[15px] text-[var(--wa-text)]">No chats yet</p>
            <p className="text-[13px] text-[var(--wa-muted)]">When a customer messages your WhatsApp business number, it appears here.</p>
            <button type="button" onClick={() => setSetupOpen(true)} className="text-[13px] font-medium text-[var(--wa-teal)] underline underline-offset-2">
              Check WhatsApp setup
            </button>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="grid flex-1 place-items-center px-8 text-center text-[13px] text-[var(--wa-muted)]">
          <div className="space-y-3">
            <p>No chats match {search ? `"${search}"` : 'this filter'}.</p>
            {data.hasMoreThreads && <LoadMoreThreads loading={data.loadingMoreThreads} onClick={data.loadMoreThreads} label="Search older chats" />}
          </div>
        </div>
      ) : (
        <ul className="wa-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {visible.map((t) => (
            <ThreadRow key={t.id} t={t} active={t.id === activeId} now={now} myUid={actor.uid} onOpen={() => setActiveId(t.id)} />
          ))}
          {data.hasMoreThreads && (
            <li className="flex justify-center px-4 py-3">
              <LoadMoreThreads loading={data.loadingMoreThreads} onClick={data.loadMoreThreads} label="Load older chats" />
            </li>
          )}
        </ul>
      )}
    </>
  );

  return (
    <>
      <WaApp
        list={list}
        onCloseChat={() => setActiveId(null)}
        empty={
          <WaEmpty
            title="Sreerasthu Silvers WhatsApp"
            text="Reply to customers from the store's WhatsApp number. Internal notes and quick replies stay inside your team."
            footer={
              <>
                <Lock className="h-3.5 w-3.5" aria-hidden /> Messages go out from your WhatsApp Business number
              </>
            }
          />
        }
        chat={
          activeThread ? (
            <Conversation
              key={activeThread.id}
              thread={activeThread}
              messages={data.messages}
              loading={data.loadingMessages}
              templates={data.templates}
              team={data.team}
              snippets={data.snippets}
              actor={actor}
              now={now}
              demo={data.demo}
              actions={data.actions}
              onBack={() => setActiveId(null)}
            />
          ) : null
        }
      />
      <SetupStatusDialog open={setupOpen} onOpenChange={setSetupOpen} status={setup} />
    </>
  );
};

export default AdminWhatsApp;

// ===========================================================================
const ThreadRow = ({ t, active, now, myUid, onOpen }: { t: Thread; active: boolean; now: number; myUid: string | null; onOpen: () => void }) => {
  const unread = t.unreadCount || 0;
  const ms = millisLeft(t.replyWindowClosesAt, now);
  const resolved = threadStatus(t) === 'resolved';
  const assignedName = t.assignedTo ? (t.assignedTo.uid === myUid ? 'You' : t.assignedTo.name) : null;
  const showTags = assignedName || resolved || ms <= 2 * 3600_000;
  return (
    <WaChatRow
      title={t.contactName || maskPhone(t.phone)}
      time={waListTime(t.updatedAt, now)}
      unread={unread}
      active={active}
      onOpen={onOpen}
      preview={
        <>
          {t.lastDirection === 'outbound' && <DeliveryTicks status={t.lastStatus || 'sent'} className="flex-none text-[var(--wa-muted)]" />}
          <span className="truncate">{t.lastMessage || 'No messages yet'}</span>
        </>
      }
      tags={
        showTags ? (
          <>
            {resolved && <WaTag tone="green">Resolved</WaTag>}
            {assignedName && <WaTag>{assignedName}</WaTag>}
            {!resolved && ms > 0 && ms <= 2 * 3600_000 && (
              <WaTag tone="amber">
                <Clock className="h-3 w-3" aria-hidden /> {formatCountdown(ms)} left
              </WaTag>
            )}
            {!resolved && ms <= 0 && <WaTag>Template only</WaTag>}
          </>
        ) : null
      }
    />
  );
};

// ===========================================================================
type Actions = ReturnType<typeof useInboxData>['actions'];

const Conversation = ({
  thread,
  messages,
  loading,
  templates,
  team,
  snippets,
  actor,
  now,
  demo,
  actions,
  onBack,
}: {
  thread: Thread;
  messages: ThreadMessage[];
  loading: boolean;
  templates: TemplateMeta[];
  team: TeamMember[];
  snippets: Snippet[];
  actor: Actor;
  now: number;
  demo: boolean;
  actions: Actions;
  onBack: () => void;
}) => {
  const [reveal, setReveal] = useState(false);
  const remainingMs = millisLeft(thread.replyWindowClosesAt, now);
  const windowOpen = remainingMs > 0;
  const resolved = threadStatus(thread) === 'resolved';

  const toggleResolved = async () => {
    try {
      await actions.setStatus(thread.id, resolved ? 'open' : 'resolved');
      toast.success(resolved ? 'Conversation reopened' : 'Marked as resolved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update the conversation');
    }
  };
  const assignTo = async (m: TeamMember | null) => {
    try {
      await actions.assign(thread.id, m);
      toast.success(m ? `Assigned to ${m.uid === actor.uid ? 'you' : m.name}` : 'Unassigned');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not assign');
    }
  };

  const days = useMemo(() => waGroup(messages), [messages]);
  const assignee = thread.assignedTo;

  return (
    <>
      <WaChatHeader
        title={thread.contactName || 'Unknown contact'}
        onBack={onBack}
        subtitle={
          <span className="flex items-center gap-1">
            <span className="truncate tabular-nums">{reveal ? thread.phone : maskPhone(thread.phone)}</span>
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="inline-flex h-6 w-6 flex-none items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
              aria-label={reveal ? 'Hide phone number' : 'Show phone number'}
              aria-pressed={reveal}
            >
              {reveal ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
            </button>
            <span aria-hidden>·</span>
            <span className={windowOpen ? '' : 'text-[#a06a00] dark:text-[#f0d27a]'}>
              {windowOpen ? `reply window ${formatCountdown(remainingMs)}` : 'template only'}
            </span>
          </span>
        }
        actions={
          <>
            <button
              type="button"
              onClick={toggleResolved}
              className={`hidden h-9 flex-none items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wa-teal)] md:inline-flex ${
                resolved
                  ? 'text-[var(--wa-icon)] hover:bg-black/5 dark:hover:bg-white/10'
                  : 'bg-[var(--wa-teal)] text-white hover:brightness-95 dark:text-[#111b21]'
              }`}
            >
              {resolved ? <RotateCcw className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
              {resolved ? 'Reopen' : 'Resolve'}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <WaIconButton label={assignee ? `Assigned to ${assignee.name}. Change` : 'Assign conversation'}>
                  <UserPlus className="h-5 w-5" aria-hidden />
                </WaIconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                {actor.uid && (
                  <DropdownMenuItem onSelect={() => assignTo({ uid: actor.uid!, name: actor.name, email: actor.email })}>
                    <span className="flex-1">Me</span>
                    {assignee?.uid === actor.uid && <Check className="h-4 w-4" aria-hidden />}
                  </DropdownMenuItem>
                )}
                {team
                  .filter((m) => m.uid !== actor.uid)
                  .map((m) => (
                    <DropdownMenuItem key={m.uid} onSelect={() => assignTo(m)}>
                      <span className="min-w-0 flex-1 truncate">{m.name}</span>
                      {assignee?.uid === m.uid && <Check className="h-4 w-4" aria-hidden />}
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={!assignee} onSelect={() => assignTo(null)}>
                  Unassign
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <WaIconButton label="More options" className="md:hidden">
                  <MoreVertical className="h-5 w-5" aria-hidden />
                </WaIconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={toggleResolved}>{resolved ? 'Reopen chat' : 'Mark as resolved'}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setReveal((r) => !r)}>{reveal ? 'Hide number' : 'Show number'}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <WaMessages label={`Messages with ${thread.contactName || 'customer'}`} resetKey={`${thread.id}:${loading}`} count={messages.length}>
        {loading ? (
          <div className="grid h-40 place-items-center text-sm text-[var(--wa-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading messages" />
          </div>
        ) : messages.length === 0 ? (
          <WaSystemNote>No messages in this chat yet.</WaSystemNote>
        ) : (
          days.map((d) => (
            <section key={d.label} aria-label={d.label}>
              <WaDayChip>{d.label}</WaDayChip>
              <ul>
                {d.items.map(({ m, tail }) => (
                  <MessageBubble key={m.id} m={m} demo={demo} tail={tail} />
                ))}
              </ul>
            </section>
          ))
        )}
      </WaMessages>

      <Composer thread={thread} windowOpen={windowOpen} remainingMs={remainingMs} templates={templates} snippets={snippets} actions={actions} />
    </>
  );
};

// ===========================================================================
type Mode = 'reply' | 'template' | 'note';

const Composer = ({
  thread,
  windowOpen,
  remainingMs,
  templates,
  snippets,
  actions,
}: {
  thread: Thread;
  windowOpen: boolean;
  remainingMs: number;
  templates: TemplateMeta[];
  snippets: Snippet[];
  actions: Actions;
}) => {
  const [mode, setMode] = useState<Mode>(windowOpen ? 'reply' : 'template');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [tplId, setTplId] = useState('');
  const [params, setParams] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  // A photo or document to send with the reply text as its caption.
  const [attachment, setAttachment] = useState<{ file: File; kind: 'image' | 'document'; previewUrl: string | null } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
  }, [attachment]);

  const attach = async (file: File | undefined) => {
    if (!file) return;
    if (!windowOpen) {
      toast.error('Photos and files can only be sent inside the 24-hour reply window.');
      return;
    }
    setPreparing(true);
    try {
      const ready = await prepareAttachment(file);
      setMode('reply');
      setAttachment({ ...ready, previewUrl: ready.kind === 'image' ? URL.createObjectURL(ready.file) : null });
      requestAnimationFrame(() => taRef.current?.focus());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not attach that file.');
    } finally {
      setPreparing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // When the 24 h window closes, free-form replies are no longer allowed.
  useEffect(() => {
    if (!windowOpen && mode === 'reply') setMode('template');
  }, [windowOpen, mode]);

  const tpl = useMemo(() => templates.find((t) => t.id === tplId) || null, [templates, tplId]);
  useEffect(() => {
    setParams((prev) => Array.from({ length: tpl?.paramLabels.length || 0 }, (_, i) => prev[i] || ''));
  }, [tpl]);

  const value = mode === 'note' ? note : text;
  const setValue = (v: string) => (mode === 'note' ? setNote(v) : setText(v));

  const submit = async () => {
    if (sending) return;
    try {
      if (mode === 'note') {
        if (!note.trim()) return;
        setSending(true);
        await actions.addNote(thread.id, note.trim());
        setNote('');
        toast.success('Note added. Only your team can see it.');
      } else if (mode === 'reply') {
        if (attachment) {
          setSending(true);
          await actions.sendMedia(thread, attachment.file, attachment.kind, text.trim());
          setAttachment(null);
          setText('');
        } else {
          if (!text.trim()) return;
          setSending(true);
          await actions.send(thread, { text: text.trim() });
          setText('');
        }
      } else {
        if (!tpl) {
          toast.error('Pick a template first.');
          return;
        }
        const missing = params.findIndex((p) => !p.trim());
        if (missing >= 0) {
          toast.error(`Fill in "${tpl.paramLabels[missing] || `Variable ${missing + 1}`}".`);
          return;
        }
        setSending(true);
        await actions.send(thread, { template: tpl, params: params.map((p) => p.trim()) });
        setParams((p) => p.map(() => ''));
        toast.success('Template sent');
      }
      taRef.current?.focus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const insertSnippet = (s: Snippet) => {
    if (mode === 'note') setNote((n) => (n ? `${n}\n${s.text}` : s.text));
    else {
      if (!windowOpen) {
        toast.error('The reply window is closed. Quick replies can only be sent inside it.');
        return;
      }
      setMode('reply');
      setText((t) => (t ? `${t}\n${s.text}` : s.text));
    }
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const insertEmoji = (e: string) => {
    const ta = taRef.current;
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + e + value.slice(end));
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(start + e.length, start + e.length);
    });
  };

  const modes: Array<{ id: Mode; label: string; Icon: typeof Send; disabled?: boolean }> = [
    { id: 'reply', label: 'Reply', Icon: Send, disabled: !windowOpen },
    { id: 'template', label: 'Template', Icon: LayoutTemplate },
    { id: 'note', label: 'Note', Icon: StickyNote },
  ];
  const sendable = templates.filter((t) => isSendableTemplate(t.status));

  const modeBar = (
    <div className="mb-1.5 flex flex-wrap items-center gap-2 px-1 md:px-0">
      <div className="inline-flex rounded-full bg-[var(--wa-input-m)] p-0.5 shadow-[var(--wa-shadow)] md:bg-[var(--wa-bg)]" role="tablist" aria-label="Composer mode">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            disabled={m.disabled}
            onClick={() => setMode(m.id)}
            title={m.disabled ? 'The 24-hour reply window is closed. Use a template.' : undefined}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wa-teal)] disabled:cursor-not-allowed disabled:opacity-40 ${
              mode === m.id
                ? m.id === 'note'
                  ? 'bg-[#f5d76e] text-[#4a3b00]'
                  : 'bg-[var(--wa-teal)] text-white dark:text-[#111b21]'
                : 'text-[var(--wa-icon)] hover:bg-black/5 dark:hover:bg-white/10'
            }`}
          >
            <m.Icon className="h-3.5 w-3.5" aria-hidden />
            {m.label}
          </button>
        ))}
      </div>
      <span
        className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] ${
          !windowOpen || remainingMs < 2 * 3600_000 ? 'bg-[#fff3cd] text-[#7a5a00] dark:bg-[#3d3216] dark:text-[#f0d27a]' : 'text-[var(--wa-muted)]'
        }`}
        aria-live="polite"
      >
        <Clock className="h-3.5 w-3.5" aria-hidden />
        {windowOpen ? `${formatCountdown(remainingMs)} left to reply freely` : 'Template only'}
      </span>
    </div>
  );

  if (mode === 'template') {
    return (
      <div className="flex-none bg-[var(--wa-header-m)] px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-1px_0_var(--wa-divider)] md:bg-[var(--wa-header)] md:px-4 md:shadow-none">
        {modeBar}
        {!windowOpen && (
          <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-[#fff3cd] px-3 py-2 text-[12.5px] text-[#5c4400] dark:bg-[#3d3216] dark:text-[#f0d27a]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
            More than 24 hours since the customer's last message. Meta only allows approved templates until they write again.
          </p>
        )}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="wa-template">Template</label>
            <select
              id="wa-template"
              value={tplId}
              onChange={(e) => setTplId(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-lg border-0 bg-[var(--wa-input)] px-3 text-[14px] text-[var(--wa-text)] shadow-[var(--wa-shadow)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wa-teal)] md:shadow-none"
            >
              <option value="">{sendable.length ? 'Pick an approved template…' : 'No approved templates yet'}</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id} disabled={!isSendableTemplate(t.status)}>
                  {t.name} · {t.language}
                  {!isSendableTemplate(t.status) ? ` (${statusStyle(t.status).label})` : ''}
                </option>
              ))}
            </select>
            <WaSendButton onClick={submit} busy={sending} disabled={!tpl} label="Send template" />
          </div>
          {tpl && tpl.paramLabels.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {tpl.paramLabels.map((label, i) => (
                <input
                  key={i}
                  value={params[i] || ''}
                  onChange={(e) => setParams((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`{{${i + 1}}} ${label}`}
                  aria-label={`${label} (variable ${i + 1})`}
                  className="h-10 rounded-lg border-0 bg-[var(--wa-input)] px-3 text-[14px] text-[var(--wa-text)] placeholder:text-[var(--wa-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wa-teal)]"
                />
              ))}
            </div>
          )}
          {tpl?.bodyText && (
            <p className="line-clamp-3 rounded-lg bg-[var(--wa-out)] px-3 py-2 text-[13px] text-[var(--wa-text)] shadow-[var(--wa-shadow)]">
              {renderTemplate(tpl.bodyText, params)}
            </p>
          )}
        </div>
      </div>
    );
  }

  const isNote = mode === 'note';
  return (
    <WaComposerBar
      above={
        <>
          {modeBar}
          {attachment && mode === 'reply' && (
            <div className="mb-2 flex items-center gap-3 rounded-lg bg-[var(--wa-input-m)] p-2 pr-1 shadow-[var(--wa-shadow)] md:bg-[var(--wa-input)]">
              {attachment.previewUrl ? (
                <img src={attachment.previewUrl} alt="" className="h-12 w-12 flex-none rounded object-cover" />
              ) : (
                <span className="grid h-12 w-12 flex-none place-items-center rounded bg-[var(--wa-search)] text-[var(--wa-icon)]">
                  <FileText className="h-5 w-5" aria-hidden />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-[var(--wa-text)]">
                  {attachment.kind === 'image' ? 'Photo' : attachment.file.name}
                </span>
                <span className="block text-[11px] text-[var(--wa-muted)]">
                  {(attachment.file.size / 1024 / 1024).toFixed(attachment.file.size < 1024 * 1024 ? 2 : 1)} MB · your text is sent as the caption
                </span>
              </span>
              <WaIconButton label="Remove attachment" onClick={() => setAttachment(null)}>
                <X className="h-4 w-4" aria-hidden />
              </WaIconButton>
            </div>
          )}
        </>
      }
      left={
        <>
          <WaEmojiPicker onPick={insertEmoji} />
          <SnippetsPopover snippets={snippets} onInsert={insertSnippet} currentText={value} onAdd={actions.addSnippet} onDelete={actions.deleteSnippet} />
          {mode === 'reply' && (
            <>
              <input ref={fileRef} type="file" accept={ATTACH_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => attach(e.target.files?.[0])} />
              <WaIconButton label="Attach a photo or document (up to 3 MB)" onClick={() => fileRef.current?.click()} disabled={preparing || sending} className="mb-1 md:mb-0">
                {preparing ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Paperclip className="h-5 w-5 -rotate-45" aria-hidden />}
              </WaIconButton>
            </>
          )}
        </>
      }
      input={
        <div className={`flex items-end ${isNote ? 'rounded-lg bg-[var(--wa-note)] px-2 md:-mx-3 md:px-3' : ''}`}>
          {isNote && <Lock className="mb-[15px] mr-1.5 h-4 w-4 flex-none text-[var(--wa-note-text)] md:mb-[13px]" aria-hidden />}
          <label htmlFor="wa-composer" className="sr-only">{isNote ? 'Internal note' : 'Message'}</label>
          <WaTextarea
            id="wa-composer"
            ref={taRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onSubmit={submit}
            onPaste={(e) => {
              const file = mode === 'reply' ? Array.from(e.clipboardData.files)[0] : undefined;
              if (file) {
                e.preventDefault();
                attach(file);
              }
            }}
            maxLength={attachment && mode === 'reply' ? 1024 : 4096}
            placeholder={isNote ? 'Note for your team (not sent)' : attachment ? 'Add a caption (optional)' : 'Type a message'}
          />
        </div>
      }
      send={
        <WaSendButton
          onClick={submit}
          busy={sending}
          disabled={mode === 'reply' && attachment ? preparing : !value.trim()}
          label={isNote ? 'Add note' : attachment ? 'Send attachment' : 'Send reply'}
          icon={isNote ? <StickyNote className="h-5 w-5" aria-hidden /> : undefined}
        />
      }
    />
  );
};

// ===========================================================================
const SnippetsPopover = ({
  snippets,
  onInsert,
  currentText,
  onAdd,
  onDelete,
}: {
  snippets: Snippet[];
  onInsert: (s: Snippet) => void;
  currentText: string;
  onAdd: (title: string, text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const filtered = snippets.filter((s) => !q.trim() || `${s.title} ${s.text}`.toLowerCase().includes(q.trim().toLowerCase()));

  const startAdd = () => {
    setAdding(true);
    setTitle('');
    setBody(currentText.trim());
  };
  const save = async () => {
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await onAdd(title.trim().slice(0, 60), body.trim().slice(0, 2000));
      setAdding(false);
      toast.success('Quick reply saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setAdding(false); }}>
      <PopoverTrigger asChild>
        <button type="button" className={`${iconBtn} mb-1 md:mb-0`} aria-label="Quick replies" title="Quick replies">
          <Zap className="h-5 w-5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Quick replies</p>
          {!adding && (
            <button type="button" onClick={startAdd} className="inline-flex h-8 items-center rounded-md px-2 text-[13px] font-medium text-[#008069] hover:bg-muted dark:text-[#00a884]">
              New
            </button>
          )}
        </div>
        {adding ? (
          <div className="space-y-2 p-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short name, e.g. Delivery time"
              maxLength={60}
              aria-label="Quick reply name"
              autoFocus
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]/50"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="The message text"
              aria-label="Quick reply text"
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]/50"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAdding(false)} className="h-9 rounded-md px-3 text-sm hover:bg-muted">Cancel</button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !title.trim() || !body.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#008069] px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-[#00a884] dark:text-[#111b21]"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />} Save
              </button>
            </div>
          </div>
        ) : (
          <>
            {snippets.length > 5 && (
              <div className="border-b border-border p-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search quick replies" aria-label="Search quick replies" className="h-9 w-full rounded-md bg-muted px-3 text-sm focus:outline-none" />
              </div>
            )}
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
                {snippets.length ? 'No match.' : 'Save answers you type often, like delivery times or care tips.'}
              </p>
            ) : (
              <ul className="max-h-72 overflow-y-auto py-1">
                {filtered.map((s) => (
                  <li key={s.id} className="group flex items-start">
                    <button
                      type="button"
                      onClick={() => {
                        onInsert(s);
                        setOpen(false);
                      }}
                      className="min-w-0 flex-1 px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <span className="block truncate text-[13px] font-medium">{s.title}</span>
                      <span className="line-clamp-2 block text-[12px] text-muted-foreground">{s.text}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(s.id).catch(() => toast.error('Could not delete'))}
                      className="m-1 inline-flex h-8 w-8 flex-none items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                      aria-label={`Delete quick reply ${s.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

const LoadMoreThreads = ({ loading, onClick, label }: { loading: boolean; onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[var(--wa-border)] px-4 text-[13px] font-medium text-[var(--wa-teal)] hover:bg-[var(--wa-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wa-teal)] disabled:opacity-60"
  >
    {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
    {loading ? 'Loading…' : label}
  </button>
);
