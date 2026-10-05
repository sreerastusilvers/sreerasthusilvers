/**
 * Admin WhatsApp team inbox.
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
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  LayoutTemplate,
  Loader2,
  Lock,
  MessageCircle,
  RotateCcw,
  Search,
  Send,
  StickyNote,
  Trash2,
  User as UserIcon,
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
import {
  FILTERS,
  avatarTone,
  dayLabel,
  formatCountdown,
  formatListTime,
  initials,
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

const iconBtn =
  'inline-flex h-10 w-10 flex-none items-center justify-center rounded-full text-[#54656f] transition-[background-color,transform] duration-150 hover:bg-black/5 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884] dark:text-[#aebac1] dark:hover:bg-white/10';

/** Re-render every 30 s so window countdowns stay current. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  return now;
}

const Avatar = ({ thread, size = 'h-12 w-12' }: { thread: Thread; size?: string }) => {
  const ini = initials(thread.contactName);
  return (
    <div className={`${size} grid flex-none place-items-center rounded-full text-sm font-semibold ${avatarTone(thread.id)}`} aria-hidden>
      {ini || <UserIcon className="h-5 w-5" />}
    </div>
  );
};

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

  // Desktop opens the newest conversation; mobile starts on the list.
  useEffect(() => {
    if (activeId || data.loadingThreads || !data.threads.length) return;
    if (window.matchMedia('(min-width: 768px)').matches) setActiveId(data.threads[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.loadingThreads]);

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

  return (
    <div className="-m-4 h-[calc(100dvh-64px)] min-h-[520px] overflow-hidden border-[#d1d7db] bg-[#efeae2] dark:border-[#2a3942] dark:bg-[#0b141a] lg:m-0 lg:h-[calc(100dvh-112px)] lg:rounded-xl lg:border lg:shadow-sm">
      <div className="grid h-full grid-cols-1 md:grid-cols-[minmax(300px,380px)_1fr]">
        {/* ------------------------------------------------ thread list */}
        <aside className={`${activeThread ? 'hidden md:flex' : 'flex'} min-h-0 flex-col overflow-hidden bg-white dark:bg-[#111b21] md:border-r md:border-[#d1d7db] md:dark:border-[#2a3942]`}>
          <header className="flex h-[60px] flex-none items-center gap-2 bg-[#f0f2f5] px-3 dark:bg-[#202c33]">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#00a884]" aria-hidden>
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-[16px] font-semibold leading-tight text-[#111b21] dark:text-[#e9edef]">WhatsApp inbox</h1>
              <p className="text-[12px] leading-tight text-[#667781] dark:text-[#8696a0]" aria-live="polite">
                {data.demo ? 'Demo data · ' : ''}
                {totalUnread ? `${totalUnread} unread` : 'All caught up'}
              </p>
            </div>
            <SetupStatusButton missing={setup.missing.length} onClick={() => setSetupOpen(true)} />
          </header>

          {setup.missing.length > 0 && (
            <button
              type="button"
              onClick={() => setSetupOpen(true)}
              className="flex flex-none items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-left text-[13px] text-amber-900 transition-colors duration-150 hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/15"
            >
              <AlertTriangle className="h-4 w-4 flex-none" aria-hidden />
              <span className="flex-1">
                Setup incomplete: {setup.missing.length} item{setup.missing.length === 1 ? '' : 's'} missing.
              </span>
              <span className="font-medium underline underline-offset-2">View</span>
            </button>
          )}

          <div className="flex-none space-y-2 border-b border-[#e9edef] px-3 py-2 dark:border-[#2a3942]">
            <label className="relative block">
              <span className="sr-only">Search by name or phone</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667781] dark:text-[#8696a0]" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or phone"
                className="h-10 w-full rounded-lg bg-[#f0f2f5] pl-9 pr-9 text-[14px] text-[#111b21] placeholder:text-[#667781] focus:outline-none focus:ring-2 focus:ring-[#00a884]/50 dark:bg-[#202c33] dark:text-[#e9edef] dark:placeholder:text-[#8696a0]"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#667781] hover:bg-black/5 dark:text-[#8696a0] dark:hover:bg-white/10" aria-label="Clear search">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </label>
            <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none]" role="tablist" aria-label="Filter conversations">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`inline-flex h-8 flex-none items-center gap-1 rounded-full px-3 text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884] ${
                    filter === f.id
                      ? 'bg-[#d9fdd3] font-medium text-[#008069] dark:bg-[#0a332c] dark:text-[#00a884]'
                      : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef] dark:bg-[#202c33] dark:text-[#aebac1] dark:hover:bg-[#2a3942]'
                  }`}
                >
                  {f.label}
                  {counts[f.id] > 0 && f.id !== 'all' && <span className="tabular-nums opacity-80">{counts[f.id]}</span>}
                </button>
              ))}
            </div>
          </div>

          {data.loadingThreads ? (
            <div className="grid flex-1 place-items-center text-sm text-[#667781] dark:text-[#8696a0]">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading conversations…
              </span>
            </div>
          ) : data.threadsError ? (
            <div className="grid flex-1 place-items-center px-6 text-center text-sm text-red-700 dark:text-red-300">{data.threadsError}</div>
          ) : data.threads.length === 0 ? (
            <div className="grid flex-1 place-items-center px-8 text-center">
              <div className="space-y-2">
                <p className="text-sm font-medium text-[#111b21] dark:text-[#e9edef]">No conversations yet</p>
                <p className="text-[13px] text-[#667781] dark:text-[#8696a0]">
                  When a customer messages your WhatsApp business number, it appears here.
                </p>
                <button type="button" onClick={() => setSetupOpen(true)} className="text-[13px] font-medium text-[#008069] underline underline-offset-2 dark:text-[#00a884]">
                  Check WhatsApp setup
                </button>
              </div>
            </div>
          ) : visible.length === 0 ? (
            <div className="grid flex-1 place-items-center px-8 text-center text-[13px] text-[#667781] dark:text-[#8696a0]">
              No conversations match {search ? `"${search}"` : 'this filter'}.
            </div>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {visible.map((t) => (
                <ThreadRow key={t.id} t={t} active={t.id === activeId} now={now} myUid={actor.uid} onOpen={() => setActiveId(t.id)} />
              ))}
            </ul>
          )}
        </aside>

        {/* ------------------------------------------------ conversation */}
        <section className={`${activeThread ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-col overflow-hidden`}>
          {!activeThread ? (
            <div className="grid flex-1 place-items-center border-b-[6px] border-[#25d366] bg-[#f0f2f5] px-8 text-center dark:bg-[#222e35]">
              <div className="max-w-sm space-y-2">
                <MessageCircle className="mx-auto h-10 w-10 text-[#8696a0]" aria-hidden />
                <p className="text-lg font-light text-[#41525d] dark:text-[#e9edef]">Pick a conversation</p>
                <p className="text-[13px] text-[#667781] dark:text-[#8696a0]">Replies go out from your WhatsApp business number. Internal notes stay inside the team.</p>
              </div>
            </div>
          ) : (
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
          )}
        </section>
      </div>
      <SetupStatusDialog open={setupOpen} onOpenChange={setSetupOpen} status={setup} />
    </div>
  );
};

export default AdminWhatsApp;

// ===========================================================================
const ThreadRow = ({ t, active, now, myUid, onOpen }: { t: Thread; active: boolean; now: number; myUid: string | null; onOpen: () => void }) => {
  const unread = (t.unreadCount || 0) > 0;
  const ms = millisLeft(t.replyWindowClosesAt, now);
  const resolved = threadStatus(t) === 'resolved';
  const assignedName = t.assignedTo ? (t.assignedTo.uid === myUid ? 'You' : t.assignedTo.name) : null;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={active ? 'true' : undefined}
        className={`flex w-full items-center gap-3 px-3 text-left transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00a884] ${
          active ? 'bg-[#f0f2f5] dark:bg-[#2a3942]' : 'hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'
        }`}
      >
        <Avatar thread={t} />
        <div className="min-w-0 flex-1 border-b border-[#e9edef] py-3 dark:border-[#222d34]">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`truncate text-[16px] text-[#111b21] dark:text-[#e9edef] ${unread ? 'font-semibold' : ''}`}>{t.contactName || maskPhone(t.phone)}</span>
            <span className={`flex-none text-[12px] ${unread ? 'font-medium text-[#008069] dark:text-[#00a884]' : 'text-[#667781] dark:text-[#8696a0]'}`}>{formatListTime(t.updatedAt)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {t.lastDirection === 'outbound' && <DeliveryTicks status={t.lastStatus || 'sent'} />}
            <p className={`min-w-0 flex-1 truncate text-[14px] ${unread ? 'text-[#111b21] dark:text-[#e9edef]' : 'text-[#667781] dark:text-[#8696a0]'}`}>
              {t.lastMessage || 'No messages yet'}
            </p>
            {unread && (
              <span className="inline-flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-[#00a884] px-1.5 text-[11px] font-semibold tabular-nums text-white dark:text-[#111b21]">
                {t.unreadCount}
                <span className="sr-only"> unread</span>
              </span>
            )}
          </div>
          {(assignedName || resolved || ms <= 2 * 3600_000) && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {resolved && <Tag className="bg-[#e7f6ec] text-[#0f6b3a] dark:bg-[#123d2a] dark:text-[#8ee3b0]">Resolved</Tag>}
              {assignedName && <Tag className="bg-[#eef1f3] text-[#41525d] dark:bg-[#202c33] dark:text-[#aebac1]">{assignedName}</Tag>}
              {!resolved && ms > 0 && ms <= 2 * 3600_000 && (
                <Tag className="bg-[#fff3cd] text-[#7a5a00] dark:bg-[#3d3216] dark:text-[#f0d27a]">
                  <Clock className="h-3 w-3" aria-hidden /> {formatCountdown(ms)} left
                </Tag>
              )}
              {!resolved && ms <= 0 && <Tag className="bg-[#eef1f3] text-[#54656f] dark:bg-[#202c33] dark:text-[#8696a0]">Template only</Tag>}
            </div>
          )}
        </div>
      </button>
    </li>
  );
};

const Tag = ({ className, children }: { className: string; children: React.ReactNode }) => (
  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${className}`}>{children}</span>
);

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const remainingMs = millisLeft(thread.replyWindowClosesAt, now);
  const windowOpen = remainingMs > 0;
  const resolved = threadStatus(thread) === 'resolved';

  // Keep the newest message in view (no smooth scroll: this runs often).
  const stickToBottom = useRef(true);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = true;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, thread.id]);
  // Stay pinned to the newest message when the box resizes (composer grows,
  // media loads, keyboard opens) unless the admin scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const onScroll = () => {
      stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    const ro = new ResizeObserver(() => {
      if (stickToBottom.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', onScroll);
    };
  }, [thread.id, loading]);

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

  // Group messages by day for separators.
  const groups = useMemo(() => {
    const out: Array<{ label: string; items: ThreadMessage[] }> = [];
    messages.forEach((m) => {
      const label = dayLabel(m.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(m);
      else out.push({ label, items: [m] });
    });
    return out;
  }, [messages]);

  const assignee = thread.assignedTo;
  return (
    <>
      <header className="flex h-[60px] flex-none items-center gap-1.5 bg-[#f0f2f5] px-2 dark:bg-[#202c33] md:gap-3 md:px-4">
        <button type="button" onClick={onBack} className={`${iconBtn} md:hidden`} aria-label="Back to conversations">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <Avatar thread={thread} size="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-medium leading-tight text-[#111b21] dark:text-[#e9edef]">{thread.contactName || 'Unknown contact'}</h2>
          <div className="flex items-center gap-1 text-[12.5px] leading-tight text-[#667781] dark:text-[#8696a0]">
            <span className="truncate font-mono">{reveal ? thread.phone : maskPhone(thread.phone)}</span>
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
              aria-label={reveal ? 'Hide phone number' : 'Show phone number'}
              aria-pressed={reveal}
            >
              {reveal ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
            </button>
          </div>
        </div>

        <span
          className={`hidden flex-none items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium lg:inline-flex ${
            windowOpen ? 'bg-[#d9fdd3] text-[#0b6b52] dark:bg-[#0a332c] dark:text-[#5fd3b0]' : 'bg-[#fff3cd] text-[#7a5a00] dark:bg-[#3d3216] dark:text-[#f0d27a]'
          }`}
          title="Meta allows free-form replies for 24 hours after the customer's last message."
        >
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {windowOpen ? `Reply window ${formatCountdown(remainingMs)}` : 'Window closed'}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-10 flex-none items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-[#54656f] transition-[background-color,transform] duration-150 hover:bg-black/5 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884] dark:text-[#aebac1] dark:hover:bg-white/10"
              aria-label={assignee ? `Assigned to ${assignee.name}. Change assignee` : 'Assign conversation'}
            >
              {assignee ? (
                <span className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold ${avatarTone(assignee.uid)}`} aria-hidden>
                  {initials(assignee.name) || '?'}
                </span>
              ) : (
                <UserPlus className="h-5 w-5" aria-hidden />
              )}
              <span className="hidden max-w-[8rem] truncate md:inline">{assignee ? (assignee.uid === actor.uid ? 'You' : assignee.name) : 'Assign'}</span>
            </button>
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

        <button
          type="button"
          onClick={toggleResolved}
          className={`inline-flex h-10 flex-none items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition-[background-color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884] md:px-3 ${
            resolved
              ? 'text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10'
              : 'bg-[#008069] text-white hover:bg-[#017561] dark:bg-[#00a884] dark:text-[#111b21] dark:hover:bg-[#06cf9c]'
          }`}
          aria-label={resolved ? 'Reopen conversation' : 'Mark conversation as resolved'}
        >
          {resolved ? <RotateCcw className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
          <span className="hidden md:inline">{resolved ? 'Reopen' : 'Resolve'}</span>
        </button>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#efeae2] px-3 py-3 dark:bg-[#0b141a] md:px-[6%] md:py-5"
        role="log"
        aria-label={`Messages with ${thread.contactName || 'customer'}`}
      >
        {loading ? (
          <div className="grid h-full place-items-center text-sm text-[#667781] dark:text-[#8696a0]">
            <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading messages" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-[#667781] dark:text-[#8696a0]">No messages in this conversation yet.</p>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="sticky top-0 z-[1] mb-2 flex justify-center">
                  <span className="rounded-lg bg-white/95 px-3 py-1 text-[12px] text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] dark:bg-[#182229] dark:text-[#8696a0]">{g.label}</span>
                </div>
                <ul className="space-y-1.5">
                  {g.items.map((m) => (
                    <MessageBubble key={m.id} m={m} demo={demo} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

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

  // When the 24 h window closes, free-form replies are no longer allowed.
  useEffect(() => {
    if (!windowOpen && mode === 'reply') setMode('template');
  }, [windowOpen, mode]);

  const tpl = useMemo(() => templates.find((t) => t.id === tplId) || null, [templates, tplId]);
  useEffect(() => {
    setParams((prev) => Array.from({ length: tpl?.paramLabels.length || 0 }, (_, i) => prev[i] || ''));
  }, [tpl]);

  // Auto-grow the textarea up to ~6 lines.
  const value = mode === 'note' ? note : text;
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [value, mode]);

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
        if (!text.trim()) return;
        setSending(true);
        await actions.send(thread, { text: text.trim() });
        setText('');
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

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends on desktop; on touch screens Enter adds a new line.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) {
      e.preventDefault();
      submit();
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

  const modes: Array<{ id: Mode; label: string; Icon: typeof Send; disabled?: boolean }> = [
    { id: 'reply', label: 'Reply', Icon: Send, disabled: !windowOpen },
    { id: 'template', label: 'Template', Icon: LayoutTemplate },
    { id: 'note', label: 'Note', Icon: StickyNote },
  ];
  const sendable = templates.filter((t) => isSendableTemplate(t.status));

  return (
    <div className="flex-none border-t border-[#d1d7db] bg-[#f0f2f5] px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 dark:border-[#2a3942] dark:bg-[#202c33] md:px-4">
      {/* window state */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full bg-white p-0.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] dark:bg-[#111b21]" role="tablist" aria-label="Composer mode">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              disabled={m.disabled}
              onClick={() => setMode(m.id)}
              title={m.disabled ? 'The 24-hour reply window is closed. Use a template.' : undefined}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a884] disabled:cursor-not-allowed disabled:opacity-40 ${
                mode === m.id
                  ? m.id === 'note'
                    ? 'bg-[#f5d76e] text-[#4a3b00]'
                    : 'bg-[#008069] text-white dark:bg-[#00a884] dark:text-[#111b21]'
                  : 'text-[#54656f] hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10'
              }`}
            >
              <m.Icon className="h-3.5 w-3.5" aria-hidden />
              {m.label}
            </button>
          ))}
        </div>
        <span
          className={`ml-auto inline-flex items-center gap-1 text-[12px] ${
            !windowOpen ? 'text-[#7a5a00] dark:text-[#f0d27a]' : remainingMs < 2 * 3600_000 ? 'text-[#7a5a00] dark:text-[#f0d27a]' : 'text-[#667781] dark:text-[#8696a0]'
          }`}
          aria-live="polite"
        >
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {windowOpen ? `${formatCountdown(remainingMs)} left to reply freely` : 'Template only'}
        </span>
      </div>

      {!windowOpen && mode !== 'note' && (
        <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-[#fff3cd] px-3 py-2 text-[12.5px] text-[#5c4400] dark:bg-[#3d3216] dark:text-[#f0d27a]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
          More than 24 hours since the customer's last message. Meta only allows approved templates until they write again.
        </p>
      )}

      {mode === 'template' ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="wa-template">Template</label>
            <select
              id="wa-template"
              value={tplId}
              onChange={(e) => setTplId(e.target.value)}
              className="h-11 min-w-0 flex-1 rounded-lg border-0 bg-white px-3 text-[14px] text-[#111b21] focus:outline-none focus:ring-2 focus:ring-[#00a884]/50 dark:bg-[#2a3942] dark:text-[#e9edef]"
            >
              <option value="">{sendable.length ? 'Pick an approved template…' : 'No approved templates yet'}</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id} disabled={!isSendableTemplate(t.status)}>
                  {t.name} · {t.language}
                  {!isSendableTemplate(t.status) ? ` (${statusStyle(t.status).label})` : ''}
                </option>
              ))}
            </select>
            <SendButton onClick={submit} sending={sending} disabled={!tpl} label="Send template" />
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
                  className="h-10 rounded-lg border-0 bg-white px-3 text-[14px] text-[#111b21] placeholder:text-[#667781] focus:outline-none focus:ring-2 focus:ring-[#00a884]/50 dark:bg-[#2a3942] dark:text-[#e9edef] dark:placeholder:text-[#8696a0]"
                />
              ))}
            </div>
          )}
          {tpl?.bodyText && (
            <p className="line-clamp-3 rounded-lg bg-white/70 px-3 py-2 text-[13px] text-[#41525d] dark:bg-[#111b21]/60 dark:text-[#aebac1]">
              {renderTemplate(tpl.bodyText, params)}
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <SnippetsPopover snippets={snippets} onInsert={insertSnippet} currentText={value} onAdd={actions.addSnippet} onDelete={actions.deleteSnippet} />
          <div className={`flex min-w-0 flex-1 items-end rounded-lg ${mode === 'note' ? 'bg-[#fff6d6] ring-1 ring-[#f5d76e] dark:bg-[#3a3418] dark:ring-[#8a7420]/60' : 'bg-white dark:bg-[#2a3942]'}`}>
            {mode === 'note' && <Lock className="mb-3 ml-3 h-4 w-4 flex-none text-[#7a6200] dark:text-[#d9c46e]" aria-hidden />}
            <label htmlFor="wa-composer" className="sr-only">{mode === 'note' ? 'Internal note' : 'Message'}</label>
            <textarea
              id="wa-composer"
              ref={taRef}
              value={value}
              onChange={(e) => (mode === 'note' ? setNote(e.target.value) : setText(e.target.value))}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={4096}
              placeholder={mode === 'note' ? 'Write a note for your team (not sent to the customer)' : 'Type a message'}
              className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3 py-[11px] text-[15px] leading-[1.4] text-[#111b21] placeholder:text-[#667781] focus:outline-none dark:text-[#e9edef] dark:placeholder:text-[#8696a0]"
            />
          </div>
          <SendButton onClick={submit} sending={sending} disabled={!value.trim()} label={mode === 'note' ? 'Add note' : 'Send reply'} note={mode === 'note'} />
        </div>
      )}
    </div>
  );
};

const SendButton = ({ onClick, sending, disabled, label, note }: { onClick: () => void; sending: boolean; disabled?: boolean; label: string; note?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={sending || disabled}
    aria-label={label}
    className={`inline-flex h-11 w-11 flex-none items-center justify-center rounded-full transition-[background-color,transform,opacity] duration-150 active:scale-[0.95] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#00a884] dark:focus-visible:ring-offset-[#202c33] ${
      note ? 'bg-[#e0b400] text-[#2b2200] hover:bg-[#c99f00]' : 'bg-[#008069] text-white hover:bg-[#017561] dark:bg-[#00a884] dark:text-[#111b21] dark:hover:bg-[#06cf9c]'
    }`}
  >
    {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : note ? <StickyNote className="h-5 w-5" aria-hidden /> : <Send className="h-5 w-5" aria-hidden />}
  </button>
);

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
        <button type="button" className={`${iconBtn} h-11 w-11`} aria-label="Quick replies">
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
