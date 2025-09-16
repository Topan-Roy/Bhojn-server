const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email }
      const result = await usersCollection.findOne(query);
      res.send(result)
    })
    // PUT - Update user profile
    app.put("/users/:id", async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;

      try {
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        if (result.modifiedCount > 0) {
          res.status(200).send({ success: true, message: "Profile updated successfully" });
        } else {
          res.status(404).send({ success: false, message: "No changes made or user not found" });
        }
      } catch (error) {
        res.status(500).send({ success: false, message: "Update failed", error });
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


    // Dashboard Stats API
    app.get("/api/admin/stats", async (req, res) => {
      try {
        const totalOrders = await bookingsCollection.estimatedDocumentCount();

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayOrders = await bookingsCollection.countDocuments({
          createdAt: { $gte: today },
        });

        const todaySales = await bookingsCollection.aggregate([
          { $match: { createdAt: { $gte: today } } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ]).toArray();

        const totalCustomers = await usersCollection.estimatedDocumentCount();

        // ✅ Completed Bookings count
        const completedOrders = await bookingsCollection.countDocuments({ status: "completed" });

        res.json({
          success: true,
          stats: {
            lifetimeOrders: totalOrders,
            todayOrders,
            todaySales: todaySales[0]?.total || 0,
            totalCustomers,
            completedOrders, 
          },
        });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
      }
    });


    // Latest Orders API
    app.get("/api/admin/latest-orders", async (req, res) => {
      try {
        const latestOrders = await bookingsCollection
          .find({})
          .sort({ createdAt: -1 })
          .limit(10)
          .toArray();

        res.json({ success: true, latestOrders });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
      }
    });



    // GET all bookings (for admin dashboard)
    app.get("/api/admin/bookings", async (req, res) => {
      try {
        const bookings = await bookingsCollection
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        res.status(200).json({ success: true, bookings });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
      }
    });

    // DELETE booking by ID
    app.delete("/api/admin/bookings/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ success: false, message: "Invalid ID" });
        }

        const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 1) {
          res.status(200).json({ success: true, message: "Booking cancelled and deleted" });
        } else {
          res.status(404).json({ success: false, message: "Booking not found" });
        }
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
      }
    });

    // update booking status
    app.patch("/api/admin/bookings/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Status updated" });
        } else {
          res.send({ success: false, message: "Update failed" });
        }
      } catch (error) {
        res.status(500).send({ success: false, message: error.message });
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
