const InvoiceTemplate = require('@models/invoiceTemplate');

// Create or update invoice template (single entry per user)
exports.createOrUpdateTemplate = async (req, res) => {
  try {
    const { default_invoice_template } = req.body;
    const userId = req.user; // Get user ID from authenticated user

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - User not authenticated'
      });
    }

    // Check if template already exists for this user
    const existingTemplate = await InvoiceTemplate.findOne({ userId });

    let template;
    if (existingTemplate) {
      // Update existing template
      template = await InvoiceTemplate.findOneAndUpdate(
        { userId },
        { default_invoice_template, updatedAt: new Date() },
        { new: true }
      );
      return res.status(200).json({
        success: true,
        message: 'Template updated successfully',
        data: template
      });
    } else {
      // Create new template
      template = await InvoiceTemplate.create({
        default_invoice_template,
        userId
      });
      return res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: template
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get current user's template
exports.getMyTemplate = async (req, res) => {
  try {
    const userId = req.user;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - User not authenticated'
      });
    }

    const template = await InvoiceTemplate.findOne({ userId });
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found for this user'
      });
    }
    res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get all invoice templates (admin only)
exports.getAllTemplates = async (req, res) => {
  try {
    // Check if user is admin (you need to implement this check based on your auth system)
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden - Admin access required'
      });
    }

    const templates = await InvoiceTemplate.find().populate('userId', 'username email');
    res.status(200).json({
      success: true,
      count: templates.length,
      data: templates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};