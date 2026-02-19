const express = require('express');
const pool = require('./db');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be set.');
}
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const saltRounds = 10;
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const RECOMMENDER_URL = process.env.RECOMMENDER_URL || 'http://recommender:5000';

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'Avatars/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

router.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
    const file = req.file;
    const userId = req.body.userId;

    if (!file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const fileUrl = `Avatars/${file.filename}`;

    try {
        const oldAvatarQuery = 'SELECT url FROM users WHERE id = $1';
        const oldAvatarResult = await pool.query(oldAvatarQuery, [userId]);

        if (oldAvatarResult.rows.length > 0) {
            const oldAvatarUrl = oldAvatarResult.rows[0].url;
            if (oldAvatarUrl) {
                const oldFilePath = path.join(__dirname, 'Avatars', path.basename(oldAvatarUrl));
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }

        }
        const query = 'UPDATE users SET url = $1 WHERE id = $2 RETURNING *';
        const values = [fileUrl, userId];
        const result = await pool.query(query, values);

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error saving avatar:', error);
        res.status(500).json({ error: 'Error saving avatar.' });
    }
});

router.get('/users/:userId/avatar', async (req, res) => {
    const userId = req.params.userId;

    try {
        const query = 'SELECT url FROM users WHERE id = $1';
        const result = await pool.query(query, [userId]);

        if (result.rows.length > 0) {
            const avatarUrl = result.rows[0].url;

            if (avatarUrl) {
                const filePath = path.join(__dirname, 'Avatars', path.basename(avatarUrl));

                if (fs.existsSync(filePath)) {
                    res.sendFile(filePath);
                } else {
                    res.status(404).json({ error: 'File not found' });
                }
            } else {
                const filePath = path.join(__dirname, 'Avatars', 'default.webp');

                if (fs.existsSync(filePath)) {
                    res.sendFile(filePath);
                } else {
                    res.status(404).json({ error: 'File not found' });
                }
            }
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error fetching avatar:', error);
        res.status(500).json({ error: 'Error fetching avatar.' });
    }
});

router.post('/modifyUserInfo', async (req, res) => {
    const { id, firstname, lastname, username } = req.body;
    try {
        const query = 'UPDATE users SET firstname = $1, lastname = $2, username = $3 WHERE id = $4 RETURNING *';
        const results = await pool.query(query, [firstname, lastname, username, id]);
        res.status(200).json(results.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

router.get('/haveGamePreference', async (req, res) => {
    const userId = req.query.userId;
    try {
        const results = await pool.query('SELECT preference FROM users WHERE id = $1', [userId]);
        res.status(200).json(results.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

router.get('/getUserGameRating', async (req, res) => {
    const userId = req.query.userId;
    const gameId = req.query.gameId;
    try {
        const results = await pool.query('SELECT * FROM user_ratings WHERE user_id = $1 AND game_id = $2', [userId, gameId]);
        if (results.rows.length === 0) {
            return res.status(200).json(null);
        }
        res.status(200).json(results.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

router.post('/setUserGameRating', async (req, res) => {
    const { userId, gameId, rating } = req.body;
    try {
        const results = await pool.query(
            'INSERT INTO user_ratings (user_id, game_id, rating) VALUES ($1, $2, $3) RETURNING *',
            [userId, gameId, rating]
        );
        res.status(200).json(results.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
    
});

router.get('/searchGame', async (req, res) => {
    const searchTerm = req.query.gameName;
    try {
        // only return top 50
        const results = await pool.query('SELECT bggid FROM board_games WHERE name ILIKE $1 limit 20', [`%${searchTerm}%`]);
        const numberList = results.rows.map(item => item.bggid);
        res.status(200).json(numberList);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});



router.get('/getGameId', async (req, res) => {
    const userId = req.query.userId;
    console.log(userId);
    const rating_pair = [];
    try {
        const results1 = await pool.query('SELECT * FROM user_ratings WHERE user_id = $1', [userId]);
        if (results1.rows.length) {
            for (let i = 0; i < results1.rows.length; i++) {
                const gameId = results1.rows[i].game_id;
                const rating = results1.rows[i].rating;
                rating_pair.push([gameId, rating]);
            }
        }
        console.log(rating_pair);
        const results2 = await pool.query('SELECT preference_list1 FROM users WHERE id = $1', [userId]);
        const booleanPreferences = results2.rows[0]['preference_list1'];
        // console.log(booleanPreferences);
        // Send data to Flask microservice
        const flaskResponse = await axios.post(`${RECOMMENDER_URL}/recommend`, {
            username: userId,
            ratings: rating_pair,
            preferences: booleanPreferences
        });
        console.log(flaskResponse.data.recommendations);
        const firstColumn = flaskResponse.data.recommendations.map(item => item[0]);
        
        res.status(200).json(firstColumn);
    } catch (error) {
        console.error('Error connecting to Flask microservice:', error.message);
        res.status(500).json({ error: 'Failed to connect to Flask microservice' });
    }
});

router.get('/getGameIdFromPreference', async (req, res) => {
    const userId = req.query.userId;

    // res.status(200).json([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    try {
        const results = await pool.query('SELECT preference_list FROM users WHERE id = $1', [userId]);
        // console.log(results.rows[0]['preference_list']);
        res.status(200).json(results.rows[0]['preference_list']);
    } catch (error) {
        res.status(500).json({ error: error.toString()});
    }
});


router.post('/setGamePreference', async (req, res) => {
    // const userId = req.query.userId;

    // res.status(200).json([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    const { userId, preferences } = req.body;

    const booleanPreferences = Object.values(preferences);
    try {
        // Send data to Flask microservice
        const flaskResponse = await axios.post(`${RECOMMENDER_URL}/recommend`, {
            username: userId,
            ratings: [],
            preferences: booleanPreferences
        });
        // console.log(flaskResponse.data.recommendations);
        const firstColumn = flaskResponse.data.recommendations.map(item => item[0]);

        const results1 = await pool.query('update users set preference_list = $1 where id = $2', [firstColumn, userId]);
        const results2 = await pool.query('update users set preference_list1 = $1 where id = $2', [booleanPreferences, userId]);

        res.status(200).json(firstColumn);
    } catch (error) {
        console.error('Error connecting to Flask microservice:', error.message);
        res.status(500).json({ error: 'Failed to connect to Flask microservice' });
    }
});

router.get('/getGameInfo', async (req, res) => {
    const gameId = req.query.gameId;
    try {
        const results = await pool.query('SELECT * FROM board_games WHERE bggid = $1', [gameId]);
        res.status(200).json(results.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});


router.get('/getUserName', async (req, res) => {
    const userId = req.query.userId;
    try {
        const results = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        res.status(200).json(results.rows[0]['username']);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

router.get('/getUserInfo', async (req, res) => {
    const userId = req.query.userId;
    try {
        const results = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        res.status(200).json(results.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});



const verifyToken = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).json({ message: 'Auth token is not provided' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        next(); // Move to next middleware
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

router.get('/verify', verifyToken, (req, res) => {
    // Access userId from request object
    const userId = req.userId;
    res.status(200).json({ userId: userId, message: 'Protected route accessed' });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length == 0) {
            console.log("User not found")
            return res.status(404).json({ message: 'User not found' });
        }
        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        // const isMatch = password === user.password;
        if (!isMatch) {
            console.log("Incorrect password");
            return res.status(404).json({ message: 'Incorrrect password' });
        }
        console.log("authenticate successfully");
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ token: token, message: 'Login successfully', user: user });
    } catch (error) {
        console.log(error);
    }
});

router.post('/signup', async (req, res) => {
    const { firstname, lastname, email, password, username } = req.body;
    console.log(req.body);
    const encrypted = await bcrypt.hash(password, saltRounds);
    try {
        const results = await pool.query('INSERT INTO users (firstname, lastname, email, password, username) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [firstname, lastname, email, encrypted, username]);
        console.log(results);
        res.status(201).json({ message: 'User added', userId: results.rows[0].id });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

module.exports = router;
