const router = require("express").Router();
const sender = require("./sender");

router.post("/:templateId/send", (req, res) => {
  // TODO email!
  // email is disabled right now due to its current unstable nature
  //
  // update this vvv
  // if (!verifyParams(req.params.templateId, req.body.uid, req.body.placeholders)) {
  //   return;
  // }
  //
  // email.send(
  //   req.params.templateId,
  //   req.body.uid,
  //   req.body.placeholders,
  //   () => res.sendStatus(200),
  //   (code, err) => {
  //     res.status(code).send(err);
  //     console.log(err);
  //   }
  // );
  res.sendStatus(200);
});

router.get("/:templateId", (req, res, next) => {
  if (
    !verifyParams(
      res,
      ["params.templateId", "query.uid"],
      req.params.templateId,
      req.query.uid
    )
  ) {
    return;
  }
  sender
    .viewOnline(req.params.templateId, req.query.uid)
    .then(content => res.send(content))
    .catch(next);
});

module.exports = router;
