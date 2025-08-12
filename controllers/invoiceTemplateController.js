const InvoiceTemplate = require('@models/invoiceTemplate');

exports.createOrUpdateTemplate = async (req, res) => {
  try {
    const { default_invoice_template } = req.body;
    const userId = req.user;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - User not authenticated'
      });
    }

    const existingTemplate = await InvoiceTemplate.findOne({ userId });

    let template;
    if (existingTemplate) {
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

exports.getAllTemplates = async (req, res) => {
  try {
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