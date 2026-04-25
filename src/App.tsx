import { useState, useEffect } from 'react';
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
  Search
} from 'lucide-react';
import { auth, db } from './lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, addDoc } from 'firebase/firestore';

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
  // Use a stable trip ID for this demo/turn
  const tripId = "europe-2026-trip";
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Map strings to Lucide components
  const iconMap: Record<string, any> = {
    'Plane': Plane,
    'Hotel': Hotel,
    'MapPin': MapPin,
    'Utensils': Utensils,
    'Camera': Camera,
    'ShoppingCart': Search // Default for now
  };

  // Generate dates from May 21 to June 5
  const generateDates = () => {
    const dates = [];
    const start = new Date(2026, 4, 21); // May 21
    const end = new Date(2026, 5, 5);    // June 5
    let current = new Date(start);
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const days = generateDates();
  const [selectedDay, setSelectedDay] = useState(0);

  useEffect(() => {
    // Initial data seeding
    const seedInitialData = async () => {
      const q = query(collection(db, 'trips', tripId, 'events'));
      const snapshot = await getDoc(doc(db, 'trips', tripId)); // Just check if trip document exists as a proxy
      
      const eventsSnap = await collection(db, 'trips', tripId, 'events');
      // We check if we have any events
      // Actually simpler: just check if the trip doc has been visited/initialized
      const hasInitialized = localStorage.getItem(`trip_init_${tripId}`);
      if (!hasInitialized) {
        const initialEvents = [
          { time: '09:30', title: 'AMS Schiphol Arrival', cat: 'Transport', icon: 'Plane', location: 'Schiphol Airport, Amsterdam', desc: 'Terminal arrival and luggage collection. Transfer to city center via NS Train.', color: 'bg-orange-100 text-orange-600', dayIndex: 0 },
          { time: '12:00', title: 'Hotel Pulitzer Check-in', cat: 'Stay', icon: 'Hotel', location: 'Prinsengracht 323, Amsterdam', desc: 'Check into the historic canal house hotel. Quick refresh before city exploration.', color: 'bg-sky-100 text-sky-600', dayIndex: 0 },
          { time: '14:30', title: 'Anne Frank House', cat: 'Sights', icon: 'MapPin', location: 'Westermarkt 20, Amsterdam', desc: 'Self-guided tour with an audio guide through the Secret Annex.', color: 'bg-emerald-100 text-emerald-600', dayIndex: 0 },
          { time: '18:30', title: 'Canal Cruise Dinner', cat: 'Food', icon: 'Utensils', location: 'Central Station Pier', desc: 'Scenic twilight cruise through the historic canals with a 3-course Dutch meal.', color: 'bg-amber-100 text-amber-600', dayIndex: 0 }
        ];

        for (const ev of initialEvents) {
          await addDoc(collection(db, 'trips', tripId, 'events'), ev);
        }
        localStorage.setItem(`trip_init_${tripId}`, 'true');
      }
    };

    if (user) seedInitialData();

    const q = query(
      collection(db, 'trips', tripId, 'events'),
      where('dayIndex', '==', selectedDay)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by time
      items.sort((a: any, b: any) => a.time.localeCompare(b.time));
      setEvents(items);
      setLoading(false);
    }, (error) => {
      console.error("Firestore read error:", error);
    });
    
    return () => unsubscribe();
  }, [selectedDay]);

  const handleAddEvent = async () => {
    const title = prompt("Event Title:");
    if (!title) return;
    const time = prompt("Time (HH:mm):", "12:00");
    if (!time) return;
    const location = prompt("Location:");
    const desc = prompt("Description:");
    
    try {
      await addDoc(collection(db, 'trips', tripId, 'events'), {
        title,
        time,
        location: location || '',
        desc: desc || '',
        dayIndex: selectedDay,
        icon: 'MapPin', // Default
        cat: 'Activity', // Default
        color: 'bg-indigo-100 text-indigo-600' // Default
      });
    } catch (err) {
      console.error("Add event error:", err);
    }
  };

  const handleEditEvent = async (event: any) => {
    const newTitle = prompt("Edit Title:", event.title);
    if (newTitle === null) return;
    
    try {
      const eventRef = doc(db, 'trips', tripId, 'events', event.id);
      await updateDoc(eventRef, { title: newTitle });
    } catch (err) {
      console.error("Update event error:", err);
    }
  };

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
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative overflow-hidden w-full bg-white rounded-2xl shadow-sm border border-brand-green/10 transition-transform active:scale-[0.98]"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.color?.split(' ')[1]?.replace('text-', 'bg-') || 'bg-brand-accent'}`} />
                
                <div className="py-4 pr-4 pl-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="px-2 h-[18px] flex items-center justify-center bg-gray-100 rounded-md">
                      <span className="text-[10px] font-bold text-brand-dark/70 font-display leading-none">{item.time}</span>
                    </div>
                    <div className={`px-2 h-[18px] flex items-center justify-center rounded-md ${item.color || 'bg-brand-green/10 text-brand-accent'}`}>
                      <span className="text-[9px] font-bold uppercase tracking-wider font-display leading-none">{item.cat || 'Activity'}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className={`flex-shrink-0 pt-0.5 ${item.color?.split(' ')[1] || 'text-brand-accent'}`}>
                      <Icon size={20} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-[16px] font-bold text-brand-dark font-display leading-tight">{item.title}</h3>
                      {item.location && (
                        <div className="flex items-center gap-1 text-brand-dark/40 text-[10px] font-medium font-sans">
                          <MapPin size={10} className="flex-shrink-0 opacity-60" />
                          <span className="truncate">{item.location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {item.desc && (
                    <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100/50">
                      <p className="text-[11px] leading-relaxed text-brand-dark/60 font-sans italic">{item.desc}</p>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button 
                      onClick={() => handleEditEvent(item)}
                      className="flex items-center gap-1.5 text-brand-dark/30 hover:text-brand-accent transition-colors cursor-pointer group"
                    >
                      <Search size={10} className="group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-bold uppercase tracking-tighter font-display leading-none">Edit Details</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}

        <motion.button
          onClick={handleAddEvent}
          whileTap={{ scale: 0.95 }}
          className="w-full flex items-center justify-center gap-2 py-4 bg-brand-green/10 border border-brand-green/30 border-dashed rounded-2xl text-brand-accent font-bold text-[10px] uppercase tracking-wider font-display mb-12"
        >
          <Plus size={14} />
          Add Event
        </motion.button>
      </div>
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
                  <MapPin size={12} />
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
          console.error("Anonymous sign in error:", err);
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
