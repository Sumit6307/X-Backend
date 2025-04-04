const express = require('express');
const connectDB = require('./config/db');
const profileRoutes = require('./routes/profiles');
const cors = require('cors');
const { getJson } = require('serpapi');
require('dotenv').config();

const app = express();

// Connect to MongoDB
connectDB();

// Configure CORS for both development and production
const allowedOrigins = [
  'http://localhost:5173',
  'https://your-netlify-app.netlify.app',
  'https://*.netlify.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowed => origin.includes(allowed))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());
app.use('/api/profiles', profileRoutes);

// Helper function to process SerpAPI results
const processResults = (results, type) => {
  if (!Array.isArray(results)) return [];
  
  return results.slice(0, 10).map((result, index) => ({
    id: result.job_id || result.event_id || `${index}-${Date.now()}`,
    title: result.title || `Untitled ${type}`,
    company: result.via || result.source || result.organizer || 'Unknown',
    location: result.location || 'India',
    description: result.snippet || result.description || `No description available for this ${type}`,
    link: result.link || 'https://www.google.co.in',
    ...(type === 'jobs' && { salary: result.salary }),
    ...(type === 'internships' && { duration: '3-6 months' }),
    ...(type === 'bootcamps' && { duration: result.duration, cost: result.price }),
    ...(type === 'hackathons' && { date: result.date, prize: result.prize }),
    ...(type === 'mentorship' && { mentor: result.mentor, duration: '3 months' }),
    ...(type === 'remote' && { remote: true })
  }));
};

// Generic API endpoint handler
const createApiHandler = (type) => (req, res) => {
  const queryMap = {
    jobs: 'jobs',
    internships: 'Internship',
    bootcamps: 'coding bootcamps',
    hackathons: 'Hackathons',
    mentorship: 'Mentorship programs',
    remote: 'Remote work'
  };

  getJson(
    {
      api_key: process.env.SERPAPI_KEY || 'd049e6f87e0094750304808808cf65e2c423c75389faf1328bec809a3df95a51',
      engine: 'google',
      q: req.query.q || queryMap[type],
      location: req.query.location || 'India',
      google_domain: 'google.co.in',
      gl: 'in',
      hl: 'hi',
    },
    (json) => {
      if (!json || json.error) {
        console.error(`SerpAPI error for ${type}:`, json ? json.error : 'Invalid response');
        return res.status(500).json({ 
          error: `Failed to fetch ${type} from SerpAPI`,
          details: json ? json.error : 'Invalid response' 
        });
      }

      const results = Array.isArray(json.jobs_results) ? json.jobs_results :
                     Array.isArray(json.events_results) ? json.events_results :
                     Array.isArray(json.organic_results) ? json.organic_results : [];
      
      res.json(processResults(results, type));
    }
  );
};

// Create all API endpoints
const endpoints = ['jobs', 'internships', 'bootcamps', 'hackathons', 'mentorship', 'remote'];
endpoints.forEach(endpoint => {
  app.get(`/api/google-${endpoint}`, createApiHandler(endpoint));
});

// Basic route for testing
app.get('/', (req, res) => res.send('Backend is running'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));