# E-Commerce Sales Prediction Backend

This project is the backend for an e-commerce platform that includes features for managing products, orders, customer data, and sales predictions. It leverages machine learning to forecast future sales and provides APIs for various functionalities.

## Features

- **Product Management**: CRUD operations for products and their variants.
- **Order Management**: Create, update, and manage orders, including support for discounts and cancellations.
- **Customer Management**: Track customer acquisition and churn metrics.
- **Cart Management**: Add, update, and remove items from the shopping cart.
- **Sales Prediction**: Use GRU-based neural networks to forecast future sales.
- **Data Aggregation**: Aggregate daily and monthly sales data for analytics and model training.

## Project Structure

- **`db/`**: Database connection and utility functions.
  - `db.js`: Database connection setup.
  - `salesData.js`: Functions for fetching and normalizing sales data.

- **`models/`**: Business logic for interacting with the database.
  - `product.js`: Handles product and variant operations.
  - `order.js`: Manages orders and related operations.
  - `cart.js`: Handles shopping cart operations.
  - `customerAcquisition.js`: Tracks customer acquisition and churn metrics.
  - `predictionModel.js`: Implements machine learning models for sales prediction.

- **`routes/`**: API endpoints for various functionalities.
  - `salesRoutes.js`: Endpoints for managing sales records and historical data.
  - `predictionRoutes.js`: Endpoints for training and using sales prediction models.
  - Other route files for products, orders, users, etc.

- **`scripts/`**: Scripts for scheduled tasks.
  - `generateDailySalesRecords.js`: Generates daily sales records from completed orders.
  - `aggregateMonthlyData.js`: Aggregates monthly sales data and triggers model training.

- **`saved_models/`**: Directory for storing trained machine learning models.

- **`server.js`**: Main entry point for the backend server.

## Setup

### Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- Cloudinary account (for image management)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd e-commerce-sales-prediction-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   DATABASE_URL=<your-database-url>
   CLOUDINARY_URL=<your-cloudinary-url>
   ```

4. Run database migrations (if applicable).

### Running the Server

Start the development server:
```bash
npm start
```

The server will run on `http://localhost:3000` by default.

## API Endpoints

### Products
- `GET /api/product`: Fetch all products.
- `POST /api/product`: Create a new product.
- `PUT /api/product/:id`: Update a product.
- `DELETE /api/product/:id`: Delete a product.

### Orders
- `POST /api/orders`: Create a new order.
- `GET /api/orders/:id`: Fetch order details.
- `PUT /api/orders/:id/status`: Update order status.

### Sales
- `GET /api/sales/records`: Fetch all sales records.
- `POST /api/sales/generate-records`: Manually trigger sales record generation.

### Predictions
- `POST /api/predictions/train`: Train a new sales prediction model.
- `GET /api/predictions/sales`: Predict future sales.

## Machine Learning

The project uses `brain.js` for training GRU-based neural networks to forecast sales. Models are saved in the `saved_models/` directory and can be reused for predictions.

### Training a Model
Use the `/api/predictions/train` endpoint to train a new model. Parameters such as `iterations` and `error_threshold` can be customized.

### Forecasting Sales
Use the `/api/predictions/sales` endpoint to forecast sales for a specified number of months ahead.

## Scheduled Tasks

- **Daily Sales Records**: The `generateDailySalesRecords.js` script generates sales records from completed orders.
- **Monthly Data Aggregation**: The `aggregateMonthlyData.js` script aggregates sales data at the end of each month and triggers model training.

## Frontend Repository

The frontend for this project is available at:  
[https://github.com/batdimoiprint/e-commerce-sales-prediction-frontend](https://github.com/batdimoiprint/e-commerce-sales-prediction-frontend)

## Contributing

1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Submit a pull request with a detailed description of your changes.

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

