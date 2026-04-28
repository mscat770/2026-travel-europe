import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  Calendar, 
  Ticket, 
  Wallet, 
  BookOpen, 
  CheckSquare, 
  Users, 
  Plus,
  MapPin,
  Clock,
  Cloud,
  Sun,
  CloudSun,
  CloudRain,
  ChevronRight,
  Camera,
  Image as ImageIcon,
  Sparkles,
  Plane,
  Hotel,
  Utensils,
  Search,
  Pencil,
  Trash2,
  Paperclip,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { 
  auth, 
  db, 
  addEvent, 
  updateEvent, 
  deleteEvent,
  subscribeToEvents, 
  seedEventsIfEmpty,
  clearAllEvents
} from './lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';

declare global {
  interface Window {
    google: any;
  }
}

// --- Types ---
type Tab = 'schedule' | 'bookings' | 'expense' | 'journal' | 'planning' | 'members';

// --- Shared Components ---
const BottomNav = ({ activeTab, setActiveTab }: { activeTab: Tab; setActiveTab: (t: Tab) => void }) => {
  const tabs: { id: Tab; icon: any; label: string }[] = [
    { id: 'schedule', icon: Calendar, label: 'Schedule' },
    { id: 'bookings', icon: Ticket, label: 'Bookings' },
    { id: 'expense', icon: Wallet, label: 'Expenses' },
    { id: 'journal', icon: BookOpen, label: 'Journal' },
    { id: 'planning', icon: CheckSquare, label: 'Checklist' },
    { id: 'members', icon: Users, label: 'Team' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-brand-green px-4 pb-6 pt-2 flex justify-between items-center z-50">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`nav-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1 transition-all duration-300 ${
              isActive ? 'text-brand-accent scale-110' : 'text-brand-dark/40'
            }`}
          >
            <div className={`p-2 rounded-full transition-colors ${isActive ? 'bg-brand-green/20' : ''}`}>
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className="text-[10px] font-bold font-display">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

const Header = ({ title, subtitle, avatars }: { title: string; subtitle?: string; avatars?: { id: string; url: string }[] }) => (
  <header id="app-header" className="px-6 pt-6 pb-0 bg-brand-beige sticky top-0 z-40">
    <div className="flex justify-between items-center">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold tracking-tight text-brand-dark font-display leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[10px] font-medium text-brand-dark/40 uppercase tracking-widest mt-0.5 font-sans">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex -space-x-2 items-center">
        {avatars?.length > 0 ? (
          avatars.map((avatar, i) => (
            <div 
              key={avatar.id} 
              className="w-8 h-8 rounded-full border-2 border-brand-beige overflow-hidden bg-brand-green/30"
              style={{ zIndex: avatars.length - i }}
            >
              <img src={avatar.url} alt="avatar" className="w-full h-full object-cover" />
            </div>
          ))
        ) : (
          <div className="w-8 h-8 rounded-full bg-brand-dark/10 flex items-center justify-center text-[10px] font-bold text-brand-dark/40">
            ?
          </div>
        )}
      </div>
    </div>
    <div className="w-full border-t border-dashed border-gray-300 mt-3 opacity-60" />
  </header>
);

// --- Tabs Implementation ---

const ScheduleTab = ({ user }: { user: User }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const locationInputRef = useRef<HTMLInputElement>(null);
  
  // Modal State
  const [formData, setFormData] = useState({
    title: '',
    time: '12:00',
    noTime: false,
    location: '',
    desc: '',
    cat: 'OTHER',
    link: ''
  });

  // Weather State
  const [weather, setWeather] = useState<{
    temp: number;
    desc: string;
    icon: any;
    locationName: string;
    loading: boolean;
  }>({
    temp: 22,
    desc: 'Sunny',
    icon: Sun,
    locationName: 'EUROPE',
    loading: false
  });

  const fetchWeather = async (locationQuery: string) => {
    setWeather(prev => ({ ...prev, loading: true }));
    try {
      // 1. Geocode location using Nominatim (OSM)
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery)}&format=json&limit=1`);
      const geoData = await geoRes.json();
      
      let lat = 52.3676; // Default Amsterdam
      let lon = 4.9041;
      let displayName = 'AMSTERDAM';

      if (geoData && geoData.length > 0) {
        lat = parseFloat(geoData[0].lat);
        lon = parseFloat(geoData[0].lon);
        displayName = geoData[0].display_name.split(',')[0].toUpperCase();
      }

      // 2. Fetch weather from Open-Meteo
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
      const weatherData = await weatherRes.json();
      const current = weatherData.current_weather;
      const code = current.weathercode;

      // WMO Weather interpretation codes (WW)
      const weatherMap: Record<number, { desc: string, icon: any }> = {
        0: { desc: 'Sunny', icon: Sun },
        1: { desc: 'Mainly Clear', icon: CloudSun },
        2: { desc: 'Partly Cloudy', icon: CloudSun },
        3: { desc: 'Overcast', icon: Cloud },
        45: { desc: 'Foggy', icon: Cloud },
        48: { desc: 'Foggy', icon: Cloud },
        51: { desc: 'Light Drizzle', icon: CloudRain },
        53: { desc: 'Drizzle', icon: CloudRain },
        55: { desc: 'Heavy Drizzle', icon: CloudRain },
        61: { desc: 'Slight Rain', icon: CloudRain },
        63: { desc: 'Moderate Rain', icon: CloudRain },
        65: { desc: 'Heavy Rain', icon: CloudRain },
        71: { desc: 'Slight Snow', icon: Cloud },
        73: { desc: 'Moderate Snow', icon: Cloud },
        75: { desc: 'Heavy Snow', icon: Cloud },
        95: { desc: 'Thunderstorm', icon: CloudRain },
      };

      const info = weatherMap[code] || { desc: 'Clear', icon: Sun };

      setWeather({
        temp: Math.round(current.temperature),
        desc: info.desc,
        icon: info.icon,
        locationName: displayName,
        loading: false
      });
    } catch (err) {
      console.error("Weather fetch failed:", err);
      setWeather(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    // Determine which location to fetch weather for
    const firstLocation = events.find(e => e.location)?.location || 'Amsterdam';
    fetchWeather(firstLocation);
  }, [selectedDay, events.find(e => e.location)?.location]); // Trigger if day changes OR first valid location string changes

  const categories = [
    { label: 'TRANSPORT', value: 'TRANSPORT', icon: 'Plane' },
    { label: 'FOOD', value: 'FOOD', icon: 'Utensils' },
    { label: 'STAY', value: 'STAY', icon: 'Hotel' },
    { label: 'SIGHTS', value: 'SIGHTS', icon: 'Camera' },
  ];

  const handleOpenAdd = () => {
    setEditingEvent(null);
    setFormData({
      title: '',
      time: '12:00',
      noTime: false,
      location: '',
      desc: '',
      cat: 'SIGHTS',
      link: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (event: any) => {
    setEditingEvent(event);
    setFormData({
      title: event.title || '',
      time: event.time || '12:00',
      noTime: event.noTime || false,
      location: event.location || '',
      desc: event.desc || '',
      cat: event.cat || 'SIGHTS',
      link: event.link || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (window.confirm('確定要刪除這筆行程嗎？')) {
      try {
        await deleteEvent(eventId);
      } catch (err) {
        console.error(err);
        alert('刪除失敗');
      }
    }
  };

  const handleSave = async (e: any) => {
    e.preventDefault();
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      const icon = categories.find(c => c.value === formData.cat)?.icon || 'MapPin';
      const eventPayload = {
        ...formData,
        noTime: formData.noTime,
        order: editingEvent ? (editingEvent.order || 0) : events.length,
        dayIndex: selectedDay,
        icon,
        color: formData.cat === 'TRANSPORT' ? 'bg-orange-100 text-orange-600' :
               formData.cat === 'FOOD' ? 'bg-amber-100 text-amber-600' :
               formData.cat === 'STAY' ? 'bg-sky-100 text-sky-600' :
               formData.cat === 'SIGHTS' ? 'bg-emerald-100 text-emerald-600' :
               'bg-indigo-100 text-indigo-600'
      };

      if (editingEvent) {
        await updateEvent(editingEvent.id, eventPayload);
      } else {
        await addEvent(eventPayload);
      }
      
      // Close and Reset ONLY after successful save
      setIsModalOpen(false);
      setFormData({
        title: '',
        time: '12:00',
        noTime: false,
        location: '',
        desc: '',
        cat: 'SIGHTS',
        link: ''
      });
      setEditingEvent(null);
    } catch (err) {
      console.error(err);
      alert('Error saving event.');
    } finally {
      setIsSaving(false);
    }
  };

  // Map strings to Lucide components
  const iconMap: Record<string, any> = {
    'Plane': Plane,
    'Hotel': Hotel,
    'MapPin': MapPin,
    'Utensils': Utensils,
    'Camera': Camera,
    'ShoppingCart': Search
  };

  // Generate dates from May 21 to June 6
  const generateDates = () => {
    const dates = [];
    const start = new Date(2026, 4, 21); // May 21
    const end = new Date(2026, 5, 6);    // June 6
    let current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const days = generateDates();

  useEffect(() => {
    if (user) {
      seedEventsIfEmpty();
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToEvents(selectedDay, (items) => {
      setEvents(items);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [selectedDay]);

  return (
    <div id="schedule-tab" className="pb-32">
      {/* Date Picker */}
      <div className="flex gap-2 overflow-x-auto overflow-y-hidden px-6 pt-2 pb-0 no-scrollbar whitespace-nowrap">
        {days.map((date, idx) => (
          <motion.button
            key={idx}
            onClick={() => setSelectedDay(idx)}
            className={`flex-shrink-0 w-[3.25rem] h-[3.25rem] flex flex-col items-center justify-center rounded-xl border-1.5 transition-all font-display ${
              selectedDay === idx 
                ? 'bg-brand-accent border-brand-accent text-white shadow-md scale-105' 
                : 'bg-white border-brand-green text-brand-dark opacity-60'
            }`}
          >
            <span className="text-[8px] font-bold uppercase opacity-70 mb-0.5 font-display">DAY {idx + 1}</span>
            <span className="text-xs font-bold whitespace-nowrap mb-0.5 font-display">
              {date.getMonth() + 1}/{date.getDate()}
            </span>
            <span className={`text-[9px] font-bold uppercase transition-opacity font-display ${selectedDay === idx ? 'opacity-90' : 'opacity-40'}`}>
              {date.toLocaleDateString('en-US', { weekday: 'short' })}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Dashed Separator */}
      <div className="mx-6 border-t border-dashed border-gray-300 mt-4 mb-6 opacity-60" />

      {/* Weather Card */}
      <motion.div
        key={selectedDay}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 mb-6 bg-white rounded-2xl border border-brand-green/10 shadow-sm overflow-hidden"
      >
        <div className={`py-4 px-4 flex items-center justify-between transition-opacity duration-300 ${weather.loading ? 'opacity-50' : 'opacity-100'}`}>
          <div className="flex gap-3 items-center">
            <div className={`p-2.5 rounded-2xl ${weather.desc.includes('Rain') || weather.desc.includes('Drizzle') ? 'bg-blue-50 text-blue-500' : 'bg-amber-50 text-amber-500'}`}>
              <weather.icon size={24} strokeWidth={2} className={weather.loading ? 'animate-pulse' : ''} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-bold text-brand-dark font-display leading-tight">
                  {weather.loading ? '--' : `${weather.temp}°C`}
                </span>
                <div className="h-3 w-[1px] bg-brand-dark/10" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/40 font-display">
                  {weather.loading ? 'Loading...' : weather.desc}
                </span>
              </div>
              <p className="text-[11px] text-brand-dark/50 font-sans mt-0.5 italic">
                {weather.temp > 20 ? 'Perfect for travelling.' : weather.temp > 10 ? 'A bit chilly today.' : 'Bundle up, it\'s cold!'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
             <span className="text-[9px] font-black uppercase tracking-widest text-brand-dark/20 font-display truncate max-w-[80px]">
               {weather.locationName}
             </span>
          </div>
        </div>
      </motion.div>

      {/* Itinerary Section */}
      <div className="px-4 pb-12 font-sans overflow-visible">
        {loading ? (
          <p className="text-center py-10 text-xs text-brand-dark/20 font-bold">Loading schedule...</p>
        ) : events.length === 0 ? (
          <div className="text-center py-10 opacity-30">
            <Sparkles className="mx-auto mb-2" size={24} />
            <p className="text-xs font-bold uppercase tracking-widest">No events planned</p>
          </div>
        ) : (
          <Reorder.Group axis="y" values={events} onReorder={(newOrder) => {
            setEvents(newOrder);
            // Bulk update order in background
            newOrder.forEach((item, index) => {
               if (item.order !== index) {
                 updateEvent(item.id, { order: index });
               }
            });
          }} className="space-y-4">
            {events.map((item) => {
              const Icon = iconMap[item.icon] || MapPin;
              return (
                <Reorder.Item
                  key={item.id}
                  value={item}
                  className="relative overflow-visible cursor-grab active:cursor-grabbing"
                  whileDrag={{ opacity: 0.9, scale: 1.02, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)", zIndex: 50 }}
                >
                  <div
                    className="relative overflow-hidden w-full bg-white rounded-[1.5rem] shadow-sm border border-brand-green/10 transition-all hover:shadow-md active:shadow-inner"
                    onClick={() => {
                      setSelectedEvent(item);
                      setIsDetailOpen(true);
                    }}
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.color?.split(' ')[1]?.replace('text-', 'bg-') || 'bg-brand-accent'}`} />
                    
                    <div className="py-4 pr-4 pl-5 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {!item.noTime && (
                            <div className="px-2 h-5 flex items-center justify-center bg-gray-50 rounded-lg">
                              <Clock size={10} className="text-brand-dark/30 mr-1" />
                              <span className="text-[10px] font-bold text-brand-dark/70 font-display leading-none">{item.time}</span>
                            </div>
                          )}
                          <div className={`px-2 h-5 flex items-center justify-center rounded-lg border border-current/10 ${item.color || 'bg-brand-green/10 text-brand-accent'}`}>
                            <span className="text-[9px] font-bold uppercase tracking-wider font-display leading-none">{item.cat === 'SIGHTSEEING' ? 'SIGHTS' : (item.cat || 'Activity')}</span>
                          </div>
                        </div>
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => handleOpenEdit(item)}
                            className="text-brand-dark/15 hover:text-brand-accent transition-all p-1.5 hover:bg-brand-accent/5 rounded-lg"
                            title="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button 
                            onClick={() => handleDeleteEvent(item.id)}
                            className="text-brand-dark/15 hover:text-red-400 transition-all p-1.5 hover:bg-red-50 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-3 items-start">
                        <div className={`flex-shrink-0 pt-0.5 ${item.color?.split(' ')[1] || 'text-brand-accent'} opacity-80`}>
                          <Icon size={20} strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                          <h3 className="text-base font-bold text-brand-dark font-display leading-tight truncate">{item.title}</h3>
                          {item.location && (
                            <div className="flex items-center gap-2 text-brand-dark/40 text-[10px] font-medium font-sans">
                              <div className="flex items-center gap-1 min-w-0">
                                <MapPin size={10} className="flex-shrink-0 opacity-40" />
                                <span className="truncate">{item.location}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {item.desc && (
                        <div className="bg-gray-50/30 rounded-xl px-3 py-2 border border-gray-100/50">
                          <p className="text-[10px] leading-relaxed text-brand-dark/40 font-sans italic line-clamp-1">{item.desc}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        )}

        <motion.button
          onClick={handleOpenAdd}
          whileTap={{ scale: 0.95 }}
          className="w-full flex items-center justify-center gap-2 py-4 bg-brand-green/10 border border-brand-green/30 border-dashed rounded-2xl text-brand-accent font-bold text-[10px] uppercase tracking-wider font-display mb-12"
        >
          <Plus size={14} />
          Add Event
        </motion.button>
      </div>

      {/* Event Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm"
            />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-2xl overflow-visible"
              >
              <div className="w-12 h-1 bg-brand-dark/10 rounded-full mx-auto mb-4 sm:hidden" />
              
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h2 className="text-xl font-bold font-display text-brand-dark">
                  {editingEvent ? 'Edit Event' : 'Add New Event'}
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-brand-dark/30 hover:text-brand-dark transition-colors"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-3 sm:space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/40 ml-1">Title</label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2.5 sm:py-3 bg-brand-beige/50 rounded-xl border border-brand-green/20 focus:outline-none focus:border-brand-accent font-sans text-sm"
                    placeholder="E.g. Amsterdam Canal Cruise"
                  />
                </div>

                <div className="grid grid-cols-2 sm:flex sm:flex-nowrap gap-3 sm:gap-4 items-end">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/40 ml-1">Time</label>
                      <label className="flex items-center gap-1.5 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={formData.noTime} 
                          onChange={(e) => setFormData({ ...formData, noTime: e.target.checked })}
                          className="sr-only"
                        />
                        <div className={`w-7 h-4 rounded-full transition-colors relative ${formData.noTime ? 'bg-brand-accent' : 'bg-brand-dark/10'}`}>
                          <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${formData.noTime ? 'translate-x-3' : ''}`} />
                        </div>
                        <span className="text-[9px] font-bold text-brand-dark/30 group-hover:text-brand-accent transition-colors">NO TIME</span>
                      </label>
                    </div>
                    <input
                      required={!formData.noTime}
                      disabled={formData.noTime}
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className={`w-full h-[44px] sm:h-[48px] px-3 sm:px-4 py-2 bg-brand-beige/50 rounded-xl border border-brand-green/20 focus:outline-none focus:border-brand-accent font-sans text-sm transition-opacity ${formData.noTime ? 'opacity-30' : 'opacity-100'}`}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/40 ml-1">Category</label>
                    <div className="relative">
                      <select
                        value={formData.cat}
                        onChange={(e) => setFormData({ ...formData, cat: e.target.value })}
                        className="w-full h-[44px] sm:h-[48px] px-3 sm:px-4 py-2 bg-brand-beige/50 rounded-xl border border-brand-green/20 focus:outline-none focus:border-brand-accent font-sans text-sm appearance-none cursor-pointer"
                      >
                        {categories.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-none text-brand-dark/30">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/40 ml-1">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-2.5 sm:py-3 bg-brand-beige/50 rounded-xl border border-brand-green/20 focus:outline-none focus:border-brand-accent font-sans text-sm"
                    placeholder="Enter location"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/40 ml-1">Notes</label>
                  <textarea
                    rows={2}
                    value={formData.desc}
                    onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                    className="w-full px-4 py-2.5 sm:py-3 bg-brand-beige/50 rounded-xl border border-brand-green/20 focus:outline-none focus:border-brand-accent font-sans text-sm resize-none"
                    placeholder="Any extra details..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/40 ml-1">Attachment Link (URL)</label>
                  <input
                    type="url"
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    className="w-full px-4 py-2.5 sm:py-3 bg-brand-beige/50 rounded-xl border border-brand-green/20 focus:outline-none focus:border-brand-accent font-sans text-sm"
                    placeholder="E.g. Google Drive link"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className={`w-full py-3.5 sm:py-4 bg-brand-accent text-white rounded-2xl font-bold font-display uppercase tracking-wider shadow-lg shadow-brand-accent/20 transition-all mt-2 sm:mt-4 ${isSaving ? 'opacity-70 cursor-not-allowed scale-[0.98]' : 'hover:scale-[1.02]'}`}
                >
                  {isSaving ? 'Saving...' : (editingEvent ? 'Save Changes' : 'Create Event')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail View Modal */}
      <AnimatePresence>
        {isDetailOpen && selectedEvent && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailOpen(false)}
              className="absolute inset-0 bg-brand-dark/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className={`h-24 w-full relative ${selectedEvent.color || 'bg-brand-green/10'}`}>
                <button 
                  onClick={() => setIsDetailOpen(false)}
                  className="absolute top-6 right-6 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/40 transition-colors z-10"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
                <div className="absolute -bottom-6 left-8 w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center">
                  {(() => {
                    const Icon = iconMap[selectedEvent.icon] || MapPin;
                    return <Icon size={32} className={selectedEvent.color?.split(' ')[1] || 'text-brand-accent'} />;
                  })()}
                </div>
              </div>

              <div className="p-8 pt-10 overflow-y-auto no-scrollbar flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="px-2 py-0.5 bg-gray-100 rounded-md text-[10px] font-bold text-brand-dark/50">
                    {selectedEvent.time}
                  </div>
                  <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${selectedEvent.color}`}>
                    {selectedEvent.cat === 'SIGHTSEEING' ? 'SIGHTS' : selectedEvent.cat}
                  </div>
                </div>
                
                <h2 className="text-2xl font-bold font-display text-brand-dark mb-4">{selectedEvent.title}</h2>
                
                {selectedEvent.location && (
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedEvent.location)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-brand-accent p-3 bg-brand-accent/5 rounded-xl border border-brand-accent/10 mb-6 transition-colors hover:bg-brand-accent/10"
                  >
                    <MapPin size={16} />
                    <span className="text-xs font-bold font-sans">{selectedEvent.location}</span>
                  </a>
                )}

                {selectedEvent.desc && (
                  <div className="mb-8">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/20 block mb-2">Detailed Notes</label>
                    <p className="text-sm leading-relaxed text-brand-dark/70 font-sans">{selectedEvent.desc}</p>
                  </div>
                )}

                {selectedEvent.link && (
                  <div className="mt-8">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/20 block mb-3">Attachment</label>
                    <a 
                      href={selectedEvent.link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-4 bg-brand-beige/50 rounded-2xl border border-brand-green/20 text-brand-accent font-bold font-display uppercase tracking-wider hover:bg-brand-accent hover:text-white transition-all shadow-sm"
                    >
                      <Paperclip size={16} />
                      View Attachment
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BookingsTab = () => {
  const [activeSubTab, setActiveSubTab] = useState<'flights' | 'hotels' | 'vouchers'>('flights');
  
  return (
    <div id="bookings-tab" className="pb-32 px-6">
      <div className="flex gap-2 mb-6 bg-brand-green/20 p-1 rounded-2xl">
        {(['flights', 'hotels', 'vouchers'] as const).map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all ${
              activeSubTab === tab ? 'bg-white shadow-sm text-brand-accent' : 'text-brand-dark/40'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {activeSubTab === 'flights' && (
            <div className="boarding-pass p-6 border border-brand-green shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-brand-accent">
                  <Ticket size={24} />
                  <span className="font-bold tracking-widest text-xs uppercase text-brand-accent font-display">Airline Ticket</span>
                </div>
                <span className="font-bold text-brand-dark/40 text-xs font-display">KLM-2026</span>
              </div>
              <div className="flex justify-between items-center mb-8">
                <div className="text-center">
                  <p className="text-3xl font-bold font-display">TPE</p>
                  <p className="text-xs text-brand-dark/40 font-bold uppercase font-display">Taipei</p>
                </div>
                <div className="flex-1 flex flex-col items-center px-4">
                  <div className="w-full h-[2px] bg-brand-green relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-lg">✈️</div>
                  </div>
                  <p className="text-[10px] mt-2 font-bold text-brand-accent font-display">DIRECT</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold font-display">AMS</p>
                  <p className="text-xs text-brand-dark/40 font-bold uppercase font-display">Amsterdam</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 border-t border-brand-green border-dashed pt-6">
                <div><p className="text-[10px] text-brand-dark/40 font-bold uppercase font-display">Gate</p><p className="font-bold font-display">E4</p></div>
                <div><p className="text-[10px] text-brand-dark/40 font-bold uppercase font-display">Seat</p><p className="font-bold font-display">14A</p></div>
                <div><p className="text-[10px] text-brand-dark/40 font-bold uppercase font-display">Time</p><p className="font-bold font-display">23:55</p></div>
              </div>
            </div>
          )}

          {activeSubTab === 'hotels' && (
            <div className="journal-card border-brand-green flex gap-4 overflow-hidden relative">
              <div className="w-24 h-24 bg-brand-green/20 rounded-2xl flex-shrink-0 flex items-center justify-center">
                <ImageIcon className="text-brand-accent opacity-40" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold">Hotel Pulitzer Amsterdam</h3>
                <p className="text-xs text-brand-dark/60 mt-1">Check-in: 15:00</p>
                <div className="flex items-center gap-1 mt-2 text-brand-accent text-xs font-bold">
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Prinsengracht 323, Amsterdam")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    title="Open in Google Maps"
                  >
                    <MapPin size={12} />
                  </a>
                  <span>Prinsengracht 323, Amsterdam</span>
                </div>
              </div>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20"><ChevronRight /></div>
            </div>
          )}

          {activeSubTab === 'vouchers' && (
            <div className="journal-card border-brand-green flex items-center justify-between">
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                   <Ticket className="text-orange-500" />
                </div>
                <div>
                  <h3 className="font-bold">Eurail Global Pass</h3>
                  <p className="text-[10px] text-brand-dark/40 font-bold">15 Days Continuous</p>
                </div>
              </div>
              <ChevronRight className="text-brand-dark/20" />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const ExpenseTab = () => {
  return (
    <div id="expense-tab" className="px-6 pb-32">
      <div className="journal-card bg-brand-dark p-8 mb-8 text-white relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-3xl" />
        <p className="text-xs font-bold opacity-60 uppercase tracking-widest mb-2 font-display">Total Expenses</p>
        <div className="flex items-baseline gap-2">
          <h2 className="text-4xl font-bold font-display">¥ 125,400</h2>
          <span className="text-sm opacity-60 font-sans">≈ NT$ 26,334</span>
        </div>
        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] opacity-40 font-bold uppercase font-display">Daily Avg</p>
            <p className="font-bold font-display">¥ 25,080</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] opacity-40 font-bold uppercase font-display">Leftover</p>
            <p className="font-bold text-green-400 font-display">¥ 74,600</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {[
          { icon: '🍜', title: '築地壽司午餐', amount: '¥ 4,500', cat: 'Food', time: '13:20' },
          { icon: '🚇', title: '東京地鐵一日券', amount: '¥ 800', cat: 'Transport', time: '09:10' },
          { icon: '🛍️', title: 'Donki 購物', amount: '¥ 12,000', cat: 'Shopping', time: '昨天' },
        ].map((item, i) => (
          <div key={i} className="journal-card flex items-center justify-between font-sans">
            <div className="flex items-center gap-4">
              <span className="text-2xl grayscale hover:grayscale-0 transition-all">{item.icon}</span>
              <div>
                <h4 className="font-bold">{item.title}</h4>
                <p className="text-[10px] text-brand-dark/40 font-bold uppercase font-display">{item.cat} • {item.time}</p>
              </div>
            </div>
            <p className="font-bold font-display">{item.amount}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const JournalTab = () => {
  return (
    <div id="journal-tab" className="px-6 pb-32 space-y-8">
      <div className="journal-card p-0 overflow-hidden border-2 border-brand-green">
        <div className="aspect-video bg-brand-green/20 relative group">
          <img 
            src="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=2070&auto=format&fit=crop" 
            className="w-full h-full object-cover" 
            alt="Japan" 
          />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="text-white" size={32} />
          </div>
        </div>
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-accent p-1">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" className="w-full h-full" alt="avatar" />
              </div>
              <span className="font-bold text-sm">Mei</span>
            </div>
            <span className="text-xs text-brand-dark/40 font-bold">2026/04/25</span>
          </div>
          <p className="text-sm leading-relaxed text-brand-dark/80 italic font-medium">
            "終於到了期待已久的東京！今天的氣候非常舒服，築地市場的海鮮生蠔真的太鮮甜了... 🍣🏮"
          </p>
          <div className="mt-4 flex gap-2">
            <span className="bg-brand-beige px-3 py-1 rounded-full text-[10px] font-bold text-brand-accent">#TokyoTrip</span>
            <span className="bg-brand-beige px-3 py-1 rounded-full text-[10px] font-bold text-brand-accent">#SushiDay</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const PlanningTab = ({ user }: { user: User }) => {
  const [items, setItems] = useState<{ id: string; text: string; completed: boolean; type: 'mission' | 'prep'; prepCat?: string }[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'mission' | 'prep'>('mission');
  const [newItemText, setNewItemText] = useState('');
  const [selectedPrepCat, setSelectedPrepCat] = useState('文件');
  const [isAdding, setIsAdding] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const tripId = "europe-2026-trip";

  const prepCategories = ['文件', '衣物', '盥洗', '電子產品', '藥品', '其他'];

  useEffect(() => {
    // Default all categories to expanded
    const initialExpanded = prepCategories.reduce((acc, cat) => ({ ...acc, [cat]: true }), {});
    setExpandedCategories(initialExpanded);

    const q = query(collection(db, 'trips', tripId, 'todos'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setItems(docs);
    });
    return () => unsubscribe();
  }, [tripId]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const toggleItem = async (id: string, currentStatus: boolean) => {
    try {
      const itemRef = doc(db, 'trips', tripId, 'todos', id);
      await updateDoc(itemRef, { completed: !currentStatus });
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  const handleAddItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newItemText.trim() || isAdding) return;
    
    setIsAdding(true);
    try {
      await addDoc(collection(db, 'trips', tripId, 'todos'), {
        type: activeSubTab,
        text: newItemText.trim(),
        completed: false,
        authorId: user.uid,
        prepCat: activeSubTab === 'prep' ? selectedPrepCat : null,
        createdAt: new Date().toISOString()
      });
      setNewItemText('');
    } catch (err) {
      console.error("Add error:", err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteItem = async (e: React.MouseEvent, id: string, text: string) => {
    e.stopPropagation();
    if (window.confirm(`確定要刪除「${text}」嗎？`)) {
      try {
        await deleteDoc(doc(db, 'trips', tripId, 'todos', id));
      } catch (err) {
        console.error("Delete error:", err);
      }
    }
  };

  const filteredItems = items.filter(item => item.type === activeSubTab);

  // Grouping logic for Prep tab
  const groupedPrepItems = activeSubTab === 'prep' 
    ? prepCategories.reduce((acc, cat) => {
        const catItems = filteredItems.filter(i => i.prepCat === cat || (!i.prepCat && cat === '其他'));
        if (catItems.length > 0) acc[cat] = catItems;
        return acc;
      }, {} as Record<string, typeof filteredItems>)
    : null;

  return (
    <div id="checklist-tab" className="px-6 pb-32">
      {/* Sub Tabs */}
      <div className="flex gap-2 mb-6 bg-brand-green/20 p-1 rounded-2xl">
        <button 
          onClick={() => setActiveSubTab('mission')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all ${
            activeSubTab === 'mission' ? 'bg-white shadow-sm text-brand-accent' : 'text-brand-dark/40'
          }`}
        >
          Missions
        </button>
        <button 
          onClick={() => setActiveSubTab('prep')}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all ${
            activeSubTab === 'prep' ? 'bg-white shadow-sm text-brand-accent' : 'text-brand-dark/40'
          }`}
        >
          Prep
        </button>
      </div>

      <div className="journal-card p-4 space-y-2">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-dark/40">
            {activeSubTab === 'mission' ? 'Journey Tasks' : 'Packing & Docs'}
          </h3>
          <span className="text-[9px] font-black text-brand-accent bg-brand-accent/5 px-2 py-0.5 rounded-full">
            {filteredItems.filter(i => i.completed).length} / {filteredItems.length}
          </span>
        </div>

        {/* Inline Add Input */}
        <form onSubmit={handleAddItem} className="space-y-3 mb-4">
          <div className="flex flex-wrap sm:flex-nowrap gap-2 items-stretch">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              disabled={isAdding}
              placeholder={activeSubTab === 'mission' ? "Add task..." : "Add item..."}
              className="w-full sm:flex-1 px-4 py-2.5 bg-brand-beige/30 rounded-xl border border-brand-green/10 focus:outline-none focus:border-brand-accent/30 font-sans text-xs transition-all h-[42px] sm:h-auto"
            />
            <div className={`flex gap-2 ${activeSubTab === 'prep' ? 'w-full sm:w-auto flex-1 sm:flex-none' : 'w-full sm:w-10'}`}>
              {activeSubTab === 'prep' && (
                <div className="relative flex-1">
                  <select
                    value={selectedPrepCat}
                    onChange={(e) => setSelectedPrepCat(e.target.value)}
                    className="w-full px-3 pr-8 h-[42px] sm:h-full bg-brand-beige/30 rounded-xl border border-brand-green/10 focus:outline-none text-[9px] font-bold uppercase tracking-wider text-brand-dark/60 appearance-none cursor-pointer"
                  >
                    {prepCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-brand-dark/20">
                    <ChevronDown size={12} />
                  </div>
                </div>
              )}
              <button 
                type="submit"
                disabled={!newItemText.trim() || isAdding}
                className={`h-[42px] rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                  activeSubTab === 'prep' ? 'w-10 px-2' : 'flex-1 sm:w-10 px-3 sm:px-2'
                } ${
                  newItemText.trim() ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20' : 'bg-gray-200 text-gray-400'
                }`}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </form>

        <AnimatePresence mode="popLayout" initial={false}>
          {activeSubTab === 'prep' ? (
            Object.keys(groupedPrepItems || {}).length === 0 ? (
              <motion.p className="text-center py-6 text-[10px] text-brand-dark/40 font-bold">No items yet ✨</motion.p>
            ) : (
              Object.entries(groupedPrepItems || {}).map(([category, catItems]) => (
                <div key={category} className="mb-2 last:mb-0">
                  <button 
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center gap-2 px-1 py-1 group"
                  >
                    <motion.div
                      animate={{ rotate: expandedCategories[category] ? 0 : -90 }}
                      className="text-brand-dark/20 group-hover:text-brand-accent transition-colors"
                    >
                      <ChevronDown size={12} />
                    </motion.div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-dark/30 group-hover:text-brand-accent transition-colors">
                      {category}
                    </span>
                    <div className="h-[1px] flex-1 bg-brand-dark/5" />
                    <span className="text-[9px] font-bold text-brand-dark/20">({catItems.length})</span>
                  </button>
                  
                  <AnimatePresence initial={false}>
                    {expandedCategories[category] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden grid grid-cols-2 gap-1.5 mt-1.5"
                      >
                        {catItems.map(item => (
                          <motion.div 
                            key={item.id} 
                            layout
                            className={`flex items-center gap-2 p-1.5 rounded-lg transition-all border border-transparent active:scale-[0.98] cursor-pointer ${
                              item.completed ? 'bg-gray-50/30' : 'bg-brand-beige/20 border-brand-green/5'
                            }`}
                            onClick={() => toggleItem(item.id, item.completed)}
                          >
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                              item.completed ? 'bg-brand-accent border-brand-accent text-white' : 'border-brand-green/40'
                            }`}>
                              {item.completed && <Plus size={10} className="rotate-45" />}
                            </div>
                            <span className={`flex-1 text-[11px] font-medium truncate transition-all ${item.completed ? 'line-through opacity-30 text-brand-dark/50' : 'text-brand-dark'}`}>
                              {item.text}
                            </span>
                            <button 
                              onClick={(e) => handleDeleteItem(e, item.id, item.text)} 
                              className="p-1 text-brand-dark/10 hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )
          ) : (
            filteredItems.length === 0 ? (
              <motion.p className="text-center py-6 text-[10px] text-brand-dark/40 font-bold">No tasks yet ✨</motion.p>
            ) : (
              <div className="space-y-1.5">
                {filteredItems.sort((a: any, b: any) => (a.createdAt > b.createdAt ? -1 : 1)).map((item) => (
                  <motion.div 
                    key={item.id} 
                    layout
                    className={`flex items-center gap-2.5 p-2 rounded-xl transition-all border border-transparent active:scale-[0.98] cursor-pointer ${
                      item.completed ? 'bg-gray-50/50' : 'bg-white shadow-sm border-brand-green/10'
                    }`}
                    onClick={() => toggleItem(item.id, item.completed)}
                  >
                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      item.completed ? 'bg-brand-accent border-brand-accent text-white' : 'border-brand-green'
                    }`}>
                      {item.completed && <Plus size={12} className="rotate-45" />}
                    </div>
                    <span className={`flex-1 text-xs font-medium transition-all ${item.completed ? 'line-through opacity-30 text-brand-dark/50' : 'text-brand-dark'}`}>
                      {item.text}
                    </span>
                    <button 
                      onClick={(e) => handleDeleteItem(e, item.id, item.text)} 
                      className="p-1.5 text-brand-dark/10 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const MembersTab = () => {
  return (
    <div id="members-tab" className="px-6 pb-32 space-y-4">
      {[
        { name: 'Mei (我)', role: '主辦人', bio: '吃貨擔當 🍜', seed: 'Felix' },
        { name: 'Jay', role: '攝影師', bio: '拍照擔當 📸', seed: 'Jack' },
        { name: 'Lena', role: '財務長', bio: '精打細算 💸', seed: 'Aneka' },
      ].map((member, i) => (
        <div key={i} className="journal-card flex items-center gap-4 transition-transform active:scale-95">
          <div className="w-14 h-14 rounded-full bg-brand-green/30 border-2 border-brand-accent overflow-hidden">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.seed}`} alt="avatar" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h4 className="font-bold">{member.name}</h4>
              <span className="text-[10px] bg-brand-accent text-white px-2 py-0.5 rounded-full font-bold uppercase">{member.role}</span>
            </div>
            <p className="text-xs text-brand-dark/60 mt-1">{member.bio}</p>
          </div>
        </div>
      ))}
      <button className="w-full journal-card border-2 border-dashed border-brand-green bg-transparent flex flex-col items-center py-8 opacity-60 hover:opacity-100 transition-opacity">
        <Plus size={32} className="text-brand-accent mb-2" />
        <span className="font-bold text-sm">邀請新成員</span>
      </button>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('schedule');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
      } else {
        // Transparent login
        try {
          const { signInAnonymously } = await import('firebase/auth');
          await signInAnonymously(auth);
        } catch (err) {
          console.error("Auth error:", err);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-beige flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="text-4xl"
        >
          🌸
        </motion.div>
      </div>
    );
  }

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-brand-beige flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-8 h-8 border-4 border-brand-green border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const currentUser = user;

  const getTitle = () => {
    switch(activeTab) {
      case 'schedule': return 'Europe 2026';
      case 'bookings': return '預訂憑證';
      case 'expense': return '旅遊記帳簿';
      case 'journal': return '旅行回憶錄';
      case 'planning': return 'Checklist';
      case 'members': return '冒險夥伴們';
    }
  };

  const getSubtitle = () => {
    if (activeTab === 'schedule') return 'NETHERLANDS ‧ BELGIUM ‧ GERMANY';
    return undefined;
  };

  const getAvatars = () => {
    const list = [];
    if (user) {
      list.push({ 
        id: user.uid, 
        url: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}` 
      });
      // Mock partners for display
      list.push({ id: 'partner-1', url: `https://api.dicebear.com/7.x/avataaars/svg?seed=Felix` });
      list.push({ id: 'partner-2', url: `https://api.dicebear.com/7.x/avataaars/svg?seed=Jack` });
    }
    return list;
  };

  return (
    <main id="app-root" className="max-w-md mx-auto min-h-screen pb-20 relative bg-brand-beige overflow-hidden pt-2">
      <Header title={getTitle()} subtitle={getSubtitle()} avatars={getAvatars()} />
      
      <div className="mt-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'schedule' && <ScheduleTab user={user!} />}
            {activeTab === 'bookings' && <BookingsTab />}
            {activeTab === 'expense' && <ExpenseTab />}
            {activeTab === 'journal' && <JournalTab />}
            {activeTab === 'planning' && <PlanningTab user={user!} />}
            {activeTab === 'members' && <MembersTab />}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Decorative Stickers */}
      <div className="fixed top-24 -right-12 pointer-events-none opacity-20 rotate-12 -z-10">
        <span className="text-[120px]">🌸</span>
      </div>
      <div className="fixed bottom-32 -left-16 pointer-events-none opacity-20 -rotate-12 -z-10">
        <span className="text-[140px]">🍵</span>
      </div>
    </main>
  );
}
