const Unit = require('../models/Unit');

// @desc Get all units
exports.getUnits = async (req, res) => {
  try {
    const units = await Unit.find();
    res.json({
      message: 'Units fetched successfully',
      data: units,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// @desc Create new unit
exports.createUnit = async (req, res) => {
  const { unit_name, short_name, status } = req.body;

  try {
    const unit = new Unit({ unit_name, short_name, status });
    await unit.save();
    res.status(201).json(unit);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create unit' });
  }
};

// @desc Get a single unit by ID
exports.getUnitById = async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.id);
    
    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    res.json(unit);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch unit' });
  }
};


// @desc Update unit
exports.updateUnit = async (req, res) => {
  const { id } = req.params;

  if (!id || id.length !== 24) {
    return res.status(400).json({ message: 'Invalid unit ID' });
  }

  try {
    const unit = await Unit.findByIdAndUpdate(id, req.body, { new: true });

    if (!unit) {
      return res.status(404).json({ message: 'Unit not found' });
    }

    res.json({
      message: 'Unit updated successfully',
      data: unit,
    })
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ message: 'Failed to update unit' });
  }
};

// @desc Delete unit
exports.deleteUnit = async (req, res) => {
  const { id } = req.params;

  try {
    const unit = await Unit.findByIdAndDelete(id);

    if (!unit) return res.status(404).json({ message: 'Unit not found' });

    res.json({ message: 'Unit deleted successfully' });
  } catch (err) {
    res.status(400).json({ message: 'Failed to delete unit' });
  }
};
