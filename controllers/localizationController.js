const DateFormat = require('@models/DateFormat');
const TimeFormat = require('@models/TimeFormat');
const Timezone = require('@models/Timezone');

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

module.exports = {
  getDropdownOptions
};