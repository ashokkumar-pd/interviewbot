const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public')); // Serve static files if needed

app.post('/upload', upload.single('audio'), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send('No file uploaded');
  }
  res.status(200).send('Audio uploaded successfully');
  // Optionally, log or process the file path: file.path
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));