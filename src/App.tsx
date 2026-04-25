import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Paperclip
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
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, addDoc } from 'firebase/firestore';

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
    { id: 'planning', icon: CheckSquare, label: 'Packing' },
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
  const locationInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  
  // Modal State
  const [formData, setFormData] = useState({
    title: '',
    time: '12:00',
    location: '',
    desc: '',
    cat: 'OTHER',
    link: ''
  });

  const categories = [
    { label: 'TRANSPORT', value: 'TRANSPORT', icon: 'Plane' },
    { label: 'FOOD', value: 'FOOD', icon: 'Utensils' },
    { label: 'STAY', value: 'STAY', icon: 'Hotel' },
    { label: 'SIGHTSEEING', value: 'SIGHTSEEING', icon: 'Camera' },
    { label: 'SHOPPING', value: 'SHOPPING', icon: 'ShoppingCart' },
    { label: 'OTHER', value: 'OTHER', icon: 'MapPin' },
  ];

  const handleOpenAdd = () => {
    setEditingEvent(null);
    setFormData({
      title: '',
      time: '12:00',
      location: '',
      desc: '',
      cat: 'OTHER',
      link: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (event: any) => {
    setEditingEvent(event);
    setFormData({
      title: event.title || '',
      time: event.time || '12:00',
      location: event.location || '',
      desc: event.desc || '',
      cat: event.cat || 'OTHER',
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
    try {
      const icon = categories.find(c => c.value === formData.cat)?.icon || 'MapPin';
      const eventPayload = {
        ...formData,
        dayIndex: selectedDay,
        icon,
        color: formData.cat === 'TRANSPORT' ? 'bg-orange-100 text-orange-600' :
               formData.cat === 'FOOD' ? 'bg-amber-100 text-amber-600' :
               formData.cat === 'STAY' ? 'bg-sky-100 text-sky-600' :
               formData.cat === 'SIGHTSEEING' ? 'bg-emerald-100 text-emerald-600' :
               formData.cat === 'SHOPPING' ? 'bg-pink-100 text-pink-600' :
               'bg-indigo-100 text-indigo-600'
      };

      if (editingEvent) {
        await updateEvent(editingEvent.id, eventPayload);
      } else {
        await addEvent(eventPayload);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Error saving event.');
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

  useEffect(() => {
    if (isModalOpen && locationInputRef.current) {
      // Small delay to ensure the modal animation is somewhat stable or the element is fully in DOM
      const timer = setTimeout(() => {
        if (!window.google || !window.google.maps || !window.google.maps.places) {
          console.warn("Google Maps API not loaded properly");
          return;
        }

        autocompleteRef.current = new window.google.maps.places.Autocomplete(locationInputRef.current, {
          types: ['geocode', 'establishment'],
        });

        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current.getPlace();
          if (place.name || place.formatted_address) {
            setFormData(prev => ({
              ...prev,
              location: place.formatted_address || place.name
            }));
          }
        });

        // Prevent form submission on Enter
        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault();
          }
        };
        locationInputRef.current?.addEventListener('keydown', handleKeyDown);

        return () => {
          locationInputRef.current?.removeEventListener('keydown', handleKeyDown);
          if (window.google && window.google.maps && window.google.maps.event) {
            window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
          }
        };
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isModalOpen]);

  return (
    <div id="schedule-tab" className="pb-32">
      {/* Date Picker */}
      <div className="flex gap-2 overflow-x-auto px-6 pt-2 pb-0 no-scrollbar">
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

      {/* Weather Card Placeholder (keeping as is for UI consistency) */}
      <motion.div
        key={selectedDay}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 mb-6 bg-white rounded-2xl border border-brand-green/10 shadow-sm overflow-hidden"
      >
        <div className="py-4 px-4 flex items-center justify-between">
          <div className="flex gap-3 items-center">
            <div className={`p-2.5 rounded-2xl bg-amber-50 text-amber-500`}>
              <Sun size={24} strokeWidth={2} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-bold text-brand-dark font-display leading-tight">22°C</span>
                <div className="h-3 w-[1px] bg-brand-dark/10" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/40 font-display">Sunny</span>
              </div>
              <p className="text-[11px] text-brand-dark/50 font-sans mt-0.5 italic">Perfect for travelling.</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
             <span className="text-[9px] font-black uppercase tracking-widest text-brand-dark/20 font-display">EUROPE</span>
          </div>
        </div>
      </motion.div>

      {/* Itinerary Section */}
      <div className="px-4 space-y-4 pb-12 font-sans">
        {loading ? (
          <p className="text-center py-10 text-xs text-brand-dark/20 font-bold">Loading schedule...</p>
        ) : events.length === 0 ? (
          <div className="text-center py-10 opacity-30">
            <Sparkles className="mx-auto mb-2" size={24} />
            <p className="text-xs font-bold uppercase tracking-widest">No events planned</p>
          </div>
        ) : (
          events.map((item, i) => {
            const Icon = iconMap[item.icon] || MapPin;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.97 }}
                transition={{ delay: i * 0.03 }}
                className="relative overflow-hidden w-full bg-white rounded-[1.5rem] shadow-sm border border-brand-green/10 transition-all hover:shadow-md cursor-pointer active:shadow-inner"
                onClick={() => {
                  setSelectedEvent(item);
                  setIsDetailOpen(true);
                }}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.color?.split(' ')[1]?.replace('text-', 'bg-') || 'bg-brand-accent'}`} />
                
                <div className="py-4 pr-4 pl-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="px-2 h-5 flex items-center justify-center bg-gray-50 rounded-lg">
                        <Clock size={10} className="text-brand-dark/30 mr-1" />
                        <span className="text-[10px] font-bold text-brand-dark/70 font-display leading-none">{item.time}</span>
                      </div>
                      <div className={`px-2 h-5 flex items-center justify-center rounded-lg border border-current/10 ${item.color || 'bg-brand-green/10 text-brand-accent'}`}>
                        <span className="text-[9px] font-bold uppercase tracking-wider font-display leading-none">{item.cat || 'Activity'}</span>
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
                        <div className="flex items-center gap-1 text-brand-dark/40 text-[10px] font-medium font-sans">
                          <MapPin size={10} className="flex-shrink-0 opacity-40" />
                          <span className="truncate">{item.location}</span>
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
              </motion.div>
            );
          })
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
              className="relative w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              <div className="w-12 h-1 bg-brand-dark/10 rounded-full mx-auto mb-6 sm:hidden" />
              
              <div className="flex justify-between items-center mb-6">
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

              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/40 ml-1">Title</label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-brand-beige/50 rounded-xl border border-brand-green/20 focus:outline-none focus:border-brand-accent font-sans text-sm"
                    placeholder="E.g. Amsterdam Canal Cruise"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/40 ml-1">Time</label>
                    <input
                      required
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      className="w-full px-4 py-3 bg-brand-beige/50 rounded-xl border border-brand-green/20 focus:outline-none focus:border-brand-accent font-sans text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/40 ml-1">Category</label>
                    <select
                      value={formData.cat}
                      onChange={(e) => setFormData({ ...formData, cat: e.target.value })}
                      className="w-full px-4 py-3 bg-brand-beige/50 rounded-xl border border-brand-green/20 focus:outline-none focus:border-brand-accent font-sans text-sm appearance-none"
                    >
                      {categories.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/40 ml-1">Location</label>
                  <input
                    ref={locationInputRef}
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 bg-brand-beige/50 rounded-xl border border-brand-green/20 focus:outline-none focus:border-brand-accent font-sans text-sm"
                    placeholder="Google Maps location"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/40 ml-1">Notes</label>
                  <textarea
                    rows={3}
                    value={formData.desc}
                    onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                    className="w-full px-4 py-3 bg-brand-beige/50 rounded-xl border border-brand-green/20 focus:outline-none focus:border-brand-accent font-sans text-sm resize-none"
                    placeholder="Any extra details..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-brand-dark/40 ml-1">Attachment Link (URL)</label>
                  <input
                    type="url"
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    className="w-full px-4 py-3 bg-brand-beige/50 rounded-xl border border-brand-green/20 focus:outline-none focus:border-brand-accent font-sans text-sm"
                    placeholder="E.g. Google Drive link"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-brand-accent text-white rounded-2xl font-bold font-display uppercase tracking-wider shadow-lg shadow-brand-accent/20 hover:scale-[1.02] transition-all mt-4"
                >
                  {editingEvent ? 'Save Changes' : 'Create Event'}
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
                    {selectedEvent.cat}
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
  const [todos, setTodos] = useState<{ id: string; text: string; completed: boolean }[]>([]);
  const tripId = "europe-2026-trip"; // Temporary fixed ID

  useEffect(() => {
    const q = query(collection(db, 'trips', tripId, 'todos'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      setTodos(items);
    });
    return () => unsubscribe();
  }, []);

  const toggleTodo = async (id: string, currentStatus: boolean) => {
    try {
      const todoRef = doc(db, 'trips', tripId, 'todos', id);
      await updateDoc(todoRef, { completed: !currentStatus });
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  const handleAddTodo = async () => {
    const text = prompt("請輸入待辦事項:");
    if (!text) return;
    try {
      await addDoc(collection(db, 'trips', tripId, 'todos'), {
        tripId,
        type: 'todo',
        text,
        completed: false,
        authorId: user.uid
      });
    } catch (err) {
      console.error("Add error:", err);
    }
  };

  return (
    <div id="planning-tab" className="px-6 pb-32">
      <div className="journal-card space-y-4">
        {todos.length === 0 && <p className="text-center py-4 text-xs text-brand-dark/40 font-bold">還沒有待辦事項 ✨</p>}
        {todos.map((item) => (
          <div 
            key={item.id} 
            className="flex items-center gap-4 py-2 group cursor-pointer"
            onClick={() => toggleTodo(item.id, item.completed)}
          >
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
              item.completed ? 'bg-brand-accent border-brand-accent text-white' : 'border-brand-green'
            }`}>
              {item.completed && <CheckSquare size={14} />}
            </div>
            <span className={`flex-1 text-sm font-medium transition-all ${item.completed ? 'line-through opacity-40' : ''}`}>
              {item.text}
            </span>
          </div>
        ))}
        <button 
          id="add-todo" 
          onClick={handleAddTodo}
          className="flex items-center gap-2 text-brand-accent font-bold pt-4 text-sm hover:opacity-80"
        >
          <Plus size={16} />
          新增待辦
        </button>
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
      case 'planning': return '行前備事清單';
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
