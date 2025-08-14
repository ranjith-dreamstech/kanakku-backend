const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const UnitsController = require('../controllers/UnitsController');
const BrandsController = require('../controllers/BrandsController');
const CategoryController = require('../controllers/CategoryController');
const TaxRateController = require('../controllers/TaxRateController');
const TaxGroupController = require('../controllers/TaxGroupController');
const ProductController = require('../controllers/ProductController');
const SupplierController = require('@controllers/Admin/Purchases/SupplierController');
const purchaseOrderController = require('@controllers/Admin/Purchases/purchaseOrderController');
const debitNoteController = require('@controllers/Admin/Purchases/debitNoteController');
const purchaseController = require('@controllers/Admin/Purchases/purchaseController');
const supplierPaymentController = require('@controllers/Admin/Purchases/supplierPaymentController');
const SignatureController = require('../controllers/SignatureController');
const currencyController = require('../controllers/currencyController');
const BankDetailController = require('@controllers/bankDetailController');
const CompanySettings = require('@controllers/CompanySettingsController');
const { uploadCompanyFields, handleUploadError } = require('../middleware/uploadCompanyImages');
const protect = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');
const { uploadSingle, uploadMultiple, uploadProductFields } = require('../middleware/uploadProductImages');
const { createUnitValidator, updateUnitValidator } = require('../validators/unitsValidator');
const { createBrandValidator, updateBrandValidator } = require('../validators/brandValidator');
const { createCategoryValidator, updateCategoryValidator } = require('../validators/categoryValidator');
const { createTaxRateValidator, updateTaxRateValidator } = require('../validators/taxRateValidator');
const { createTaxGroupValidator, updateTaxGroupValidator } = require('../validators/taxGroupValidator');
const { createProductValidator, updateProductValidator } = require('../validators/productValidator');
const { updateProfileValidator } = require('../validators/updateProfileValidator');
const { createSupplierValidator } = require('../validators/Admin/Purchases/SupplierVaidator');
const { purchaseOrderValidator, updatePurchaseOrderValidator } = require('../validators/Admin/Purchases/purchaseOrderValidator');
const {supplierPaymentValidator } = require('../validators/Admin/Purchases/supplierPaymentValidator');
const  {purchaseValidator } = require('../validators/Admin/Purchases/purchaseValidator');
const  {debitNoteValidator } = require('../validators/Admin/Purchases/debitNoteValidator');
const {createSignatureValidator, updateSignatureValidator} = require('../validators/signatureValidator');
const {createCurrencyValidator} = require('../validators/currencyValidator');
const { createBankDetailValidator, updateBankDetailValidator, updateBankDetailStatusValidator } = require('@validators/bankDetailValidator');
const { updateCompanySettingsValidator } = require('@validators/companySettingsValidator');
const { createCustomerValidator } = require('@validators/customerValidator');
const customerController = require('@controllers/customerController');
const localizationController = require('@controllers/localizationController');
const multer = require('multer');
const quotationController = require('@controllers/Admin/Invoice/quotationController');
const  { quotationValidator , updateQuotationValidator } = require('../validators/Admin/Invoice/quotationValidator');
const invoiceTemplateController = require('@controllers/invoiceTemplateController');
const { createInvoiceValidator } = require('../validators/Admin/Invoice/invoiceValidator');
const invoiceController = require('@controllers/Admin/Invoice/invoiceController');
const emailSettingsController = require('@controllers/emailSettingsController');
const emailTeamplateController = require('@controllers/emailTeamplateController');

router.get('/', protect, adminController.dashboard);
router.get('/countries', protect, adminController.getCountries);
router.get('/states/:countryId', protect, adminController.getStates);
router.get('/cities/:stateId', protect, adminController.getCities);
router.get('/country/:id', protect, adminController.getCountryById);
router.get('/state/:id', protect, adminController.getStateById);
router.get('/city/:id', protect, adminController.getCityById);
router.get('/profile', protect, adminController.getProfile);
router.put('/profile', protect, upload.single('profileImage'), updateProfileValidator, adminController.updateProfile);

//Unit routes
router.get('/units', protect, UnitsController.getUnits);
router.post('/units', protect,createUnitValidator, UnitsController.createUnit);
router.get('/units/:id', protect, UnitsController.getUnitById);
router.put('/units/:id', protect, updateUnitValidator, UnitsController.updateUnit);
router.delete('/units/:id', protect, UnitsController.deleteUnit);

//Brand routes
router.get('/brands', protect, BrandsController.getAllBrands);
router.post('/brands', protect, upload.single('brand_image'), createBrandValidator, BrandsController.createBrand);
router.get('/brands/:id', protect, BrandsController.getBrandById);
router.put('/brands/:id', protect, upload.single('brand_image'), updateBrandValidator, BrandsController.updateBrand);
router.delete('/brands/:id', protect, BrandsController.deleteBrand);

//Category routes
router.get('/categories', protect, CategoryController.getAllCategories);
router.post('/categories', protect, upload.single('category_image'), createCategoryValidator, CategoryController.createCategory);
router.get('/categories/:id', protect, CategoryController.getCategoryById);
router.put('/categories/:id', protect, upload.single('category_image'), updateCategoryValidator, CategoryController.updateCategory);
router.delete('/categories/:id', protect, CategoryController.deleteCategory);

// Tax Rate routes
router.get('/tax-rates', protect, TaxRateController.getAllTaxRates);
router.post('/tax-rates', protect, createTaxRateValidator, TaxRateController.createTaxRate);
router.get('/tax-rates/:id', protect, TaxRateController.getTaxRateById);
router.put('/tax-rates/:id', protect, updateTaxRateValidator, TaxRateController.updateTaxRate);
router.delete('/tax-rates/:id', protect, TaxRateController.deleteTaxRate);

//Tax Group routes
router.get('/tax-groups', protect, TaxGroupController.getAllTaxGroups);
router.post('/tax-groups', protect, createTaxGroupValidator, TaxGroupController.createTaxGroup);
router.get('/tax-groups/:id', protect, TaxGroupController.getTaxGroupById);
router.put('/tax-groups/:id', protect, updateTaxGroupValidator, TaxGroupController.updateTaxGroup);
router.delete('/tax-groups/:id', protect, TaxGroupController.deleteTaxGroup);

//Product Routes
router.post('/products', protect, uploadProductFields, handleUploadError, createProductValidator, ProductController.createProduct);
router.get('/products', protect, ProductController.getAllProducts);
router.get('/products/:id', protect, ProductController.getProductById);
router.put('/products/:id', protect, uploadProductFields, updateProductValidator, ProductController.updateProduct);
router.delete('/products/:id', protect, ProductController.deleteProduct);
router.get('/product-categories', protect, ProductController.getAllProductCategories);
router.get('/product-brands', protect, ProductController.getAllProductBrands);
router.get('/product-units', protect, ProductController.getAllUnits);
router.get('/product-taxes', protect, ProductController.getAllTaxGroups);

//suppliers routes
router.post('/suppliers', protect, upload.single('profileImage'), createSupplierValidator, SupplierController.createSupplier);
router.get('/suppliers', protect, SupplierController.listSuppliers);
router.put('/suppliers/:id', protect, upload.single('profileImage'), SupplierController.updateSupplier);
router.delete('/suppliers/:id', protect, SupplierController.deleteSupplier);
//debitnote
router.post('/debitnote', protect, upload.single('signatureImage'), debitNoteValidator, debitNoteController.createDebitNote);
router.get('/debitnote', protect, debitNoteController.getAllDebitNotes);
router.put('/debitnote', protect, upload.single('signatureImage'), debitNoteController.createDebitNote);
router.get('/debitnote/:id', protect,  debitNoteController.getDebitNoteById);
router.delete('/debitnote/:id', protect, debitNoteController.deleteDebitNote);

//supplierpayment
router.post('/supplierpayments', protect, upload.single('attachment'), supplierPaymentValidator, supplierPaymentController.createSupplierPayment);
router.get('/supplierpayments', protect, supplierPaymentController.listSupplierPayments);
router.put('/supplierpayments/:id', protect, upload.single('attachment'), supplierPaymentController.updateSupplierPayment);
router.delete('/supplierpayments/:id', protect, supplierPaymentController.deleteSupplierPayment);

//purchase
router.post('/purchases', protect, upload.single('signatureImage'), purchaseValidator, purchaseController.createPurchase);
router.get('/purchases', protect, purchaseController.getAllPurchases);
router.get('/purchases/:id', protect, purchaseController.getPurchaseById);
router.delete('/purchases/:id', protect, purchaseController.deletePurchase);
router.get('/purchases-minimal', protect, purchaseController.listPurchasesMinimal);
router.get('/purchases-pending', protect, purchaseController.listPurchasesPending);

//purchaseOrder
router.post('/purchase-order', protect, upload.single('signatureImage'), purchaseOrderValidator, purchaseOrderController.createPurchaseOrder);
router.get('/purchase-orders', protect, purchaseOrderController.listPurchaseOrders);
router.get('/purchase-orders/:id', protect, purchaseOrderController.getPurchaseOrderById);
router.put('/purchase-orders/:id', protect, upload.single('signatureImage'), updatePurchaseOrderValidator, purchaseOrderController.updatePurchaseOrder);
router.delete('/purchase-orders/:id', protect, purchaseOrderController.deletePurchaseOrder);
router.get('/purchase-minimal', protect, purchaseOrderController.listPurchaseOrdersMinimal);

// Helper routes for purchase order creation
router.get('/user/type/:type', protect, purchaseOrderController.listUsersByType);
router.get('/user/:id', protect, purchaseOrderController.getUserById);
router.get('/productsrecent', protect, purchaseOrderController.getRecentProductsWithSearch);
router.get('/bankdetailsrecent', protect, purchaseOrderController.listBankDetails);
router.get('/signaturesrecent', protect, purchaseOrderController.getUserSignatures);
router.get('/tax-group-details', protect, purchaseOrderController.getAllTaxGroupsDetails);
//signature
router.post('/signatures', protect, upload.single('signatureImage'), createSignatureValidator, SignatureController.createSignature);
router.get('/signatures', protect, SignatureController.getUserSignatures);
router.put('/signatures/:signatureId', protect, upload.single('signatureImage'), updateSignatureValidator, SignatureController.updateSignature);
router.delete('/signatures/:signatureId', protect, SignatureController.deleteSignature);
router.patch('/signatures/set-default/:signatureId', protect, SignatureController.setAsDefaultSignature);
router.patch('/signatures/status/:signatureId', protect, SignatureController.updateSignatureStatus);
router.post('/paymentmode', protect, SignatureController.createPaymentMode);
router.get('/paymentmode', protect, SignatureController.listPaymentModes);

//currency
router.post('/currency', protect, createCurrencyValidator, currencyController.createCurrency);
router.get('/currency', protect, currencyController.getAllCurrencies);
router.put('/currency/:id', protect, currencyController.updateCurrency);
router.delete('/currency/:id', protect, currencyController.deleteCurrency);
router.patch('/currency/:id', protect, currencyController.updateCurrencyStatus);

//bankDetails
router.post('/bank-accounts', protect, createBankDetailValidator, BankDetailController.createBankDetail);
router.get('/bank-accounts', protect, BankDetailController.listBankDetails);
router.put('/bank-accounts/:id', protect, updateBankDetailValidator, BankDetailController.updateBankDetail);
router.delete('/bank-accounts/:id', protect, BankDetailController.deleteBankDetail);
router.patch('/bank-accounts/status/:id', updateBankDetailStatusValidator, BankDetailController.updateBankDetailStatus);
//company
router.put('/company-details/:userId', protect, uploadCompanyFields, handleUploadError, updateCompanySettingsValidator, CompanySettings.updateCompanySettings);
router.get('/company-details/:userId', protect, CompanySettings.getCompanySettings);
//customer
router.post('/customers', protect, upload.single('image'), createCustomerValidator, customerController.createCustomer);
router.put('/customers/:id', protect, upload.single('image'), customerController.updateCustomer);
router.get('/customers', protect, customerController.getCustomers);
router.get('/customers/:id', protect, customerController.getCustomerById);
router.delete('/customers/:id', protect, customerController.deleteCustomer);
//localization
router.get('/localization', protect, localizationController.getDropdownOptions);
router.post('/localizations', protect , localizationController.saveLocalization);
router.get('/localizations', protect, localizationController.getLocalization);
//Quotation
router.post('/quotations', protect, upload.single('signatureImage'), quotationValidator, quotationController.createQuotation);
router.get('/quotations', protect, quotationController.listQuotations);
router.get('/quotations/:id', protect, quotationController.getQuotationById);
router.put('/quotations/:id', protect, upload.single('signatureImage'), updateQuotationValidator, quotationController.updateQuotation);
router.delete('/quotations/:id', protect, quotationController.deleteQuotation);
router.get('/quotations', protect, quotationController.listQuotations);
router.get('/customers-all', protect, quotationController.getAllCustomers);
router.get('/quotations-minimal', protect, quotationController.getAllCustomers);
//invoicetemplate
router.post('/invoice-template', protect, invoiceTemplateController.createOrUpdateTemplate);
router.get('/invoice-templates', protect, invoiceTemplateController.getAllTemplates);
//Invoice
router.post('/invoices', protect, upload.single('signatureImage'), createInvoiceValidator, invoiceController.createInvoice);
router.get('/invoices', protect, invoiceController.getAllInvoices);
router.get('/invoices/:id', protect, invoiceController.getInvoice);
router.put('/invoices/:id', protect, upload.single('signatureImage'), invoiceController.updateInvoice);
router.delete('/invoices/:id', protect, invoiceController.deleteInvoice);
router.post('/quotation-convert-to-invoice/:quotationId', protect, upload.single('signatureImage'), invoiceController.convertQuotationToInvoice);
router.post('/invoice/payment', protect, invoiceController.recordInvoicePayment);

//Email Settings
router.post("/email-settings", protect, emailSettingsController.createOrUpdateEmailSettings);
router.get("/email-settings", protect, emailSettingsController.getEmailSettings);

//Email Template
router.post("/email-template", protect, emailTeamplateController.createEmailTemplate);
router.get("/email-template", protect, emailTeamplateController.listEmailTemplates);
router.put("/email-template/:id", protect, emailTeamplateController.updateEmailTemplate);
router.delete("/email-template/:id", protect, emailTeamplateController.deleteEmailTemplate);

module.exports = router;