import { useEffect, useState } from "react";
import { Scale, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  fetchSilverRate,
  getCachedSilverRate,
  subscribeSilverRate,
  type SilverRate,
} from "@/services/silverRateService";

type Variant = "icon" | "pill";

interface SilverRateWidgetProps {
  variant?: Variant;
  className?: string;
}

const formatInr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: n >= 1000 ? 0 : 2,
  }).format(n);

const formatRelative = (iso: string) => {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "just now";
  const diffMs = Date.now() - then;
  const sec = Math.max(1, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
};

const SilverRateWidget = ({ variant = "icon", className = "" }: SilverRateWidgetProps) => {
  const [rate, setRate] = useState<SilverRate | null>(() => getCachedSilverRate());
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async (force = false) => {
      setLoading(true);
      try {
        const r = await fetchSilverRate(force);
        if (!cancelled) setRate(r);
      } catch {
        /* keep last known */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load(false);
    const id = window.setInterval(() => load(false), 10 * 60 * 1000);
    const unsub = subscribeSilverRate((r) => {
      if (!cancelled) setRate(r);
    });
    return () => {
      cancelled = true;
      window.clearInterval(id);
      unsub();
    };
  }, []);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const r = await fetchSilverRate(true);
      setRate(r);
    } catch {
      /* swallow */
    } finally {
      setLoading(false);
    }
  };

  const trend = rate?.change24hPct;
  const TrendIcon = trend == null ? Minus : trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor =
    trend == null
      ? "text-muted-foreground"
      : trend > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : trend < 0
      ? "text-rose-600 dark:text-rose-400"
      : "text-muted-foreground";

  const triggerInner =
    variant === "pill" ? (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900 border border-zinc-200/80 dark:border-zinc-700/80 text-foreground/90 hover:border-primary/40 transition-colors">
        <Scale className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-300" strokeWidth={2} />
        {rate ? `Silver ${formatInr(rate.pricePerGramInr)}/g` : "Silver rate"}
        {trend != null && (
          <span className={`inline-flex items-center gap-0.5 ${trendColor}`}>
            <TrendIcon className="w-3 h-3" strokeWidth={2.5} />
            {trend.toFixed(2)}%
          </span>
        )}
      </span>
    ) : (
      <span className="relative inline-flex items-center justify-center p-2 rounded-full hover:bg-muted transition-colors">
        <Scale className="w-[22px] h-[22px] text-foreground/80" strokeWidth={1.5} />
        {/* Live pulse dot */}
        <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
      </span>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Live silver rate"
          className={`outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-full ${className}`}
        >
          {triggerInner}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[280px] p-0 overflow-hidden border-zinc-200 dark:border-zinc-700 shadow-2xl"
      >
        {/* Premium silver-tone header */}
        <div className="relative px-4 py-3 bg-gradient-to-br from-zinc-100 via-white to-zinc-200 dark:from-zinc-800 dark:via-zinc-900 dark:to-zinc-800 border-b border-zinc-200/70 dark:border-zinc-700/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-500 dark:from-zinc-500 dark:to-zinc-700 flex items-center justify-center shadow-inner">
                <Scale className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Live silver
                </p>
                <p className="text-xs font-medium text-foreground/80">
                  92.5% sterling indicative
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              aria-label="Refresh silver rate"
              className="p-1.5 rounded-full hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors"
              disabled={loading}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`}
                strokeWidth={2}
              />
            </button>
          </div>
        </div>

        {/* Rates body */}
        <div className="px-4 py-3 space-y-2 bg-card">
          {!rate ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Fetching latest rate…
            </div>
          ) : (
            <>
              <motion.div
                key={rate.fetchedAt}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-2"
              >
                <RateRow label="Per gram" value={formatInr(rate.pricePerGramInr)} highlight />
                <RateRow label="Per 10 grams" value={formatInr(rate.pricePer10gInr)} />
                <RateRow label="Per kilogram" value={formatInr(rate.pricePerKgInr)} />
              </motion.div>

              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${trendColor}`}>
                  <TrendIcon className="w-3 h-3" strokeWidth={2.5} />
                  {trend == null ? "Trend unavailable" : `${trend > 0 ? "+" : ""}${trend.toFixed(2)}% 24h`}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Updated {formatRelative(rate.fetchedAt)}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-2 bg-muted/40 border-t border-border/60">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Indicative only. Actual product price may differ based on making
            charges, GST and design.
            {rate?.source === "fallback" && " (Showing fallback estimate.)"}
            {rate?.source === "manual" && " (Store-set rate.)"}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const RateRow = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <div className="flex items-center justify-between">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span
      className={`tabular-nums font-semibold ${
        highlight ? "text-base text-foreground" : "text-sm text-foreground/85"
      }`}
    >
      {value}
    </span>
  </div>
);

export default SilverRateWidget;
