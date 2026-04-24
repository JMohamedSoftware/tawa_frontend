import { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { io, Socket } from 'socket.io-client';
import {
  Search, MapPin, Star, ShieldCheck, Hammer,
  Zap, Droplets, Paintbrush, Wind, Leaf,
  User, LogOut, LayoutDashboard, ClipboardList,
  CheckCircle2, Clock, AlertCircle, Menu, X,
  Send, MessageCircle, Bell, Map, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Navbar } from './components/Navbar';
import { CategoryCard } from './components/CategoryCard';
import { ArtisanCard } from './components/ArtisanCard';
import { PhotoGallery } from './components/PhotoGallery';
import { ArtisanMap } from './components/ArtisanMap';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_BASE = import.meta.env.VITE_API_URL || '';

// --- Types ---
interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

interface Artisan {
  id: string;
  full_name: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  bio: string;
  avg_rating: number;
  completed_jobs: number;
  is_verified: number;
  is_online: number;
  distance_km: string;
  smart_score: number;
  profile_image?: string;
}

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'client' | 'artisan' | 'admin';
  phone?: string;
  age?: number;
}

// Components moved to separate files

// --- Main App ---

export default function App() {
  // Persist view in localStorage so refresh doesn't lose state
  const [view, setViewRaw] = useState<string>(() => {
    const savedView = localStorage.getItem('tawa_view') || 'home';
    // Only restore dashboard views if user is still logged in
    const savedUser = localStorage.getItem('artisan_user');
    if (!savedUser && savedView !== 'home') return 'home';
    return savedView;
  });

  const setView = (newView: string) => {
    localStorage.setItem('tawa_view', newView);
    setViewRaw(newView);
  };
  const [selectedArtisan, setSelectedArtisan] = useState<Artisan | null>(null);
  const [selectedArtisanPhotos, setSelectedArtisanPhotos] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Admin Data
  const [adminTab, setAdminTab] = useState<'verifications' | 'accounts'>('verifications');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [sortBy, setSortBy] = useState<'smart' | 'distance' | 'rating'>('smart');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [artisanPage, setArtisanPage] = useState(0);
  const ARTISANS_PER_PAGE = 10;
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [activeRadarId, setActiveRadarId] = useState<string | null>(null);

  const [regData, setRegData] = useState({ fullName: '', email: '', password: '', phone: '', role: 'client' as 'client' | 'artisan', categoryId: '' });
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);

  // Real data state
  const [pendingArtisans, setPendingArtisans] = useState<any[]>([]);
  const [artisanRequests, setArtisanRequests] = useState<any[]>([]);
  const [artisanProfile, setArtisanProfile] = useState<any>(null);
  const [artisanPhotos, setArtisanPhotos] = useState<any[]>([]);
  const [clientRequests, setClientRequests] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const socketRef = useRef<Socket | null>(null);

  // Chat state
  const [chatArtisan, setChatArtisan] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Rating modal state
  const [ratingRequest, setRatingRequest] = useState<any>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingReview, setRatingReview] = useState('');

  // Notification history
  const [notifHistory, setNotifHistory] = useState<any[]>([]);

  // Profile edit state
  const [profileForm, setProfileForm] = useState({ fullName: '', currentPassword: '', newPassword: '', phone: '', age: '' });
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Fetch real data conditionally
  useEffect(() => {
    if (user?.role === 'admin' && view === 'admin-dashboard') {
      if (adminTab === 'verifications') {
        fetch(API_BASE + '/api/admin/pending-artisans', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` }
        })
          .then(res => res.json())
          .then(data => setPendingArtisans(data));
      } else if (adminTab === 'accounts') {
        fetch(API_BASE + '/api/admin/users', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` }
        })
          .then(res => res.json())
          .then(data => setAllUsers(data));
      }
    }
    if (user?.role === 'artisan' && view === 'artisan-dashboard') {
      fetch(API_BASE + '/api/artisan/me', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` }
      })
        .then(res => res.json())
        .then(data => {
          setArtisanProfile(data);
          if (data?.id) fetchPhotos(data.id);
        });

      fetch(API_BASE + '/api/requests/artisan', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` }
      })
        .then(res => res.json())
        .then(data => setArtisanRequests(data));
    }

    if (user?.role === 'client' && view === 'client-dashboard') {
      fetch(API_BASE + '/api/requests/client', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` }
      })
        .then(res => res.json())
        .then(data => setClientRequests(data));
    }
  }, [user, view, adminTab]);

  // Socket Connection & Notifications
  useEffect(() => {
    socketRef.current = io(import.meta.env.VITE_API_URL || '');

    socketRef.current.on("connect", () => {
      if (user?.id) {
        socketRef.current?.emit("register", user.id);
      }
    });

    socketRef.current.on("new_request", (data) => {
      addNotification(`🔔 New Service Request: ${data.description}`);
      // Refresh artisan requests
      if (user?.role === 'artisan') {
        fetch(API_BASE + '/api/requests/artisan', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` }
        })
          .then(res => res.json())
          .then(data => setArtisanRequests(data));
      }
    });

    socketRef.current.on("request_accepted", () => {
      addNotification("✅ Your service request has been ACCEPTED!");
    });

    socketRef.current.on("request_completed", () => {
      addNotification("🎉 Work is DONE! Please rate your artisan.");
    });

    socketRef.current.on("new_message", (data) => {
      setChatMessages(prev => [...prev, { ...data, is_mine: data.sender_id === user?.id }]);
      if (view !== 'chat' || chatArtisan?.id !== data.room_id.split('_').find((id: any) => id !== user?.id)) {
        addNotification(`💬 New message: ${data.message}`);
      }
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [user, view, chatArtisan]);

  const addNotification = (msg: string) => {
    const id = Date.now();
    const newNotif = { id, msg, time: new Date().toLocaleTimeString() };
    setNotifications(prev => [...prev, newNotif]);
    setNotifHistory(prev => [newNotif, ...prev].slice(0, 50));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const fetchPhotos = (artisanId: string) => {
    fetch(API_BASE + `/api/artisans/${artisanId}/photos`)
      .then(res => res.json())
      .then(data => setArtisanPhotos(data));
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);
    formData.append('description', 'Portfolio work');

    try {
      const res = await fetch(API_BASE + '/api/artisan/photos', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` },
        body: formData
      });
      if (res.ok) {
        if (artisanProfile?.id) fetchPhotos(artisanProfile.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerify = async (artisanId: string, status: 'approved' | 'rejected', contractSigned = false) => {
    try {
      await fetch(API_BASE + '/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('artisan_token')}`
        },
        body: JSON.stringify({ artisanId, status, contractSigned })
      });
      setPendingArtisans(prev => prev.filter(a => a.id !== artisanId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to completely delete this user and all associated data?")) return;
    try {
      await fetch(API_BASE + `/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('artisan_token')}`
        }
      });
      setAllUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('document', file);
    formData.append('doc_type', docType);

    try {
      const res = await fetch(API_BASE + '/api/artisan/documents', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` },
        body: formData
      });
      if (res.ok) {
        alert(`${docType.toUpperCase()} uploaded successfully!`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Auth state + auto-load artisans on mount
  useEffect(() => {
    const saved = localStorage.getItem('artisan_user');
    const token = localStorage.getItem('artisan_token');
    const savedView = localStorage.getItem('tawa_view') || 'home';

    if (saved && token) {
      const parsedUser = JSON.parse(saved);
      setUser(parsedUser);

      // Restore correct view based on role
      const protectedViews = ['artisan-dashboard', 'client-dashboard', 'admin-dashboard', 'client-profile', 'chat'];
      if (protectedViews.includes(savedView)) {
        // Keep the saved view — it's valid
        setViewRaw(savedView);
      }
    } else {
      // Not logged in, reset to home
      setViewRaw('home');
      localStorage.setItem('tawa_view', 'home');
    }

    fetchCategories();
    // Auto-load nearby artisans
    handleSearch(undefined, false);
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(API_BASE + '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regData)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      localStorage.setItem('artisan_token', data.token);
      localStorage.setItem('artisan_user', JSON.stringify(data.user));
      setUser(data.user);
      if (data.user.role === 'artisan') {
        setView('artisan-dashboard');
      } else {
        setView('home');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const [otpValue, setOtpValue] = useState('');
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(API_BASE + '/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, otp: otpValue })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      localStorage.setItem('artisan_token', data.token);
      localStorage.setItem('artisan_user', JSON.stringify(data.user));
      setUser(data.user);
      if (data.user.role === 'artisan') {
        setView('artisan-dashboard');
      } else {
        setView('home');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(API_BASE + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      localStorage.setItem('artisan_token', data.token);
      localStorage.setItem('artisan_user', JSON.stringify(data.user));
      setUser(data.user);
      if (data.user.role === 'artisan') {
        setView('artisan-dashboard');
      } else if (data.user.role === 'admin') {
        setView('admin-dashboard');
      } else {
        setView('home');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchCategories = async () => {
    const res = await fetch(API_BASE + '/api/categories');
    const data = await res.json();
    setCategories(data);
  };

  const handleSearch = async (catSlug?: string, navigateToResults = true) => {
    setLoading(true);
    const lat = location?.lat || 36.8065; // Tunis default
    const lng = location?.lng || 10.1815;
    const slug = catSlug !== undefined ? catSlug : (selectedCategory || '');
    const res = await fetch(API_BASE + `/api/artisans/search?categorySlug=${slug}&lat=${lat}&lng=${lng}`);
    let data = await res.json();
    setArtisans(data);
    setLoading(false);
    if (navigateToResults) setView('search-results');
  };

  const sortedArtisans = [...artisans].sort((a, b) => {
    if (sortBy === 'rating') return b.avg_rating - a.avg_rating;
    if (sortBy === 'distance') return parseFloat(a.distance_km) - parseFloat(b.distance_km);
    // Smart score is default
    return b.smart_score - a.smart_score;
  });

  const handleLogout = () => {
    localStorage.removeItem('artisan_token');
    localStorage.removeItem('artisan_user');
    localStorage.removeItem('tawa_view');
    setUser(null);
    setViewRaw('home');
  };

  const toggleOnlineStatus = async () => {
    const newStatus = artisanProfile?.is_online ? 0 : 1;
    try {
      await fetch(API_BASE + '/api/artisan/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('artisan_token')}`
        },
        body: JSON.stringify({ ...artisanProfile, is_online: newStatus })
      });
      setArtisanProfile((prev: any) => ({ ...prev, is_online: newStatus }));
      addNotification(newStatus ? '🟢 أنت الآن متوفر للخدمة!' : '🔴 لقد قمت بإيقاف التشغيل مؤقتاً.');
    } catch (err) {
      console.error(err);
    }
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  };

  const handleUpdateRequestStatus = async (requestId: number, status: string) => {
    try {
      const res = await fetch(API_BASE + `/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('artisan_token')}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        if (user?.role === 'artisan') {
          fetch(API_BASE + '/api/requests/artisan', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` }
          })
            .then(res => res.json())
            .then(data => setArtisanRequests(data));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };


  const [bookingArtisan, setBookingArtisan] = useState<Artisan | null>(null);
  const [bookingDesc, setBookingDesc] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');

  // ─── Handle Rating Submission ──────────────────────────────────────
  const handleRateRequest = async () => {
    if (!ratingRequest) return;
    try {
      await fetch(API_BASE + `/api/requests/${ratingRequest.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` },
        body: JSON.stringify({ rating: ratingValue, review: ratingReview })
      });
      setClientRequests(prev => prev.map(r => r.id === ratingRequest.id ? { ...r, rating: ratingValue, review: ratingReview } : r));
      setRatingRequest(null);
      setRatingValue(5);
      setRatingReview('');
      addNotification('⭐ تم إرسال التقييم! شكراً لك!');
    } catch (err) { console.error(err); }
  };

  // ─── Handle Chat ───────────────────────────────────────────────────
  const openChat = async (target: { artisanProfileId: string, clientId: string, name: string }) => {
    if (!user) {
      setView('login');
      return;
    }
    setChatArtisan(target);
    setView('chat');
    try {
      const res = await fetch(API_BASE + `/api/chat/${target.artisanProfileId}/${target.clientId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` }
      });
      const data = await res.json();
      setChatMessages(data);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) { console.error(err); }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !chatArtisan) return;
    const msg = chatInput;
    setChatInput('');
    try {
      await fetch(API_BASE + `/api/chat/${chatArtisan.artisanProfileId}/${chatArtisan.clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` },
        body: JSON.stringify({ message: msg })
      });
      // Message will come back via Socket.io
    } catch (err) { console.error(err); }
  };

  // ─── Handle Profile Save ───────────────────────────────────────────
  const handleSaveProfile = async () => {
    setProfileMsg(null);
    try {
      const res = await fetch(API_BASE + '/api/client/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` },
        body: JSON.stringify(profileForm)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.user) {
        localStorage.setItem('artisan_user', JSON.stringify(data.user));
        setUser(data.user);
      }
      setProfileMsg('✅ تم تحديث الملف الشخصي بنجاح!');
    } catch (err: any) {
      setProfileMsg(`❌ ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900" dir="rtl">
      <Navbar user={user} onLogout={handleLogout} onNavigate={setView} />

      {/* Real-time Notifications Toast */}
      <div className="fixed bottom-8 left-8 z-[100] space-y-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: -50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.9 }}
              className="bg-stone-900/95 backdrop-blur-md text-white p-5 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4 pointer-events-auto min-w-[300px]"
            >
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-bold tracking-tight">{n.msg}</p>
              <button
                onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}
                className="mr-auto p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Booking Modal */}
      <AnimatePresence>
        {bookingArtisan && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl border border-stone-100 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black tracking-tight uppercase">طلب خدمة</h3>
                <button onClick={() => setBookingArtisan(null)} className="p-2 hover:bg-stone-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                <div className="w-12 h-12 bg-stone-200 rounded-xl flex items-center justify-center font-black">{(bookingArtisan?.full_name || '?').charAt(0)}</div>
                <div>
                  <p className="font-bold">{bookingArtisan?.full_name || 'حرفي'}</p>
                  <p className="text-xs text-stone-500 uppercase font-bold">{bookingArtisan.category_name}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase">وصف المشكلة</label>
                <textarea
                  value={bookingDesc}
                  onChange={(e) => setBookingDesc(e.target.value)}
                  placeholder="اشرح ما تحتاجه هنا... (مثال: صنبور المطبخ يسرب الماء منذ الصباح...)"
                  className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:border-emerald-500 outline-none h-32 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-400 uppercase">التاريخ</label>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:border-emerald-500 outline-none text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-stone-400 uppercase">الوقت</label>
                  <input
                    type="time"
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:border-emerald-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 font-medium">بتأكيد الطلب، سيتم إرساله إلى الحرفي للتحقق من الموعد المختار. سيتواصل معك فور قبوله.</p>
              </div>

              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch(API_BASE + '/api/requests', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('artisan_token')}`
                      },
                      body: JSON.stringify({
                        artisanId: bookingArtisan.id,
                        categoryId: typeof bookingArtisan.category_id === 'object' ? (bookingArtisan.category_id as any).id : bookingArtisan.category_id,
                        description: bookingDesc,
                        lat: location?.lat || 36.8,
                        lng: location?.lng || 10.1,
                        scheduled_at: bookingDate && bookingTime ? `${bookingDate}T${bookingTime}` : null
                      })
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                      addNotification('تم إرسال طلبك بنجاح! يمكنك متابعته من لوحة التحكم.');
                      setBookingArtisan(null);
                      setBookingDesc('');
                    } else {
                      addNotification('خطأ: ' + (data.error || 'حدث خطأ غير متوقع'));
                    }
                  } catch (err) {
                    addNotification('حدث خطأ في الاتصال بالخادم');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading || !bookingDesc.trim()}
                className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black uppercase tracking-tighter hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed border-b-4 border-black"
              >
                {loading ? 'جاري الإرسال...' : (!bookingDesc.trim() ? 'الرجاء كتابة وصف للطلب' : 'تأكيد طلب الخدمة')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rating Modal */}
      <AnimatePresence>
        {ratingRequest && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl space-y-6"
            >
              <h3 className="text-2xl font-black uppercase tracking-tighter text-stone-900 text-center">تقييم تجربتك</h3>
              <p className="text-center text-stone-500 text-sm">كيف كانت جودة الخدمة مع <span className="font-bold text-stone-900">{ratingRequest.artisan_name}</span>؟</p>
              
              <div className="flex justify-center gap-2 py-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    onClick={() => setRatingValue(star)}
                    className={cn(
                      "w-10 h-10 cursor-pointer transition-all",
                      star <= ratingValue ? "text-amber-400 fill-current" : "text-stone-200"
                    )}
                  />
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-stone-400">رأيك الشخصي</label>
                <textarea
                  value={ratingReview}
                  onChange={(e) => setRatingReview(e.target.value)}
                  placeholder="أخبرنا بتجربتك..."
                  className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:border-emerald-500 h-32 resize-none"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setRatingRequest(null)}
                  className="flex-1 py-4 text-stone-400 font-bold uppercase tracking-widest text-sm hover:text-stone-600"
                >
                  تخطي
                </button>
                <button
                  onClick={handleRateRequest}
                  className="flex-1 bg-stone-900 text-white py-4 rounded-2xl font-black uppercase tracking-tighter hover:bg-stone-800"
                >
                  إرسال التقييم
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-12"
            >
              <section className="text-center space-y-6 py-12">
                <motion.h1
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-5xl md:text-7xl font-black tracking-tighter text-stone-900"
                >
                  ابحث عن أفضل <br />
                  <span className="text-emerald-600 italic">الحرفيين</span> الموثقين
                </motion.h1>
                <p className="text-lg text-stone-500 max-w-2xl mx-auto font-medium">
                  أول سوق ذكي للحرفيين التونسيين. ملفات شخصية موثقة، تقييمات شفافة وحجز فوري.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                  <div className="relative w-full max-w-md">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="موقعك (مثلاً: تونس، سوسة...)"
                      className="w-full pl-12 pr-4 py-4 bg-white border-2 border-stone-100 rounded-2xl focus:border-emerald-500 outline-none transition-all shadow-sm text-right"
                      onFocus={getUserLocation}
                    />
                  </div>
                  <button
                    onClick={() => handleSearch()}
                    className="w-full sm:w-auto bg-stone-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Search className="w-5 h-5" />
                    ابحث في منطقتي
                  </button>
                </div>
              </section>

              {/* Hero Image */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative rounded-3xl overflow-hidden shadow-2xl"
              >
                <img
                  src="/hero.jpg"
                  alt="حرفيون تونسيون محترفون - تـوّا"
                  className="w-full object-cover"
                  style={{ maxHeight: '480px' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 via-transparent to-transparent" />
                <div className="absolute bottom-6 right-6 text-right">
                  <p className="text-white font-black text-2xl drop-shadow-lg">حرفيون موثقون</p>
                  <p className="text-emerald-300 text-sm font-bold">جاهزون لخدمتك في أي وقت</p>
                </div>
              </motion.div>

              <section className="space-y-6">
                <div className="flex justify-between items-end">
                  <h2 className="text-2xl font-bold tracking-tight">الفئات الشائعة</h2>
                  <button 
                    onClick={() => {
                      setSelectedCategory(null);
                      handleSearch(undefined);
                    }}
                    className="text-sm font-bold text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors"
                  >
                    عرض الكل
                  </button>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                  {categories.map(cat => (
                    <CategoryCard
                      key={cat.id}
                      category={cat}
                      active={selectedCategory === cat.slug}
                      onClick={() => {
                        const newSlug = selectedCategory === cat.slug ? '' : cat.slug;
                        setSelectedCategory(newSlug || null);
                        handleSearch(newSlug, false);
                      }}
                    />
                  ))}
                </div>
              </section>

              {/* Artisan Cards with Pagination */}
              {artisans.length > 0 && (
                <section className="space-y-6">
                  <div className="flex justify-between items-end">
                    <h2 className="text-2xl font-bold tracking-tight">
                      {selectedCategory
                        ? `حرفيون في ${categories.find(c => c.slug === selectedCategory)?.name}`
                        : 'حرفيون قريبون منك'}
                      <span className="text-sm font-normal text-stone-400 mr-2">({artisans.length} نتيجة)</span>
                    </h2>
                    <button
                      onClick={() => setView('search-results')}
                      className="text-sm font-bold text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors"
                    >
                      عرض الكل →
                    </button>
                  </div>

                  {loading ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[1,2,3].map(i => <div key={i} className="h-48 bg-stone-200 animate-pulse rounded-2xl" />)}
                    </div>
                  ) : (
                    <>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {artisans
                          .slice(artisanPage * ARTISANS_PER_PAGE, (artisanPage + 1) * ARTISANS_PER_PAGE)
                          .map(artisan => (
                            <ArtisanCard
                              key={artisan.id}
                              artisan={artisan}
                              onClick={() => {
                                setSelectedArtisan(artisan);
                                fetch(API_BASE + `/api/artisans/${artisan.id}/photos`)
                                  .then(res => res.json())
                                  .then(data => setSelectedArtisanPhotos(data));
                                setView('artisan-detail');
                              }}
                            />
                          ))}
                      </div>

                      {/* Pagination Controls */}
                      {artisans.length > ARTISANS_PER_PAGE && (
                        <div className="flex items-center justify-center gap-4 pt-4">
                          <button
                            onClick={() => setArtisanPage(p => Math.max(0, p - 1))}
                            disabled={artisanPage === 0}
                            className="px-5 py-2 bg-white border border-stone-200 rounded-xl text-sm font-bold hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          >
                            ← السابق
                          </button>
                          <span className="text-sm font-bold text-stone-500">
                            صفحة {artisanPage + 1} من {Math.ceil(artisans.length / ARTISANS_PER_PAGE)}
                          </span>
                          <button
                            onClick={() => setArtisanPage(p => Math.min(Math.ceil(artisans.length / ARTISANS_PER_PAGE) - 1, p + 1))}
                            disabled={(artisanPage + 1) * ARTISANS_PER_PAGE >= artisans.length}
                            className="px-5 py-2 bg-stone-900 text-white rounded-xl text-sm font-bold hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          >
                            التالي →
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}

              {/* Inline Map / Radar Section */}
              <section className="space-y-4">
                <div className="flex justify-between items-end">
                  <h2 className="text-2xl font-bold tracking-tight">رادار الحرفيين 🗺️</h2>
                  <button
                    onClick={() => setView('map')}
                    className="text-sm font-bold text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors"
                  >
                    فتح الخريطة الكاملة →
                  </button>
                </div>
                {/* Real Leaflet Map - clean white container */}
                <div className="rounded-3xl overflow-hidden border border-stone-200 shadow-sm" style={{ height: '320px' }}>
                  <ArtisanMap
                    artisans={artisans}
                    userLocation={location}
                    onArtisanClick={(a) => {
                      setSelectedArtisan(a as any);
                      fetch(API_BASE + `/api/artisans/${a.id}/photos`)
                        .then(res => res.json())
                        .then(data => setSelectedArtisanPhotos(data));
                      setView('artisan-detail');
                    }}
                  />
                </div>
              </section>

              <section className="grid md:grid-cols-3 gap-8 py-12">
                {[
                  { icon: ShieldCheck, title: "ملفات موثقة", desc: "يخضع كل حرفي لعملية تحقق صارمة للهوية والمهارات لضمان الجودة." },
                  { icon: Star, title: "ترتيب ذكي", desc: "نظامنا يرتب النتائج حسب المسافة والتقييم والموثوقية لتجد الأنسب لك." },
                  { icon: Clock, title: "حجز فوري", desc: "أنشئ طلباً واحصل على ردود من الحرفيين المتاحين في محيطك خلال دقائق." }
                ].map((feature, i) => (
                  <div key={i} className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-shadow text-right" dir="rtl">
                    <div className="bg-emerald-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
                      <feature.icon className="text-emerald-600 w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                    <p className="text-stone-500 text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
              </section>
            </motion.div>
          )}

          {view === 'map' && (
            <motion.div
              key="map-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <div>
                  <button onClick={() => setView('home')} className="text-sm font-bold text-stone-400 hover:text-stone-600 mb-1 flex items-center gap-1 uppercase tracking-widest">
                    العودة للرئيسية →
                  </button>
                  <h2 className="text-3xl font-black tracking-tight">خريطة الحرفيين 🗺️</h2>
                  <p className="text-stone-500 text-sm mt-1">{artisans.length > 0 ? `${artisans.length} حرفي متوفر في منطقتك` : 'ابحث أولاً لتحميل الحرفيين'}</p>
                </div>
                {artisans.length === 0 && (
                  <button
                    onClick={() => handleSearch(undefined, false)}
                    className="bg-stone-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    تحميل الحرفيين
                  </button>
                )}
              </div>
              <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-stone-100" style={{ height: '65vh' }}>
                <ArtisanMap
                  artisans={artisans}
                  userLocation={location}
                  onArtisanClick={(a) => {
                    setSelectedArtisan(a as any);
                    fetch(API_BASE + `/api/artisans/${a.id}/photos`)
                      .then(res => res.json())
                      .then(data => setSelectedArtisanPhotos(data));
                    setView('artisan-detail');
                  }}
                />
              </div>
            </motion.div>
          )}

          {view === 'artisan-detail' && selectedArtisan && (
            <motion.div
              key="artisan-detail"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <Helmet>
                <title>{selectedArtisan.full_name} - {selectedArtisan.category_name} على تـوّا</title>
                <meta property="og:title" content={`${selectedArtisan.full_name} - ${selectedArtisan.category_name}`} />
                <meta property="og:description" content={selectedArtisan.bio || "اكتشف أفضل الحرفيين الموثوقين في تونس."} />
                <meta property="og:image" content={selectedArtisan.profile_image || "https://tawa.tn/default-artisan.jpg"} />
              </Helmet>
              <button onClick={() => setView('search-results')} className="text-sm font-bold text-stone-400 hover:text-stone-600 mb-2 flex items-center gap-1 uppercase tracking-widest text-right" dir="rtl">
                العودة إلى النتائج →
              </button>

              <div className="bg-white rounded-3xl border border-stone-100 p-8 shadow-sm flex flex-col md:flex-row gap-8 text-right" dir="rtl">
                <div className="w-24 h-24 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-300 text-4xl font-black">
                  {(selectedArtisan?.full_name || '?').charAt(0)}
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1 justify-start">
                      <h2 className="text-4xl font-black tracking-tight">{selectedArtisan.full_name}</h2>
                      {selectedArtisan.is_verified === 1 && (
                        <div className="flex gap-2">
                          <ShieldCheck className="text-emerald-600 w-6 h-6" />
                          {selectedArtisan.smart_score > 0.8 && (
                            <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" /> متميز
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-emerald-600 font-bold uppercase tracking-widest text-sm text-right">{selectedArtisan.category_name}</p>
                  </div>
                  <p className="text-stone-600 leading-relaxed text-lg italic">"{selectedArtisan.bio || 'حرفي محترف جاهز لتلبية احتياجاتك بكل دقة.'}"</p>

                  <div className="flex flex-wrap gap-6 pt-4 justify-start">
                    <div className="flex items-center gap-2">
                      <Star className="text-amber-500 fill-current w-5 h-5" />
                      <span className="font-bold">{selectedArtisan.avg_rating.toFixed(1)} تقييم</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="text-stone-400 w-5 h-5" />
                      <span className="font-bold text-stone-900">{selectedArtisan.completed_jobs} عمل مكتمل</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="text-stone-400 w-5 h-5" />
                      <span className="font-bold text-stone-900">على بعد {selectedArtisan.distance_km} كم</span>
                    </div>
                  </div>
                </div>
                <div className="md:w-64 space-y-4">
                  <button
                    onClick={() => setBookingArtisan(selectedArtisan)}
                    className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold border-b-4 border-black hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
                  >
                    اطلب الخدمة الآن
                  </button>
                  <button
                    onClick={() => {
                      if (!user) { setView('login'); return; }
                      openChat({
                        artisanProfileId: selectedArtisan.id,
                        clientId: user.id,
                        name: selectedArtisan.full_name
                      });
                    }}
                    className="w-full bg-emerald-50 text-emerald-700 border border-emerald-200 py-4 rounded-2xl font-bold hover:bg-emerald-100 transition-all flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    راسل الحرفي
                  </button>
                  <div className="px-4 py-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-3">
                    <div className={cn("w-2 h-2 rounded-full", selectedArtisan.is_online ? "bg-emerald-500 animate-pulse" : "bg-stone-300")} />
                    <span className="text-xs font-bold text-stone-500 uppercase">{selectedArtisan.is_online ? 'متوفر الآن' : 'غير متصل'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-stone-100 p-8 shadow-sm space-y-6">
                <h3 className="text-2xl font-black tracking-tight">Work Portfolio</h3>
                <PhotoGallery photos={selectedArtisanPhotos} />
              </div>
            </motion.div>
          )}

          {view === 'search-results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-right" dir="rtl">
                <div>
                  <button onClick={() => setView('home')} className="text-sm font-bold text-stone-400 hover:text-stone-600 mb-2 flex items-center gap-1 uppercase tracking-widest justify-end">
                    العودة للرئيسية →
                  </button>
                  <h2 className="text-3xl font-black tracking-tight">
                    تم العثور على {artisans.length} حرفياً
                    {selectedCategory && <span className="text-emerald-600"> في {categories.find(c => c.slug === selectedCategory)?.name}</span>}
                  </h2>
                </div>
                <div className="flex gap-2 bg-white p-1 rounded-xl border border-stone-200">
                  <button 
                    onClick={() => setSortBy('smart')}
                    className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", sortBy === 'smart' ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-50")}
                  >
                    الترتيب الذكي
                  </button>
                  <button 
                    onClick={() => setSortBy('distance')}
                    className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", sortBy === 'distance' ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-50")}
                  >
                    المسافة
                  </button>
                  <button 
                    onClick={() => setSortBy('rating')}
                    className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", sortBy === 'rating' ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-50")}
                  >
                    التقييم
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-64 bg-stone-200 animate-pulse rounded-2xl" />
                  ))}
                </div>
              ) : artisans.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedArtisans.map(artisan => (
                    <ArtisanCard
                      key={artisan.id}
                      artisan={artisan}
                      onClick={() => {
                        setSelectedArtisan(artisan);
                        fetch(API_BASE + `/api/artisans/${artisan.id}/photos`)
                          .then(res => res.json())
                          .then(data => setSelectedArtisanPhotos(data));
                        setView('artisan-detail');
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-stone-200">
                  <AlertCircle className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-stone-900">لم يتم العثور على أي حرفيين في منطقتك</h3>
                  <p className="text-stone-500">حاول توسيع نطاق البحث أو اختيار فئة أخرى.</p>
                </div>
              )}
            </motion.div>
          )}

          {view === 'login' && (
            <motion.div
              key="login"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto bg-white p-8 rounded-3xl shadow-xl border border-stone-100 mt-12"
            >
              <h2 className="text-3xl font-black mb-6 text-center">أهلاً بك مجدداً</h2>
              {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm rounded-xl border border-rose-100">{error}</div>}
              <form className="space-y-4" onSubmit={handleLogin}>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none text-right"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">كلمة المرور</label>
                  <input
                    type="password"
                    required
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none text-right"
                  />
                </div>
                <button className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                  تسجيل الدخول
                </button>
              </form>
              <p className="mt-6 text-center text-sm text-stone-500">
                ليس لديك حساب؟ <button onClick={() => setView('register')} className="text-emerald-600 font-bold">سجل الآن</button>
              </p>
            </motion.div>
          )}

          {view === 'client-dashboard' && (
            <motion.div
              key="client-dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <h2 className="text-3xl font-black tracking-tight">طلبات الخدمة الخاصة بي</h2>
              <div className="grid gap-6">
                {clientRequests.length > 0 ? clientRequests.map((req, i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-bold text-lg">{req.category_name}</p>
                        <span className={cn(
                          "text-[10px] font-black uppercase px-2 py-0.5 rounded-full border",
                          req.status === 'pending' ? "bg-amber-50 text-amber-600 border-amber-100" :
                            req.status === 'accepted' ? "bg-blue-50 text-blue-600 border-blue-100" :
                              "bg-emerald-600 text-white border-emerald-600"
                        )}>
                          {req.status === 'pending' ? 'قيد الانتظار' : req.status === 'accepted' ? 'تم القبول' : 'مكتمل'}
                        </span>
                      </div>
                      <p className="text-sm text-stone-600 mb-1">الحرفي: <span className="font-bold">{req.artisan_name}</span></p>
                      <p className="text-xs text-stone-400 italic">"{req.description}"</p>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <div className="flex gap-2">
                        {req.status !== 'pending' && (
                          <button
                            onClick={() => openChat({ artisanProfileId: req.artisan_id, clientId: req.client_id, name: req.artisan_name })}
                            className="bg-stone-50 text-stone-500 p-2 rounded-xl border border-stone-200 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                        )}
                        {req.status === 'completed' && !req.rating && (
                          <button
                            onClick={() => setRatingRequest(req)}
                            className="bg-amber-50 text-amber-600 p-2 rounded-xl border border-amber-100 hover:bg-amber-100 transition-colors"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {req.rating && (
                        <div className="flex items-center gap-1 text-amber-500">
                          {[...Array(req.rating)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                        </div>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="bg-white p-12 rounded-3xl border border-stone-100 text-center space-y-4">
                    <ClipboardList className="w-12 h-12 text-stone-200 mx-auto" />
                    <p className="text-stone-400">لم تقم بإرسال أي طلبات بعد.</p>
                    <button onClick={() => setView('home')} className="bg-stone-900 text-white px-6 py-2 rounded-xl text-xs font-bold">ابدأ البحث الآن</button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'admin-dashboard' && (
            <motion.div
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-black tracking-tight">لوحة تحكم المسؤول</h2>
                  <div className="flex gap-2 bg-stone-100 p-1 rounded-xl">
                    <button
                      onClick={() => setAdminTab('verifications')}
                      className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", adminTab === 'verifications' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:bg-white/50")}
                    >
                      طلبات التوثيق
                    </button>
                    <button
                      onClick={() => setAdminTab('accounts')}
                      className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", adminTab === 'accounts' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:bg-white/50")}
                    >
                      حسابات المستخدمين
                    </button>
                  </div>
                </div>

                {adminTab === 'verifications' ? (
                  <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
                    <table className="w-full text-right" dir="rtl">
                      <thead className="bg-stone-50 border-b border-stone-200">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400 text-right">الحرفي / الهاتف</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400 text-right">الفئة / الوثائق</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400 text-right">الحالة</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400 text-right">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {pendingArtisans.length > 0 ? pendingArtisans.map((item, i) => (
                          <tr key={i} className="hover:bg-stone-50 transition-colors text-right">
                            <td className="px-6 py-4">
                              <div className="font-bold text-stone-900">{item.full_name}</div>
                              <div className="text-xs text-stone-500">{item.email}</div>
                              <div className="text-xs font-bold text-emerald-600 mt-1">{item.phone || "بدون هاتف"}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-stone-600 mb-2">{item.category_name || 'غير محدد'}</div>
                              <div className="flex flex-wrap gap-2">
                                {item.documents && item.documents.map((d: any, di: number) => (
                                  <a key={di} href={API_BASE + d.file_path} target="_blank" className="text-[9px] bg-stone-100 px-2 py-1 rounded border border-stone-200 text-stone-500 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                                    معاينة {d.doc_type === 'cin' ? 'البطاقة' : 'الوثيقة'}
                                  </a>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] bg-stone-100 px-2 py-1 rounded border border-stone-200 text-stone-600 text-center">في انتظار المراجعة</span>
                                {item.contract_signed ? (
                                  <span className="text-[9px] text-emerald-600 font-bold">✓ تم توقيع العقد</span>
                                ) : (
                                  <span className="text-[9px] text-rose-400 font-bold">⚠ العقد غير موقع</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-2">
                                <button 
                                  onClick={() => {
                                    if(window.confirm("هل تأكدت من الوثائق وتوقيع العقد مع الحرفي؟")) {
                                      handleVerify(item.id, 'approved', true);
                                    }
                                  }} 
                                  className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-50"
                                >
                                  تفعيل الحساب (بعد العقد)
                                </button>
                                <button onClick={() => handleVerify(item.id, 'rejected')} className="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors">رفض</button>
                              </div>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-stone-400">لا توجد طلبات معلقة حالياً.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-stone-50 border-b border-stone-200">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">المعرف</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">الاسم / البريد</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">الدور</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">تاريخ الانضمام</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {allUsers.length > 0 ? allUsers.map((u, i) => (
                          <tr key={i} className="hover:bg-stone-50 transition-colors text-right">
                            <td className="px-6 py-4 text-sm font-bold text-stone-500">#{u.id}</td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-stone-900">{u.fullName || 'غير معروف'}</div>
                              <div className="text-xs text-stone-500">{u.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "text-[10px] font-black uppercase px-2 py-1 rounded-md border",
                                u.role === 'admin' ? "bg-purple-50 text-purple-600 border-purple-200" :
                                u.role === 'artisan' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                                "bg-blue-50 text-blue-600 border-blue-200"
                              )}>
                                {u.role === 'admin' ? 'مسؤول' : u.role === 'artisan' ? 'حرفي' : 'عميل'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-stone-500">{(u as any).created_at ? new Date((u as any).created_at).toLocaleDateString('ar-TN') : 'غير معروف'}</td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={u.role === 'admin'}
                                className="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                حذف
                              </button>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-stone-400">لم يتم العثور على مستخدمين.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'artisan-dashboard' && (
            artisanProfile?.verification_status !== 'approved' ? (
              <motion.div
                key="artisan-waiting"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto py-24 text-center space-y-8"
              >
                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                  <Clock className="w-12 h-12 text-emerald-600" />
                </div>
                <div className="space-y-4">
                  <h2 className="text-4xl font-black tracking-tighter uppercase text-stone-900">مرحباً بك في تـوّا</h2>
                  <p className="text-xl text-stone-500 font-medium">تم استلام طلبك بنجاح! نحن الآن في طور مراجعة بياناتك.</p>
                  <div className="bg-white p-8 rounded-3xl border border-emerald-100 shadow-xl shadow-emerald-50/50 space-y-4 max-w-lg mx-auto">
                    <p className="text-stone-900 font-bold">ماذا سيحدث الآن؟</p>
                    <p className="text-sm text-stone-500 leading-relaxed">سيقوم أحد مسؤولي المنصة بالاتصال بك على رقم هاتفك <span className="text-emerald-600 font-black">({user?.phone})</span> خلال 24 ساعة للتحقق من هويتك وتوقيع عقد العمل.</p>
                    <div className="pt-4 flex items-center justify-center gap-2 text-emerald-600 font-black text-xs uppercase tracking-widest">
                      <ShieldCheck className="w-4 h-4" />
                      يرجى إبقاء هاتفك متاحاً
                    </div>
                  </div>
                  <button onClick={() => setView('home')} className="text-emerald-600 font-bold uppercase tracking-widest text-xs hover:underline pt-8">العودة للرئيسية</button>
                </div>
              </motion.div>
            ) : (
            <motion.div
              key="artisan"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Online/Offline Toggle */}
              <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-stone-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-3 h-3 rounded-full transition-colors",
                    artisanProfile?.is_online ? "bg-emerald-500 animate-pulse" : "bg-stone-300"
                  )} />
                  <div>
                    <p className="font-bold text-stone-900 text-sm">
                      {artisanProfile?.is_online ? 'أنت متوفر الآن للخدمة' : 'أنت غير متوفر حالياً'}
                    </p>
                    <p className="text-xs text-stone-400">{artisanProfile?.is_online ? 'يمكن للزبائن رؤيتك ومراسلتك' : 'لن تظهر في نتائج البحث'}</p>
                  </div>
                </div>
                <button
                  onClick={toggleOnlineStatus}
                  className={cn(
                    "relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none",
                    artisanProfile?.is_online ? "bg-emerald-500" : "bg-stone-200"
                  )}
                >
                  <span className={cn(
                    "absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300",
                    artisanProfile?.is_online ? "left-8" : "left-1"
                  )} />
                </button>
              </div>

              <div className="grid md:grid-cols-4 gap-4">
                {[
                  { label: "إجمالي الأرباح", val: "غير متوفر", icon: Zap, color: "bg-emerald-500" },
                  { label: "الأعمال المكتملة", val: artisanProfile?.completed_jobs || 0, icon: ClipboardList, color: "bg-blue-500" },
                  { label: "متوسط التقييم", val: (artisanProfile?.avg_rating || 0).toFixed(1), icon: Star, color: "bg-amber-500" },
                  { label: "حالة التوثيق", val: artisanProfile?.verification_status === 'approved' ? 'موثق' : 'قيد المراجعة', icon: ShieldCheck, color: "bg-purple-500" }
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-white", stat.color)}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{stat.label}</p>
                    <p className="text-2xl font-black text-stone-900">{stat.val}</p>
                  </div>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">الطلبات النشطة</h3>
                    <span className="text-xs font-bold text-stone-400 uppercase">إجمالي {artisanRequests.length}</span>
                  </div>
                  <div className="space-y-4">
                    {artisanRequests.length > 0 ? artisanRequests.map((req, i) => (
                      <div key={i} className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex justify-between items-center text-right" dir="rtl">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-stone-900">{req.category_name}</p>
                            <span className={cn(
                              "text-[10px] font-black uppercase px-2 py-0.5 rounded-full border",
                              req.status === 'pending' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                req.status === 'accepted' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                  "bg-emerald-600 text-white border-emerald-600"
                            )}>
                              {req.status === 'pending' ? 'جديد' : req.status === 'accepted' ? 'مقبول' : 'مكتمل'}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500">العميل: {req.client_name} • {req.description}</p>
                        </div>
                        <div className="flex gap-2">
                          {req.status !== 'pending' && (
                            <button
                              onClick={() => openChat({ artisanProfileId: req.artisan_id, clientId: req.client_id, name: req.client_name })}
                              className="bg-stone-100 text-stone-500 p-2 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                            >
                              <MessageCircle className="w-3 h-3" />
                            </button>
                          )}
                          {req.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleUpdateRequestStatus(req.id, 'accepted')}
                                className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight hover:bg-emerald-700 transition-colors"
                              >
                                قبول
                              </button>
                              <button
                                onClick={() => handleUpdateRequestStatus(req.id, 'rejected')}
                                className="bg-white text-stone-400 border border-stone-200 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-colors"
                              >
                                رفض
                              </button>
                            </>
                          )}
                          {req.status === 'accepted' && (
                            <button
                              onClick={() => handleUpdateRequestStatus(req.id, 'completed')}
                              className="bg-stone-900 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight"
                            >
                              إتمام العمل
                            </button>
                          )}
                        </div>
                      </div>
                    )) : (
                      <p className="text-center py-8 text-stone-400">لا توجد طلبات نشطة حالياً.</p>
                    )}
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">معرض الأعمال</h3>
                    <label className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-emerald-700 transition-colors">
                      إضافة صورة
                      <input type="file" className="hidden" onChange={handleUploadPhoto} accept="image/*" />
                    </label>
                  </div>
                  <PhotoGallery photos={artisanPhotos} />
                  <p className="text-sm text-stone-500">أضف صوراً لأهم أعمالك لجذب المزيد من الزبائن.</p>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">إعدادات الملف الشخصي</h3>
                    <button
                      onClick={async () => {
                        setLoading(true);
                        try {
                          const bio = "حرفي محترف في فئة " + (artisanProfile?.category_name || "الحرف") + " مع سنوات من الخبرة في العمل عالي الجودة. ملتزم بخدمة السوق التونسية بكل ثقة ومصداقية.";
                          setArtisanProfile({ ...artisanProfile, bio });
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="text-xs font-bold text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                    >
                      ✨ سيرة ذاتية ذكية
                    </button>
                  </div>
                  <div className="space-y-4 text-right" dir="rtl">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-stone-400 uppercase">فئة الخدمة</label>
                        <select
                          value={artisanProfile?.category_id || ''}
                          onChange={(e) => setArtisanProfile({ ...artisanProfile, category_id: e.target.value })}
                          className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none h-12 text-sm text-right"
                        >
                          <option value="">اختر الفئة</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-stone-400 uppercase">نطاق الخدمة (كم)</label>
                        <input
                          type="number"
                          value={artisanProfile?.service_radius_km || 20}
                          onChange={(e) => setArtisanProfile({ ...artisanProfile, service_radius_km: parseFloat(e.target.value) })}
                          className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none h-12 text-sm text-right"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase flex justify-between">
                        موقع الخدمة (GPS)
                        <button
                          onClick={() => {
                            if (navigator.geolocation) {
                              navigator.geolocation.getCurrentPosition((pos) => {
                                setArtisanProfile({ ...artisanProfile, lat: pos.coords.latitude, lng: pos.coords.longitude });
                              });
                            }
                          }}
                          className="text-emerald-600 hover:text-emerald-700 normal-case"
                        >
                          تحديد موقعي التلقائي
                        </button>
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <input
                          placeholder="خط العرض"
                          type="number"
                          value={artisanProfile?.lat || ''}
                          readOnly
                          className="w-full p-3 bg-stone-100 border border-stone-200 rounded-xl text-stone-500 text-sm text-center"
                        />
                        <input
                          placeholder="خط الطول"
                          type="number"
                          value={artisanProfile?.lng || ''}
                          readOnly
                          className="w-full p-3 bg-stone-100 border border-stone-200 rounded-xl text-stone-500 text-sm text-center"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-400 uppercase">السيرة الذاتية (Bio)</label>
                      <textarea
                        value={artisanProfile?.bio || ''}
                        onChange={(e) => setArtisanProfile({ ...artisanProfile, bio: e.target.value })}
                        className="w-full mt-2 p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:border-emerald-500 outline-none h-32 text-sm text-right"
                        placeholder="أخبر الزبائن عن خبرتك ومهاراتك..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase">وثائق التوثيق (بطاقة التعريف / دبلوم)</label>
                      <div className="flex gap-4">
                        <label className="flex-1 bg-stone-50 border-2 border-dashed border-stone-200 p-4 rounded-2xl text-center cursor-pointer hover:bg-stone-100 transition-colors">
                          <span className="text-xs font-bold text-stone-500">انقر لتحميل الوثيقة</span>
                          <input type="file" className="hidden" onChange={(e) => handleUploadDocument(e, 'cin')} accept=".pdf,image/*" />
                        </label>
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        await fetch(API_BASE + '/api/artisan/profile', {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('artisan_token')}`
                          },
                          body: JSON.stringify(artisanProfile)
                        });
                        alert('تم تحديث الملف الشخصي بنجاح!');
                      }}
                      className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all border-b-4 border-black"
                    >
                      حفظ الملف الشخصي المهني
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {view === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto bg-white p-8 rounded-3xl shadow-xl border border-stone-100 mt-12"
            >
              <h2 className="text-3xl font-black mb-6 text-center">انضم إلى تعاوني</h2>
              <div className="flex gap-2 mb-8 p-1 bg-stone-100 rounded-xl">
                <button
                  onClick={() => setRegData({ ...regData, role: 'client' })}
                  className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", regData.role === 'client' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:bg-white/50")}
                >
                  أنا عميل
                </button>
                <button
                  onClick={() => setRegData({ ...regData, role: 'artisan' })}
                  className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", regData.role === 'artisan' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:bg-white/50")}
                >
                  أنا حرفي
                </button>
              </div>
              {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm rounded-xl border border-rose-100">{error}</div>}
              <form className="space-y-4" onSubmit={handleRegister}>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">الاسم الكامل</label>
                  <input
                    type="text"
                    required
                    value={regData.fullName}
                    onChange={(e) => setRegData({ ...regData, fullName: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none text-right"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">البريد الإلكتروني</label>
                  <input
                    type="email"
                    required
                    value={regData.email}
                    onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none text-right"
                  />
                </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase tracking-widest text-stone-400">رقم الهاتف</label>
                    <input
                      type="tel"
                      required
                      placeholder="مثال: 000 000 21"
                      value={regData.phone}
                      onChange={(e) => setRegData({ ...regData, phone: e.target.value })}
                      className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none text-right"
                    />
                  </div>

                  {regData.role === 'artisan' && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-widest text-stone-400">الفئة المهنية</label>
                      <select
                        required
                        value={regData.categoryId}
                        onChange={(e) => setRegData({ ...regData, categoryId: e.target.value })}
                        className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:border-emerald-500 text-right appearance-none font-bold"
                        dir="rtl"
                      >
                        <option value="">اختر التخصص...</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">كلمة المرور</label>
                  <input
                    type="password"
                    required
                    value={regData.password}
                    onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none text-right"
                  />
                </div>
                <button className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                  إنشاء حساب
                </button>
              </form>
              <p className="mt-6 text-center text-sm text-stone-500">
                لديك حساب بالفعل؟ <button onClick={() => setView('login')} className="text-emerald-600 font-bold">تسجيل الدخول</button>
              </p>
            </motion.div>
          )}

          {view === 'otp-verification' && (
            <motion.div
              key="otp-verification"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto bg-white p-8 rounded-3xl shadow-xl border border-stone-100 mt-12 text-center space-y-6"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-10 h-10 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-stone-900">تأكيد رقم الـ WhatsApp</h2>
                <p className="text-stone-500 text-sm mt-2">لقد أرسلنا رمزاً مكوناً من 6 أرقام إلى هاتفك <span className="font-bold text-stone-900" dir="ltr">{user?.phone}</span> عبر واتساب.</p>
              </div>

              {error && <div className="p-3 bg-rose-50 text-rose-600 text-sm rounded-xl border border-rose-100">{error}</div>}

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000 000"
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value)}
                  className="w-full text-center text-4xl font-black tracking-[0.2em] p-4 bg-stone-50 border-2 border-stone-100 rounded-2xl outline-none focus:border-emerald-500 transition-all"
                />
                <button className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                  تأكيد الرمز والدخول
                </button>
              </form>
              
              <button onClick={() => setView('login')} className="text-xs font-bold text-stone-400 uppercase tracking-widest hover:text-stone-600">العودة لتسجيل الدخول</button>
            </motion.div>
          )}

          {view === 'chat' && chatArtisan && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl border border-stone-100 flex flex-col h-[700px] overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                <div className="flex items-center gap-4">
                  <button onClick={() => setView('client-dashboard')} className="p-2 hover:bg-stone-200 rounded-xl transition-colors"><X className="w-5 h-5 text-stone-400" /></button>
                  <div>
                    <h3 className="font-black uppercase tracking-tighter text-stone-900">{chatArtisan.full_name || chatArtisan.fullName}</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Active Chat</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-stone-50/50">
                {chatMessages.map((m, i) => (
                  <div key={i} className={cn("flex", m.is_mine ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[80%] p-4 rounded-2xl text-sm font-medium shadow-sm",
                      m.is_mine ? "bg-stone-900 text-white rounded-br-none" : "bg-white text-stone-900 border border-stone-200 rounded-bl-none"
                    )}>
                      <p>{m.message}</p>
                      <p className={cn("text-[9px] mt-1 opacity-50", m.is_mine ? "text-right" : "")}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 border-t border-stone-100 bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                    placeholder="Type your message..."
                    className="flex-1 p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleSendChat}
                    className="bg-emerald-600 text-white p-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black tracking-tighter uppercase">رادار الحرفيين</h2>
                <div className="flex gap-2">
                  <button onClick={() => setView('home')} className="text-xs font-bold text-stone-400 uppercase tracking-widest hover:text-stone-600 transition-colors">إغلاق المعاينة</button>
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-stone-200 rounded-3xl h-[600px] relative overflow-hidden flex items-center justify-center border-4 border-white shadow-2xl">
                  <div className="absolute inset-0 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px] opacity-10" />
                  <div className="text-center space-y-4 z-10">
                    <div className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center mx-auto animate-ping opacity-20 absolute top-1/2 left-1/2 -ml-10 -mt-10" />
                    <MapPin className="w-12 h-12 text-emerald-600 mx-auto" />
                    <p className="font-black text-stone-400 uppercase tracking-widest text-xs">جاري البحث عن حرفيين في منطقتك...</p>
                    <div className="flex gap-2 justify-center">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                    </div>
                  </div>
                  {/* Dynamic artisan locations based on search results */}
                  {artisans.map((a, i) => {
                    // Simple relative positioning for the radar mockup
                    const latDiff = (a as any).lat ? ((a as any).lat - (location?.lat || 36.8)) : (Math.random() - 0.5) * 0.4;
                    const lngDiff = (a as any).lng ? ((a as any).lng - (location?.lng || 10.1)) : (Math.random() - 0.5) * 0.4;
                    
                    const top = 50 + (latDiff * 200); // Scale factor
                    const left = 50 + (lngDiff * 200);
                    
                    return (
                      <motion.div 
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        style={{ top: `${top}%`, left: `${left}%` }}
                        className="absolute w-4 h-4 group cursor-pointer"
                        onClick={(e) => { 
                          e.stopPropagation();
                          if (activeRadarId === a.id) {
                            setSelectedArtisan(a); 
                            setView('artisan-detail'); 
                          } else {
                            setActiveRadarId(a.id);
                          }
                        }}
                      >
                        <div className={cn(
                          "w-full h-full rounded-full shadow-lg border-2 border-white transition-all",
                          activeRadarId === a.id ? "bg-stone-900 scale-125 z-30" : "bg-emerald-500 animate-pulse shadow-emerald-200"
                        )} />
                        <div className={cn(
                          "absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-stone-900 text-white text-[10px] px-2 py-1 rounded-md transition-all whitespace-nowrap z-20 pointer-events-none font-bold shadow-xl",
                          activeRadarId === a.id ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
                        )}>
                          {a.full_name} (اضغط مرة أخرى للتفاصيل)
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                
                <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm space-y-6 overflow-y-auto max-h-[600px]">
                  <h3 className="font-bold text-lg uppercase tracking-tight text-stone-900">حرفيون قريبون</h3>
                  <div className="space-y-4">
                    {artisans.length > 0 ? artisans.map((a, i) => (
                      <div key={i} className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center gap-4 group cursor-pointer hover:border-emerald-200 hover:bg-emerald-50/50 transition-all" onClick={() => { setSelectedArtisan(a); setView('artisan-detail'); }}>
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-emerald-600 border border-stone-100 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-colors">{(a.full_name || '?').charAt(0)}</div>
                        <div>
                          <p className="font-bold text-sm text-stone-900">{a.full_name || 'حرفي'}</p>
                          <p className="text-[10px] text-stone-400 font-bold uppercase">{a.category_name} • {a.distance_km} كم</p>
                        </div>
                      </div>
                    )) : <p className="text-xs text-stone-400 font-bold italic">Search to find artisans nearby...</p>}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'notifications' && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-black tracking-tighter uppercase text-stone-900">Notifications</h2>
                <button onClick={() => setNotifHistory([])} className="text-xs font-bold text-rose-500 uppercase tracking-widest">Clear All</button>
              </div>

              <div className="space-y-4">
                {notifHistory.length > 0 ? notifHistory.map((n, i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                      <Bell className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-bold text-stone-900 text-sm">{n.msg}</p>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">{n.time}</p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-24 bg-white rounded-3xl border border-stone-100">
                    <Bell className="w-12 h-12 text-stone-100 mx-auto mb-4" />
                    <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">No notifications yet</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'client-profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-xl mx-auto space-y-8"
            >
              <h2 className="text-3xl font-black tracking-tighter uppercase text-stone-900 text-right">إعدادات الحساب</h2>
              
              <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-xl space-y-8 text-right" dir="rtl">
                <div className="flex items-center gap-6 justify-start">
                  <div className="w-20 h-20 bg-stone-100 rounded-3xl flex items-center justify-center font-black text-3xl text-stone-300 border-2 border-stone-50">
                    {(user?.fullName || '?').charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-stone-900">{user?.fullName || 'مستخدم'}</h3>
                    <p className="text-stone-400 font-medium">{user?.email}</p>
                    <span className="inline-block mt-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">عميل موثق</span>
                  </div>
                </div>

                {profileMsg && (
                  <div className={cn("p-4 rounded-2xl text-sm font-bold border", profileMsg.includes('✅') ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100")}>
                    {profileMsg}
                  </div>
                )}

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-stone-400 flex justify-between">الاسم الكامل <Settings className="w-3 h-3" /></label>
                    <input
                      type="text"
                      value={profileForm.fullName || user?.fullName || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:border-emerald-500 text-right"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-stone-400">رقم الهاتف</label>
                      <input
                        type="text"
                        placeholder="مثال: 000 000 21"
                        value={profileForm.phone || user?.phone || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:border-emerald-500 text-right"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-stone-400">العمر</label>
                      <input
                        type="number"
                        placeholder="مثال: 25"
                        value={profileForm.age || user?.age || ''}
                        onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })}
                        className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:border-emerald-500 text-right"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-stone-50">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300 mb-6 font-bold">تغيير كلمة المرور</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-stone-400">كلمة المرور الحالية</label>
                        <input
                          type="password"
                          onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })}
                          className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:border-emerald-500 text-right"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-stone-400">كلمة المرور الجديدة</label>
                        <input
                          type="password"
                          onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
                          className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:border-emerald-500 text-right"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    className="w-full bg-stone-900 text-white py-5 rounded-3xl font-black uppercase tracking-tighter hover:bg-stone-800 transition-all shadow-xl shadow-stone-100 mt-4"
                  >
                    حفظ جميع التغييرات
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="bg-stone-900 text-stone-400 py-12 mt-24">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-600 p-1.5 rounded-lg">
                <Hammer className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">تـوّا<span className="text-emerald-600">.تونس</span></span>
            </div>
            <p className="text-sm">تمكين الحرفيين التونسيين بالتكنولوجيا والثقة.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs">المنصة</h4>
            <ul className="space-y-2 text-sm">
              <li><button className="hover:text-emerald-500">كيف نعمل</button></li>
              <li><button className="hover:text-emerald-500">عملية التحقق</button></li>
              <li><button className="hover:text-emerald-500">الترتيب الذكي</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs">قانوني</h4>
            <ul className="space-y-2 text-sm">
              <li><button className="hover:text-emerald-500">سياسة الخصوصية</button></li>
              <li><button className="hover:text-emerald-500">شروط الخدمة</button></li>
              <li><button className="hover:text-emerald-500">سياسة الكوكيز</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs">تواصل معنا</h4>
            <ul className="space-y-2 text-sm">
              <li><button className="hover:text-emerald-500">اتصل بنا</button></li>
              <li><button className="hover:text-emerald-500">فيسبوك</button></li>
              <li><button className="hover:text-emerald-500">انستغرام</button></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pt-12 mt-12 border-t border-stone-800 text-center text-xs">
          © 2026 تـوّا.تونس. صُنع في تونس بكل ❤️
        </div>
      </footer>
    </div>
  );
}
