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
const SignatureController = require('../controllers/SignatureController');
const BankDetailController = require('@controllers/bankDetailController');
const CompanySettings = require('@controllers/CompanySettingsController');
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
const purchaseOrderValidator = require('../validators/Admin/Purchases/purchaseOrderValidator');
const {createSignatureValidator, updateSignatureValidator} = require('../validators/signatureValidator');
const { createBankDetailValidator, updateBankDetailValidator, updateBankDetailStatusValidator } = require('@validators/bankDetailValidator');
const { updateCompanySettingsValidator } = require('@validators/companySettingsValidator');

router.get('/', protect, adminController.dashboard);
router.get('/countries', protect, adminController.getCountries);
router.get('/states/:countryId', protect, adminController.getStates);
router.get('/cities/:stateId', protect, adminController.getCities);
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
router.post(
  '/products',
  protect,
  uploadProductFields,
  createProductValidator,
  ProductController.createProduct
);
router.get('/products', protect, ProductController.getAllProducts);
router.get('/products/:id', protect, ProductController.getProductById);
router.put(
  '/products/:id',
  protect,
  uploadProductFields,
  updateProductValidator,
  ProductController.updateProduct
);
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

//purchaseOrder
router.post('/purchase-order', protect, upload.single('signatureImage'), purchaseOrderValidator, purchaseOrderController.createPurchaseOrder);
router.get('/user/type/:type', protect, purchaseOrderController.listUsersByType);
router.get('/user/:id', protect, purchaseOrderController.getUserById);
router.get('/productsrecent', protect, purchaseOrderController.getRecentProductsWithSearch);
//signature
router.post('/signatures', protect, upload.single('signatureImage'), createSignatureValidator, SignatureController.createSignature);
router.get('/signatures', protect, SignatureController.getUserSignatures);
router.put('/signatures/:signatureId', protect, upload.single('signatureImage'), updateSignatureValidator, SignatureController.updateSignature);
router.delete('/signatures/:signatureId', protect, SignatureController.deleteSignature);
router.patch('/signatures/set-default/:signatureId', protect, SignatureController.setAsDefaultSignature);
router.patch('/signatures/status/:signatureId', protect, SignatureController.updateSignatureStatus);
//bankDetails
router.post('/bank-accounts', protect, createBankDetailValidator, BankDetailController.createBankDetail);
router.get('/bank-accounts', protect, BankDetailController.listBankDetails);
router.put('/bank-accounts/:id', protect, updateBankDetailValidator, BankDetailController.updateBankDetail);
router.delete('/bank-accounts/:id', protect, BankDetailController.deleteBankDetail);
router.patch('/bank-accounts/status/:id', updateBankDetailStatusValidator, BankDetailController.updateBankDetailStatus);
//companySetting
// Get company settings
router.get('/company-details/:userId', CompanySettings.getCompanySettings);

// Update company settings (will create if doesn't exist)
router.put('/company-details/:userId', updateCompanySettingsValidator, CompanySettings.updateCompanySettings);

module.exports = router;