# AnalyzeUp - Inventory Management Platform

AnalyzeUp is a modern, AI-powered inventory management platform built with Next.js, Firebase, and Genkit. It provides tools for tracking stock, managing orders, and generating data-driven business insights.

## Features

- **Dashboard:** An at-a-glance overview of key inventory metrics, including total inventory value, sales, and low-stock items.
- **Inventory Management:** Add, edit, and delete products with details like stock levels, pricing, and images.
- **Order Tracking:** Create and manage purchase orders from suppliers.
- **Supplier Management:** Maintain a directory of your suppliers.
- **AI-Powered Insights:**
  - **Stock Advisor:** Get smart reorder recommendations based on sales velocity and supplier lead times.
  - **Strategy Generator:** Generate an AI-powered business growth strategy from your sales and product data.
- **Reporting & Visualization:** View and export detailed reports on sales, inventory, and transactions.

## Tech Stack

- **Framework:** Next.js (with App Router)
- **Authentication & Database:** Firebase (Authentication & Firestore)
- **Generative AI:** Google AI & Genkit
- **UI:** ShadCN UI, Tailwind CSS, Recharts
- **Styling:** Tailwind CSS

---

## Getting Started

Follow these steps to get the application running on your local machine.

### Prerequisites

- [Node.js](https://nodejs.org/en) (v20.x or later recommended)
- [npm](https://www.npmjs.com/) (usually comes with Node.js)

### 1. Set Up Environment Variables

You need a Google AI API key for the generative AI features to work.

1.  Create a new file named `.env.local` in the root of the project.
2.  Add your Google AI API key to this file:

    ```bash
    GOOGLE_API_KEY="YOUR_API_KEY_HERE"
    ```

    You can obtain an API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### 2. Install Dependencies

Open your terminal, navigate to the project directory, and run the following command to install all the required packages listed in `package.json`:

```bash
npm install
```

### 3. Run the Development Server

Once the dependencies are installed, you can start the local development server:

```bash
npm run dev
```

This will start the app on `http://localhost:9002`. You can now open this URL in your browser to see the application.

---

## Available Scripts

In the project directory, you can run:

- `npm run dev`: Starts the application in development mode with hot-reloading.
- `npm run build`: Creates an optimized production build of the app.
- `npm run start`: Starts the production server. You must run `npm run build` first.
- `npm run lint`: Lints the project files using Next.js's built-in ESLint configuration.
- `npm run typecheck`: Runs the TypeScript compiler to check for type errors.
