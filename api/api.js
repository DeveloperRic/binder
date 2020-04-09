const router = require("express").Router();

router.use("/source", require("./source/source"));
router.use("/user", require("./user/user"));
router.use("/email", require("./email/email"));

module.exports = router;
