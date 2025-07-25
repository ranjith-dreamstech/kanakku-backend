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
    const countries = await Country.find({}, { _id: 1, name: 1 }).lean();
    console.log(countries);
    res.json(countries);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching countries', error: err.message });
  }
};

exports.getStates = async (req, res) => {
  const countryId = parseInt(req.params.countryId);
  try {
    const states = await State.find({ country_id: countryId }, { _id: 1, name: 1 }).lean();
    res.json(states);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching states', error: err.message });
  }
};

exports.getCities = async (req, res) => {
  const stateId = parseInt(req.params.stateId);
  try {
    const cities = await City.find({ state_id: stateId }, { _id: 1, name: 1 }).lean();
    res.json(cities);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching cities', error: err.message });
  }
};

//getProfile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user).select('-password');
    if(!user){
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.toJSON());
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user profile', error: err.message });
  }
};
//updateProfile 
exports.updateProfile = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      gender,
      address,
      city,
      country,
      dateOfBirth,
      phone,
      state,
      postalCode,
    } = req.body;

    const updateData = {
      firstName,
      lastName,
      email,
      gender,
      address,
      city,
      country,
      dateOfBirth,
      phone,
      state,
      postalCode,
    };

    // Attach uploaded profile image
    if (req.file) {
      updateData.profileImage = `/uploads/${req.file.filename}`;
    }
    console.log('user id' +req.user);
    const updatedUser = await User.findOneAndUpdate(
    { _id: req.user }, // works for both ObjectId or string
    updateData,
    { new: true }
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
    res.status(500).json({
      message: 'Error updating user profile',
      error: err.message,
    });
  }
};

