const User = require('../models/User');
const Country = require('../models/Country');
const State = require('../models/State');
const City = require('../models/City');

exports.dashboard = async (req, res) => {
  const userData = await User.findById(req.user);
  res.json({
    message: 'Admin dashboard',
    user: userData,
  });
};

exports.getCountries = async (req, res) => {
  try {
    const { search } = req.query;
    const query = {};
    const projection = { _id: 1, name: 1 };
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
      const countries = await Country.find(query, projection).lean();
      res.json(countries);
    } else {
      const countries = await Country.find(query, projection).limit(10).lean();
      res.json(countries);
    }
  } catch (err) {
    res.status(500).json({ message: 'Error fetching countries', error: err.message });
  }
};

exports.getStates = async (req, res) => {
  const countryId = parseInt(req.params.countryId);
  try {
    const { search } = req.query;
    const query = { country_id: countryId };
    const projection = { _id: 1, name: 1 };
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
      const states = await State.find(query, projection).lean();
      res.json(states);
    } else {
      const states = await State.find(query, projection).limit(10).lean();
      res.json(states);
    }
  } catch (err) {
    res.status(500).json({ message: 'Error fetching states', error: err.message });
  }
};

exports.getCities = async (req, res) => {
  const stateId = parseInt(req.params.stateId);
  try {
    const { search } = req.query;
    const query = { state_id: stateId };
    const projection = { _id: 1, name: 1 };
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
      const cities = await City.find(query, projection).lean();
      res.json(cities);
    } else {
      const cities = await City.find(query, projection).limit(10).lean();
      res.json(cities);
    }
  } catch (err) {
    res.status(500).json({ message: 'Error fetching cities', error: err.message });
  }
};

//getProfile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.toJSON());
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user profile', error: err.message });
  }
};
// updateProfile
exports.updateProfile = async (req, res) => {
  try {
    // List of fields that are allowed to be updated from the request body
    const allowedFields = [
      'firstName',
      'lastName',
      'email',
      'gender',
      'address',
      'city',
      'country',
      'dateOfBirth',
      'phone',
      'state',
      'postalCode',
    ];

    const updateData = {};

    // Only add fields to updateData if they exist in the request body
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Handle the profile image upload separately
    if (req.file) {
      // Make sure the uploads directory is served statically by Express
      updateData.profileImage = `/uploads/${req.file.filename}`;
    }

    // Find the user and update only the provided data
    const updatedUser = await User.findByIdAndUpdate(
      req.user, // Assuming req.user is the full user object from your auth middleware
      { $set: updateData }, // Use $set to ensure only specified fields are updated
      { new: true, runValidators: true, context: 'query' }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'User profile updated successfully',
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    // Handle potential duplicate key errors from the validator
    if (err.code === 11000) {
      return res.status(409).json({
        message: 'Email address is already in use.',
        error: err.message,
      });
    }
    res.status(500).json({
      message: 'Error updating user profile',
      error: err.message,
    });
  }
};