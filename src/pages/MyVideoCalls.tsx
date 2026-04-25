import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Video, Calendar, Clock, Phone, ExternalLink, X, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import MobileHeader from '@/components/MobileHeader';
import MobileBottomNav from '@/components/MobileBottomNav';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import {
  listenMyRequests,
  cancelVideoCallRequest,
  type VideoCallRequest,
  type VideoCallStatus,
} from '@/services/videoCallRequestService';
import type { Timestamp } from 'firebase/firestore';

const STATUS_LABELS: Record<VideoCallStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  live: { label: 'Live', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  no_show: { label: 'No Show', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
};

const formatTs = (ts: Timestamp | null | undefined): string => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts as unknown as number);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const MyVideoCalls = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<VideoCallRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const unsub = listenMyRequests(user.uid, (data) => {
      setRequests(data);
      setLoading(false);
    });
    return unsub;
  }, [user, navigate]);

  const handleCancel = async (id: string) => {
    setCancelling(id);
    try {
      await cancelVideoCallRequest(id);
      toast.success('Request cancelled');
    } catch {
      toast.error('Failed to cancel');
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <MobileHeader />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
            <Video className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">My Video Calls</h1>
            <p className="text-sm text-muted-foreground">Track your demo call requests</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <Video className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">No video call requests yet.</p>
            <Button
              variant="outline"
              className="border-amber-400 text-amber-700"
              onClick={() => navigate('/')}
            >
              Browse products
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => {
              const st = STATUS_LABELS[req.status];
              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-2xl p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                      {req.productTitle && (
                        <p className="mt-1.5 text-sm font-medium text-foreground truncate">
                          {req.productTitle}
                        </p>
                      )}
                    </div>
                    {req.mode === 'scheduled' ? (
                      <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    ) : (
                      <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>
                        {req.mode === 'scheduled' && req.scheduledAt
                          ? `Scheduled for ${formatTs(req.scheduledAt)}`
                          : `Requested ${formatTs(req.createdAt)}`}
                      </span>
                    </div>
                    {req.meetingType === 'meet' && req.meetingUrl && (
                      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <ExternalLink className="w-3 h-3" />
                        <span>Google Meet link ready</span>
                      </div>
                    )}
                    {req.meetingType === 'inapp' && req.callId && (
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle className="w-3 h-3" />
                        <span>In-app call prepared</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex gap-2 flex-wrap">
                    {req.status === 'confirmed' && req.meetingType === 'meet' && req.meetingUrl && (
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                        onClick={() => window.open(req.meetingUrl, '_blank')}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Join Google Meet
                      </Button>
                    )}
                    {(req.status === 'confirmed' || req.status === 'live') &&
                      req.meetingType === 'inapp' && req.callId && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                          onClick={() => navigate(`/call/${req.callId}`)}
                        >
                          <Video className="w-3.5 h-3.5" />
                          Join Call
                        </Button>
                      )}
                    {req.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        disabled={cancelling === req.id}
                        onClick={() => handleCancel(req.id)}
                      >
                        {cancelling === req.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <><X className="w-3.5 h-3.5 mr-1" />Cancel</>
                        )}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
      <MobileBottomNav />
    </div>
  );
};

export default MyVideoCalls;
