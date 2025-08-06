const mongoose = require('mongoose');
const PurchaseOrder = require('@models/PurchaseOrder');
const User = require('@models/User');
const Product = require('@models/Product');
const BankDetail = require('@models/BankDetail');
const Signature = require('@models/Signature');
const TaxGroup = require('@models/TaxGroup');
const { response } = require('express');

// Create a new purchase order
const createPurchaseOrder = async (req, res) => {
    try {
        const { 
            vendorId,
            orderDate,
            dueDate,
            referenceNo,
            items,
            status,
            paymentMode,
            notes,
            termsAndCondition,
            sign_type,
            signatureId,
            signatureName,
            userId,
            billFrom,
            billTo,
            convert_type
        } = req.body;

        // Validate vendor exists and is a supplier
        // const vendor = await User.findById(vendorId);
        // if (!vendor || vendor.user_type !== 2) {
        //     return res.status(400).json({ message: 'Invalid vendor ID or vendor is not a supplier' });
        // }

        // Validate requesting user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(422).json({ message: 'Invalid user ID' });
        }

        // Get bill from and bill to user addresses
        const billFromUser = await User.findById(billFrom);
        const billToUser = await User.findById(billTo);
        
        if (!billFromUser || !billToUser) {
            return res.status(422).json({ message: 'Invalid bill from or bill to user ID' });
        }

        // Validate at least one address exists
        if (!billFromUser.address && !billToUser.address) {
            return res.status(400).json({ message: 'Both bill from and bill to addresses are missing' });
        }

        // Validate products in items
        for (const item of items) {
            const product = await Product.findById(item.id);
            if (!product) {
                return res.status(422).json({ message: `Invalid product ID: ${item.id}` });
            }
        }

        // Validate signature type
        const validSignatureTypes = ['none', 'digitalSignature', 'eSignature'];
        if (sign_type && !validSignatureTypes.includes(sign_type)) {
            return res.status(400).json({ message: 'Invalid signature type' });
        }

        // Validate signature data if eSignature is selected
        if (sign_type === 'eSignature') {
            if (!req.file) {
                return res.status(400).json({ message: 'Signature image is required for eSignature' });
            }
            if (!signatureName) {
                return res.status(400).json({ message: 'Signature name is required for eSignature' });
            }
        }

        // Calculate amounts based on the items exactly as they are in the payload
        let taxableAmount = 0;
        let totalDiscount = 0;
        let vat = 0;
        let totalAmount = 0;

        items.forEach(item => {
            const itemAmount = item.amount || (item.qty * (item.rate || 0));
            const itemDiscount = item.discount || 0;
            const itemTax = item.tax || 0;
            
            taxableAmount += itemAmount;
            totalDiscount += itemDiscount;
            vat += itemTax;
            totalAmount += itemAmount;
        });

        // Create purchase order with items exactly as in payload
        const purchaseOrder = new PurchaseOrder({
            vendorId,
            purchaseOrderDate: new Date(orderDate),
            dueDate: new Date(dueDate || orderDate),
            referenceNo: referenceNo || '',
            items: items.map(item => ({
                id: item.id,
                name: item.name,
                unit: item.unit,
                qty: item.qty,
                rate: item.rate,
                discount: item.discount,
                tax: item.tax,
                tax_group_id: item.tax_group_id,
                discount_type: item.discount_type,
                discount_value: item.discount_value,
                amount: item.amount
            })),
            status: status || 'new',
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
            signatureImage: sign_type === 'eSignature' ? req.file.path : null,
            signatureName: sign_type === 'eSignature' ? signatureName : null,
            userId,
            billFrom: billFrom,
            billTo: billTo,
            convert_type: convert_type || 'purchase'
        });

        await purchaseOrder.save();

        res.status(200).json({ 
            message: 'Purchase order created successfully', 
            data: {
                purchaseOrder: {
                    id: purchaseOrder._id,
                    purchaseOrderId: purchaseOrder.purchaseOrderId,
                    purchaseOrderDate: purchaseOrder.purchaseOrderDate,
                    dueDate: purchaseOrder.dueDate,
                    status: purchaseOrder.status,
                    TotalAmount: purchaseOrder.TotalAmount,
                    billFrom: purchaseOrder.billFrom,
                    billTo: purchaseOrder.billTo,
                    sign_type: purchaseOrder.sign_type,
                    signatureName: purchaseOrder.signatureName,
                    items: purchaseOrder.items.map(item => ({
                        id: item.id,
                        name: item.name,
                        unit: item.unit,
                        qty: item.qty,
                        rate: item.rate,
                        discount: item.discount,
                        tax: item.tax,
                        tax_group_id: item.tax_group_id,
                        discount_type: item.discount_type,
                        discount_value: item.discount_value,
                        amount: item.amount
                    }))
                }
            }
        });
    } catch (err) {
        console.error(err);
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
        const total = await PurchaseOrder.countDocuments(query);

        // Get purchase orders with pagination
        const purchaseOrders = await PurchaseOrder.find(query)
            .populate('vendorId', 'firstName lastName email phone')
            .populate('signatureId', 'signatureName')
            .populate('billTo', 'firstName lastName email profileImage phone')
            .populate({
                path: 'bank',
                model: 'BankDetail',
                select: 'bankName accountNumber accountHoldername IFSCCode'
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        const formattedOrders = await Promise.all(purchaseOrders.map(async (order) => {
            const baseUrl = `${req.protocol}://${req.get('host')}/`;
            const signatureImage = order.signatureImage 
                ? `${baseUrl}${order.signatureImage.replace(/\\/g, '/')}`
                : null;

            // Format dates as "dd, MMM yyyy"
            const formatDate = (date) => {
                if (!date) return null;
                const d = new Date(date);
                const day = d.getDate().toString().padStart(2, '0');
                const month = d.toLocaleString('default', { month: 'short' });
                const year = d.getFullYear();
                return `${day}, ${month} ${year}`;
            };

            // Vendor details
            const vendorDetails = order.vendorId ? {
                id: order.vendorId._id,
                name: `${order.vendorId.firstName || ''} ${order.vendorId.lastName || ''}`.trim(),
                email: order.vendorId.email || null,
                phone: order.vendorId.phone || null
            } : null;

            // BillTo details (consistent with vendor structure)
            const billToDetails = order.billTo ? {
                id: order.billTo._id,
                name: `${order.billTo.firstName || ''} ${order.billTo.lastName || ''}`.trim(),
                email: order.billTo.email || null,
                phone: order.billTo.phone || null,
                profileImage: order.billTo.profileImage 
                    ? `${baseUrl}${order.billTo.profileImage.replace(/\\/g, '/')}`
                    : 'https://placehold.co/150x150/E0BBE4/FFFFFF?text=Profile'
            } : null;

            // Bank details
            const bankDetails = order.bank ? {
                id: order.bank._id,
                name: order.bank.bankName || null,
                accountNumber: order.bank.accountNumber || null,
                accountHolderName: order.bank.accountHoldername || null,
                ifscCode: order.bank.IFSCCode || null
            } : null;

            // Signature details
            const signatureDetails = order.sign_type === 'eSignature' ? {
                name: order.signatureName || null,
                image: signatureImage
            } : order.signatureId ? {
                id: order.signatureId._id,
                name: order.signatureId.signatureName || null
            } : null;

            return {
                id: order._id,
                purchaseOrderId: order.purchaseOrderId,
                vendor: vendorDetails,
                purchaseOrderDate: formatDate(order.purchaseOrderDate),
                dueDate: formatDate(order.dueDate),
                referenceNo: order.referenceNo,
                status: order.status,
                paymentMode: order.paymentMode,
                taxableAmount: order.taxableAmount,
                totalDiscount: order.totalDiscount,
                vat: order.vat,
                TotalAmount: order.TotalAmount,
                itemsCount: order.items.length,
                billFrom: order.billFrom,
                billTo: billToDetails,
                notes: order.notes,
                sign_type: order.sign_type,
                signature: signatureDetails,
                bank: bankDetails,
                convert_type: order.convert_type,
                createdAt: formatDate(order.createdAt),
                updatedAt: formatDate(order.updatedAt)
            };
        }));

        res.status(200).json({
            success: true,
            message: 'Purchase orders retrieved successfully',
            data: {
                purchaseOrders: formattedOrders,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit)
                }
            }
        });

    } catch (err) {
        console.error('List purchase orders error:', err);
        res.status(500).json({
            message: 'Error fetching purchase orders',
            error: err.message
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
        .populate({
            path: 'bank',
            model: 'BankDetail',
            select: 'bankName accountNumber IFSCCode accountHoldername branchName'
        })
        // .populate('items.productId', 'product_name product_code price stock image_url')
        // .populate('items.unit', 'unit_name');

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
            discountType: item.discountType,
            isRateFormUpdated: item.isRateFormUpdated,
            form_updated_discounttype: item.form_updated_discounttype,
            form_updated_discount: item.form_updated_discount,
            form_updated_rate: item.form_updated_rate,
            form_updated_tax: item.form_updated_tax
        }));

        // Format signature based on sign_type
        const baseUrl = `${req.protocol}://${req.get('host')}/`;
        let signature = null;

        if (purchaseOrder.sign_type === 'manualSignature') {
            signature = {
                name: purchaseOrder.signatureName,
                image: purchaseOrder.signatureImage 
                    ? `${baseUrl}${purchaseOrder.signatureImage.replace(/\\/g, '/')}`
                    : null
            };
        } else if (purchaseOrder.sign_type === 'digitalSignature' && purchaseOrder.signatureId) {
            signature = {
                id: purchaseOrder.signatureId._id,
                name: purchaseOrder.signatureId.signatureName,
                image: purchaseOrder.signatureId.signatureImage 
                    ? `${baseUrl}${purchaseOrder.signatureId.signatureImage.replace(/\\/g, '/')}`
                    : null
            };
        }

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
            items: purchaseOrder.items ?? [],
            billFrom: purchaseOrder.billFrom,
            billTo: purchaseOrder.billTo,
            notes: purchaseOrder.notes,
            termsAndCondition: purchaseOrder.termsAndCondition,
            sign_type: purchaseOrder.sign_type,
            signature: signature,
            bank: purchaseOrder.bank ? {
                id: purchaseOrder.bank._id,
                bankName: purchaseOrder.bank.bankName,
                accountNumber: purchaseOrder.bank.accountNumber,
                accountHolderName: purchaseOrder.bank.accountHoldername,
                branchName: purchaseOrder.bank.branchName,
                ifscCode: purchaseOrder.bank.IFSCCode
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
            error: err.message
        });
    }
};

const updatePurchaseOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            vendorId,
            orderDate,
            dueDate,
            referenceNo,
            items,
            status,
            paymentMode,
            notes,
            termsAndCondition,
            sign_type,
            signatureId,
            signatureName,
            userId,
            billFrom,
            billTo,
            convert_type
        } = req.body;

        // Validate purchase order exists
        const existingOrder = await PurchaseOrder.findById(id);
        if (!existingOrder) {
            return res.status(404).json({ message: 'Purchase order not found' });
        }

        // Validate requesting user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(422).json({ message: 'Invalid user ID' });
        }

        // Get bill from and bill to user addresses if provided
        if (billFrom || billTo) {
            const billFromUser = billFrom ? await User.findById(billFrom) : null;
            const billToUser = billTo ? await User.findById(billTo) : null;
            
            if ((billFrom && !billFromUser) || (billTo && !billToUser)) {
                return res.status(422).json({ message: 'Invalid bill from or bill to user ID' });
            }

            // Validate at least one address exists if updating both
            if (billFrom && billTo && !billFromUser.address && !billToUser.address) {
                return res.status(400).json({ message: 'Both bill from and bill to addresses are missing' });
            }
        }

        // Validate products in items if provided
        if (items && Array.isArray(items)) {
            for (const item of items) {
                const product = await Product.findById(item.id);
                if (!product) {
                    return res.status(422).json({ message: `Invalid product ID: ${item.id}` });
                }
            }
        }

        // Validate signature type if provided
        if (sign_type) {
            const validSignatureTypes = ['none', 'digitalSignature', 'eSignature'];
            if (!validSignatureTypes.includes(sign_type)) {
                return res.status(400).json({ message: 'Invalid signature type' });
            }
        }

        // Validate signature data if eSignature is selected
        if (sign_type === 'eSignature') {
            if (!req.file && !existingOrder.signatureImage) {
                return res.status(400).json({ message: 'Signature image is required for eSignature' });
            }
            if (!signatureName && !existingOrder.signatureName) {
                return res.status(400).json({ message: 'Signature name is required for eSignature' });
            }
        }

        // Calculate amounts if items are updated
        let taxableAmount = existingOrder.taxableAmount;
        let totalDiscount = existingOrder.totalDiscount;
        let vat = existingOrder.vat;
        let totalAmount = existingOrder.TotalAmount;

        if (items && Array.isArray(items)) {
            taxableAmount = 0;
            totalDiscount = 0;
            vat = 0;
            totalAmount = 0;

            items.forEach(item => {
                const itemAmount = item.amount || (item.qty * (item.rate || 0));
                const itemDiscount = item.discount || 0;
                const itemTax = item.tax || 0;
                
                taxableAmount += itemAmount;
                totalDiscount += itemDiscount;
                vat += itemTax;
                totalAmount += itemAmount;
            });
        }

        // Prepare update object
        const updateData = {
            vendorId: vendorId || existingOrder.vendorId,
            purchaseOrderDate: orderDate ? new Date(orderDate) : existingOrder.purchaseOrderDate,
            dueDate: dueDate ? new Date(dueDate) : existingOrder.dueDate,
            referenceNo: referenceNo || existingOrder.referenceNo,
            items: items ? items.map(item => ({
                id: item.id,
                name: item.name,
                unit: item.unit,
                qty: item.qty,
                rate: item.rate,
                discount: item.discount,
                tax: item.tax,
                tax_group_id: item.tax_group_id,
                discount_type: item.discount_type,
                discount_value: item.discount_value,
                amount: item.amount
            })) : existingOrder.items,
            status: status || existingOrder.status,
            paymentMode: paymentMode || existingOrder.paymentMode,
            taxableAmount: taxableAmount,
            totalDiscount: totalDiscount,
            vat: vat,
            TotalAmount: totalAmount,
            bank: req.body.bank || existingOrder.bank,
            notes: notes || existingOrder.notes,
            termsAndCondition: termsAndCondition || existingOrder.termsAndCondition,
            sign_type: sign_type || existingOrder.sign_type,
            signatureId: signatureId || existingOrder.signatureId,
            signatureImage: sign_type === 'eSignature' ? (req.file?.path || existingOrder.signatureImage) : null,
            signatureName: sign_type === 'eSignature' ? (signatureName || existingOrder.signatureName) : null,
            userId: userId || existingOrder.userId,
            billFrom: billFrom || existingOrder.billFrom,
            billTo: billTo || existingOrder.billTo,
            convert_type: convert_type || existingOrder.convert_type
        };

        // If changing to none, clear all signature fields
        if (sign_type === 'none') {
            updateData.signatureName = null;
            updateData.signatureImage = null;
            updateData.signatureId = null;
        }

        const updatedOrder = await PurchaseOrder.findByIdAndUpdate(id, updateData, { new: true });

        res.status(200).json({ 
            message: 'Purchase order updated successfully', 
            data: {
                purchaseOrder: {
                    id: updatedOrder._id,
                    purchaseOrderId: updatedOrder.purchaseOrderId,
                    purchaseOrderDate: updatedOrder.purchaseOrderDate,
                    dueDate: updatedOrder.dueDate,
                    status: updatedOrder.status,
                    TotalAmount: updatedOrder.TotalAmount,
                    billFrom: updatedOrder.billFrom,
                    billTo: updatedOrder.billTo,
                    sign_type: updatedOrder.sign_type,
                    signatureName: updatedOrder.signatureName,
                    items: updatedOrder.items.map(item => ({
                        id: item.id,
                        name: item.name,
                        unit: item.unit,
                        qty: item.qty,
                        rate: item.rate,
                        discount: item.discount,
                        tax: item.tax,
                        tax_group_id: item.tax_group_id,
                        discount_type: item.discount_type,
                        discount_value: item.discount_value,
                        amount: item.amount
                    }))
                }
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ 
            message: 'Error updating purchase order',
            error: err.message
        });
    }
};

// Delete purchase order (soft delete)
const deletePurchaseOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user; // Assuming user ID is available in req.user

        // Validate ID format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid purchase order ID format',
                error: 'INVALID_ID_FORMAT'
            });
        }

        // Check if purchase order exists, belongs to user, and isn't deleted
        const purchaseOrder = await PurchaseOrder.findOne({ 
            _id: id,
            userId: userId, // Ensure the PO belongs to the requesting user
            isDeleted: false 
        });

        if (!purchaseOrder) {
            return res.status(404).json({
                success: false,
                message: 'Purchase order not found or already deleted',
                error: 'PO_NOT_FOUND'
            });
        }

        // Additional validation - check if PO can be deleted based on status
        if (purchaseOrder.status === 'COMPLETED' || purchaseOrder.status === 'PAID') {
            return res.status(403).json({
                success: false,
                message: 'Cannot delete a completed or paid purchase order',
                error: 'INVALID_PO_STATUS'
            });
        }

        // Soft delete with additional audit info
        const deletedPO = await PurchaseOrder.findByIdAndUpdate(
            id,
            { 
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: userId
            },
            { new: true }
        );

        if (!deletedPO) {
            return res.status(404).json({
                success: false,
                message: 'Purchase order not found after deletion attempt',
                error: 'DELETE_FAILED'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Purchase order deleted successfully',
            data: {
                id: deletedPO._id,
                purchaseOrderId: deletedPO.purchaseOrderId,
                deletedAt: deletedPO.deletedAt
            }
        });

    } catch (err) {
        console.error('Delete purchase order error:', err);
        
        // Handle specific mongoose errors
        if (err.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid purchase order ID',
                error: 'INVALID_ID'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error deleting purchase order',
            error: process.env.NODE_ENV === 'development' ? err.message : 'INTERNAL_SERVER_ERROR',
            errorCode: 'SERVER_ERROR'
        });
    }
};
const getAllTaxGroupsDetails = async (req, res) => {
    try {
        const { search } = req.query;
        
        // Build the query
        const query = {};
        if (search) {
            query.$or = [
                { tax_name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Fetch all tax groups with populated tax rates
        const taxGroups = await TaxGroup.find(query)
            .populate({
                path: 'tax_rate_ids',
                select: 'tax_name tax_rate status createdAt updatedAt'
            })
            .sort({ createdAt: -1 });

        // Format response with detailed tax rate information
        const result = taxGroups.map(taxGroup => {
            const totalTaxRate = taxGroup.tax_rate_ids.reduce(
                (sum, rate) => sum + (rate.tax_rate || 0), 0
            );

            return {
                _id: taxGroup._id,
                tax_name: taxGroup.tax_name,
                status: taxGroup.status,
                created_on: taxGroup.created_on,
                createdAt: taxGroup.createdAt,
                updatedAt: taxGroup.updatedAt,
                total_tax_rate: totalTaxRate,
                tax_rates: taxGroup.tax_rate_ids.map(rate => ({
                    _id: rate._id,
                    tax_name: rate.tax_name,
                    tax_rate: rate.tax_rate,
                    status: rate.status,
                    createdAt: rate.createdAt,
                    updatedAt: rate.updatedAt
                }))
            };
        });

        res.status(200).json({
            success: true,
            data: result,
            count: result.length
        });
    } catch (err) {
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch tax groups', 
            error: err.message 
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
    deletePurchaseOrder,
    getAllTaxGroupsDetails
};