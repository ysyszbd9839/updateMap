const express = require("express")
const path = require('path');
const fs = require('fs');
const filePath = path.join(__dirname, '../public', 'index.html');

const router = express.Router();
router.post("/update", (req, res) => {
    res.send("ppppppppppppp")
})
router.get("/page", (req, res) => {
    res.setHeader('Content-Type','text/html')
    // res.send('hello world')
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
})
module.exports = router