import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Configuration ---
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Schemas & Models ---
const userSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: String,
    bio: String,
    profilePicUrl: String,
    skillsOffered: [String],
    skillsWanted: [String],
    posts: [{ text: String, imageUrl: String }],
    certifications: [{ title: String, imageUrl: String }],
    points: { type: Number, default: 0 },
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const swapRequestSchema = new mongoose.Schema({
    requesterId: { type: String, required: true },
    receiverId: { type: String, required: true },
    message: String,
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    communicationMethod: { type: String, default: '' },
    lessons: [{
        title: String,
        addedBy: String,
        completed: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const SwapRequest = mongoose.model('SwapRequest', swapRequestSchema);

// --- Cloudinary Configuration ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'skillswap_profiles',
        allowed_formats: ['jpg', 'png', 'jpeg']
    }
});
const upload = multer({ storage: storage });

// --- API Endpoints ---


app.post('/api/users', upload.any(), async (req, res) => {
    try {
        const { uid, email, name, bio, skillsOffered, skillsWanted, posts, certifications } = req.body;
        const parsedOffered = Array.isArray(skillsOffered) ? skillsOffered : JSON.parse(skillsOffered || '[]');
        const parsedWanted = Array.isArray(skillsWanted) ? skillsWanted : JSON.parse(skillsWanted || '[]');
        const parsedPosts = Array.isArray(posts) ? posts : JSON.parse(posts || '[]');
        const parsedCertifications = Array.isArray(certifications) ? certifications : JSON.parse(certifications || '[]');

        let profilePicUrl;
        const postImages = {};
        const certImages = {};

        if (req.files) {
            for (const file of req.files) {
                if (file.fieldname === 'profilePic') {
                    profilePicUrl = file.path;
                } else if (file.fieldname.startsWith('postImage_')) {
                    const idx = file.fieldname.split('_')[1];
                    postImages[idx] = file.path;
                } else if (file.fieldname.startsWith('certImage_')) {
                    const idx = file.fieldname.split('_')[1];
                    certImages[idx] = file.path;
                }
            }
        }

        const finalPosts = parsedPosts.map((p, idx) => {
            const isStr = typeof p === 'string';
            return {
                text: isStr ? p : p.text,
                imageUrl: postImages[idx] || (isStr ? null : p.imageUrl) || null
            };
        });

        const finalCerts = parsedCertifications.map((c, idx) => {
            const isStr = typeof c === 'string';
            return {
                title: isStr ? c : c.title,
                imageUrl: certImages[idx] || (isStr ? null : c.imageUrl) || null
            };
        });

        const updateData = {
            email, name, bio,
            skillsOffered: parsedOffered.map(s => s.trim().toLowerCase()),
            skillsWanted: parsedWanted.map(s => s.trim().toLowerCase()),
            posts: finalPosts,
            certifications: finalCerts
        };

        if (email.toLowerCase() === 'admin@universal.edu.in') {
            updateData.isAdmin = true;
        }

        if (profilePicUrl) {
            updateData.profilePicUrl = profilePicUrl;
        }

        const user = await User.findOneAndUpdate(
            { uid },
            { $set: updateData, $setOnInsert: { uid, createdAt: new Date(), points: 0 } },
            { new: true, upsert: true }
        );

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fetch all users with search
app.get('/api/users', async (req, res) => {
    try {
        const { search, currentUid } = req.query;
        let query = {};

        // Exclude current user from feed
        if (currentUid) {
            query.uid = { $ne: currentUid };
        }

        if (search) {
            query.$or = [
                { skillsOffered: { $regex: search, $options: 'i' } },
                { skillsWanted: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query).sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fetch Leaderboard
app.get('/api/leaderboard', async (req, res) => {
    try {
        const users = await User.find({ points: { $gt: 0 } })
            .sort({ points: -1 })
            .limit(10)
            .select('name profilePicUrl points bio skillsOffered');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send a swap request
app.post('/api/requests', async (req, res) => {
    try {
        const { requesterId, receiverId, message } = req.body;

        const existing = await SwapRequest.findOne({ requesterId, receiverId, status: 'pending' });
        if (existing) return res.status(400).json({ error: 'Pending request already exists.' });

        const request = new SwapRequest({ requesterId, receiverId, message });
        await request.save();

        res.status(201).json(request);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fetch user's incoming & outgoing requests
app.get('/api/requests', async (req, res) => {
    try {
        const { uid } = req.query;
        if (!uid) return res.status(400).json({ error: 'UID is required' });

        const incoming = await SwapRequest.find({ receiverId: uid }).sort({ createdAt: -1 });
        const outgoing = await SwapRequest.find({ requesterId: uid }).sort({ createdAt: -1 });

        const userIds = new Set([
            ...incoming.map(r => r.requesterId),
            ...outgoing.map(r => r.receiverId)
        ]);

        const users = await User.find({ uid: { $in: Array.from(userIds) } });
        const userMap = users.reduce((acc, user) => ({ ...acc, [user.uid]: user }), {});

        const attachUser = (req, userKey) => ({
            ...req.toObject(),
            user: userMap[req[userKey]]
        });

        res.json({
            incoming: incoming.map(r => attachUser(r, 'requesterId')),
            outgoing: outgoing.map(r => attachUser(r, 'receiverId'))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update request status
app.put('/api/requests/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['accepted', 'rejected'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const request = await SwapRequest.findByIdAndUpdate(req.params.id, { status }, { new: true });

        // Give 10 points to both parties making the community stronger!
        if (status === 'accepted') {
            await User.updateMany(
                { uid: { $in: [request.requesterId, request.receiverId] } },
                { $inc: { points: 10 } }
            );
        }

        res.json(request);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Collaboration Endpoints ---

// Fetch collaborations (accepted requests)
app.get('/api/collaborations', async (req, res) => {
    try {
        const { uid } = req.query;
        if (!uid) return res.status(400).json({ error: 'UID is required' });

        const requests = await SwapRequest.find({
            status: 'accepted',
            $or: [{ requesterId: uid }, { receiverId: uid }]
        }).sort({ createdAt: -1 });

        const userIds = new Set(requests.flatMap(r => [r.requesterId, r.receiverId]));
        const users = await User.find({ uid: { $in: Array.from(userIds) } });
        const userMap = users.reduce((acc, user) => ({ ...acc, [user.uid]: user }), {});

        const result = requests.map(r => {
            const partnerId = r.requesterId === uid ? r.receiverId : r.requesterId;
            return {
                ...r.toObject(),
                partner: userMap[partnerId]
            };
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update communication method
app.put('/api/collaborations/:id/communication', async (req, res) => {
    try {
        const { communicationMethod } = req.body;
        const request = await SwapRequest.findByIdAndUpdate(req.params.id, { communicationMethod }, { new: true });
        res.json(request);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add a lesson
app.post('/api/collaborations/:id/lessons', async (req, res) => {
    try {
        const { title, addedBy } = req.body;
        if (!title || !addedBy) return res.status(400).json({ error: 'Missing title or addedBy' });

        const request = await SwapRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ error: 'Request not found' });

        request.lessons.push({ title, addedBy, completed: false });
        await request.save();
        res.status(201).json(request);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Toggle lesson status
app.put('/api/collaborations/:id/lessons/:lessonId', async (req, res) => {
    try {
        const { uid } = req.body;
        const request = await SwapRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ error: 'Request not found' });

        const lesson = request.lessons.id(req.params.lessonId);
        if (!lesson) return res.status(404).json({ error: 'Lesson not found' });

        if (lesson.addedBy !== uid) {
            return res.status(403).json({ error: 'Only the teacher can check mark progress.' });
        }

        lesson.completed = !lesson.completed;
        await request.save();
        res.json(request);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Admin Endpoints ---

app.post('/api/admin/query', async (req, res) => {
    try {
        const { modelName, operation, args } = req.body;
        let model;
        if (modelName === 'User') model = User;
        else if (modelName === 'SwapRequest') model = SwapRequest;
        else return res.status(400).json({ error: 'Invalid modelName' });

        const parsedArgs = typeof args === 'string' ? JSON.parse(args || '[]') : (args || []);

        let result;
        if (typeof model[operation] !== 'function') {
            return res.status(400).json({ error: `Invalid operation on model ${modelName}` });
        }

        // Wait for query evaluation
        const queryResult = model[operation](...parsedArgs);
        // Note: some mongoose results might be queries instead of promises.
        result = await queryResult;

        res.json({ result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/stats', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const requestCount = await SwapRequest.countDocuments();
        const acceptedCount = await SwapRequest.countDocuments({ status: 'accepted' });
        res.json({ userCount, requestCount, acceptedCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
