const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion } = require('mongodb');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.a6tztk3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect to MongoDB
    // await client.connect();
    const db = client.db("bhojon-server");
    const usersCollection = db.collection("users");
    const productsCollection = db.collection("products");
    const categoriesCollection = db.collection("categories");
    const bookingsCollection = db.collection("bookings");
    // ✅ Register Route
    app.post("/api/register", async (req, res) => {
      try {
        const userData = req.body;

        // Check if user already exists
        const existingUser = await usersCollection.findOne({ email: userData.email });
        if (existingUser) {
          return res.status(400).json({ message: "User already exists" });
        }

        // Insert new user
        const result = await usersCollection.insertOne(userData);
        res.status(201).json({ message: "User registered successfully", userId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
      }
    });


    // Get all products
    app.get("/api/products", async (req, res) => {
      const products = await productsCollection.find().toArray();
      res.json(products);
    });

    // Get all categories
    app.get("/api/categories", async (req, res) => {
      const categories = await categoriesCollection.find().toArray();
      res.json(categories);
    });

    // GET all bookings
    app.get("/api/bookings", async (req, res) => {
      try {
        const bookings = await bookingsCollection.find({}).toArray();
        res.status(200).json({ success: true, bookings });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
      }
    });
    app.post("/api/bookings", async (req, res) => {
      try {
        const bookingData = req.body;

        if (!bookingData.items || bookingData.items.length === 0) {
          return res.status(400).json({ success: false, message: "Cart is empty" });
        }
        const result = await bookingsCollection.insertOne({
          ...bookingData,
          status: "pending",
          createdAt: new Date(),
        });

        res.status(201).json({ success: true, message: "Booking created", bookingId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
      }
    });
    // Test ping
    // await client.db("admin").command({ ping: 1 });
    console.log("✅ Pinged your deployment. MongoDB Connected Successfully!");
  } catch (err) {
    console.error("DB Connection Error:", err.message);
  }
}

run().catch(console.dir);

// Sample route
app.get('/', (req, res) => {
  res.send('System Server is running');
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
