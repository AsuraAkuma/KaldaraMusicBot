const { exit } = require('process');

const router = require("express").Router();
router.get('/', async (req, res) => {
    res.status(200).send({ success: true });
});
router.get('/stop', async (req, res) => {
    console.log('Stopping')
    exit(0);
});

module.exports = router;