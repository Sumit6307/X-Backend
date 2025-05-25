const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  bio: { type: String, maxlength: 500 },
  skills: [{ type: String, index: true }],
  socialLinks: {
    github: String,
    linkedin: String,
    twitter: String,
    instagram: String,
  },
  location: { type: String, index: true },
  imageUrl: { 
    type: String, 
    default: 'https://img.freepik.com/premium-vector/vector-flat-illustration-grayscale-avatar-user-profile-person-icon-gender-neutral-silhouette-profile-picture-suitable-social-media-profiles-icons-screensavers-as-templatex9xa_719432-2210.jpg?semt=ais_hybrid' 
  },
  projects: [{
    title: { type: String, required: true },
    description: String,
    codeSnippet: String,
    url: String,
  }],
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

profileSchema.index({ name: 'text', skills: 'text', location: 'text' });

// Update updatedAt on save
profileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Profile', profileSchema);