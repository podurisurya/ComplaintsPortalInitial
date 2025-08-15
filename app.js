const express = require("express");
const ejs = require("ejs");
const bp = require("body-parser");
const admin = require("firebase-admin");
const app = express();
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { ObjectId } = require('mongodb');
require('dotenv').config();
const dbUrl = process.env.DB_URL;


app.use(bp.urlencoded({ extended: true }));
app.set("view engine", "ejs");
const account = JSON.parse(process.env.FIREBASE_CONFIG);

const MongoClient = require("mongodb/lib/mongo_client");

admin.initializeApp({
    credential: admin.credential.cert(account),
});
mongoose.connect(dbUrl
    , {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("Connected to MongoDB");
}).catch((err) => {
    console.error("MongoDB connection error: ", err);
});

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
    const us = req.body.username;
    const em = req.body.email;
    const ps = req.body.password;
    const db = admin.firestore();
    try {
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
    const email = req.body.email;
    const password = req.body.password;
    const db = admin.firestore();
    try {
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
    const likesId = req.body.thumbsup;

    try {
        await Complaint.updateOne(
            { _id:ObjectId(likesId) }, 
            { $inc: { likes: 1 } }
        );
        res.redirect("/home");
    } catch (error) {
        console.log("Error updating likes:", error);
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
