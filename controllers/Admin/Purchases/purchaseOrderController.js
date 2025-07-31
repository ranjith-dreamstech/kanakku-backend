const mongoose = require('mongoose');
const PurchaseOrder = require('@models/PurchaseOrder');
const User = require('@models/User');
const Product = require('@models/Product');
const BankDetail = require('@models/BankDetail');
const Signature = require('@models/Signature');

// Create a new purchase order
const createPurchaseOrder = async (req, res) => {
    try {
        const { 
            vendorId,
            dueDate,
            referenceNo,
            items,
            status,
            paymentMode,
            notes,
            termsAndCondition,
            sign_type,
            signatureId,
            userId,
            billFrom,  // This will now be the user ID whose address we'll use
            billTo,    // This will now be the user ID whose address we'll use
            convert_type
        } = req.body;

        // Validate vendor exists and is a supplier
        const vendor = await User.findById(vendorId);
        if (!vendor || vendor.user_type !== 2) {
            return res.status(400).json({ message: 'Invalid vendor ID or vendor is not a supplier' });
        }

        // Validate requesting user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        // Get bill from and bill to user addresses
        const billFromUser = await User.findById(billFrom);
        const billToUser = await User.findById(billTo);
        
        if (!billFromUser || !billToUser) {
            return res.status(400).json({ message: 'Invalid bill from or bill to user ID' });
        }

        // Validate at least one address exists
        if (!billFromUser.address && !billToUser.address) {
            return res.status(400).json({ message: 'Both bill from and bill to addresses are missing' });
        }

        // Validate products in items
        for (const item of items) {
            const product = await Product.findById(item.productId);
            if (!product) {
                return res.status(400).json({ message: `Invalid product ID: ${item.productId}` });
            }
        }

        // Calculate amounts
        let taxableAmount = 0;
        let totalDiscount = 0;
        let vat = 0;
        let totalAmount = 0;

        items.forEach(item => {
            const itemAmount = item.quantity * (item.rate || 0);
            const itemDiscount = item.discount || 0;
            const itemTax = item.tax || 0;
            
            taxableAmount += itemAmount;
            totalDiscount += itemDiscount;
            vat += itemTax;
            totalAmount += (itemAmount - itemDiscount + itemTax);
        });

        // Create purchase order
        const purchaseOrder = new PurchaseOrder({
            vendorId,
            purchaseOrderDate: new Date(),
            dueDate: new Date(dueDate),
            referenceNo: referenceNo || '',
            items: items.map(item => ({
                ...item,
                amount: item.amount || (item.quantity * (item.rate || 0))
            })),
            status: status || 'NEW',
            paymentMode,
            taxableAmount: req.body.taxableAmount || taxableAmount,
            totalDiscount: req.body.totalDiscount || totalDiscount,
            vat: req.body.vat || vat,
            roundOff: req.body.roundOff || false,
            TotalAmount: req.body.TotalAmount || totalAmount,
            bank: req.body.bank || null,
            notes: notes || '',
            termsAndCondition: termsAndCondition || '',
            sign_type: sign_type || 'none',
            signatureId: signatureId || null,
            signatureImage: req.file ? req.file.path : null,
            userId,
            billFrom: billFromUser.address || '',
            billTo: billToUser.address || '',
            convert_type: convert_type || 'purchase'
        });

        await purchaseOrder.save();

        res.status(201).json({ 
            message: 'Purchase order created successfully', 
            data: {
                purchaseOrder: {
                    id: purchaseOrder._id,
                    purchaseOrderId: purchaseOrder.purchaseOrderId,
                    vendor: {
                        id: vendor._id,
                        name: `${vendor.firstName} ${vendor.lastName}`
                    },
                    purchaseOrderDate: purchaseOrder.purchaseOrderDate,
                    dueDate: purchaseOrder.dueDate,
                    status: purchaseOrder.status,
                    TotalAmount: purchaseOrder.TotalAmount,
                    billFrom: purchaseOrder.billFrom,
                    billTo: purchaseOrder.billTo,
                    items: purchaseOrder.items.map(item => ({
                        name: item.name,
                        quantity: item.quantity,
                        rate: item.rate,
                        amount: item.amount
                    }))
                }
            }
        });
    } catch (err) {
        res.status(500).json({ 
            message: 'Error creating purchase order',
            error: err.message 
        });
    }
};

const listUsersByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { search } = req.query;

    // Validate type parameter
    if (![1, 2].includes(Number(type))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type. Must be 1 (regular) or 2 (supplier)'
      });
    }

    // Build the query
    const query = { user_type: Number(type) };

    // Add search condition if search query exists
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    const users = await User.find(query)
      .select('-password -__v')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users.map(user => ({
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        user_type: user.user_type,
        profileImage: user.profileImageUrl, // Using virtual
        address: user.address,
        balance: user.balance,
        balance_type: user.balance_type,
        createdAt: user.createdAt
      }))
    });

  } catch (err) {
    console.error('Error listing users:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // Find user by ID
    const user = await User.findById(id)
      .select('-password -__v'); // Exclude sensitive fields

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Format response
    const responseData = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      user_type: user.user_type,
      profileImage: user.profileImageUrl, // Using virtual property
      address: user.address,
      country: user.country,
      state: user.state,
      city: user.city,
      postalCode: user.postalCode,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      balance: user.balance,
      balance_type: user.balance_type,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user details',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};
const getRecentProductsWithSearch = async (req, res) => {
    try {
        const { search = '' } = req.query;
        
        // Build search query
        const searchQuery = {
            $or: [
                { product_name: { $regex: search, $options: 'i' } },
                { product_code: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ]
        };

        // Get products - if search is empty, get last 10, otherwise get all matching
        const products = await Product.find(search ? searchQuery : {})
            .populate('category', 'category_name')
            .populate('brand', 'brand_name')
            .sort({ createdAt: -1 })
            .limit(search ? 0 : 10); // No limit when searching

        // Format response
        const formattedProducts = products.map(product => ({
            id: product._id,
            name: product.product_name,
            code: product.product_code,
            price: product.price,
            stock: product.stock,
            category: product.category?.category_name || null,
            brand: product.brand?.brand_name || null,
            image: product.image_url || null,
            createdAt: product.createdAt
        }));

        res.status(200).json({
            message: search 
                ? 'Search results for products' 
                : 'Last 10 products retrieved',
            data: formattedProducts,
            count: formattedProducts.length
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Server error', 
            error: error.message 
        });
    }
};

const listBankDetails = async (req, res) => {
    try {
        const { userId, status, search = '' } = req.query;

        const baseQuery = { isDeleted: false };
        
        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid user ID format'
                });
            }
            baseQuery.userId = userId;
        }

        // Add status filter if provided
        if (status !== undefined) {
            baseQuery.status = status === 'true';
        }

        // Build search query if search term exists
        const searchQuery = search ? {
            $or: [
                { accountHoldername: { $regex: search, $options: 'i' } },
                { bankName: { $regex: search, $options: 'i' } },
                { branchName: { $regex: search, $options: 'i' } },
                { accountNumber: { $regex: search, $options: 'i' } },
                { IFSCCode: { $regex: search, $options: 'i' } }
            ]
        } : {};

        // Combine all queries
        const query = { ...baseQuery, ...searchQuery };

        // Get bank details - if search is empty, get last 10, otherwise get all matching
        const bankDetails = await BankDetail.find(query)
            .sort({ createdAt: -1 })
            .limit(search ? 0 : 10) // No limit when searching
            .lean();

        // Transform the data
        const transformedDetails = bankDetails.map(detail => ({
            id: detail._id,
            accountHoldername: detail.accountHoldername,
            bankName: detail.bankName,
            branchName: detail.branchName,
            accountNumber: detail.accountNumber,
            IFSCCode: detail.IFSCCode,
            status: detail.status,
            userId: detail.userId,
            createdAt: detail.createdAt,
            updatedAt: detail.updatedAt
        }));

        res.status(200).json({
            success: true,
            message: search 
                ? 'Search results for bank details' 
                : 'Last 10 bank details retrieved',
            data: transformedDetails,
            count: transformedDetails.length
        });
    } catch (err) {
        console.error('List bank details error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching bank details',
            error: err.message 
        });
    }
};

const getUserSignatures = async (req, res) => {
    try {
        const userId = req.user;
        const { 
            search = '',
            status
        } = req.query;

        // Build base query
        const query = { 
            userId, 
            isDeleted: false 
        };

        // Add search filter if search term exists
        if (search) {
            query.signatureName = { 
                $regex: search, 
                $options: 'i' 
            };
        }

        // Add status filter if provided
        if (status !== undefined) {
            query.status = status === 'true';
        }

        // Get signatures - if search is empty, get last 10, otherwise get all matching
        const signatures = await Signature.find(query)
            .sort({ createdAt: -1 })
            .limit(search ? 0 : 10); // No limit when searching

        const baseUrl = `${req.protocol}://${req.get('host')}/`;
        
        // Format response
        const formattedSignatures = signatures.map(sig => ({
            id: sig._id,
            signatureName: sig.signatureName,
            signatureImage: sig.signatureImage 
                ? `${baseUrl}${sig.signatureImage.replace(/\\/g, '/')}`
                : null,
            status: sig.status,
            markAsDefault: sig.markAsDefault,
            createdAt: sig.createdAt,
            updatedAt: sig.updatedAt
        }));

        res.status(200).json({
            success: true,
            message: search 
                ? 'Search results for signatures' 
                : 'Last 10 signatures retrieved',
            data: formattedSignatures,
            count: formattedSignatures.length
        });
    } catch (err) {
        console.error('Error fetching signatures:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching signatures',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
};


module.exports = {
    createPurchaseOrder,
    listUsersByType,
    getUserById,
    getRecentProductsWithSearch,
    listBankDetails,
    getUserSignatures
};