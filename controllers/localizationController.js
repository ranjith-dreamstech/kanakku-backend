const DateFormat = require('@models/DateFormat');
const TimeFormat = require('@models/TimeFormat');
const Timezone = require('@models/Timezone');
const Localization = require('@models/Localization');

const getDropdownOptions = async (req, res) => {
  try {
    const [dateFormats, timeFormats, timezones] = await Promise.all([
      DateFormat.find({ isActive: true, isDeleted: false })
        .select('title format')
        .sort({ title: 1 }),
      
      TimeFormat.find({ isActive: true, isDeleted: false })
        .select('name format')
        .sort({ name: 1 }),
      
      Timezone.find()
        .select('name utc_offset')
        .sort({ name: 1 })
    ]);

    // Format the response
    const response = {
      success: true,
      message: 'Dropdown options retrieved successfully',
      data: {
        dateFormats: dateFormats.map(format => ({
          id: format._id,
          title: format.title,
          format: format.format
        })),
        timeFormats: timeFormats.map(format => ({
          id: format._id,
          name: format.name,
          format: format.format
        })),
        timezones: timezones.map(zone => ({
          id: zone._id,
          name: zone.name,
          offset: zone.utc_offset
        }))
      }
    };

    res.status(200).json(response);
  } catch (err) {
    console.error('Error fetching dropdown options:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching dropdown options',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

const saveLocalization = async (req, res) => {
  try {
    const { dateFormatId, timeFormatId, timezoneId } = req.body;
    const userId = req.user;

    // Validate all IDs exist
    const [dateFormat, timeFormat, timezone] = await Promise.all([
      DateFormat.findById(dateFormatId),
      TimeFormat.findById(timeFormatId),
      Timezone.findById(timezoneId)
    ]);

    // Deactivate any previous active settings
    await Localization.updateMany(
      { user: userId, isActive: true },
      { isActive: false }
    );

    // Create new localization
    const localization = await Localization.create({
      user: userId,
      dateFormat: dateFormatId,
      timeFormat: timeFormatId,
      timezone: timezoneId
    });

    res.status(201).json({
      success: true,
      message: 'Localization settings saved successfully',
      data: localization
    });

  } catch (err) {
    console.error('Error saving localization:', err);
    res.status(500).json({
      success: false,
      message: 'Error saving localization settings',
      error: err.message 
    });
  }
};

// Get current localization settings
const getLocalization = async (req, res) => {
  try {
    const userId = req.user;

    const localization = await Localization.findOne({ 
      user: userId, 
      isActive: true 
    })
    .populate('dateFormat', 'title format')
    .populate('timeFormat', 'name format')
    .populate('timezone', 'name utc_offset');

    if (!localization) {
      return res.status(404).json({
        success: false,
        message: 'No localization settings found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Localization settings retrieved successfully',
      data: {
        dateFormat: {
          id: localization.dateFormat._id,
          title: localization.dateFormat.title,
          format: localization.dateFormat.format
        },
        timeFormat: {
          id: localization.timeFormat._id,
          name: localization.timeFormat.name,
          format: localization.timeFormat.format
        },
        timezone: {
          id: localization.timezone._id,
          name: localization.timezone.name,
          offset: localization.timezone.utc_offset
        }
      }
    });

  } catch (err) {
    console.error('Error fetching localization:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching localization settings',
      error: err.message 
    });
  }
};


module.exports = {
  saveLocalization,
  getLocalization,
  getDropdownOptions
};