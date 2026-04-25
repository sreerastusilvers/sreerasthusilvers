import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, MessageCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useWhatsAppOtpVerification } from '@/hooks/useWhatsAppOtpVerification';

interface WhatsAppSetupModalProps {
  open: boolean;
  /** Called with the verified 10-digit phone number after OTP success */
  onSuccess: (phone: string) => void;
  onSkip: () => void;
}

const WhatsAppSetupModal = ({ open, onSuccess, onSkip }: WhatsAppSetupModalProps) => {
  const [phone, setPhone] = useState('');

  // Hook is enabled once the modal is open AND phone has 10 digits
  const otp = useWhatsAppOtpVerification(phone, open && phone.length === 10);

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
  };

  const handleContinue = () => {
    if (!otp.isVerified) return;
    onSuccess(phone);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="w-[calc(100vw-1.5rem)] max-w-sm p-5 sm:p-6 rounded-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-0">
          <div className="flex items-start gap-3 pr-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 flex-shrink-0">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base leading-tight">Add WhatsApp Number</DialogTitle>
              <p className="text-xs text-gray-500 mt-0.5">Verify to receive order updates</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <p className="text-sm text-gray-600 leading-snug">
            Verify your WhatsApp number to receive order updates and secure your account with
            two-factor authentication.
          </p>

          {/* Phone number input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              WhatsApp number
            </label>
            <div className="flex items-stretch rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-green-300">
              <span className="flex items-center px-2.5 bg-gray-50 text-sm text-gray-600 border-r border-gray-200 select-none flex-shrink-0">
                +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="10-digit number"
                disabled={otp.isVerified}
                className="flex-1 min-w-0 px-2.5 py-2 text-sm outline-none bg-white disabled:bg-gray-50 disabled:text-gray-500"
              />
              <button
                type="button"
                onClick={otp.sendOtp}
                disabled={otp.isBusy || otp.isVerified || phone.length !== 10}
                className="px-2.5 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed border-l border-gray-200 transition-colors flex-shrink-0"
              >
                {otp.phase === 'sending'
                  ? 'Sending…'
                  : otp.phase !== 'idle'
                  ? 'Resend'
                  : 'Send'}
              </button>
            </div>
          </div>

          {/* OTP input — shown after code is sent */}
          {(otp.phase === 'sent' || otp.phase === 'verifying' || otp.isVerified) && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                6-digit WhatsApp code
              </label>
              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp.otpCode}
                  onChange={(e) =>
                    otp.setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="123456"
                  disabled={otp.isVerified}
                  className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-green-300 tracking-[0.3em] font-mono text-center disabled:bg-gray-50 disabled:text-gray-500"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={otp.confirmOtp}
                  disabled={otp.isBusy || otp.isVerified || otp.otpCode.length !== 6}
                  className="bg-green-600 hover:bg-green-700 text-white flex-shrink-0"
                >
                  {otp.phase === 'verifying' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : otp.isVerified ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    'Verify'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Verified badge */}
          {otp.isVerified && (
            <p className="flex items-center gap-1.5 text-sm text-green-700 font-medium">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              Number verified successfully
            </p>
          )}

          {/* Error */}
          {otp.otpError && (
            <p className="flex items-start gap-1 text-xs text-red-600">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{otp.otpError}</span>
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSkip}
              className="flex-1 text-gray-600"
            >
              Skip for now
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleContinue}
              disabled={!otp.isVerified}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppSetupModal;
