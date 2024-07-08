const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const path = require('path');
const app = express();
const dotenv = require('dotenv');
const fs=require('fs');
const {v2:cloudinary} = require('cloudinary');
const multer  = require('multer');
const upload = multer({ dest: 'uploads/' });
dotenv.config();
const encodeURL = bodyParser.urlencoded({ extended: false });

app.use(express.static(path.join(__dirname, 'placementPortal')));

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const background_image_url = process.env.BACKGROUND_IMAGE_URL;
const nmims_logo_url = process.env.NMIMS_LOGO_URL;

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Define routes
app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/studentdashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'studentdashboard.html'));
});

app.get('/facultydashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'facultydashboard.html'));
});

app.get('/result.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'result.html'));
});

app.use(session({
    secret: process.env.SECRET_SESSION,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 },
    resave: false
}));

app.use(cookieParser());

const con = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

con.connect(function(err) {
    if (err) {
        console.error('Error connecting to database: ' + err.stack);
        return;
    }
    console.log('Connected to database as id ' + con.threadId);
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/register.html', encodeURL, async (req, res) => {
    const { name, email, username, password, userType } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    con.query(`SELECT * FROM users WHERE email = '${email}'`, async function(err, result) {
        if (err) {
            console.error('Error querying data: ' + err.stack);
            return;
        }

        if (result.length > 0) {
            res.sendFile(path.join(__dirname, 'public', 'fail_reg.html')); 
       } else {
            if (password.length < 8) {
                res.sendFile(path.join(__dirname, 'public', 'fail_reg.html'));
                return;
            }

            const sql = `INSERT INTO users (name, email, username, password, userType) VALUES (?, ?, ?, ?, ?)`;
            con.query(sql, [name, email, username, hashedPassword, userType], function(err, result) {
                if (err) {
                    console.error(err);
                    return;
                }
                res.send(`
                    <!DOCTYPE html>
                    <html lang="en">
                    <head>
                        <title>Registration Form</title>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
                        <link rel="stylesheet"> 
                        <style>
                            body{
                                background-image: url('${background_image_url}');
                                background-size: cover;
                                background-position: center;
                            }
                        </style>
                        <script>
                            setTimeout(function() {
                                alert('Registration successful!');
                                window.location.href = '/login'; // Redirect to login page
                            }, 1000); 
                        </script>
                    </head>
                    <body>
                        <div class="container">
                            <a href="/login.html">Log in</a>
                        </div>
                    </body>
                    </html>
                `);
            });
        }
    });
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post("/dashboard", encodeURL, (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    con.query(`SELECT * FROM users WHERE username = '${username}'`, async function(err, result) {
        if (err) {
            console.error('Error querying data: ' + err.stack);
            res.sendFile(path.join(__dirname + 'public', '/fail_login.html'));
            return;
        }
        if (result.length > 0) {
            const passwordMatch = await bcrypt.compare(password, result[0].password);
            if (passwordMatch) {
                req.session.email = result[0].email; 
                const user = result[0];
                if (user.userType === 'student') {
                    res.redirect('/studentdashboard');
                } else if (user.userType === 'faculty') {
                    res.redirect('/facultydashboard');
                } else {
                    res.sendFile(path.join(__dirname , 'public', '/fail_login.html'));
                }
            } else {
                res.sendFile(path.join(__dirname, 'public', '/fail_login.html'));
            }
        } else {
            res.sendFile(path.join(__dirname + 'public', '/fail_login.html'));
        }
    });
});

app.get('/dashboard', (req, res) => {
    const userId = req.session.email; 
    const sql = `SELECT * FROM users WHERE email = ?`;
    con.query(sql, [userId], (err, result) => {
        if (err) {
            console.error('Error fetching user data from database:', err);
            res.status(500).json({ success: false, message: 'Internal server error' });
        } else {
            const userData = result[0];
            if (userData) {
                res.status(200).json({ success: true, user: userData });
            } else {
                res.status(404).json({ success: false, message: 'User not found' });
            }
        }
    });
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/upload', (req, res) => {
    const { question, option1, option2, option3, option4, correctAnswer, question_type } = req.body;
    saveQuestionToDatabase(question, option1, option2, option3, option4, correctAnswer, question_type)
        .then(() => {
            res.status(200).send('Question uploaded successfully!');
        })
        .catch((error) => {
            console.error('Error uploading question:', error);
            res.status(500).send('An error occurred while uploading the question.');
        });
});

function saveQuestionToDatabase(question, option1, option2, option3, option4, correctAnswer, question_type) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO questions (question, option1, option2, option3, option4, correctAnswer, question_type) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        con.query(sql, [question, option1, option2, option3, option4, correctAnswer, question_type], (err, result) => {
            if (err) {
                console.error('Error saving question to database:', err);
                reject(err);
            } else {
                console.log('Question saved to database:', result);
                resolve(result);
            }
        });
    });
}
app.get('/questions/:question_type', (req, res) => {
    const questionType = req.params.question_type;
    const sql = `SELECT question, option1, option2, option3, option4, correctAnswer FROM questions WHERE question_type = ?`;
    con.query(sql, [questionType], (err, results) => {
        if (err) {
            console.error('Error fetching questions: ' + err.stack);
            res.status(500).send({ error: 'Failed to fetch questions' });
            return;
        }
        res.send(results);
    });
});

app.post('/submitAnswers', (req, res) => {
    const answers = req.body.answers; 
    const questionType = req.body.questionType; 

    const sql = `SELECT correctAnswer FROM questions WHERE question_type = ?`;
    con.query(sql, [questionType], (err, results) => {
        if (err) {
            console.error('Error fetching correct answers: ' + err.stack);
            res.status(500).send({ error: 'Failed to fetch correct answers' });
            return;
        }
        const correctAnswers = results.map(result => result.correctAnswer);
        const evaluationResults = evaluateAnswers(answers, correctAnswers);

        res.send({ evaluationResults });
    });
});

function evaluateAnswers(answers, correctAnswers) {
    const results = [];
    answers.forEach((answer, index) => {
        const isCorrect = answer === correctAnswers[index];
        results.push({ questionIndex: index, isCorrect, correctAnswer: correctAnswers[index] });
    });
    return results;
}

// POST endpoint to handle news upload
app.post('/uploadNews', upload.single('image'), (req, res) => {
    // Extract data from the request
    const { title, description, image_url } = req.body;
    const image = req.file; // Uploaded image file

    // Validate required fields
    if (!title || !description) {
        return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    // Save news data to the database
    const sql = 'INSERT INTO news (title, description, image_url) VALUES (?, ?, ?)';
    const values = [title, description, image_url || null]; // Use null if image_url is not provided
    con.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error uploading news:', err);
            return res.status(500).json({ success: false, message: 'Failed to upload news' });
        }
        
        // Optionally, if an image was uploaded, move it to a permanent location
        if (image) {
            const imagePath = `images/${image.filename}`; // Assuming filename is stored in the database
            fs.renameSync(image.path, imagePath); // Move the file
        }

        // Send response to the client
        res.json({ success: true, message: 'News uploaded successfully!' });
    });
});
app.get('/latestNews', (req, res) => {
    // Fetch latest news from the database
    con.query('SELECT * FROM news ORDER BY created_at DESC LIMIT 5', (error, results) => {
        if (error) {
            console.error('Error fetching latest news:', error);
            res.json({ success: false, message: 'Failed to fetch latest news' });
        } else {
            res.json({ success: true, news: results });
        }
    });
});


app.listen(3000, () => {
    console.log("Server running on port 3000");
});