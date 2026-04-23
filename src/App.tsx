import { useState, useEffect, useRef, useCallback } from 'react';
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

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
}

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'client' | 'artisan' | 'admin';
}

// Components moved to separate files

// --- Main App ---

export default function App() {
  const [view, setView] = useState('home');
  const [selectedArtisan, setSelectedArtisan] = useState<Artisan | null>(null);
  const [selectedArtisanPhotos, setSelectedArtisanPhotos] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Admin Data
  const [adminTab, setAdminTab] = useState<'verifications' | 'accounts'>('verifications');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [artisans, setArtisans] = useState<Artisan[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);

  const [regData, setRegData] = useState({ fullName: '', email: '', password: '', role: 'client' });
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
  const [profileForm, setProfileForm] = useState({ fullName: '', currentPassword: '', newPassword: '' });
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Fetch real data conditionally
  useEffect(() => {
    if (user?.role === 'admin' && view === 'admin-dashboard') {
      if (adminTab === 'verifications') {
        fetch('/api/admin/pending-artisans', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` }
        })
          .then(res => res.json())
          .then(data => setPendingArtisans(data));
      } else if (adminTab === 'accounts') {
        fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` }
        })
          .then(res => res.json())
          .then(data => setAllUsers(data));
      }
    }
    if (user?.role === 'artisan' && view === 'artisan-dashboard') {
      fetch('/api/artisan/me', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` }
      })
        .then(res => res.json())
        .then(data => {
          setArtisanProfile(data);
          if (data?.id) fetchPhotos(data.id);
        });

      fetch('/api/requests/artisan', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` }
      })
        .then(res => res.json())
        .then(data => setArtisanRequests(data));
    }

    if (user?.role === 'client' && view === 'client-dashboard') {
      fetch('/api/requests/client', {
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
        fetch('/api/requests/artisan', {
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
    fetch(`/api/artisans/${artisanId}/photos`)
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
      const res = await fetch('/api/artisan/photos', {
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

  const handleVerify = async (artisanId: string, status: 'approved' | 'rejected') => {
    try {
      await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('artisan_token')}`
        },
        body: JSON.stringify({ artisanId, status })
      });
      setPendingArtisans(prev => prev.filter(a => a.id !== artisanId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to completely delete this user and all associated data?")) return;
    try {
      await fetch(`/api/admin/users/${userId}`, {
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
      const res = await fetch('/api/artisan/documents', {
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

  // Auth state
  useEffect(() => {
    const saved = localStorage.getItem('artisan_user');
    if (saved) setUser(JSON.parse(saved));
    fetchCategories();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regData)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      localStorage.setItem('artisan_token', data.token);
      localStorage.setItem('artisan_user', JSON.stringify(data.user));
      setUser(data.user);
      setView('home');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      localStorage.setItem('artisan_token', data.token);
      localStorage.setItem('artisan_user', JSON.stringify(data.user));
      setUser(data.user);
      setView('home');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchCategories = async () => {
    const res = await fetch('/api/categories');
    const data = await res.json();
    setCategories(data);
  };

  const handleSearch = async (catSlug?: string) => {
    setLoading(true);
    const lat = location?.lat || 36.8065; // Tunis default
    const lng = location?.lng || 10.1815;
    const slug = catSlug || selectedCategory || '';
    const res = await fetch(`/api/artisans/search?categorySlug=${slug}&lat=${lat}&lng=${lng}`);
    const data = await res.json();
    setArtisans(data);
    setLoading(false);
    setView('search-results');
  };

  const handleLogout = () => {
    localStorage.removeItem('artisan_token');
    localStorage.removeItem('artisan_user');
    setUser(null);
    setView('home');
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
      const res = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('artisan_token')}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        if (user?.role === 'artisan') {
          fetch('/api/requests/artisan', {
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

  const handleRateRequest = async (requestId: number, rating: number, review: string) => {
    try {
      await fetch(`/api/requests/${requestId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('artisan_token')}`
        },
        body: JSON.stringify({ rating, review })
      });
      fetch('/api/requests/client', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` }
      })
        .then(res => res.json())
        .then(data => setClientRequests(data));
    } catch (err) {
      console.error(err);
    }
  };

  const [bookingArtisan, setBookingArtisan] = useState<Artisan | null>(null);
  const [bookingDesc, setBookingDesc] = useState('');

  // ─── Handle Rating Submission ──────────────────────────────────────
  const handleRateRequest = async () => {
    if (!ratingRequest) return;
    try {
      await fetch(`/api/requests/${ratingRequest.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('artisan_token')}` },
        body: JSON.stringify({ rating: ratingValue, review: ratingReview })
      });
      setClientRequests(prev => prev.map(r => r.id === ratingRequest.id ? { ...r, rating: ratingValue, review: ratingReview } : r));
      setRatingRequest(null);
      setRatingValue(5);
      setRatingReview('');
      addNotification('⭐ Rating submitted! Thank you!');
    } catch (err) { console.error(err); }
  };

  // ─── Handle Chat ───────────────────────────────────────────────────
  const openChat = async (target: { artisanProfileId: string, clientId: string, name: string }) => {
    setChatArtisan(target);
    setView('chat');
    try {
      const res = await fetch(`/api/chat/${target.artisanProfileId}/${target.clientId}`, {
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
      await fetch(`/api/chat/${chatArtisan.artisanProfileId}/${chatArtisan.clientId}`, {
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
      const res = await fetch('/api/client/profile', {
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
      setProfileMsg('✅ Profile updated successfully!');
    } catch (err: any) {
      setProfileMsg(`❌ ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900">
      <Navbar user={user} onLogout={handleLogout} onNavigate={setView} />

      {/* Real-time Notifications Toast */}
      <div className="fixed bottom-8 right-8 z-[100] space-y-3 pointer-events-none">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              className="bg-stone-900/95 backdrop-blur-md text-white p-5 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-4 pointer-events-auto min-w-[300px]"
            >
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-bold tracking-tight">{n.msg}</p>
              <button
                onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}
                className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors"
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
                <h3 className="text-2xl font-black tracking-tight uppercase">Request Service</h3>
                <button onClick={() => setBookingArtisan(null)} className="p-2 hover:bg-stone-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-200">
                <div className="w-12 h-12 bg-stone-200 rounded-xl flex items-center justify-center font-black">{bookingArtisan.full_name.charAt(0)}</div>
                <div>
                  <p className="font-bold">{bookingArtisan.full_name}</p>
                  <p className="text-xs text-stone-500 uppercase font-bold">{bookingArtisan.category_name}</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-400 uppercase">Problem Description</label>
                <textarea
                  value={bookingDesc}
                  onChange={(e) => setBookingDesc(e.target.value)}
                  placeholder="Describe what you need help with (e.g. My kitchen sink is leaking since this morning...)"
                  className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:border-emerald-500 outline-none h-32 text-sm"
                />
              </div>

              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 font-medium">By confirming, your request will be sent to the artisan. They will contact you via phone or email once they accept.</p>
              </div>

              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch('/api/requests', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('artisan_token')}`
                      },
                      body: JSON.stringify({
                        artisanId: bookingArtisan.id,
                        categoryId: bookingArtisan.category_id,
                        description: bookingDesc,
                        lat: location?.lat || 36.8,
                        lng: location?.lng || 10.1
                      })
                    });
                    if (res.ok) {
                      alert('Your request has been sent! You can track it in your dashboard.');
                      setBookingArtisan(null);
                      setBookingDesc('');
                    }
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={!bookingDesc}
                className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black uppercase tracking-tighter hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed border-b-4 border-black"
              >
                Confirm Booking Request
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
              <h3 className="text-2xl font-black uppercase tracking-tighter text-stone-900 text-center">Rate Your Experience</h3>
              <p className="text-center text-stone-500 text-sm">How was your service with <span className="font-bold text-stone-900">{ratingRequest.artisan_name}</span>?</p>
              
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
                <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Your Review</label>
                <textarea
                  value={ratingReview}
                  onChange={(e) => setRatingReview(e.target.value)}
                  placeholder="Share your experience..."
                  className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:border-emerald-500 h-32 resize-none"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setRatingRequest(null)}
                  className="flex-1 py-4 text-stone-400 font-bold uppercase tracking-widest text-sm hover:text-stone-600"
                >
                  Skip
                </button>
                <button
                  onClick={handleRateRequest}
                  className="flex-1 bg-stone-900 text-white py-4 rounded-2xl font-black uppercase tracking-tighter hover:bg-stone-800"
                >
                  Submit Review
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
                  FIND THE BEST <br />
                  <span className="text-emerald-600 italic">VERIFIED</span> ARTISANS
                </motion.h1>
                <p className="text-lg text-stone-500 max-w-2xl mx-auto font-medium">
                  The first smart marketplace for Tunisian craftsmen. Verified profiles,
                  transparent ratings, and instant booking.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                  <div className="relative w-full max-w-md">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Your location (e.g. Tunis, Sousse...)"
                      className="w-full pl-12 pr-4 py-4 bg-white border-2 border-stone-100 rounded-2xl focus:border-emerald-500 outline-none transition-all shadow-sm"
                      onFocus={getUserLocation}
                    />
                  </div>
                  <button
                    onClick={() => handleSearch()}
                    className="w-full sm:w-auto bg-stone-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Search className="w-5 h-5" />
                    SEARCH NEARBY
                  </button>
                </div>
              </section>

              <section className="space-y-6">
                <div className="flex justify-between items-end">
                  <h2 className="text-2xl font-bold tracking-tight">Popular Categories</h2>
                  <button className="text-sm font-bold text-emerald-600 uppercase tracking-widest">View All</button>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                  {categories.map(cat => (
                    <CategoryCard
                      key={cat.id}
                      category={cat}
                      active={selectedCategory === cat.slug}
                      onClick={() => {
                        setSelectedCategory(cat.slug);
                        handleSearch(cat.slug);
                      }}
                    />
                  ))}
                </div>
              </section>

              <section className="grid md:grid-cols-3 gap-8 py-12">
                {[
                  { icon: ShieldCheck, title: "Verified Profiles", desc: "Every artisan goes through a strict ID and skill verification process." },
                  { icon: Star, title: "Smart Ranking", desc: "Our algorithm sorts by distance, rating, and reliability to find your perfect match." },
                  { icon: Clock, title: "Instant Booking", desc: "Create a request and get responses from nearby artisans in minutes." }
                ].map((feature, i) => (
                  <div key={i} className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-shadow">
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

          {view === 'artisan-detail' && selectedArtisan && (
            <motion.div
              key="artisan-detail"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              <button onClick={() => setView('search-results')} className="text-sm font-bold text-stone-400 hover:text-stone-600 mb-2 flex items-center gap-1 uppercase tracking-widest">
                ← Back to Results
              </button>

              <div className="bg-white rounded-3xl border border-stone-100 p-8 shadow-sm flex flex-col md:flex-row gap-8">
                <div className="w-24 h-24 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-300 text-4xl font-black">
                  {selectedArtisan.full_name.charAt(0)}
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-4xl font-black tracking-tight">{selectedArtisan.full_name}</h2>
                      {selectedArtisan.is_verified === 1 && <ShieldCheck className="text-emerald-600 w-6 h-6" />}
                    </div>
                    <p className="text-emerald-600 font-bold uppercase tracking-widest text-sm">{selectedArtisan.category_name}</p>
                  </div>
                  <p className="text-stone-600 leading-relaxed text-lg italic">"{selectedArtisan.bio || 'Professional artisan ready to help with your needs.'}"</p>

                  <div className="flex flex-wrap gap-6 pt-4">
                    <div className="flex items-center gap-2">
                      <Star className="text-amber-500 fill-current w-5 h-5" />
                      <span className="font-bold">{selectedArtisan.avg_rating.toFixed(1)} Rating</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="text-stone-400 w-5 h-5" />
                      <span className="font-bold text-stone-900">{selectedArtisan.completed_jobs} Jobs Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="text-stone-400 w-5 h-5" />
                      <span className="font-bold text-stone-900">{selectedArtisan.distance_km} km away</span>
                    </div>
                  </div>
                </div>
                <div className="md:w-64 space-y-4">
                  <button
                    onClick={() => setBookingArtisan(selectedArtisan)}
                    className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold border-b-4 border-black hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
                  >
                    REQUEST SERVICE
                  </button>
                  <div className="px-4 py-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-3">
                    <div className={cn("w-2 h-2 rounded-full", selectedArtisan.is_online ? "bg-emerald-500 animate-pulse" : "bg-stone-300")} />
                    <span className="text-xs font-bold text-stone-500 uppercase">{selectedArtisan.is_online ? 'Available Now' : 'Currently Offline'}</span>
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
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <button onClick={() => setView('home')} className="text-sm font-bold text-stone-400 hover:text-stone-600 mb-2 flex items-center gap-1 uppercase tracking-widest">
                    ← Back to Home
                  </button>
                  <h2 className="text-3xl font-black tracking-tight">
                    {artisans.length} Artisans Found
                    {selectedCategory && <span className="text-emerald-600"> in {categories.find(c => c.slug === selectedCategory)?.name}</span>}
                  </h2>
                </div>
                <div className="flex gap-2 bg-white p-1 rounded-xl border border-stone-200">
                  <button className="px-4 py-2 text-xs font-bold bg-stone-900 text-white rounded-lg">Smart Score</button>
                  <button className="px-4 py-2 text-xs font-bold text-stone-500 hover:bg-stone-50 rounded-lg">Distance</button>
                  <button className="px-4 py-2 text-xs font-bold text-stone-500 hover:bg-stone-50 rounded-lg">Rating</button>
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
                  {artisans.map(artisan => (
                    <ArtisanCard
                      key={artisan.id}
                      artisan={artisan}
                      onClick={() => {
                        setSelectedArtisan(artisan);
                        fetch(`/api/artisans/${artisan.id}/photos`)
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
                  <h3 className="text-xl font-bold text-stone-900">No artisans found in this area</h3>
                  <p className="text-stone-500">Try expanding your search radius or checking another category.</p>
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
              <h2 className="text-3xl font-black mb-6 text-center">Welcome Back</h2>
              {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm rounded-xl border border-rose-100">{error}</div>}
              <form className="space-y-4" onSubmit={handleLogin}>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Email Address</label>
                  <input
                    type="email"
                    required
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Password</label>
                  <input
                    type="password"
                    required
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none"
                  />
                </div>
                <button className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                  Sign In
                </button>
              </form>
              <p className="mt-6 text-center text-sm text-stone-500">
                Don't have an account? <button onClick={() => setView('register')} className="text-emerald-600 font-bold">Register</button>
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
              <h2 className="text-3xl font-black tracking-tight">My Service Requests</h2>
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
                          {req.status}
                        </span>
                      </div>
                      <p className="text-sm text-stone-600 mb-1">Artisan: <span className="font-bold">{req.artisan_name}</span></p>
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
                    <p className="text-stone-400">You haven't made any requests yet.</p>
                    <button onClick={() => setView('home')} className="bg-stone-900 text-white px-6 py-2 rounded-xl text-xs font-bold">Start Searching</button>
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
                  <h2 className="text-3xl font-black tracking-tight">Admin Dashboard</h2>
                  <div className="flex gap-2 bg-stone-100 p-1 rounded-xl">
                    <button
                      onClick={() => setAdminTab('verifications')}
                      className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", adminTab === 'verifications' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:bg-white/50")}
                    >
                      Verifications
                    </button>
                    <button
                      onClick={() => setAdminTab('accounts')}
                      className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", adminTab === 'accounts' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:bg-white/50")}
                    >
                      User Accounts
                    </button>
                  </div>
                </div>

                {adminTab === 'verifications' ? (
                  <div className="bg-white rounded-3xl border border-stone-200 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-stone-50 border-b border-stone-200">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">Artisan</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">Category</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">Documents</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {pendingArtisans.length > 0 ? pendingArtisans.map((item, i) => (
                          <tr key={i} className="hover:bg-stone-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-stone-900">{item.full_name}</div>
                              <div className="text-xs text-stone-500">{item.email}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-stone-600">{item.category_id || 'Not Set'}</td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <span className="text-[10px] bg-stone-100 px-2 py-1 rounded border border-stone-200 text-stone-600">Pending Review</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <button onClick={() => handleVerify(item.id, 'approved')} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700">Approve</button>
                                <button onClick={() => handleVerify(item.id, 'rejected')} className="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-100">Reject</button>
                              </div>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-stone-400">Everything up to date!</td>
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
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">ID</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">Name / Email</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">Role</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">Joined</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-stone-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {allUsers.length > 0 ? allUsers.map((u, i) => (
                          <tr key={i} className="hover:bg-stone-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-bold text-stone-500">#{u.id}</td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-stone-900">{u.fullName || 'N/A'}</div>
                              <div className="text-xs text-stone-500">{u.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "text-[10px] font-black uppercase px-2 py-1 rounded-md border",
                                u.role === 'admin' ? "bg-purple-50 text-purple-600 border-purple-200" :
                                u.role === 'artisan' ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                                "bg-blue-50 text-blue-600 border-blue-200"
                              )}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-stone-500">{(u as any).created_at ? new Date((u as any).created_at).toLocaleDateString() : 'Unknown'}</td>
                            <td className="px-6 py-4">
                              <button 
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={u.role === 'admin'}
                                className="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-stone-400">No users found.</td>
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
            <motion.div
              key="artisan"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="grid md:grid-cols-4 gap-4">
                {[
                  { label: "Total Earnings", val: "N/A", icon: Zap, color: "bg-emerald-500" },
                  { label: "Completed Jobs", val: artisanProfile?.completed_jobs || 0, icon: ClipboardList, color: "bg-blue-500" },
                  { label: "Avg Rating", val: (artisanProfile?.avg_rating || 0).toFixed(1), icon: Star, color: "bg-amber-500" },
                  { label: "Verification", val: artisanProfile?.verification_status || 'pending', icon: ShieldCheck, color: "bg-purple-500" }
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
                    <h3 className="text-xl font-bold">Active Requests</h3>
                    <span className="text-xs font-bold text-stone-400 uppercase">{artisanRequests.length} Total</span>
                  </div>
                  <div className="space-y-4">
                    {artisanRequests.length > 0 ? artisanRequests.map((req, i) => (
                      <div key={i} className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-bold text-stone-900">{req.category_name}</p>
                            <span className={cn(
                              "text-[10px] font-black uppercase px-2 py-0.5 rounded-full border",
                              req.status === 'pending' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                req.status === 'accepted' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                  "bg-emerald-600 text-white border-emerald-600"
                            )}>
                              {req.status}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500">Client: {req.client_name} • {req.description}</p>
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
                                Accept
                              </button>
                              <button
                                onClick={() => handleUpdateRequestStatus(req.id, 'rejected')}
                                className="bg-white text-stone-400 border border-stone-200 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {req.status === 'accepted' && (
                            <button
                              onClick={() => handleUpdateRequestStatus(req.id, 'completed')}
                              className="bg-stone-900 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight"
                            >
                              Mark Completed
                            </button>
                          )}
                        </div>
                      </div>
                    )) : (
                      <p className="text-center py-8 text-stone-400">No active requests found.</p>
                    )}
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Portfolio Gallery</h3>
                    <label className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer hover:bg-emerald-700 transition-colors">
                      Add Photo
                      <input type="file" className="hidden" onChange={handleUploadPhoto} accept="image/*" />
                    </label>
                  </div>
                  <PhotoGallery photos={artisanPhotos} />
                  <p className="text-sm text-stone-500">Add photos of your best work to attract more clients.</p>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Profile Settings</h3>
                    <button
                      onClick={async () => {
                        setLoading(true);
                        try {
                          const bio = "Professional " + (artisanProfile?.category_name || "Artisan") + " with years of experience in high-quality craftsmanship. Dedicated to serving the Tunisian market with trust and reliability.";
                          setArtisanProfile({ ...artisanProfile, bio });
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="text-xs font-bold text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                    >
                      ✨ Magic Bio
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-stone-400 uppercase">Service Category</label>
                        <select
                          value={artisanProfile?.category_id || ''}
                          onChange={(e) => setArtisanProfile({ ...artisanProfile, category_id: e.target.value })}
                          className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none h-12 text-sm"
                        >
                          <option value="">Select Category</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-stone-400 uppercase">Service Radius (km)</label>
                        <input
                          type="number"
                          value={artisanProfile?.service_radius_km || 20}
                          onChange={(e) => setArtisanProfile({ ...artisanProfile, service_radius_km: parseFloat(e.target.value) })}
                          className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none h-12 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase flex justify-between">
                        Service Location (GPS)
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
                          Detect My Location
                        </button>
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <input
                          placeholder="Latitude"
                          type="number"
                          value={artisanProfile?.lat || ''}
                          readOnly
                          className="w-full p-3 bg-stone-100 border border-stone-200 rounded-xl text-stone-500 text-sm"
                        />
                        <input
                          placeholder="Longitude"
                          type="number"
                          value={artisanProfile?.lng || ''}
                          readOnly
                          className="w-full p-3 bg-stone-100 border border-stone-200 rounded-xl text-stone-500 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-stone-400 uppercase">Biography</label>
                      <textarea
                        value={artisanProfile?.bio || ''}
                        onChange={(e) => setArtisanProfile({ ...artisanProfile, bio: e.target.value })}
                        className="w-full mt-2 p-4 bg-stone-50 border border-stone-200 rounded-2xl focus:border-emerald-500 outline-none h-32 text-sm"
                        placeholder="Tell clients about your experience and skills..."
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-stone-400 uppercase">Verification Documents (CIN / Diploma)</label>
                      <div className="flex gap-4">
                        <label className="flex-1 bg-stone-50 border-2 border-dashed border-stone-200 p-4 rounded-2xl text-center cursor-pointer hover:bg-stone-100 transition-colors">
                          <span className="text-xs font-bold text-stone-500">Click to Upload Document</span>
                          <input type="file" className="hidden" onChange={(e) => handleUploadDocument(e, 'cin')} accept=".pdf,image/*" />
                        </label>
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        await fetch('/api/artisan/profile', {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('artisan_token')}`
                          },
                          body: JSON.stringify(artisanProfile)
                        });
                        alert('Profile updated successfully!');
                      }}
                      className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all border-b-4 border-black"
                    >
                      Save Professional Profile
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto bg-white p-8 rounded-3xl shadow-xl border border-stone-100 mt-12"
            >
              <h2 className="text-3xl font-black mb-6 text-center">Join Artisan.tn</h2>
              <div className="flex gap-2 mb-8 p-1 bg-stone-100 rounded-xl">
                <button
                  onClick={() => setRegData({ ...regData, role: 'client' })}
                  className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", regData.role === 'client' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:bg-white/50")}
                >
                  I'm a Client
                </button>
                <button
                  onClick={() => setRegData({ ...regData, role: 'artisan' })}
                  className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", regData.role === 'artisan' ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:bg-white/50")}
                >
                  I'm an Artisan
                </button>
              </div>
              {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm rounded-xl border border-rose-100">{error}</div>}
              <form className="space-y-4" onSubmit={handleRegister}>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Full Name</label>
                  <input
                    type="text"
                    required
                    value={regData.fullName}
                    onChange={(e) => setRegData({ ...regData, fullName: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Email</label>
                  <input
                    type="email"
                    required
                    value={regData.email}
                    onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Password</label>
                  <input
                    type="password"
                    required
                    value={regData.password}
                    onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                    className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-emerald-500 outline-none"
                  />
                </div>
                <button className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
                  Create Account
                </button>
              </form>
              <p className="mt-6 text-center text-sm text-stone-500">
                Already have an account? <button onClick={() => setView('login')} className="text-emerald-600 font-bold">Login</button>
              </p>
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
                <h2 className="text-3xl font-black tracking-tighter uppercase">Artisan Radar</h2>
                <div className="flex gap-2">
                  <button onClick={() => setView('home')} className="text-xs font-bold text-stone-400 uppercase tracking-widest hover:text-stone-600 transition-colors">Close View</button>
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-stone-200 rounded-3xl h-[600px] relative overflow-hidden flex items-center justify-center border-4 border-white shadow-2xl">
                  <div className="absolute inset-0 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px] opacity-10" />
                  <div className="text-center space-y-4 z-10">
                    <div className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center mx-auto animate-ping opacity-20 absolute top-1/2 left-1/2 -ml-10 -mt-10" />
                    <MapPin className="w-12 h-12 text-emerald-600 mx-auto" />
                    <p className="font-black text-stone-400 uppercase tracking-widest text-xs">Scanning artisans in your area...</p>
                    <div className="flex gap-2 justify-center">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                    </div>
                  </div>
                  {/* Mock artisan locations */}
                  <div className="absolute top-1/4 left-1/3 w-3 h-3 bg-emerald-500 rounded-full shadow-lg shadow-emerald-200 cursor-pointer hover:scale-150 transition-transform" />
                  <div className="absolute top-1/2 right-1/4 w-3 h-3 bg-emerald-500 rounded-full shadow-lg shadow-emerald-200 cursor-pointer hover:scale-150 transition-transform" />
                  <div className="absolute bottom-1/3 left-1/2 w-3 h-3 bg-emerald-500 rounded-full shadow-lg shadow-emerald-200 cursor-pointer hover:scale-150 transition-transform" />
                </div>
                
                <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm space-y-6 overflow-y-auto max-h-[600px]">
                  <h3 className="font-bold text-lg uppercase tracking-tight text-stone-900">Nearby Artisans</h3>
                  <div className="space-y-4">
                    {artisans.length > 0 ? artisans.map((a, i) => (
                      <div key={i} className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center gap-4 group cursor-pointer hover:border-emerald-200 hover:bg-emerald-50/50 transition-all" onClick={() => { setSelectedArtisan(a); setView('artisan-detail'); }}>
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-emerald-600 border border-stone-100 shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-colors">{a.full_name.charAt(0)}</div>
                        <div>
                          <p className="font-bold text-sm text-stone-900">{a.full_name}</p>
                          <p className="text-[10px] text-stone-400 font-bold uppercase">{a.category_name} • {a.distance_km} km</p>
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
              <h2 className="text-3xl font-black tracking-tighter uppercase text-stone-900">Account Settings</h2>
              
              <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-xl space-y-8">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-stone-100 rounded-3xl flex items-center justify-center font-black text-3xl text-stone-300 border-2 border-stone-50">
                    {user?.fullName?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-stone-900">{user?.fullName}</h3>
                    <p className="text-stone-400 font-medium">{user?.email}</p>
                    <span className="inline-block mt-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">Verified Client</span>
                  </div>
                </div>

                {profileMsg && (
                  <div className={cn("p-4 rounded-2xl text-sm font-bold border", profileMsg.includes('✅') ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100")}>
                    {profileMsg}
                  </div>
                )}

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-stone-400 flex justify-between">Full Name <Settings className="w-3 h-3" /></label>
                    <input
                      type="text"
                      value={profileForm.fullName || user?.fullName || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="pt-4 border-t border-stone-50">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-300 mb-6 font-bold">Change Password</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-stone-400">Current Password</label>
                        <input
                          type="password"
                          onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })}
                          className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-stone-400">New Password</label>
                        <input
                          type="password"
                          onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
                          className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    className="w-full bg-stone-900 text-white py-5 rounded-3xl font-black uppercase tracking-tighter hover:bg-stone-800 transition-all shadow-xl shadow-stone-100 mt-4"
                  >
                    Save All Changes
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
              <span className="text-xl font-bold tracking-tight text-white">Artisan<span className="text-emerald-600">.tn</span></span>
            </div>
            <p className="text-sm">Empowering Tunisian artisans with technology and trust.</p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li><button className="hover:text-emerald-500">How it works</button></li>
              <li><button className="hover:text-emerald-500">Verification Process</button></li>
              <li><button className="hover:text-emerald-500">Smart Ranking</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><button className="hover:text-emerald-500">Privacy Policy</button></li>
              <li><button className="hover:text-emerald-500">Terms of Service</button></li>
              <li><button className="hover:text-emerald-500">Cookie Policy</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs">Connect</h4>
            <ul className="space-y-2 text-sm">
              <li><button className="hover:text-emerald-500">Contact Us</button></li>
              <li><button className="hover:text-emerald-500">Facebook</button></li>
              <li><button className="hover:text-emerald-500">Instagram</button></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pt-12 mt-12 border-t border-stone-800 text-center text-xs">
          © 2026 Artisan.tn. Built for Tunisia with ❤️
        </div>
      </footer>
    </div>
  );
}
