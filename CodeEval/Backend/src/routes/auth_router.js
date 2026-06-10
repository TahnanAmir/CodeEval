const express = require("express");
const { register, login, logout } = require("../controllers/auth_controller");
const { authenticateJWT } = require("../middleware/auth_middleware");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authenticateJWT, logout);

module.exports = router;
