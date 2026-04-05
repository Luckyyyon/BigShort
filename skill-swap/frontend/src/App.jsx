import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, onAuthStateChanged
} from 'firebase/auth';
import {
    Mail, Lock, Search, MessageSquare, Handshake, Check, X,
    LogOut, User as UserIcon, Loader2, Trophy, Flame, Edit3,
    BookOpen, CheckSquare
} from 'lucide-react';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

let app, auth, configError = null;
try {
    if (!firebaseConfig.apiKey) throw new Error("Missing Firebase API Key");
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
} catch (error) {
    configError = error.message;
}

const API_BASE_URL = 'http://localhost:5000/api';
const ALLOWED_DOMAIN = '@universal.edu.in';

const AuthContext = createContext();
const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [dbUser, setDbUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchDbUser = async (uid) => {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${API_BASE_URL}/users?search=&currentUid=`, { signal: controller.signal });
            clearTimeout(id);
            if (!res.ok) throw new Error("Server response not ok");
            const users = await res.json();
            setDbUser(users.find(u => u.uid === uid) || null);
        } catch (error) {
            console.error("Backend Error:", error);
            setDbUser(null);
        }
    };

    useEffect(() => {
        if (!auth) return;
        return onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) await fetchDbUser(currentUser.uid);
            else setDbUser(null);
            setLoading(false);
        });
    }, []);

    const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
    const register = (email, password) => createUserWithEmailAndPassword(auth, email, password);
    const logout = () => signOut(auth);
    const refreshDbUser = () => { if (user) fetchDbUser(user.uid); };

    return (
        <AuthContext.Provider value={{ user, dbUser, loading, login, register, logout, refreshDbUser }}>
            {loading ? (
                <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                    <Loader2 className="w-12 h-12 animate-spin text-teal-600 mb-4" />
                    <p className="text-teal-800 font-bold animate-pulse">Waking up servers...</p>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
};

function AuthScreen() {
    const { login, register } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
            setError(`Access is strictly limited to ${ALLOWED_DOMAIN} accounts.`);
            return;
        }
        try {
            if (isLogin) await login(email, password);
            else await register(email, password);
        } catch (err) { setError(err.message); }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-blue-50 p-4">
            <div className="bg-white/80 backdrop-blur-lg p-8 rounded-3xl shadow-xl max-w-md w-full border border-white">
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-teal-100 rounded-full shadow-inner"><Handshake className="w-10 h-10 text-teal-600" /></div>
                </div>
                <h2 className="text-3xl font-extrabold text-center mb-2 text-teal-900">SkillSwap</h2>
                <p className="text-center text-gray-500 mb-8 text-sm">Join the Universal knowledge exchange.</p>
                {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-6 border border-red-100 text-center">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative group">
                        <Mail className="w-5 h-5 absolute left-4 top-3.5 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
                        <input type="email" placeholder={`Email (${ALLOWED_DOMAIN})`} required
                            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none transition-all bg-white"
                            value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div className="relative group">
                        <Lock className="w-5 h-5 absolute left-4 top-3.5 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
                        <input type="password" placeholder="Password" required
                            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none transition-all bg-white"
                            value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    <button type="submit" className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white font-bold py-3.5 rounded-2xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all">
                        {isLogin ? 'Sign In' : 'Create Account'}
                    </button>
                </form>
                <p className="mt-6 text-center text-sm font-medium text-gray-600">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button onClick={() => setIsLogin(!isLogin)} className="text-teal-600 font-bold hover:underline">
                        {isLogin ? 'Sign up' : 'Log in'}
                    </button>
                </p>
            </div>
        </div>
    );
}

function ProfileEditor({ isEditing, onClose }) {
    const { user, dbUser, refreshDbUser } = useAuth();
    const [name, setName] = useState(dbUser?.name || '');
    const [bio, setBio] = useState(dbUser?.bio || '');
    const [teaches, setTeaches] = useState(dbUser?.skillsOffered?.join(', ') || '');
    const [wants, setWants] = useState(dbUser?.skillsWanted?.join(', ') || '');
    const [file, setFile] = useState(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('uid', user.uid);
            formData.append('email', user.email);
            formData.append('name', name);
            formData.append('bio', bio);
            formData.append('skillsOffered', JSON.stringify(teaches.split(',').map(s => s.trim()).filter(Boolean)));
            formData.append('skillsWanted', JSON.stringify(wants.split(',').map(s => s.trim()).filter(Boolean)));
            if (file) formData.append('profilePic', file);

            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(`${API_BASE_URL}/users`, { method: 'POST', body: formData, signal: controller.signal });
            clearTimeout(id);

            if (!res.ok) throw new Error("Failed to save profile on backend.");

            await refreshDbUser();
            if (isEditing && onClose) onClose();
        } catch (error) {
            console.error(error);
            alert("Profile saving failed. Your MongoDB connection might be blocked! Check backend terminal.");
        } finally { setSaving(false); }
    };

    const formContent = (
        <div className={`bg-white/95 backdrop-blur-xl p-8 rounded-3xl shadow-2xl max-w-xl w-full border border-gray-100 relative ${!isEditing ? 'my-12' : ''}`}>
            {isEditing && (
                <button onClick={onClose} className="absolute top-6 right-6 p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-full transition">
                    <X className="w-6 h-6" />
                </button>
            )}
            <h2 className="text-3xl font-extrabold mb-2 text-teal-900">{isEditing ? 'Edit Profile' : 'Complete your profile'}</h2>
            <p className="text-gray-500 mb-8 font-medium">Let others know what you can teach and what you want to learn.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
                    <input type="text" required value={name} onChange={e => setName(e.target.value)}
                        className="w-full px-5 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none transition bg-gray-50 focus:bg-white" placeholder="Jane Doe" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Bio</label>
                    <textarea required value={bio} onChange={e => setBio(e.target.value)} rows="3"
                        className="w-full px-5 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none transition bg-gray-50 focus:bg-white resize-none" placeholder="A short introduction..." />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Profile Picture {isEditing && <span className="text-gray-400 font-normal">(Leave empty to keep)</span>}</label>
                    <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 transition-colors cursor-pointer" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Skills I Can Teach (comma separated)</label>
                    <input type="text" value={teaches} onChange={e => setTeaches(e.target.value)}
                        className="w-full px-5 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none transition bg-gray-50 focus:bg-white" placeholder="Python, Cooking, Spanish" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Skills I Want to Learn (comma separated)</label>
                    <input type="text" value={wants} onChange={e => setWants(e.target.value)}
                        className="w-full px-5 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none transition bg-gray-50 focus:bg-white" placeholder="Guitar, Photography, React" />
                </div>
                <div className="pt-4">
                    <button type="submit" disabled={saving} className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white font-extrabold py-4 rounded-2xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex justify-center items-center text-lg">
                        {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Save Profile'}
                    </button>
                </div>
            </form>
        </div>
    );

    if (isEditing) return <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">{formContent}</div>;
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">{formContent}</div>;
}

function Feed() {
    const { user, dbUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_BASE_URL}/users?currentUid=${user.uid}&search=${search}`);
                let data = await res.json();

                if (dbUser) {
                    const myWants = dbUser.skillsWanted || [];
                    const myOffers = dbUser.skillsOffered || [];
                    data = data.map(u => {
                        const theirOffers = u.skillsOffered || [];
                        const theirWants = u.skillsWanted || [];
                        let matchScore = 0;
                        if (theirOffers.some(s => myWants.includes(s))) matchScore += 5;
                        if (theirWants.some(s => myOffers.includes(s))) matchScore += 3;
                        return { ...u, matchScore };
                    });
                    data.sort((a, b) => b.matchScore - a.matchScore);
                }
                setUsers(data);
            } catch (err) { console.error(err); } finally { setLoading(false); }
        };
        const timer = setTimeout(fetchUsers, 300);
        return () => clearTimeout(timer);
    }, [search, user.uid, dbUser]);

    const handleSwapRequest = async (e, receiverId, message) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE_URL}/requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requesterId: user.uid, receiverId, message })
            });
            if (!res.ok) alert((await res.json()).error || 'Failed to send request');
            else { alert('Swap request sent successfully!'); setSelectedUser(null); }
        } catch (err) { console.error(err); }
    };

    return (
        <div className="space-y-8">
            <div className="bg-white/60 backdrop-blur-md p-4 rounded-3xl shadow-sm border border-white">
                <div className="relative w-full group">
                    <Search className="w-5 h-5 absolute left-5 top-4 text-gray-400 group-focus-within:text-teal-500 transition-colors" />
                    <input type="text" placeholder="Search skills or people..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-14 pr-6 py-3.5 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-teal-500 outline-none bg-white shadow-sm transition-all text-lg font-medium" />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-12 h-12 animate-spin text-teal-600" /></div>
            ) : users.length === 0 ? (
                <div className="text-center py-20 bg-white/50 rounded-3xl shadow-sm border border-white"><p className="text-gray-500 text-xl font-bold">No members found matching your search.</p></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {users.map((u, i) => (
                        <div key={u.uid} className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 transform hover:-translate-y-1 relative group flex flex-col h-full">
                            {u.matchScore > 0 && (
                                <div className="absolute -top-3 -right-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xs font-black px-4 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 transform group-hover:scale-105 transition-transform">
                                    <Flame className="w-4 h-4" /> HIGHLY RECOMMENDED
                                </div>
                            )}

                            <div className="flex items-center gap-5 mb-5">
                                {u.profilePicUrl ? (
                                    <img src={u.profilePicUrl} className="w-16 h-16 rounded-full object-cover border-4 border-teal-50 shadow-md group-hover:border-teal-100 transition-colors" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-100 to-teal-50 flex items-center justify-center border-4 border-white shadow-sm"><UserIcon className="w-8 h-8 text-teal-500" /></div>
                                )}
                                <div>
                                    <h3 className="font-extrabold text-xl text-gray-900 group-hover:text-teal-700 transition-colors line-clamp-1">{u.name}</h3>
                                    <div className="flex items-center gap-1.5 mt-1 bg-yellow-50 text-yellow-700 w-max px-2.5 py-0.5 rounded-md font-bold text-xs border border-yellow-100">
                                        <Trophy className="w-3.5 h-3.5" /> {u.points || 0} pts
                                    </div>
                                </div>
                            </div>

                            <p className="text-gray-500 text-sm mb-6 line-clamp-2 italic font-medium leading-relaxed flex-grow">"{u.bio}"</p>

                            <div className="space-y-4 mb-6">
                                <div>
                                    <p className="text-[11px] font-black text-teal-600 uppercase tracking-widest mb-2 px-1">Can Teach</p>
                                    <div className="flex flex-wrap gap-2">
                                        {u.skillsOffered?.map(s => <span key={s} className="px-3 py-1.5 bg-teal-50 text-teal-800 text-xs font-bold rounded-xl border border-teal-100 shadow-sm">{s}</span>)}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[11px] font-black text-orange-600 uppercase tracking-widest mb-2 px-1">Wants to Learn</p>
                                    <div className="flex flex-wrap gap-2">
                                        {u.skillsWanted?.map(s => <span key={s} className="px-3 py-1.5 bg-orange-50 text-orange-800 text-xs font-bold rounded-xl border border-orange-100 shadow-sm">{s}</span>)}
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => setSelectedUser(u)} className="w-full bg-gray-50 text-gray-800 font-extrabold py-3.5 rounded-2xl group-hover:bg-teal-600 group-hover:text-white transition-all duration-300 flex items-center justify-center gap-2 mt-auto border border-gray-200 group-hover:border-teal-600">
                                <Handshake className="w-5 h-5" /> Propose a Swap
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {selectedUser && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">
                        <h3 className="text-3xl font-extrabold mb-3 text-teal-900">Swap with {selectedUser.name}</h3>
                        <p className="text-md text-gray-500 mb-8 font-medium">Send a brief message suggesting how you two can help each other build skills.</p>
                        <form onSubmit={(e) => {
                            const msg = e.target.elements.message.value;
                            handleSwapRequest(e, selectedUser.uid, msg);
                        }}>
                            <textarea name="message" required rows="5" className="w-full px-5 py-4 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-teal-500/20 focus:border-teal-500 outline-none mb-8 resize-none bg-gray-50 focus:bg-white transition-all text-lg font-medium"
                                placeholder="Hi, I noticed you want to learn Python. I can teach you that if you help me practice Spanish!" />
                            <div className="flex gap-4 justify-end">
                                <button type="button" onClick={() => setSelectedUser(null)} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl transition-colors">Cancel</button>
                                <button type="submit" className="px-8 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white font-extrabold rounded-2xl hover:shadow-lg transition-all transform hover:-translate-y-0.5">Send Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

function Leaderboard() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_BASE_URL}/leaderboard`)
            .then(r => r.json()).then(data => setUsers(data)).catch(e => console.error(e)).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-12 h-12 animate-spin text-teal-600" /></div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-gradient-to-br from-teal-500 to-blue-600 rounded-[2rem] p-10 text-white shadow-2xl transform hover:scale-[1.01] transition-transform">
                <h2 className="text-4xl font-black flex items-center gap-4 mb-4"><Trophy className="w-12 h-12 text-yellow-300 drop-shadow-lg" /> Community Leaders</h2>
                <p className="text-teal-50 text-lg font-medium max-w-2xl leading-relaxed">Top contributors earn points by successfully completing skill swaps. The more you help others learn, the higher you climb!</p>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
                {users.length === 0 ? (
                    <div className="p-16 text-center text-gray-500 text-xl font-bold">No points awarded yet. Be the first to help someone out!</div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {users.map((u, i) => (
                            <div key={u._id} className="flex items-center p-6 hover:bg-teal-50/50 transition-colors group">
                                <div className={`w-14 h-14 flex items-center justify-center font-black text-2xl rounded-2xl shrink-0 mr-6 shadow-sm ${i === 0 ? 'bg-yellow-100 text-yellow-600 border border-yellow-200' : i === 1 ? 'bg-gray-100 text-gray-600 border border-gray-200' : i === 2 ? 'bg-orange-100 text-orange-600 border border-orange-200' : 'bg-gray-50 text-gray-400'}`}>
                                    #{i + 1}
                                </div>
                                {u.profilePicUrl ? (
                                    <img src={u.profilePicUrl} className="w-16 h-16 rounded-full object-cover mr-6 shadow-md border-2 border-white group-hover:scale-105 transition-transform" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mr-6 border-2 border-teal-100"><UserIcon className="w-8 h-8 text-teal-400" /></div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-extrabold text-2xl text-gray-900 group-hover:text-teal-700 transition-colors truncate">{u.name}</h3>
                                    <p className="text-sm font-semibold text-gray-500 truncate mt-1">Teaching: <span className="text-teal-600">{u.skillsOffered?.join(', ') || 'Nothing yet'}</span></p>
                                </div>
                                <div className="ml-6 flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-emerald-50 px-6 py-3 rounded-2xl border border-green-200 shadow-sm group-hover:shadow-md transition-shadow">
                                    <b className="text-green-700 text-3xl font-black leading-none">{u.points}</b>
                                    <span className="text-green-600 text-[10px] font-black uppercase tracking-widest mt-1">Points</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function Inbox() {
    const { user } = useAuth();
    const [incoming, setIncoming] = useState([]);
    const [outgoing, setOutgoing] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_BASE_URL}/requests?uid=${user.uid}`).then(r => r.json()).then(data => {
            setIncoming(data.incoming || []); setOutgoing(data.outgoing || []);
        }).catch(e => console.error(e)).finally(() => setLoading(false));
    }, [user.uid]);

    const handleUpdate = async (id, status) => {
        try {
            await fetch(`${API_BASE_URL}/requests/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
            setIncoming(prev => prev.map(r => r._id === id ? { ...r, status } : r));
        } catch (err) { console.error(err); }
    };

    const badgeTheme = {
        accepted: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        rejected: 'text-red-700 bg-red-50 border-red-200',
        pending: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    };

    return (
        <div className="space-y-12">
            <section>
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-teal-100 rounded-2xl shadow-inner"><Mail className="w-8 h-8 text-teal-700" /></div>
                    <h2 className="text-3xl font-black text-gray-900">Incoming Requests</h2>
                </div>
                {loading ? <Loader2 className="w-10 h-10 animate-spin text-teal-600" /> : incoming.length === 0 ? (
                    <div className="bg-white/50 p-12 rounded-[2rem] text-center text-gray-500 font-bold text-xl shadow-sm border border-gray-100">No incoming requests yet. Post more skills to get noticed!</div>
                ) : (
                    <div className="grid gap-6">
                        {incoming.map(req => (
                            <div key={req._id} className="bg-white p-6 md:p-8 rounded-[2rem] border border-gray-100 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center shadow-md hover:shadow-lg transition-shadow group">
                                <div className="flex gap-6 items-start w-full">
                                    {req.user?.profilePicUrl ? (
                                        <img src={req.user.profilePicUrl} className="w-16 h-16 rounded-full object-cover shadow-sm border-2 border-gray-50" />
                                    ) : <div className="w-16 h-16 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0"><UserIcon className="w-8 h-8 text-gray-400" /></div>}
                                    <div className="flex-1">
                                        <h4 className="font-extrabold text-gray-900 text-xl group-hover:text-teal-700 transition-colors">{req.user?.name || 'A user'} wants to swap!</h4>
                                        <p className="text-gray-600 text-md mt-2 mb-4 italic font-medium">"{req.message}"</p>
                                        {req.status === 'accepted' && (
                                            <div className="inline-flex items-center gap-2 text-sm bg-emerald-50 text-emerald-800 px-5 py-2.5 rounded-xl border border-emerald-200 font-bold shadow-sm">
                                                <Mail className="w-5 h-5 opacity-70" /> {req.user?.email}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 ml-auto md:ml-0">
                                    {req.status === 'pending' ? (
                                        <>
                                            <button onClick={() => handleUpdate(req._id, 'accepted')} className="px-5 py-3 bg-emerald-50 text-emerald-700 font-extrabold hover:bg-emerald-500 hover:text-white rounded-2xl transition-all flex items-center gap-2 border border-emerald-200 hover:border-emerald-500 shadow-sm">
                                                <Check className="w-5 h-5" /> Accept
                                            </button>
                                            <button onClick={() => handleUpdate(req._id, 'rejected')} className="p-3 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-2xl transition-all border border-red-200 hover:border-red-500 shadow-sm">
                                                <X className="w-6 h-6" />
                                            </button>
                                        </>
                                    ) : <span className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border shadow-sm ${badgeTheme[req.status]}`}>{req.status}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section>
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-blue-100 rounded-2xl shadow-inner"><MessageSquare className="w-8 h-8 text-blue-700" /></div>
                    <h2 className="text-3xl font-black text-gray-900">Sent Requests</h2>
                </div>
                {loading ? <Loader2 className="w-10 h-10 animate-spin text-teal-600" /> : outgoing.length === 0 ? (
                    <div className="bg-white/50 p-12 rounded-[2rem] text-center text-gray-500 font-bold text-xl shadow-sm border border-gray-100">You haven't sent any requests yet. Start exploring the market!</div>
                ) : (
                    <div className="grid gap-6">
                        {outgoing.map(req => (
                            <div key={req._id} className="bg-white p-6 md:p-8 rounded-[2rem] border border-gray-100 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center shadow-md">
                                <div className="flex-1">
                                    <h4 className="font-extrabold text-xl text-gray-900">Request to {req.user?.name || 'Unknown'}</h4>
                                    <p className="text-gray-500 text-md mt-2 italic font-medium">"{req.message}"</p>
                                    {req.status === 'accepted' && (
                                        <div className="inline-flex items-center gap-2 text-sm bg-emerald-50 text-emerald-800 px-5 py-2.5 rounded-xl border border-emerald-200 font-bold shadow-sm mt-4">
                                            <Mail className="w-5 h-5 opacity-70" /> <a href={`mailto:${req.user?.email}`} className="hover:underline">{req.user?.email}</a>
                                        </div>
                                    )}
                                </div>
                                <div className="shrink-0"><span className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border shadow-sm ${badgeTheme[req.status]}`}>{req.status}</span></div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function Collaborations() {
    const { user } = useAuth();
    const [collaborations, setCollaborations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCollab, setActiveCollab] = useState(null);

    const fetchCollabs = () => {
        fetch(`${API_BASE_URL}/collaborations?uid=${user.uid}`)
            .then(r => r.json()).then(data => {
                setCollaborations(data);
                if (activeCollab) {
                    const updatedActive = data.find(c => c._id === activeCollab._id);
                    if (updatedActive) setActiveCollab(updatedActive);
                }
            })
            .catch(e => console.error(e)).finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchCollabs();
    }, [user.uid]);

    const updateCommunication = async (id, method) => {
        try {
            await fetch(`${API_BASE_URL}/collaborations/${id}/communication`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ communicationMethod: method })
            });
            fetchCollabs();
        } catch(e) {}
    }

    const addLesson = async (id, title) => {
        try {
            await fetch(`${API_BASE_URL}/collaborations/${id}/lessons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, addedBy: user.uid })
            });
            fetchCollabs();
        } catch(e) {}
    }

    const toggleLesson = async (id, lessonId) => {
        try {
            await fetch(`${API_BASE_URL}/collaborations/${id}/lessons/${lessonId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid })
            });
            fetchCollabs();
        } catch(e) {}
    }

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-12 h-12 animate-spin text-indigo-600" /></div>;

    if (activeCollab) {
        return (
            <div className="space-y-8 animate-in fade-in duration-300">
                <button onClick={() => setActiveCollab(null)} className="text-indigo-600 font-bold hover:underline mb-4 inline-flex items-center gap-2">
                    &larr; Back to Collaborations
                </button>
                <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-gray-100">
                    <h2 className="text-3xl font-black text-gray-900 mb-2">Workspace with {activeCollab.partner?.name}</h2>
                    <p className="text-gray-500 mb-8 font-medium">Coordinate how you'll communicate and track lessons together.</p>

                    <div className="grid md:grid-cols-2 gap-10">
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-blue-100/50 rounded-2xl"><MessageSquare className="w-6 h-6 text-blue-600" /></div>
                                <h3 className="text-2xl font-extrabold text-gray-800">Communication</h3>
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); updateCommunication(activeCollab._id, e.target.method.value); }}>
                                <textarea name="method" defaultValue={activeCollab.communicationMethod} rows="5" className="w-full px-5 py-4 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none mb-4 resize-none bg-gray-50 hover:bg-white focus:bg-white transition-all text-gray-700 font-medium" placeholder="E.g., Let's meet on Zoom every Friday at 6PM, or here's my Discord: uer#1234" />
                                <button type="submit" className="w-full py-3.5 bg-blue-50 text-blue-700 font-black rounded-2xl hover:bg-blue-600 hover:text-white transition-all border border-blue-200 hover:border-blue-600 shadow-sm">Save Method</button>
                            </form>
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-3 bg-emerald-100/50 rounded-2xl"><CheckSquare className="w-6 h-6 text-emerald-600" /></div>
                                <h3 className="text-2xl font-extrabold text-gray-800">Progress Tracker</h3>
                            </div>
                            <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
                                {activeCollab.lessons?.map(l => (
                                    <div key={l._id} className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
                                        <button disabled={l.addedBy !== user.uid} onClick={() => toggleLesson(activeCollab._id, l._id)} className={`w-7 h-7 rounded-lg flex items-center justify-center border-2 transition-all shrink-0 ${l.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300'} ${l.addedBy === user.uid ? 'cursor-pointer group-hover:border-emerald-400' : 'cursor-not-allowed opacity-40'}`}>
                                            {l.completed && <Check className="w-4 h-4 font-black" />}
                                        </button>
                                        <div className="flex-1 min-w-0">
                                            <span className={`font-bold block truncate ${l.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>{l.title}</span>
                                        </div>
                                        <span className="shrink-0 text-xs text-gray-400 font-bold uppercase tracking-widest bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                            {l.addedBy === user.uid ? 'You' : activeCollab.partner?.name?.split(' ')[0]}
                                        </span>
                                    </div>
                                ))}
                                {!activeCollab.lessons?.length && <div className="text-center p-8 bg-gray-50 rounded-2xl border border-gray-100"><p className="text-gray-500 font-medium">No lessons added yet. Propose your first lesson below!</p></div>}
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); addLesson(activeCollab._id, e.target.title.value); e.target.title.value = ''; }} className="flex gap-3">
                                <input type="text" name="title" required placeholder="Add a lesson, goal, or milestone..." className="flex-1 px-5 py-3.5 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-gray-50 hover:bg-white focus:bg-white transition-all font-medium" />
                                <button type="submit" className="px-6 py-3.5 bg-emerald-500 text-white font-black rounded-2xl hover:bg-emerald-600 transition-colors shadow-md transform hover:-translate-y-0.5">+</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] p-10 text-white shadow-2xl transform hover:scale-[1.01] transition-transform">
                <h2 className="text-4xl font-black flex items-center gap-4 mb-4"><BookOpen className="w-12 h-12 text-indigo-200 drop-shadow-lg" /> Active Collaborations</h2>
                <p className="text-indigo-50 text-lg font-medium max-w-2xl leading-relaxed">Manage your accepted skill swaps. Set up how you'll communicate and track each other's progress with shared lesson plans.</p>
            </div>
            
            {collaborations.length === 0 ? (
                <div className="bg-white/50 p-12 rounded-[2rem] text-center text-gray-500 font-bold text-xl shadow-sm border border-gray-100">You don't have any active collaborations yet. Accept requests in your Inbox or send some from the Market!</div>
            ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {collaborations.map(c => {
                        const totalLessons = c.lessons?.length || 0;
                        const completedLessons = c.lessons?.filter(l => l.completed).length || 0;
                        const progress = totalLessons ? (completedLessons / totalLessons) * 100 : 0;
                        
                        return (
                        <div key={c._id} onClick={() => setActiveCollab(c)} className="bg-white p-6 rounded-[2rem] shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group flex flex-col h-full">
                            <div className="flex items-center gap-5 mb-5">
                                {c.partner?.profilePicUrl ? (
                                    <img src={c.partner.profilePicUrl} className="w-16 h-16 rounded-full object-cover border-4 border-indigo-50 shadow-md group-hover:border-indigo-100 transition-colors" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center border-4 border-white shadow-sm"><UserIcon className="w-8 h-8 text-indigo-500" /></div>
                                )}
                                <div>
                                    <h3 className="font-extrabold text-xl text-gray-900 group-hover:text-indigo-700 transition-colors">{c.partner?.name || 'Unknown'}</h3>
                                    <div className="flex items-center gap-1.5 mt-1 bg-indigo-50 text-indigo-700 w-max px-2.5 py-0.5 rounded-md font-bold text-xs border border-indigo-100 uppercase tracking-wider">
                                        <CheckSquare className="w-3.5 h-3.5" /> {totalLessons} Lessons
                                    </div>
                                </div>
                            </div>
                            <p className="text-gray-500 text-sm mb-6 line-clamp-2 italic font-medium leading-relaxed">"{c.message}"</p>
                            
                            <div className="mt-auto pt-4 border-t border-gray-50">
                                <div className="flex justify-between text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                    <span>Progress</span>
                                    <span className="text-indigo-600">{completedLessons} / {totalLessons}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                    <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        </div>
                    )})}
                </div>
            )}
        </div>
    );
}

function MainLayout() {
    const { logout, dbUser } = useAuth();
    const [activeTab, setActiveTab] = useState('feed');
    const [isEditingProfile, setIsEditingProfile] = useState(false);

    if (!dbUser) return <ProfileEditor isEditing={false} />;

    return (
        <div className="min-h-screen bg-[#F0FDF4] text-gray-800 font-sans selection:bg-teal-200">
            <nav className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-20">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('feed')}>
                            <div className="bg-gradient-to-br from-teal-500 to-teal-700 p-2.5 rounded-2xl shadow-lg transform hover:scale-105 transition-transform">
                                <Handshake className="w-7 h-7 text-white" />
                            </div>
                            <span className="font-black text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-900 to-teal-600 hidden sm:block">SkillSwap</span>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-6">
                            <button onClick={() => setActiveTab('feed')} className={`font-black text-sm tracking-wide transition-all h-11 px-5 rounded-2xl flex items-center ${activeTab === 'feed' ? 'bg-teal-100 text-teal-800 shadow-sm' : 'text-gray-500 hover:bg-white hover:text-gray-900'} uppercase`}>
                                Market
                            </button>
                            <button onClick={() => setActiveTab('inbox')} className={`font-black text-sm tracking-wide transition-all h-11 px-5 rounded-2xl flex items-center ${activeTab === 'inbox' ? 'bg-teal-100 text-teal-800 shadow-sm' : 'text-gray-500 hover:bg-white hover:text-gray-900'} uppercase`}>
                                Inbox
                            </button>
                            <button onClick={() => setActiveTab('collaborate')} className={`font-black text-sm tracking-wide transition-all h-11 px-5 rounded-2xl flex items-center ${activeTab === 'collaborate' ? 'bg-indigo-100 text-indigo-800 shadow-sm' : 'text-gray-500 hover:bg-white hover:text-gray-900'} uppercase`}>
                                Collaborate
                            </button>
                            <button onClick={() => setActiveTab('leaderboard')} className={`font-black text-sm tracking-wide transition-all h-11 px-5 rounded-2xl flex items-center gap-2 ${activeTab === 'leaderboard' ? 'bg-yellow-100 text-yellow-800 shadow-sm' : 'text-gray-500 hover:bg-white hover:text-gray-900'} uppercase`}>
                                <Trophy className="w-4 h-4" /> Leaderboard
                            </button>
                            <div className="flex items-center gap-4 ml-2 sm:ml-6 pl-4 sm:pl-8 border-l-2 border-gray-100">
                                <button onClick={() => setIsEditingProfile(true)} className="flex items-center gap-3 group focus:outline-none text-left">
                                    {dbUser?.profilePicUrl ? (
                                        <img src={dbUser.profilePicUrl} className="w-11 h-11 rounded-full object-cover border-2 border-transparent group-hover:border-teal-500 shadow-sm transition-all" />
                                    ) : (
                                        <div className="w-11 h-11 rounded-full bg-teal-50 flex items-center justify-center border-2 border-teal-100 group-hover:border-teal-500 transition-all"><UserIcon className="w-5 h-5 text-teal-600" /></div>
                                    )}
                                    <div className="hidden sm:flex flex-col">
                                        <span className="text-sm font-black text-gray-900">{dbUser.name}</span>
                                        <span className="text-[10px] font-bold text-teal-600 flex items-center gap-1 group-hover:text-teal-800 uppercase tracking-wider mt-0.5"><Edit3 className="w-3 h-3" /> Edit Profile</span>
                                    </div>
                                </button>
                                <button onClick={logout} className="p-3 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-2xl transition-colors ml-2" title="Log out">
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {activeTab === 'feed' && <Feed />}
                {activeTab === 'inbox' && <Inbox />}
                {activeTab === 'collaborate' && <Collaborations />}
                {activeTab === 'leaderboard' && <Leaderboard />}
            </main>

            {isEditingProfile && <ProfileEditor isEditing={true} onClose={() => setIsEditingProfile(false)} />}
        </div>
    );
}

export default function App() {
    if (configError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-red-50 p-6 text-gray-800">
                <div className="max-w-md bg-white p-8 rounded-2xl shadow-xl border border-red-200">
                    <h2 className="text-2xl font-black mb-4 text-red-600 flex items-center gap-2"><X className="w-8 h-8" /> Config Missing</h2>
                    <p className="mb-4 text-sm font-medium text-gray-600">The application failed to start correctly. ({configError})</p>
                </div>
            </div>
        );
    }

    return (
        <AuthProvider>
            <AuthContext.Consumer>
                {({ user }) => user ? <MainLayout /> : <AuthScreen />}
            </AuthContext.Consumer>
        </AuthProvider>
    );
}
