const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const { uploadImage, deleteImage } = require('../utils/cloudinary');
const multer = require('multer');
const db = require('../db/db'); // Moved up for broader access

// Configure multer for file handling with dynamic field support
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { files: 50, fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Allow mainImage and any variantImage_<index>
    if (file.fieldname === 'mainImage' || /^variantImage_\d+$/.test(file.fieldname)) {
      return cb(null, true);
    }
    // Silently skip unexpected file fields instead of erroring
    return cb(null, false);
  }
});

// Get inventory statistics (for admin dashboard)
router.get('/stats', async (req, res) => {
  try {
    // Query for total variants count (not products)
    const totalVariantsResult = await Product.getVariantCount();
    const totalProducts = totalVariantsResult.count;
    
    // Query for low stock variants (quantity <= 5)
    const lowStockResult = await Product.getCountByCondition('pv.quantity > 0 AND pv.quantity <= 5', true);
    const lowStockItems = lowStockResult.count;
    
    // Query for out of stock variants (based only on quantity)
    const outOfStockResult = await Product.getCountByCondition('pv.quantity = 0', true);
    const outOfStockItems = outOfStockResult.count;
    
    // Query for total inventory value
    const inventoryValueResult = await Product.getTotalInventoryValue();
    const totalInventoryValue = inventoryValueResult.value;
    
    res.json({
      totalProducts,
      lowStockItems,
      outOfStockItems,
      totalInventoryValue
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.findAll();
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search products
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      const products = await Product.findAll();
      return res.json(products);
    }
    const products = await Product.search(query);
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get products by variant search (moved before :id route)
router.get('/variant-search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ message: 'Query parameter is required' });
    }
    
    // Search for variants matching product name, variant name, or SKU
    const searchQuery = `%${query}%`;
    
    // Include product data alongside variant data for display
    const result = await db.query(`
      SELECT
        p.id AS product_id,
        p.product_name,
        p.brand,
        p.category,
        v.id AS variant_id,
        v.sku,
        v.variant_name,
        v.store_price,
        v.quantity,
        v.image_url
      FROM products p
      JOIN product_variants v ON v.product_ref = p.id
      WHERE 
        p.product_name ILIKE $1
        OR v.variant_name ILIKE $1
        OR v.sku ILIKE $1
      ORDER BY p.product_name, v.variant_name
    `, [searchQuery]);
    
    // Format the response for the AddOrderDialog component
    const formattedResults = result.rows.map(row => ({
      variant_id: row.variant_id,
      product_id: row.product_id,
      product_name: row.product_name,
      sku: row.sku,
      variant_name: row.variant_name || 'Default',
      store_price: row.store_price,
      quantity: row.quantity,
      image_url: row.image_url
    }));
    
    res.json(formattedResults);
  } catch (err) {
    console.error('Error in variant search:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.getCategories();
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get categories with their products
router.get('/category-products', async (req, res) => {
  try {
    const result = await Product.getCategoriesWithProducts();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get stock levels
router.get('/stock-levels', async (req, res) => {
  try {
    const result = await Product.getStockLevels();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get stock details for dashboard
router.get('/stock-details', async (req, res) => {
  try {
    // Query for low stock items (quantity > 0 AND quantity <= 5)
    const lowStockResult = await db.query(`
      SELECT DISTINCT ON (p.id)
        p.id,
        p.product_name,
        pv.variant_name,
        pv.quantity
      FROM products p
      JOIN product_variants pv ON p.id = pv.product_ref
      WHERE pv.quantity > 0 AND pv.quantity <= 5
      ORDER BY p.id, pv.quantity ASC
    `);

    // Query for out of stock items (quantity = 0)
    const outOfStockResult = await db.query(`
      SELECT DISTINCT ON (p.id)
        p.id,
        p.product_name,
        pv.variant_name,
        pv.quantity
      FROM products p
      JOIN product_variants pv ON p.id = pv.product_ref
      WHERE pv.quantity = 0
      ORDER BY p.id, pv.quantity ASC
    `);

    res.json({
      lowStock: lowStockResult.rows,
      outOfStock: outOfStockResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product by ID
router.get('/:id', async (req, res) => {
  try {
    // Check if id is valid before even attempting to find the product
    const productId = req.params.id;
    
    // Try to parse as integer
    const productIdNum = parseInt(productId, 10);
    if (isNaN(productIdNum)) {
      return res.status(400).json({ 
        message: `Invalid product ID format: "${productId}". ID must be a number.` 
      });
    }
    
    const product = await Product.findById(productIdNum);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // No need to fetch variants separately as they're now included in the product
    return res.json(product);
  } catch (err) {
    console.error(`Error fetching product: ${err.message}`);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// Create new product with image upload
router.post('/', upload.any(), async (req, res) => {
  try {
    // Index uploaded files by fieldname for easy access
    const filesByField = (req.files || []).reduce((acc, f) => {
      (acc[f.fieldname] ||= []).push(f);
      return acc;
    }, {});
    // Parse the productData JSON string
    let productData;
    
    if (req.body.productData) {
      productData = JSON.parse(req.body.productData);
    } else {
      // Fallback for direct JSON
      productData = req.body;
    }
    
    const {
      category,
      brand,
      product_name,
      variants = []
    } = productData;

    if (!category || !brand || !product_name) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Create the product without status
    const newProduct = await Product.create({
      category,
      brand,
      product_name
    });

    // Process the main uploaded image
    let mainImageUrl = null;
    if (filesByField.mainImage && filesByField.mainImage[0]) {
      // Get the uploaded file
      const imageFile = filesByField.mainImage[0];
      // Convert buffer to base64
      const base64Image = imageFile.buffer.toString('base64');
      const dataURI = `data:${imageFile.mimetype};base64,${base64Image}`;
      // Upload to Cloudinary
      mainImageUrl = await uploadImage(dataURI);
    }

    // Validate variants for duplicate SKUs
    if (variants && Array.isArray(variants) && variants.length > 0) {
      // Track SKUs within this submission to prevent duplicates within the same request
      const requestSkus = new Set();
      
      for (const variant of variants) {
        if (!variant.sku) {
          return res.status(400).json({ message: 'SKU is required for all variants' });
        }
        
        // Check for duplicates within this request
        if (requestSkus.has(variant.sku)) {
          return res.status(400).json({ message: `Duplicate SKU: ${variant.sku} appears multiple times in your request` });
        }
        
        // Check for duplicates in the database
        const isDuplicate = await Product.checkDuplicateSku(variant.sku);
        if (isDuplicate) {
          return res.status(400).json({ message: `SKU ${variant.sku} already exists in the database` });
        }
        
        requestSkus.add(variant.sku);
      }
    }

    // Process each variant
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      let variantImageUrl = null;
      
      // Check if this variant has an uploaded image file
      const variantImageFieldName = `variantImage_${i}`;
      if (variant.hasImage && filesByField[variantImageFieldName] && filesByField[variantImageFieldName][0]) {
        const variantImageFile = filesByField[variantImageFieldName][0];
        // Convert buffer to base64
        const base64Image = variantImageFile.buffer.toString('base64');
        const dataURI = `data:${variantImageFile.mimetype};base64,${base64Image}`;
        // Upload to Cloudinary
        variantImageUrl = await uploadImage(dataURI);
      } else if (variant.image_data_uri) {
        // Support for base64 image directly in JSON
        variantImageUrl = await uploadImage(variant.image_data_uri);
      }
      
      // If no specific variant image but we have a main image and this is the first variant,
      // use the main image for the first variant
      if (!variantImageUrl && mainImageUrl && i === 0) {
        variantImageUrl = mainImageUrl;
      }
      
      // Create the variant using the Product model's createVariant method
      await Product.createVariant({
        product_ref: newProduct.id,
        sku: variant.sku,
        variant_name: variant.variant_name,
        description: variant.description || null,
        store_price: variant.store_price,
        quantity: variant.quantity,
        image_url: variantImageUrl || variant.image_url || null
      });
    }
    
    // If no variants but we have a main image, create a default variant
    if (variants.length === 0 && mainImageUrl) {
      await Product.createVariant({
        product_ref: newProduct.id,
        sku: `${product_name.substring(0, 10)}-${newProduct.id}`,
        variant_name: 'Default',
        description: productData.description || null, // Move description to variant level
        store_price: productData.store_price || 0.00,
        quantity: productData.quantity || 0,
        image_url: mainImageUrl
      });
    }

    // Fetch the complete product with variants to return
    const productWithVariants = await Product.findById(newProduct.id);
    res.status(201).json(productWithVariants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update product with optional image update (accepts JSON payload)
router.put('/:id', upload.any(), async (req, res) => {
  try {
    // Index uploaded files by fieldname for easy access
    const filesByField = (req.files || []).reduce((acc, f) => {
      (acc[f.fieldname] ||= []).push(f);
      return acc;
    }, {});
    const productId = parseInt(req.params.id, 10);
    
    // Parse the productData JSON string if it exists
    let productData;
    
    if (req.body.productData) {
      productData = JSON.parse(req.body.productData);
    } else {
      // Fallback for direct JSON
      productData = req.body;
    }
    
    const {
      category,
      brand,
      product_name,
      variants = []
    } = productData;

    if (isNaN(productId)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }

    // Basic validation for required product fields
    if (!category || !brand || !product_name) {
      return res.status(400).json({ message: 'Missing required product fields (category, brand, product_name)' });
    }

    // Create an images object to store all uploaded image URLs
    const images = {};

    // Process the main uploaded image if provided
    if (filesByField.mainImage && filesByField.mainImage[0]) {
      const imageFile = filesByField.mainImage[0];
      const base64Image = imageFile.buffer.toString('base64');
      const dataURI = `data:${imageFile.mimetype};base64,${base64Image}`;
      images.mainImageUrl = await uploadImage(dataURI);
    } else if (productData.image_data_uri) { // Handle base64 image directly from JSON
      images.mainImageUrl = await uploadImage(productData.image_data_uri);
    }

    // Process variant images if variants are provided
    if (variants && Array.isArray(variants)) {
      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        const variantImageFieldName = `variantImage_${i}`;

        // Check for file upload
        if (filesByField[variantImageFieldName] && filesByField[variantImageFieldName][0]) {
          const variantImageFile = filesByField[variantImageFieldName][0];
          const base64Image = variantImageFile.buffer.toString('base64');
          const dataURI = `data:${variantImageFile.mimetype};base64,${base64Image}`;
          images[variantImageFieldName] = await uploadImage(dataURI);
        } 
        // Check for base64 data URI in JSON
        else if (variant.image_data_uri) {
          images[variantImageFieldName] = await uploadImage(variant.image_data_uri);
        }
      }
    }

    // Validate variants for duplicate SKUs
    if (variants && Array.isArray(variants) && variants.length > 0) {
      // Track SKUs within this submission to prevent duplicates within the same request
      const requestSkus = new Set();
      
      for (const variant of variants) {
        if (!variant.sku) {
          return res.status(400).json({ message: 'SKU is required for all variants' });
        }
        
        // Check for duplicates within this request
        if (requestSkus.has(variant.sku)) {
          return res.status(400).json({ message: `Duplicate SKU: ${variant.sku} appears multiple times in your request` });
        }
        
        // Check for duplicates in the database (excluding the current product's variants)
        const isDuplicate = await Product.checkDuplicateSku(variant.sku, productId);
        if (isDuplicate) {
          return res.status(400).json({ message: `SKU ${variant.sku} already exists in the database` });
        }
        
        requestSkus.add(variant.sku);
      }
    }

    // Use the updateWithVariants method to update both product and variants
    // Pass the processed image URLs in the `images` object
    const updatedProduct = await Product.updateWithVariants(
      productId,
      { category, brand, product_name },
      variants || [], // Ensure variants is an array
      images
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found or failed to update' });
    }

    res.json(updatedProduct);
  } catch (err) {
    console.error(err);
    // Check for specific database errors if needed
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// Delete product
router.delete('/:id', async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);
    
    if (isNaN(productId)) {
      return res.status(400).json({ message: 'Invalid product ID format' });
    }
    
    const deletedProduct = await Product.delete(productId);
    
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(deletedProduct);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// Delete variant image from Cloudinary and update database
router.delete('/variant-image/:variantId', async (req, res) => {
  try {
    const variantId = parseInt(req.params.variantId, 10);
    
    if (isNaN(variantId)) {
      return res.status(400).json({ message: 'Invalid variant ID format' });
    }
    
    // Get the current image URL from the variant
    const result = await db.query(
      'SELECT image_url FROM product_variants WHERE id = $1',
      [variantId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Variant not found' });
    }
    
    const imageUrl = result.rows[0].image_url;
    
    if (!imageUrl) {
      return res.status(400).json({ message: 'No image found for this variant' });
    }
    
    // Delete the image from Cloudinary
    const deleteResult = await deleteImage(imageUrl);
    
    // Update the database to remove the image reference
    await db.query(
      'UPDATE product_variants SET image_url = NULL WHERE id = $1',
      [variantId]
    );
    
    res.json({ 
      message: 'Image deleted successfully',
      cloudinaryResult: deleteResult,
      variantId
    });
  } catch (err) {
    console.error('Error deleting variant image:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

module.exports = router;