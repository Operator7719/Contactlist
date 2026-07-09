import React, { useState, useEffect } from "react";
import { 
  User, 
  Phone, 
  Mail, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  Search, 
  MessageCircle, 
  Heart, 
  Sparkles, 
  Check,
  AlertCircle,
  X,
  RefreshCw,
  LogIn,
  LogOut,
  Cloud,
  CheckCircle,
  Shield,
  Loader2,
  Bookmark
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Contact, AVATAR_COLORS, INITIAL_CONTACTS } from "./types";
import { 
  googleSignIn, 
  logout, 
  initAuth, 
  getAccessToken 
} from "./lib/firebase";
import { 
  fetchGoogleContacts, 
  createGoogleContact, 
  updateGoogleContact, 
  deleteGoogleContact 
} from "./lib/googleContacts";
import { User as FirebaseUser } from "firebase/auth";

export default function App() {
  // State for local contacts
  const [localContacts, setLocalContacts] = useState<Contact[]>(() => {
    try {
      const saved = localStorage.getItem("contacts_list_app");
      return saved ? JSON.parse(saved) : INITIAL_CONTACTS;
    } catch {
      return INITIAL_CONTACTS;
    }
  });

  // State for Google Contacts
  const [googleContacts, setGoogleContacts] = useState<Contact[]>([]);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  // Authentication states
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Form inputs
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [syncToGoogle, setSyncToGoogle] = useState(false);

  // State for tracking editing contact
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditingGoogleContact, setIsEditingGoogleContact] = useState(false);
  const [editingEtag, setEditingEtag] = useState<string | null>(null);

  // Filter tab state
  const [activeTab, setActiveTab] = useState<"all" | "local" | "google">("all");

  // Search query
  const [searchQuery, setSearchQuery] = useState("");

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Form error
  const [formError, setFormError] = useState<string | null>(null);

  // Confirmation Modal state for Workspace mutations
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
    isDestructive?: boolean;
  } | null>(null);

  // Gemini Affirmation widget states
  const [affirmation, setAffirmation] = useState({
    title: "Believe in Yourself!",
    text: "Every day is a new opportunity to grow, work hard, and achieve success."
  });
  const [loadingAffirmation, setLoadingAffirmation] = useState(false);

  // Save local contacts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("contacts_list_app", JSON.stringify(localContacts));
  }, [localContacts]);

  // Toast helper
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    const timer = setTimeout(() => {
      setToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  };

  // Restore session & auth state on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
        setSyncToGoogle(true);
        loadGoogleContacts(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
        setGoogleContacts([]);
        setSyncToGoogle(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch daily affirmation from Gemini API on mount
  useEffect(() => {
    fetchAffirmation();
  }, []);

  // API call to backend Gemini generator
  const fetchAffirmation = async () => {
    setLoadingAffirmation(true);
    try {
      const res = await fetch("/api/affirmation");
      if (res.ok) {
        const data = await res.json();
        setAffirmation(data);
      } else {
        throw new Error("Affirmation lookup failed");
      }
    } catch (err) {
      console.error("Error fetching affirmation:", err);
      // Fallback is already initialized in state
    } finally {
      setLoadingAffirmation(false);
    }
  };

  // Google Sign In handler
  const handleGoogleSignIn = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setCurrentUser(result.user);
        setAccessToken(result.accessToken);
        setSyncToGoogle(true);
        showToast(`Welcome, ${result.user.displayName}!`, "success");
        loadGoogleContacts(result.accessToken);
      }
    } catch (error: any) {
      console.error("Sign-in failed:", error);
      showToast("Authentication failed. Please try again.", "error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    try {
      await logout();
      setCurrentUser(null);
      setAccessToken(null);
      setGoogleContacts([]);
      setSyncToGoogle(false);
      setActiveTab("local");
      showToast("Signed out successfully.", "info");
    } catch (error) {
      console.error("Logout failed:", error);
      showToast("Failed to sign out.", "error");
    }
  };

  // Fetch from Google People API
  const loadGoogleContacts = async (token: string) => {
    setIsLoadingGoogle(true);
    try {
      const fetched = await fetchGoogleContacts(token);
      setGoogleContacts(fetched);
    } catch (error) {
      console.error("Failed to load Google Contacts:", error);
      showToast("Unable to fetch Google Contacts. Please log in again.", "error");
    } finally {
      setIsLoadingGoogle(false);
    }
  };

  // Save or Update contact form handler
  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name.trim()) {
      setFormError("Name field is required");
      return;
    }
    if (!phone.trim()) {
      setFormError("Phone field is required");
      return;
    }
    if (!email.trim()) {
      setFormError("Email field is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setFormError("Please enter a valid email address");
      return;
    }

    setFormError(null);

    // Editing mode
    if (editingId !== null) {
      if (isEditingGoogleContact) {
        // Mutating Google Contact: MUST ask for user confirmation
        if (!accessToken) {
          showToast("Please sign in with Google to modify this contact.", "error");
          return;
        }

        setConfirmModal({
          isOpen: true,
          title: "Update Google Contact?",
          message: `Are you sure you want to update the contact details for "${name.trim()}" in your Google account?`,
          confirmLabel: "Update in Google Contacts",
          onConfirm: async () => {
            setConfirmModal(null);
            try {
              if (!accessToken || !editingEtag) return;
              await updateGoogleContact(accessToken, editingId, editingEtag, {
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim()
              });
              
              showToast(`Contact "${name.trim()}" updated in Google Contacts!`, "success");
              // Clear form
              resetForm();
              // Refresh contacts list
              loadGoogleContacts(accessToken);
            } catch (err: any) {
              console.error(err);
              showToast("Failed to update Google Contact. Try signing in again.", "error");
            }
          }
        });
      } else {
        // Local contact update (no confirmation needed as it's purely client-side local data)
        setLocalContacts(
          localContacts.map((c) =>
            c.id === editingId
              ? { ...c, name: name.trim(), phone: phone.trim(), email: email.trim() }
              : c
          )
        );
        showToast(`Contact "${name.trim()}" updated successfully!`, "success");
        resetForm();
      }
    } else {
      // Create mode
      if (syncToGoogle && currentUser && accessToken) {
        // Mutating Google Contact: MUST ask for user confirmation
        setConfirmModal({
          isOpen: true,
          title: "Save to Google Contacts?",
          message: `This will save and create a new contact for "${name.trim()}" directly in your Google account directory.`,
          confirmLabel: "Create in Google Contacts",
          onConfirm: async () => {
            setConfirmModal(null);
            try {
              await createGoogleContact(accessToken, {
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim()
              });
              
              showToast(`Contact "${name.trim()}" created in Google Contacts!`, "success");
              resetForm();
              loadGoogleContacts(accessToken);
            } catch (err: any) {
              console.error(err);
              showToast("Failed to save contact to Google. Try logging in again.", "error");
            }
          }
        });
      } else {
        // Save local contact
        const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
        const newContact: Contact = {
          id: Date.now().toString(),
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          avatarColor: randomColor,
        };

        setLocalContacts([newContact, ...localContacts]);
        showToast(`Contact "${newContact.name}" saved locally!`, "success");
        resetForm();
      }
    }
  };

  // Populate form for editing
  const handleEditContact = (contact: Contact) => {
    setEditingId(contact.id);
    setName(contact.name);
    setPhone(contact.phone);
    setEmail(contact.email);
    setFormError(null);
    
    if (contact.isGoogleContact) {
      setIsEditingGoogleContact(true);
      setEditingEtag(contact.etag || null);
      setSyncToGoogle(true);
    } else {
      setIsEditingGoogleContact(false);
      setEditingEtag(null);
      setSyncToGoogle(false);
    }
    
    // Smooth scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Delete contact handler
  const handleDeleteContact = (contact: Contact) => {
    if (contact.isGoogleContact) {
      // Google deletion: MUST obtain explicit user confirmation
      if (!accessToken) {
        showToast("Please sign in with Google to delete this contact.", "error");
        return;
      }

      setConfirmModal({
        isOpen: true,
        title: "Delete from Google Contacts?",
        message: `Are you sure you want to permanently delete "${contact.name}" from your Google account? This action cannot be undone.`,
        confirmLabel: "Delete permanently",
        isDestructive: true,
        onConfirm: async () => {
          setConfirmModal(null);
          try {
            await deleteGoogleContact(accessToken, contact.resourceName!);
            showToast(`Contact deleted from Google Contacts`, "info");
            
            if (editingId === contact.id) {
              resetForm();
            }
            loadGoogleContacts(accessToken);
          } catch (err) {
            console.error(err);
            showToast("Failed to delete contact from Google.", "error");
          }
        }
      });
    } else {
      // Local deletion (does not mutate cloud data, so immediate deletion is safe)
      if (editingId === contact.id) {
        resetForm();
      }
      setLocalContacts(localContacts.filter((c) => c.id !== contact.id));
      showToast(`Contact "${contact.name}" deleted locally`, "info");
    }
  };

  // Copy a Google Contact to local lists
  const handleImportToLocal = (contact: Contact) => {
    // Check if already in local
    const exists = localContacts.some(
      (c) => c.phone === contact.phone || c.email === contact.email
    );
    if (exists) {
      showToast(`"${contact.name}" is already in your local contacts.`, "info");
      return;
    }

    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const imported: Contact = {
      id: Date.now().toString(),
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      avatarColor: randomColor,
    };

    setLocalContacts([imported, ...localContacts]);
    showToast(`"${contact.name}" saved to Local Directory!`, "success");
  };

  const resetForm = () => {
    setEditingId(null);
    setIsEditingGoogleContact(false);
    setEditingEtag(null);
    setName("");
    setPhone("");
    setEmail("");
    setSyncToGoogle(currentUser !== null);
    setFormError(null);
  };

  // Cancel edit helper
  const handleCancelEdit = () => {
    resetForm();
  };

  // Formatting WhatsApp links helper
  const getWhatsAppLink = (phoneNumber: string) => {
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");
    return `https://wa.me/${cleanNumber}`;
  };

  // Combine and filter contacts based on Active Tab
  const combinedContacts = (() => {
    if (activeTab === "local") {
      return localContacts;
    }
    if (activeTab === "google") {
      return googleContacts;
    }
    // "all"
    return [...googleContacts, ...localContacts];
  })();

  // Filter based on Search Query
  const filteredContacts = combinedContacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FDF2F4] text-slate-800 font-sans selection:bg-pink-200">
      
      {/* AppBar Navbar */}
      <header className="sticky top-0 z-40 bg-pink-500 shadow-md backdrop-blur-md bg-opacity-95 text-white">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl" role="img" aria-label="cherry blossom">🌸</span>
            <h1 className="font-display font-bold text-xl tracking-wide">Contact List</h1>
          </div>
          
          {/* Auth State & Custom Sign In button */}
          <div className="flex items-center space-x-3">
            {currentUser ? (
              <div className="flex items-center space-x-3 bg-pink-600/40 pl-2.5 pr-3.5 py-1.5 rounded-full backdrop-blur-sm border border-pink-400/20 text-xs font-medium">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName || "User Profile"} 
                    referrerPolicy="no-referrer"
                    className="w-5.5 h-5.5 rounded-full border border-pink-300"
                  />
                ) : (
                  <div className="w-5.5 h-5.5 bg-pink-400 rounded-full flex items-center justify-center font-bold text-[10px]">
                    {currentUser.displayName?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}
                <span className="hidden sm:inline font-semibold">{currentUser.displayName?.split(" ")[0]}</span>
                <button 
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="p-1 text-pink-100 hover:text-white hover:bg-pink-500/50 rounded-full transition cursor-pointer"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                disabled={isLoggingIn}
                className="flex items-center space-x-2 bg-white text-pink-600 hover:bg-pink-50 px-3.5 py-1.5 rounded-full text-xs font-bold transition shadow-sm hover:shadow active:scale-95 disabled:opacity-75 cursor-pointer"
              >
                {isLoggingIn ? (
                  <Loader2 size={13} className="animate-spin text-pink-500" />
                ) : (
                  <LogIn size={13} className="text-pink-500" />
                )}
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 md:py-8">
        
        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Form & Quotes (5 Cols on Large) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Inspirational AI Quote Widget with Gemini */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="relative overflow-hidden bg-gradient-to-br from-pink-400 to-rose-500 rounded-3xl p-6 text-white shadow-lg border border-pink-300/20"
              id="quote-widget"
            >
              {/* Abstract decorative circles */}
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
              <div className="absolute -left-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-lg"></div>

              <div className="relative flex flex-col items-center text-center space-y-3">
                <div className="flex items-center justify-between w-full">
                  <div className="bg-white/20 p-1.5 rounded-full backdrop-blur-md">
                    <Heart className="fill-white text-white" size={16} />
                  </div>
                  
                  {/* Badge indicating AI Generated Affirmation */}
                  <span className="text-[10px] bg-white/20 px-2.5 py-1 rounded-full font-mono uppercase tracking-wider backdrop-blur-md flex items-center gap-1">
                    <Sparkles size={10} className="animate-pulse" />
                    <span>Gemini AI</span>
                  </span>

                  {/* Refresh Button to call Gemini again */}
                  <button 
                    onClick={fetchAffirmation}
                    disabled={loadingAffirmation}
                    title="Get new unique affirmation"
                    className="bg-white/20 p-1.5 rounded-full hover:bg-white/35 transition active:scale-90 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw size={14} className={loadingAffirmation ? "animate-spin" : ""} />
                  </button>
                </div>
                
                <h3 className="font-display text-xl md:text-2xl font-bold tracking-tight">
                  {affirmation.title}
                </h3>
                
                <p className="text-pink-50 text-sm leading-relaxed max-w-sm">
                  {affirmation.text}
                </p>
              </div>
            </motion.div>

            {/* Contact Input Form Card */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white rounded-3xl p-6 shadow-md border border-pink-100/60"
              id="contact-form"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-semibold text-lg text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-6 bg-pink-500 rounded-full block"></span>
                  {editingId ? "Update Contact" : "Create New Contact"}
                </h2>
                {editingId && (
                  <button 
                    onClick={handleCancelEdit}
                    className="text-xs text-slate-400 hover:text-slate-600 font-medium flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md transition"
                  >
                    <X size={12} /> Cancel Edit
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveContact} className="space-y-4">
                
                {/* Form Alert Errors */}
                <AnimatePresence mode="wait">
                  {formError && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-rose-50 border border-rose-200 text-rose-600 px-3.5 py-2.5 rounded-xl flex items-center gap-2 text-sm"
                    >
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{formError}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Input: Name */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Name</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                      <User size={18} />
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. Nirmal Dahit"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Input: Phone */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Phone</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                      <Phone size={18} />
                    </span>
                    <input
                      type="tel"
                      placeholder="e.g. +977-9800000000"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Input: Email */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Email</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                      <Mail size={18} />
                    </span>
                    <input
                      type="email"
                      placeholder="e.g. example@domain.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Sync to Google Toggle (Only visible if authenticated and not editing a non-google contact) */}
                {currentUser && !(!isEditingGoogleContact && editingId) && (
                  <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Cloud size={16} className="text-pink-500" />
                      <div>
                        <p className="text-xs font-bold text-slate-700">Sync with Google Contacts</p>
                        <p className="text-[10px] text-slate-400">Write changes to Google Account</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={syncToGoogle} 
                        onChange={(e) => setSyncToGoogle(e.target.checked)} 
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-500"></div>
                    </label>
                  </div>
                )}

                {/* Submit Action Button */}
                <button
                  type="submit"
                  className="w-full py-3.5 bg-pink-500 hover:bg-pink-600 text-white rounded-2xl shadow-md font-medium tracking-wide flex items-center justify-center gap-2 hover:shadow-lg transition cursor-pointer select-none"
                >
                  <Save size={18} />
                  <span>
                    {editingId 
                      ? (isEditingGoogleContact ? "Update in Google" : "Update Contact") 
                      : (syncToGoogle ? "Save & Sync to Google" : "Save Contact")}
                  </span>
                </button>

              </form>
            </motion.div>

          </div>

          {/* Right Column: List & Actions (7 Cols on Large) */}
          <div className="lg:col-span-7 space-y-6">

            {/* List Header, Tabs & Search */}
            <div className="bg-white rounded-3xl p-5 shadow-md border border-pink-100/60 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display font-bold text-xl text-slate-800">
                    Contacts Directory
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Showing {filteredContacts.length} of {localContacts.length + googleContacts.length} contacts
                  </p>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-md md:w-64">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    placeholder="Search name, phone, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 focus:bg-white transition"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery("")}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Directory Filter Tabs */}
              <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setActiveTab("all")}
                  className={`flex-1 py-2 rounded-lg text-center transition ${
                    activeTab === "all" 
                      ? "bg-white text-pink-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  All ({localContacts.length + googleContacts.length})
                </button>
                <button
                  onClick={() => setActiveTab("local")}
                  className={`flex-1 py-2 rounded-lg text-center transition ${
                    activeTab === "local" 
                      ? "bg-white text-pink-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Local Directory ({localContacts.length})
                </button>
                <button
                  onClick={() => setActiveTab("google")}
                  className={`flex-1 py-2 rounded-lg text-center transition flex items-center justify-center space-x-1 ${
                    activeTab === "google" 
                      ? "bg-white text-pink-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Cloud size={12} className={activeTab === "google" ? "text-pink-500" : ""} />
                  <span>Google Contacts ({googleContacts.length})</span>
                </button>
              </div>
            </div>

            {/* Contacts Cards Container */}
            <div className="space-y-4" id="contacts-list">
              
              {/* Google loading indicator */}
              {activeTab === "google" && !currentUser && (
                <div className="bg-white rounded-3xl p-10 text-center border border-pink-100/30 flex flex-col items-center justify-center space-y-4">
                  <div className="bg-pink-50 p-4 rounded-full text-pink-500">
                    <Cloud size={32} />
                  </div>
                  <h3 className="font-display font-semibold text-slate-800 text-lg">Google Cloud Integration</h3>
                  <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
                    Sign in with Google to view, search, and synchronize your contacts live from your Google Contacts account.
                  </p>
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoggingIn}
                    className="flex items-center space-x-2 bg-pink-500 hover:bg-pink-600 text-white px-5 py-2.5 rounded-full text-sm font-bold transition shadow"
                  >
                    {isLoggingIn ? (
                      <Loader2 size={16} className="animate-spin text-white" />
                    ) : (
                      <LogIn size={16} className="text-white" />
                    )}
                    <span>Connect Google Contacts</span>
                  </button>
                </div>
              )}

              {isLoadingGoogle && (
                <div className="bg-white/60 rounded-3xl py-12 flex flex-col items-center justify-center space-y-2 border border-pink-100/30">
                  <Loader2 className="animate-spin text-pink-500" size={28} />
                  <p className="text-xs text-slate-500 font-semibold tracking-wider">Syncing with Google Contacts...</p>
                </div>
              )}

              <AnimatePresence mode="popLayout">
                {!isLoadingGoogle && (
                  filteredContacts.length > 0 ? (
                    filteredContacts.map((contact, index) => (
                      <motion.div
                        key={contact.id}
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -15 }}
                        transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.25) }}
                        className={`bg-white rounded-3xl p-5 shadow-sm hover:shadow-md border border-pink-100/40 relative overflow-hidden transition ${
                          editingId === contact.id ? "ring-2 ring-pink-400 bg-pink-50/10" : ""
                        }`}
                      >
                        {/* Active editing marker */}
                        {editingId === contact.id && (
                          <div className="absolute top-0 right-0 bg-pink-500 text-white text-[10px] uppercase font-bold tracking-wider px-3.5 py-1 rounded-bl-xl flex items-center gap-1 shadow-sm">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                            <span>Editing</span>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          
                          {/* Contact Core Info Row */}
                          <div className="flex items-start space-x-4">
                            {/* Avatar Circle */}
                            <div className={`w-12 h-12 rounded-full shrink-0 flex items-center justify-center font-display font-bold text-lg shadow-inner ${contact.avatarColor || "bg-pink-500 text-white"}`}>
                              {contact.name.charAt(0).toUpperCase()}
                            </div>

                            {/* Details */}
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-display font-semibold text-slate-800 text-lg leading-none">
                                  {contact.name}
                                </h4>
                                
                                {/* Badge indicating local vs cloud */}
                                {contact.isGoogleContact ? (
                                  <span className="text-[9px] bg-pink-50 text-pink-600 border border-pink-100 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 shadow-sm">
                                    <Cloud size={10} />
                                    <span>Google Contacts</span>
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-slate-50 text-slate-500 border border-slate-100 px-2 py-0.5 rounded-full font-bold shadow-sm">
                                    Local
                                  </span>
                                )}
                              </div>
                              
                              <div className="text-slate-500 text-sm space-y-0.5 pt-1">
                                <p className="flex items-center gap-1.5 font-mono text-xs">
                                  <Phone size={13} className="text-slate-400" />
                                  <span>{contact.phone || <em className="text-slate-300">No phone</em>}</span>
                                </p>
                                <p className="flex items-center gap-1.5 text-xs text-slate-400">
                                  <Mail size={13} className="text-slate-400" />
                                  <span className="truncate max-w-[200px] sm:max-w-xs">{contact.email || <em className="text-slate-300">No email</em>}</span>
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Actions Quick Row */}
                          <div className="flex flex-wrap items-center sm:justify-end gap-1.5 pt-2 sm:pt-0 self-start">
                            
                            {/* Localize Action (Save Google Contact locally) */}
                            {contact.isGoogleContact && (
                              <button
                                onClick={() => handleImportToLocal(contact)}
                                title="Add to Local Directory"
                                className="p-2.5 bg-pink-50 hover:bg-pink-100 text-pink-600 rounded-xl transition hover:scale-105 active:scale-95 flex items-center justify-center"
                              >
                                <Bookmark size={16} />
                              </button>
                            )}

                            {/* Call Action */}
                            {contact.phone && (
                              <a
                                href={`tel:${contact.phone}`}
                                title="Call Contact"
                                className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition hover:scale-105 active:scale-95 flex items-center justify-center"
                              >
                                <Phone size={16} />
                              </a>
                            )}

                            {/* WhatsApp Chat Action */}
                            {contact.phone && (
                              <a
                                href={getWhatsAppLink(contact.phone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Message on WhatsApp"
                                className="p-2.5 bg-teal-50 hover:bg-teal-100 text-teal-600 rounded-xl transition hover:scale-105 active:scale-95 flex items-center justify-center"
                              >
                                <MessageCircle size={16} />
                              </a>
                            )}

                            {/* Mail Action */}
                            {contact.email && (
                              <a
                                href={`mailto:${contact.email}`}
                                title="Send Email"
                                className="p-2.5 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl transition hover:scale-105 active:scale-95 flex items-center justify-center"
                              >
                                <Mail size={16} />
                              </a>
                            )}

                            {/* Edit Action */}
                            <button
                              onClick={() => handleEditContact(contact)}
                              title="Edit Contact"
                              className="p-2.5 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-xl transition hover:scale-105 active:scale-95 flex items-center justify-center"
                            >
                              <Edit2 size={16} />
                            </button>

                            {/* Delete Action */}
                            <button
                              onClick={() => handleDeleteContact(contact)}
                              title="Delete Contact"
                              className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition hover:scale-105 active:scale-95 flex items-center justify-center"
                            >
                              <Trash2 size={16} />
                            </button>

                          </div>

                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="bg-white rounded-3xl p-12 text-center border border-pink-100/30 flex flex-col items-center justify-center space-y-3"
                    >
                      <div className="bg-pink-50 p-4 rounded-full text-pink-400">
                        <User size={36} />
                      </div>
                      <h3 className="font-display font-semibold text-slate-800 text-lg">No Contacts Found</h3>
                      <p className="text-slate-400 text-sm max-w-sm">
                        {searchQuery 
                          ? "We couldn't find any contacts matching your search criteria. Try typing something else!"
                          : (activeTab === "google" 
                              ? "Your Google Contacts list is empty. Start adding some contacts!"
                              : "Start building your personal network by creating and saving some contacts!")}
                      </p>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="mt-2 text-xs font-semibold text-pink-500 hover:text-pink-600 bg-pink-50 hover:bg-pink-100 px-3 py-1.5 rounded-lg transition"
                        >
                          Clear Search Filter
                        </button>
                      )}
                    </motion.div>
                  )
                )}
              </AnimatePresence>
            </div>

          </div>

        </div>

        {/* Footer Section */}
        <footer className="mt-16 border-t border-pink-200/50 pt-8 pb-12 text-center space-y-4">
          <div className="flex items-center justify-center space-x-1.5 text-pink-600 font-display font-bold text-sm">
            <span>🌸</span>
            <span>Developed by Nirmal Dahit</span>
          </div>
          <p className="text-slate-400 text-xs max-w-md mx-auto italic leading-relaxed">
            "Keep moving forward. Success comes to those who never stop learning and improving."
          </p>
        </footer>

      </main>

      {/* Elegant Custom Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-xl text-sm font-medium border border-slate-800"
          >
            <div className="bg-pink-500 p-1 rounded-lg shrink-0">
              <Check size={14} className="text-white" />
            </div>
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mandatory Explicit Confirmation Dialog for Workspace Mutations */}
      <AnimatePresence>
        {confirmModal && confirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            
            {/* Modal Dialog Content */}
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="relative bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-pink-100/60 z-10"
            >
              <div className="flex items-center space-x-2.5 text-pink-600 mb-3">
                <Shield size={20} className="text-pink-500 shrink-0" />
                <h3 className="font-display font-bold text-lg text-slate-900">
                  {confirmModal.title}
                </h3>
              </div>
              
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                {confirmModal.message}
              </p>
              
              <div className="flex items-center justify-end space-x-2.5">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow transition cursor-pointer ${
                    confirmModal.isDestructive
                      ? "bg-rose-500 hover:bg-rose-600"
                      : "bg-pink-500 hover:bg-pink-600"
                  }`}
                >
                  {confirmModal.confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
