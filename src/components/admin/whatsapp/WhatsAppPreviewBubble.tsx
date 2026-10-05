/**
 * WhatsApp-style message bubble used to preview templates before they are
 * submitted to Meta. Renders WhatsApp's light markup (*bold*, _italic_,
 * ~strike~, ```mono```) as React nodes, never as HTML.
 */
import { Fragment, type ReactNode } from 'react';
import { CornerUpLeft, ExternalLink, Phone, Copy, CheckCheck } from 'lucide-react';

export interface PreviewButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'OTP' | string;
  text: string;
}

const TOKEN_RE = /(```[^`]+```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;

export function formatWhatsAppText(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  String(text || '')
    .split(TOKEN_RE)
    .forEach((part, i) => {
      if (!part) return;
      if (part.startsWith('```') && part.endsWith('```') && part.length > 6) {
        out.push(<code key={i} className="font-mono text-[0.95em]">{part.slice(3, -3)}</code>);
      } else if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
        out.push(<strong key={i} className="font-semibold">{part.slice(1, -1)}</strong>);
      } else if (part.length > 2 && part.startsWith('_') && part.endsWith('_')) {
        out.push(<em key={i}>{part.slice(1, -1)}</em>);
      } else if (part.length > 2 && part.startsWith('~') && part.endsWith('~')) {
        out.push(<s key={i}>{part.slice(1, -1)}</s>);
      } else {
        out.push(<Fragment key={i}>{part}</Fragment>);
      }
    });
  return out;
}

const ButtonIcon = ({ type }: { type: string }) => {
  if (type === 'URL') return <ExternalLink className="h-4 w-4" aria-hidden />;
  if (type === 'PHONE_NUMBER') return <Phone className="h-4 w-4" aria-hidden />;
  if (type === 'OTP') return <Copy className="h-4 w-4" aria-hidden />;
  return <CornerUpLeft className="h-4 w-4" aria-hidden />;
};

export const WhatsAppPreviewBubble = ({
  header,
  body,
  footer,
  buttons = [],
  businessName = 'Sreerasthu Silvers',
}: {
  header?: string | null;
  body: string;
  footer?: string | null;
  buttons?: PreviewButton[];
  businessName?: string;
}) => {
  const time = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 shadow-sm dark:border-white/10">
      <div className="flex items-center gap-2.5 bg-[#008069] px-3 py-2.5 text-white dark:bg-[#202c33]">
        <div className="grid h-8 w-8 place-items-center rounded-full bg-white/20 text-xs font-semibold" aria-hidden>
          {businessName.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight">{businessName}</p>
          <p className="text-[11px] leading-tight text-white/75">Business account</p>
        </div>
      </div>
      <div className="min-h-[220px] bg-[#efeae2] p-3 dark:bg-[#0b141a]">
        <div className="max-w-[92%]">
          <div className="relative rounded-lg rounded-tl-none bg-white px-2.5 pb-1.5 pt-2 text-[14px] leading-[1.4] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] dark:bg-[#202c33] dark:text-[#e9edef]">
            {header ? <p className="mb-1 font-semibold">{header}</p> : null}
            <p className="whitespace-pre-wrap break-words">
              {body ? formatWhatsAppText(body) : <span className="text-[#667781] dark:text-[#8696a0]">Your message appears here.</span>}
            </p>
            {footer ? <p className="mt-1 text-[12.5px] text-[#667781] dark:text-[#8696a0]">{footer}</p> : null}
            <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[#667781] dark:text-[#8696a0]">
              {time}
              <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" aria-hidden />
            </p>
          </div>
          {buttons.length > 0 && (
            <div className="mt-0.5 space-y-0.5">
              {buttons.slice(0, 3).map((b, i) => (
                <div
                  key={`${b.type}-${i}`}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[14px] font-medium text-[#027eb5] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] dark:bg-[#202c33] dark:text-[#53bdeb]"
                >
                  <ButtonIcon type={b.type} />
                  <span className="truncate">{b.text || 'Button'}</span>
                </div>
              ))}
              {buttons.length > 3 && (
                <div className="flex items-center justify-center rounded-lg bg-white px-3 py-2 text-[14px] font-medium text-[#027eb5] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] dark:bg-[#202c33] dark:text-[#53bdeb]">
                  See all options
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppPreviewBubble;
