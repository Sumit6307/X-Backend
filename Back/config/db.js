const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');

    const collections = await mongoose.connection.db.listCollections().toArray();
    if (collections.some(col => col.name === 'profiles')) {
      await mongoose.connection.db.collection('profiles').dropIndex('editToken_1').catch(err => {
        if (err.codeName !== 'IndexNotFound') {
          console.error('Error dropping editToken_1 index:', err.message);
        }
      });
    }
  } catch (err) {
    console.error('DB Connection Error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;