import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import {dirname} from "path"; // these are just for the path
import  {fileURLToPath} from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

// CONNECT TO DATABASE
const db = new pg.Client ({
	user: "postgres",
	host: "localhost",
    database: "Blog",
	password: "PostyBoy3000",
	port: 5432
});
db.connect();

// SETUP SERVER
const app = express();
const PORT = 3000;

app.use(express.static('public')); // allows usage of static css files
app.use(morgan('tiny')); // gives me status info in terminal
app.use(bodyParser.urlencoded({extended: true})); // encodes and parses the form inputs

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}.`);
});

var posts = [];
var user_id = -1;
var currentUsername = "";
var edit = false;
var editID = -1;
var editNumber = -1;
var signInError = "";
var signUpError = "";

app.post("/submit", async (req, res) => { // HANDLES ALL SUBMIT BUTTONS ACROSS THE WEBSITE
    const action = req.body.action;

    // SUBMIT POST BUTTON PRESSED
    if (action === 'submitPost') { 
        const postTitle = req.body.postTitle;
        const postAuthor = req.body.postAuthor;
        const postContent = req.body.postContent;
        const postDate = new Date();
        // Convert postDate into proper SQL TIMESTAMP format:
        const timeStamp = `${postDate.getFullYear}-${postDate.getMonth+1}-${postDate.getDay} ${postDate.getHours}:${postDate.getMinutes}:${postDate.getSeconds}`;
        // Add or edit post:
        if (edit) {
            db.query("UPDATE blog SET creator_name=$1, title=$2, body=$3 WHERE blog_id=$4", [postAuthor, postTitle, postContent, editID]);  
        } else {
            db.query("INSERT INTO blog (creator_name, creator_id, title, body, date_created) VALUES ($1, $2, $3, $4, $5)", [postAuthor, user_id, postTitle, postContent, postDate]);
        }
        edit = false;
        res.redirect('/');  // return to homepage

    // EDIT BUTTON PRESSED
    } else if (action === 'editPost') {
        const postNumber = req.body.postNumber;
        edit = true;
        editNumber = postNumber;
        editID = req.body.blogID;
        console.log(editNumber);
        res.redirect('/newpost.ejs');
        
    // DELETE BUTTON PRESSED
    } else if (action === 'deletePost') { 
        console.log("deleted");
        const deleteNumber = req.body.blogID; 
        db.query("DELETE FROM blog WHERE blog_id=$1",[deleteNumber]);
        res.redirect('/');
    
    // SIGNIN BUTTON PRESSED
    } else if (action === 'signIn') {
        const enteredName = req.body.username;
        const enteredPassword = req.body.password;
        try { 
            const findUser = await db.query("SELECT * FROM users WHERE name=$1",[enteredName]);
            const userData = findUser.rows; 
            if (userData.length === 0) { // If no users found with that name
                signInError = "Username not found"
                res.redirect('/sign-in.ejs');
            } else {
                if (enteredPassword === userData[0].password) { // Check password
                    user_id = userData[0].user_id;
                    currentUsername = userData[0].name;
                    signInError = "";
                    res.redirect('/');
                } else {
                    console.log ("Incorrect password");
                    signInError = "Incorrect password"
                    res.redirect('/sign-in.ejs');
                }
            }
        } catch (err) {
            console.log(err);
            res.status(500).send("");
        }
    // SIGNUP BUTTON PRESSED
    } else if (action === 'signUp') {
        const newName = req.body.newUsername;
        const newPassword = req.body.newPassword;
        try { 
            const findUsernames = await db.query("SELECT name FROM users WHERE name=$1",[newName]);
            const usernames = findUsernames.rows;  
            if (usernames.length === 0) { // if username does not exist (this query should return nothing)
                db.query("INSERT INTO users (name, password) VALUES ($1, $2)",[newName, newPassword]);
                res.redirect('/sign-in.ejs');
            } else {
                console.log("Username taken");
                signUpError = "Username taken";
                res.redirect('/sign-up.ejs');
            }
        } catch (err) {
            console.log(err);
            res.status(500).send("");
        }

    } else {
        res.redirect('/');
    }
});


// HOME PAGE ROUTE
app.get("/", async (req, res) => {
    if (user_id == -1) { // not signed in
        res.redirect('/sign-in.ejs');
    }
    // Update posts then render index.ejs
    try {
        const data = await db.query("SELECT * FROM blog ORDER BY date_created DESC");
        posts = data.rows;
        res.render('index.ejs', { posts: posts, username: currentUsername, user_id: user_id}); // send homepage ejs file, and make the post data available
    } catch (err) {
        console.log(err);
        res.status(500);
    } 
});

// NEWPOST PAGE ROUTE
app.get('/newpost.ejs', (req, res) => {
    res.render('newpost.ejs', {edit: edit, editNumber: editNumber, posts: posts});
});
// SIGNIN PAGE ROUTE
app.get('/sign-in.ejs', (req, res) => {
    res.render('sign-in.ejs', {error: signInError});
});
// SINGUP PAGE ROUTE
app.get('/sign-up.ejs', (req, res) => {
    res.render('sign-up.ejs', {error: signUpError});
});
