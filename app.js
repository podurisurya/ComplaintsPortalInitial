const express = require("express");
const ejs = require("ejs");
const bp = require("body-parser");
const admin = require("firebase-admin");
const app = express();
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const dbUrl = process.env.DB_URL;


app.use(bp.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const MongoClient = require("mongodb/lib/mongo_client");

// Initialize Firebase Admin
try {
    const serviceAccountPath = path.join(__dirname, 'firebaseServiceAccount.json');
    
    // Try to read from file first
    if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = require(serviceAccountPath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log("Firebase Admin initialized successfully from firebaseServiceAccount.json");
    } 
    // Fallback to environment variable
    else if (process.env.FIREBASE_CONFIG) {
        const account = JSON.parse(process.env.FIREBASE_CONFIG);
        admin.initializeApp({
            credential: admin.credential.cert(account),
        });
        console.log("Firebase Admin initialized successfully from environment variable");
    } 
    else {
        console.warn("Firebase configuration not found. Firebase features will not be available.");
    }
} catch (error) {
    console.error("Error initializing Firebase Admin:", error.message);
    console.warn("Firebase features will not be available.");
}
if (dbUrl) {
    mongoose.connect(dbUrl, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    }).then(() => {
        console.log("Connected to MongoDB");
    }).catch((err) => {
        console.error("MongoDB connection error: ", err);
        console.warn("MongoDB connection failed. Some features may not work.");
    });
} else {
    console.warn("DB_URL not found in environment variables. MongoDB features will not be available.");
}

const complaintSchema = new mongoose.Schema({
    name: String,
    reg: String,
    comp: String,
    dept: String,
    complaint: String,
    likes: {
        type: Number,
        default: 0,
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Complaint = mongoose.model('Complaint', complaintSchema);

app.get("/", (req, res) => {
    res.render("signup", { error: " " });
});
app.get("/signup",(req,res)=>{
    res.render("signup",{error:" "});
})
app.post("/signup", async (req, res) => {
    try {
        const us = req.body.username;
        const em = req.body.email;
        const ps = req.body.password;
        const db = admin.firestore();
        const userRecord = await admin.auth().createUser({
            displayName: us,
            email: em,
            password: ps,
        });
        const hashpass = await bcrypt.hash(ps, 10);
        const awt = await db.collection("users").doc(userRecord.uid).set({
            username: us,
            email: em,
            password: hashpass,
        });
        res.redirect("/login");
    } catch (error) {
        console.log(error);
        const errorMes = error.message;
        res.render("signup", { error: errorMes });
    }
});

app.get("/login", (req, res) => {
    res.render("login", { error: " " });
});

app.post("/login", async (req, res) => {
    try {
        const email = req.body.email;
        const password = req.body.password;
        const db = admin.firestore();
        const userres = await admin.auth().getUserByEmail(email);
        const userdetails = await db.collection("users").doc(userres.uid).get();
        if (userdetails.exists) {
            const userdata = userdetails.data();
            const pswd = userdata.password;
            const result = await bcrypt.compare(password, pswd);
            if (result == true) {
                res.redirect("/home");
            } else {
                res.render("login", { error: "Invalid Credentials" });
            }
        } else {
            res.render("login", { error: "User not found" });
        }
    } catch (error) {
        console.log(error);
        res.render("login", { error: "An error occurred, please try again." });
    }
});
app.get("/complaints",(req,res)=>{
   res.render("complaints", { error: " " });
});
app.post("/complaints", async (req, res) => {
    const { nam, reg, comp, dept, complaint } = req.body;

    const newComplaint = new Complaint({
        name: nam,
        reg,
        comp,
        dept,
        complaint
    });

    try {
        await newComplaint.save();
        console.log("Complaint saved:", newComplaint);
        res.redirect("/home"); 
    } catch (error) {
        console.error("Error saving complaint:", error);
        res.status(500).send("Error submitting complaint");
    }
});
app.post("/home", async (req, res) => {
    const filter = req.body.filtervalue; 
    try {
        let filterQuery = {};
        if (filter && filter !== 'all') {
            filterQuery = { dept: filter }; 
        }
        const complaints = await Complaint.find(filterQuery); 
        res.render("home", { complaints });
    } catch (error) {
        console.log("Error filtering complaints:", error);
        res.status(500).send("Error filtering complaints");
    }
});


app.post("/likes", async (req, res) => {
    try {
        const result = await Complaint.findByIdAndUpdate(
            req.body.thumbsup, 
            { $inc: { likes: 1 } },
            { new: true } // Returns the updated document
        );
        
        if (!result) {
            return res.status(404).send("Complaint not found");
        }
        
        res.redirect("/home");
    } catch (error) {
        console.error("Error updating likes:", error);
        res.status(500).send("Error updating likes");
    }
});

app.get("/home", async (req, res) => {
    try {
        const complaints = await Complaint.find().sort({ likes: -1 }); 
        res.render("home", { complaints });
    } catch (error) {
        console.error("Error fetching complaints:", error);
        res.status(500).send("Error retrieving complaints");
    }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


// // Add this script to your EJS file or a separate JS file
// document.querySelectorAll('.like-form').forEach(form => {
//     form.addEventListener('submit', async (e) => {
//         e.preventDefault();
        
//         const formData = new FormData(form);
//         const complaintId = formData.get('thumbsup');
//         const counter = form.querySelector('.counter');
        
//         try {
//             const response = await fetch('/likes', {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/x-www-form-urlencoded',
//                 },
//                 body: `thumbsup=${complaintId}`
//             });
            
//             if (response.ok) {
//                 const currentLikes = parseInt(counter.textContent) || 0;
//                 counter.textContent = currentLikes + 1;
//             }
//         } catch (error) {
//             console.error('Error:', error);
//         }
//     });
// });