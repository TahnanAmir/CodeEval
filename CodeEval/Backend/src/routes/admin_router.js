const express = require("express");
const { authenticateJWT } = require("../middleware/auth_middleware");
const { getStats, listUsers, addUser, updateUser } = require("../controllers/admin_controller");

const router = express.Router();

// Minimal protection: must be logged in. (Role checks can be added later.)
router.use(authenticateJWT);

router.get("/stats", getStats);
router.get("/users", listUsers);
router.post("/add-user", express.json(), addUser);
router.put("/update-user/:userId", express.json(), updateUser);

module.exports = router;

