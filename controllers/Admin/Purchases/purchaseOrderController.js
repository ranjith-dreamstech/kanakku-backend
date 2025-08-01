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
        const { search = '', limit = 10 } = req.query;
        const numLimit = parseInt(limit);
        
        const searchQuery = {
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { barcode: { $regex: search, $options: 'i' } }
            ]
        };

        const products = await Product.find(search.trim() ? searchQuery : {})
            .populate('category', 'category_name')
            .populate('brand', 'brand_name')
            .populate('unit', 'unit_name')
            .populate({
                path: 'tax',
                model: 'TaxGroup',
                populate: {
                    path: 'tax_rate_ids',
                    model: 'TaxRate',
                    select: 'tax_name tax_rate status'
                }
            })
            .sort({ createdAt: -1 })
            .limit(search.trim() ? 0 : numLimit);

        const formattedProducts = await Promise.all(products.map(async (product) => {
            // Calculate total tax rate
            let totalTaxRate = 0;
            let taxDetails = null;
            
            if (product.tax) {
                totalTaxRate = product.tax.tax_rate_ids.reduce(
                    (total, rate) => total + (rate.tax_rate || 0), 0
                );
                
                taxDetails = {
                    group_id: product.tax._id,
                    group_name: product.tax.tax_name,
                    total_rate: totalTaxRate,
                    components: product.tax.tax_rate_ids.map(rate => ({
                        rate_id: rate._id,
                        name: rate.tax_name,
                        rate: rate.tax_rate,
                        status: rate.status
                    }))
                };
            }

            return {
                id: product._id,
                item_type: product.item_type,
                name: product.name,
                code: product.code,
                category: {
                    id: product.category?._id,
                    name: product.category?.category_name
                },
                brand: {
                    id: product.brand?._id,
                    name: product.brand?.brand_name
                },
                unit: {
                    id: product.unit?._id,
                    name: product.unit?.unit_name
                },
                prices: {
                    selling: product.selling_price,
                    purchase: product.purchase_price,
                    selling_with_tax: product.selling_price * (1 + totalTaxRate / 100),
                    purchase_with_tax: product.purchase_price * (1 + totalTaxRate / 100)
                },
                discount: {
                    type: product.discount_type,
                    value: product.discount_value
                },
                tax: taxDetails,
                barcode: product.barcode,
                stock: {
                    quantity: product.stock,
                    alert_quantity: product.alert_quantity
                },
                description: product.description,
                images: {
                    main: product.product_image,
                    gallery: product.gallery_images || []
                },
                status: product.status,
                createdAt: product.createdAt,
                updatedAt: product.updatedAt
            };
        }));

        res.status(200).json({
            success: true,
            message: search.trim() 
                ? 'Product search results' 
                : `Last ${numLimit} products retrieved`,
            data: formattedProducts,
            count: formattedProducts.length,
            pagination: {
                limit: numLimit,
                returned: formattedProducts.length
            }
        });
    } catch (error) {
        console.error('Product fetch error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error while fetching products', 
            error: process.env.NODE_ENV === 'development' ? error.message : null
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

// List all purchase orders
const listPurchaseOrders = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            status, 
            search = '',
            vendorId,
            startDate,
            endDate
        } = req.query;

        const userId = req.user;
        const skip = (page - 1) * limit;

        // Build query
        const query = { 
            userId, 
            isDeleted: false 
        };

        // Add status filter
        if (status && ['NEW', 'PENDING', 'COMPLETED', 'CANCELLED'].includes(status)) {
            query.status = status;
        }

        // Add vendor filter
        if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
            query.vendorId = vendorId;
        }

        // Add date range filter
        if (startDate || endDate) {
            query.purchaseOrderDate = {};
            if (startDate) {
                query.purchaseOrderDate.$gte = new Date(startDate);
            }
            if (endDate) {
                query.purchaseOrderDate.$lte = new Date(endDate);
            }
        }

        // Add search filter
        if (search) {
            query.$or = [
                { purchaseOrderId: { $regex: search, $options: 'i' } },
                { referenceNo: { $regex: search, $options: 'i' } },
                { notes: { $regex: search, $options: 'i' } }
            ];
        }

        // Get total count
        const totalCount = await PurchaseOrder.countDocuments(query);

        // Get purchase orders with pagination
        const purchaseOrders = await PurchaseOrder.find(query)
            .populate('vendorId', 'firstName lastName email phone')
            .populate('signatureId', 'signatureName')
            .populate('bank', 'bankName accountNumber')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Format response
        const formattedOrders = purchaseOrders.map(order => ({
            id: order._id,
            purchaseOrderId: order.purchaseOrderId,
            vendor: order.vendorId ? {
                id: order.vendorId._id,
                name: `${order.vendorId.firstName} ${order.vendorId.lastName}`,
                email: order.vendorId.email,
                phone: order.vendorId.phone
            } : null,
            purchaseOrderDate: order.purchaseOrderDate,
            dueDate: order.dueDate,
            referenceNo: order.referenceNo,
            status: order.status,
            paymentMode: order.paymentMode,
            taxableAmount: order.taxableAmount,
            totalDiscount: order.totalDiscount,
            vat: order.vat,
            TotalAmount: order.TotalAmount,
            itemsCount: order.items.length,
            billFrom: order.billFrom,
            billTo: order.billTo,
            notes: order.notes,
            signature: order.signatureId ? {
                id: order.signatureId._id,
                name: order.signatureId.signatureName
            } : null,
            bank: order.bank ? {
                id: order.bank._id,
                name: order.bank.bankName,
                accountNumber: order.bank.accountNumber
            } : null,
            convert_type: order.convert_type,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
        }));

        res.status(200).json({
            success: true,
            message: 'Purchase orders retrieved successfully',
            data: formattedOrders,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / limit),
                totalCount,
                hasNextPage: page * limit < totalCount,
                hasPrevPage: page > 1
            }
        });

    } catch (err) {
        console.error('List purchase orders error:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching purchase orders',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
};

// Get purchase order by ID
const getPurchaseOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid purchase order ID format'
            });
        }

        const purchaseOrder = await PurchaseOrder.findOne({ 
            _id: id, 
            userId, 
            isDeleted: false 
        })
        .populate('vendorId', 'firstName lastName email phone address')
        .populate('signatureId', 'signatureName signatureImage')
        .populate('bank', 'bankName accountNumber IFSCCode')
        .populate('items.productId', 'product_name product_code price stock image_url')
        .populate('items.unit', 'unit_name');

        if (!purchaseOrder) {
            return res.status(404).json({
                success: false,
                message: 'Purchase order not found'
            });
        }

        // Format items
        const formattedItems = purchaseOrder.items.map(item => ({
            id: item._id,
            name: item.name,
            key: item.key,
            product: item.productId ? {
                id: item.productId._id,
                name: item.productId.product_name,
                code: item.productId.product_code,
                price: item.productId.price,
                stock: item.productId.stock,
                image: item.productId.image_url
            } : null,
            quantity: item.quantity,
            units: item.units,
            unit: item.unit ? {
                id: item.unit._id,
                name: item.unit.unit_name
            } : null,
            rate: item.rate,
            discount: item.discount,
            tax: item.tax,
            taxInfo: item.taxInfo,
            amount: item.amount,
            discountType: item.discountType
        }));

        // Format signature image URL
        const baseUrl = `${req.protocol}://${req.get('host')}/`;
        const signatureImage = purchaseOrder.signatureId?.signatureImage 
            ? `${baseUrl}${purchaseOrder.signatureId.signatureImage.replace(/\\/g, '/')}`
            : null;

        const responseData = {
            id: purchaseOrder._id,
            purchaseOrderId: purchaseOrder.purchaseOrderId,
            vendor: purchaseOrder.vendorId ? {
                id: purchaseOrder.vendorId._id,
                name: `${purchaseOrder.vendorId.firstName} ${purchaseOrder.vendorId.lastName}`,
                email: purchaseOrder.vendorId.email,
                phone: purchaseOrder.vendorId.phone,
                address: purchaseOrder.vendorId.address
            } : null,
            purchaseOrderDate: purchaseOrder.purchaseOrderDate,
            dueDate: purchaseOrder.dueDate,
            referenceNo: purchaseOrder.referenceNo,
            status: purchaseOrder.status,
            paymentMode: purchaseOrder.paymentMode,
            taxableAmount: purchaseOrder.taxableAmount,
            totalDiscount: purchaseOrder.totalDiscount,
            vat: purchaseOrder.vat,
            roundOff: purchaseOrder.roundOff,
            TotalAmount: purchaseOrder.TotalAmount,
            items: formattedItems,
            billFrom: purchaseOrder.billFrom,
            billTo: purchaseOrder.billTo,
            notes: purchaseOrder.notes,
            termsAndCondition: purchaseOrder.termsAndCondition,
            sign_type: purchaseOrder.sign_type,
            signature: purchaseOrder.signatureId ? {
                id: purchaseOrder.signatureId._id,
                name: purchaseOrder.signatureId.signatureName,
                image: signatureImage
            } : null,
            bank: purchaseOrder.bank ? {
                id: purchaseOrder.bank._id,
                name: purchaseOrder.bank.bankName,
                accountNumber: purchaseOrder.bank.accountNumber,
                IFSCCode: purchaseOrder.bank.IFSCCode
            } : null,
            convert_type: purchaseOrder.convert_type,
            createdAt: purchaseOrder.createdAt,
            updatedAt: purchaseOrder.updatedAt
        };

        res.status(200).json({
            success: true,
            message: 'Purchase order retrieved successfully',
            data: responseData
        });

    } catch (err) {
        console.error('Get purchase order error:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching purchase order',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
};

// Update purchase order
const updatePurchaseOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user;
        const updates = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid purchase order ID format'
            });
        }

        // Check if purchase order exists and belongs to user
        const existingOrder = await PurchaseOrder.findOne({ 
            _id: id, 
            userId, 
            isDeleted: false 
        });

        if (!existingOrder) {
            return res.status(404).json({
                success: false,
                message: 'Purchase order not found'
            });
        }

        // Validate vendor if provided
        if (updates.vendorId) {
            const vendor = await User.findById(updates.vendorId);
            if (!vendor || vendor.user_type !== 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid vendor ID or vendor is not a supplier'
                });
            }
        }

        // Validate products in items if provided
        if (updates.items && Array.isArray(updates.items)) {
            for (const item of updates.items) {
                if (item.productId) {
                    const product = await Product.findById(item.productId);
                    if (!product) {
                        return res.status(400).json({
                            success: false,
                            message: `Invalid product ID: ${item.productId}`
                        });
                    }
                }
            }
        }

        // Calculate amounts if items are updated
        if (updates.items && Array.isArray(updates.items)) {
            let taxableAmount = 0;
            let totalDiscount = 0;
            let vat = 0;
            let totalAmount = 0;

            updates.items.forEach(item => {
                const itemAmount = item.quantity * (item.rate || 0);
                const itemDiscount = item.discount || 0;
                const itemTax = item.tax || 0;
                
                taxableAmount += itemAmount;
                totalDiscount += itemDiscount;
                vat += itemTax;
                totalAmount += (itemAmount - itemDiscount + itemTax);
            });

            updates.taxableAmount = taxableAmount;
            updates.totalDiscount = totalDiscount;
            updates.vat = vat;
            updates.TotalAmount = totalAmount;
        }

        // Handle signature image upload
        if (req.file) {
            updates.signatureImage = req.file.path;
        }

        // Remove protected fields
        const protectedFields = ['_id', 'purchaseOrderId', 'userId', 'createdAt', 'updatedAt'];
        protectedFields.forEach(field => delete updates[field]);

        // Update purchase order
        const updatedOrder = await PurchaseOrder.findByIdAndUpdate(
            id,
            { $set: updates },
            { 
                new: true,
                runValidators: true
            }
        )
        .populate('vendorId', 'firstName lastName email phone')
        .populate('signatureId', 'signatureName')
        .populate('bank', 'bankName accountNumber');

        res.status(200).json({
            success: true,
            message: 'Purchase order updated successfully',
            data: {
                id: updatedOrder._id,
                purchaseOrderId: updatedOrder.purchaseOrderId,
                vendor: updatedOrder.vendorId ? {
                    id: updatedOrder.vendorId._id,
                    name: `${updatedOrder.vendorId.firstName} ${updatedOrder.vendorId.lastName}`
                } : null,
                status: updatedOrder.status,
                TotalAmount: updatedOrder.TotalAmount,
                updatedAt: updatedOrder.updatedAt
            }
        });

    } catch (err) {
        console.error('Update purchase order error:', err);
        res.status(500).json({
            success: false,
            message: 'Error updating purchase order',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }
};

// Delete purchase order (soft delete)
const deletePurchaseOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid purchase order ID format'
            });
        }

        // Check if purchase order exists and belongs to user
        const purchaseOrder = await PurchaseOrder.findOne({ 
            _id: id, 
            userId, 
            isDeleted: false 
        });

        if (!purchaseOrder) {
            return res.status(404).json({
                success: false,
                message: 'Purchase order not found'
            });
        }

        // Soft delete the purchase order
        await PurchaseOrder.findByIdAndUpdate(id, { 
            isDeleted: true 
        });

        res.status(200).json({
            success: true,
            message: 'Purchase order deleted successfully',
            data: {
                id: purchaseOrder._id,
                purchaseOrderId: purchaseOrder.purchaseOrderId
            }
        });

    } catch (err) {
        console.error('Delete purchase order error:', err);
        res.status(500).json({
            success: false,
            message: 'Error deleting purchase order',
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
    getUserSignatures,
    listPurchaseOrders,
    getPurchaseOrderById,
    updatePurchaseOrder,
    deletePurchaseOrder
};