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
    const purchasesCollection = db.collection("purchases");
    const bookingsCollection1 = db.collection("booking");


    // ✅ Register Route
    app.post("/api/register", async (req, res) => {
      try {
        const userData = req.body;
        const existingUser = await usersCollection.findOne({ email: userData.email });
        if (existingUser) {
          return res.status(400).json({ message: "User already exists" });
        }
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

    // user role get by email
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email: email });
      res.send(user || {});
    });
    // Get all users
    app.get("/api/admin/users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.json({ success: true, users });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
      }
    });

    // Update user role (Admin <-> User)
    app.patch("/api/admin/users/:id/role", async (req, res) => {
      try {
        const { role } = req.body;
        const { id } = req.params;
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role } }
        );
        res.json({ success: true, message: "Role updated", result });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
      }
    });

    // Update user info (name, email, etc.)
    app.put("/api/admin/users/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updateDoc = req.body;
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateDoc }
        );
        res.json({ success: true, message: "User updated", result });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
      }
    });

    // Delete user
    app.delete("/api/admin/users/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
        res.json({ success: true, message: "User deleted", result });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
      }
    });

    // GET all bookings
    app.get("/api/bookings", async (req, res) => {
      try {
        const bookings = await bookingsCollection1.find({}).toArray();
        res.status(200).json({ success: true, bookings });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
      }
    });

    // Check Availability API
    app.get("/api/reservations/check", async (req, res) => {
      try {
        const { date, time } = req.query;

        if (!date || !time) {
          return res.status(400).json({ success: false, message: "Missing fields" });
        }

        const MAX_TABLES = 20;
        const [hour, min] = time.split(":").map(Number);
        const requestedStart = new Date(`${date}T${time}:00`);
        const requestedEnd = new Date(requestedStart.getTime() + 2 * 60 * 60 * 1000);

        const existingReservations = await bookingsCollection1.find({ date }).toArray();
        const tables = [];
        for (let i = 1; i <= MAX_TABLES; i++) {
          const overlapping = existingReservations.find(r => {
            if (r.tableNo !== i) return false;
            const rStart = new Date(`${r.date}T${r.startTime}`);
            const rEnd = new Date(`${r.date}T${r.endTime}`);
            return (requestedStart < rEnd) && (requestedEnd > rStart);
          });
          tables.push({
            tableNo: i,
            status: overlapping ? "Booked" : "Free",
            reservationId: overlapping?._id || null,
            customer: overlapping ? overlapping.customer : null,
          });
        }

        const available = tables.some(t => t.status === "Free");

        res.json({ success: true, available, tables });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
      }
    });

    // Confirm Reservation API
    app.post("/api/reservations", async (req, res) => {
      try {
        const { date, tableNo, time, people, customer } = req.body;

        if (!date || !tableNo || !time || !people || !customer) {
          return res.status(400).json({ success: false, message: "Missing fields" });
        }

        const startTime = time;
        const startDate = new Date(`${date}T${startTime}:00`);
        const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
        const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}:00`;
        const overlapping = await bookingsCollection1.findOne({
          date,
          tableNo,
          $or: [
            { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
          ]
        });

        if (overlapping) {
          return res.status(400).json({ success: false, message: "Table already booked for this slot" });
        }

        const reservation = {
          customer,
          tableNo,
          people: Number(people),
          startTime,
          endTime,
          date,
          status: "Booked",
          createdAt: new Date(),
        };

        await bookingsCollection1.insertOne(reservation);
        res.status(201).json({ success: true, reservation });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
      }
    });

    // DELETE reservation
    app.delete("/api/admin/bookings/:id", async (req, res) => {
      const { id } = req.params;
      try {
        await bookingsCollection1.deleteOne({ _id: new ObjectId(id) });
        res.json({ success: true, message: "Deleted successfully" });
      } catch (err) {
        res.status(500).json({ success: false, message: "Error deleting" });
      }
    });

    // PATCH status
    app.patch("/api/admin/bookings/:id", async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;
      try {
        await bookingsCollection1.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );
        res.json({ success: true, message: "Status updated" });
      } catch (err) {
        res.status(500).json({ success: false, message: "Error updating status" });
      }
    });




    // POST - Create Purchase
    app.post("/purchases", async (req, res) => {
      try {
        const purchase = req.body;
        const result = await purchasesCollection.insertOne(purchase);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to create purchase", error });
      }
    });

    // GET - All Purchases
    app.get("/purchases", async (req, res) => {
      try {
        const result = await purchasesCollection.find().toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch purchases", error });
      }
    });

    // GET - Single Purchase by ID
    app.get("/purchases/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await purchasesCollection.findOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch purchase", error });
      }
    });

    // PUT - Update Purchase
    app.put("/purchases/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const data = req.body;
        const result = await purchasesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: data }
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to update purchase", error });
      }
    });

    // DELETE - Remove Purchase
    app.delete("/purchases/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await purchasesCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete purchase", error });
      }
    });

    // PATCH - Mark Purchase as returned
    app.patch("/purchases/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;

        const result = await purchasesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );

        if (result.modifiedCount > 0) {
          res.json({ success: true, message: "Purchase returned successfully" });
        } else {
          res.status(404).json({ success: false, message: "Purchase not found" });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error" });
      }
    });



    // Get all products
    app.get("/api/products", async (req, res) => {
      const products = await productsCollection.find().toArray();
      res.json(products);
    });
    app.post("/api/products", async (req, res) => {
      try {
        const productData = req.body;
        const result = await productsCollection.insertOne(productData);
        res.json({ success: true, productId: result.insertedId });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
      }
    });
    app.delete("/api/products/:id", async (req, res) => {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid product ID" });
      }

      try {
        const result = await productsCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 1) {
          res.json({ success: true, message: "Product deleted successfully" });
        } else {
          res.status(404).json({ success: false, message: "Product not found" });
        }
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to delete product" });
      }
    });

    app.put("/api/products/:id", async (req, res) => {
      const { id } = req.params;
      const { name, price, category } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid product ID" });
      }

      try {
        const result = await productsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { name, price: Number(price), category } }
        );

        if (result.modifiedCount > 0) {
          res.json({ success: true, message: "Product updated successfully" });
        } else {
          res.status(404).json({ success: false, message: "Product not found or no changes made" });
        }
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Failed to update product" });
      }
    });


    // Get all categories
    app.get("/api/categories", async (req, res) => {
      const categories = await categoriesCollection.find().toArray();
      res.json(categories);
    });

    // POST: Add new category (only name)
    app.post("/api/categories", async (req, res) => {
      try {
        const { name, parentCategory, offer, status, image } = req.body;

        if (!name || !name.trim()) {
          return res.status(400).json({ success: false, message: "Category name is required" });
        }

        const existing = await categoriesCollection.findOne({ name: name.trim() });
        if (existing) {
          return res.status(400).json({ success: false, message: "Category already exists" });
        }
        const newCategory = {
          name: name.trim(),
          parentCategory: parentCategory || "",
          offer: offer || false,
          status: status || "Active",
          image: image || "",
          createdAt: new Date(),
        };

        const result = await categoriesCollection.insertOne(newCategory);

        res.status(201).json({ success: true, categoryId: result.insertedId, category: newCategory });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server Error" });
      }
    });

    // 2️⃣ Update category
    app.put("/api/categories/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updateData = req.body;

        const result = await categoriesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ success: false, message: "Category not found" });
        }

        res.json({ success: true, message: "Category updated successfully" });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
      }
    });

    // 3️⃣ Delete category
    app.delete("/api/categories/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await categoriesCollection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
          return res.status(404).json({ success: false, message: "Category not found" });
        }

        res.json({ success: true, message: "Category deleted successfully" });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error" });
      }
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
