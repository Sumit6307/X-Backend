const express = require('express');
const router = express.Router();
const Profile = require('../models/Profile');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

// Auth middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const profile = await Profile.findOne({ _id: decoded.id, name: decoded.name });
    if (!profile) return res.status(401).json({ error: 'Profile not found' });

    req.profile = profile;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    if (err.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Invalid token' });
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Add Profile
router.post('/add', limiter, upload.single('image'), async (req, res) => {
  const { name, password, bio, skills, socialLinks, location, projects } = req.body;
  try {
    if (!name || !password) return res.status(400).json({ error: 'Name and password are required' });

    const existingProfile = await Profile.findOne({ name });
    if (existingProfile) return res.status(400).json({ error: 'Profile name already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    let imageUrl = 'https://img.freepik.com/premium-vector/vector-flat-illustration-grayscale-avatar-user-profile-person-icon-gender-neutral-silhouette-profile-picture-suitable-social-media-profiles-icons-screensavers-as-templatex9xa_719432-2210.jpg?semt=ais_hybrid';
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
          if (error) reject(error);
          resolve(result);
        }).end(req.file.buffer);
      });
      imageUrl = result.secure_url;
    }
    console.log('Creating profile with imageUrl:', imageUrl);

    let parsedProjects = [];
    if (projects) {
      parsedProjects = JSON.parse(projects);
      if (!Array.isArray(parsedProjects)) throw new Error('Projects must be an array');
      for (const project of parsedProjects) {
        if (!project.title) return res.status(400).json({ error: 'Project title is required' });
      }
    }

    const profile = new Profile({
      name,
      password: hashedPassword,
      bio,
      skills: skills ? skills.split(',').map(s => s.trim()) : [],
      socialLinks: socialLinks ? JSON.parse(socialLinks) : {},
      location,
      imageUrl,
      projects: parsedProjects,
    });
    await profile.save();

    const token = jwt.sign({ id: profile._id, name: profile.name }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ profile: { ...profile._doc, password: undefined }, token });
  } catch (err) {
    console.error('Add Profile Error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { name, password } = req.body;
  try {
    if (!name || !password) return res.status(400).json({ error: 'Name and password are required' });

    const profile = await Profile.findOne({ name });
    if (!profile) return res.status(401).json({ error: 'Invalid name or password' });

    const isMatch = await bcrypt.compare(password, profile.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid name or password' });

    const token = jwt.sign({ id: profile._id, name: profile.name }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ profile: { ...profile._doc, password: undefined }, token });
  } catch (err) {
    console.error('Login Error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Get current user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({ 
      userId: req.profile._id, 
      name: req.profile.name,
      imageUrl: req.profile.imageUrl
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit Profile
router.put('/edit/:id', authenticate, limiter, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    if (req.profile._id.toString() !== id) return res.status(403).json({ error: 'Unauthorized to edit this profile' });

    const { bio, skills, socialLinks, location, projects } = req.body;
    let imageUrl = req.profile.imageUrl || 'https://img.freepik.com/premium-vector/vector-flat-illustration-grayscale-avatar-user-profile-person-icon-gender-neutral-silhouette-profile-picture-suitable-social-media-profiles-icons-screensavers-as-templatex9xa_719432-2210.jpg?semt=ais_hybrid';
    
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ resource_type: 'image' }, (error, result) => {
          if (error) reject(error);
          resolve(result);
        }).end(req.file.buffer);
      });
      imageUrl = result.secure_url;
    }
    console.log('Editing profile with imageUrl:', imageUrl);

    let parsedProjects = req.profile.projects;
    if (projects) {
      parsedProjects = JSON.parse(projects);
      if (!Array.isArray(parsedProjects)) throw new Error('Projects must be an array');
      for (const project of parsedProjects) {
        if (!project.title) return res.status(400).json({ error: 'Project title is required' });
      }
    }

    const updatedProfile = await Profile.findByIdAndUpdate(id, {
      bio,
      skills: skills ? skills.split(',').map(s => s.trim()) : req.profile.skills,
      socialLinks: socialLinks ? JSON.parse(socialLinks) : req.profile.socialLinks,
      location,
      imageUrl,
      projects: parsedProjects,
      updatedAt: Date.now(),
    }, { new: true });

    res.json({ 
      message: 'Profile updated successfully', 
      profile: { ...updatedProfile._doc, password: undefined } 
    });
  } catch (err) {
    console.error('Edit Profile Error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Get Single Profile
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid profile ID' });

    const profile = await Profile.findById(req.params.id).select('-password');
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    profile.views += 1;
    await profile.save();
    res.json(profile);
  } catch (err) {
    console.error('Get Profile Error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Get All Profiles
router.get('/', async (req, res) => {
  try {
    const profiles = await Profile.find().select('-password').sort({ views: -1 }).limit(50);
    res.json(profiles);
  } catch (err) {
    console.error('Get Profiles Error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Search Profiles
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Search query is required' });

    const profiles = await Profile.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { skills: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } },
      ],
    }).select('-password').limit(50);

    res.json(profiles);
  } catch (err) {
    console.error('Search Profiles Error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

module.exports = router;