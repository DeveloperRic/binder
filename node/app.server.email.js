const nodemailer = require("nodemailer");
const fs = require("fs");
const udb = require("./app.server.user");

const EMAIL_ADDRESSES = {
  noReply: "do-not-reply@victorolaitan.xyz"
};
const EMAIL_TEMPLATES = {
  emailChanged: {
    from: EMAIL_ADDRESSES.noReply,
    subject: "Your email address was changed",
    html: "html/app.email.emailchanged.html"
  }
};
const EMAIL_TRANSPORTER = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: "do-not-reply@victorolaitan.xyz",
    pass: "do-not-reply"
  }
});

function qualifyPlaceholders(localPlaceholders, user) {
  return Object.assign(localPlaceholders, {
    profileName: user.profile.firstname,
    emailAddressResetLink: encodeURI(
      "https://binder-211420.appspot.com/emailreset?uid=" + user.uid
    ),
    twoFactorSetupLink: encodeURI("https://binder-211420.appspot.com/security"),
    supportEmailAddress: "support@mail.binder.victorolaitan.xyz",
    updateEmailPrefrencesLink: encodeURI(
      "https://binder-211420.appspot.com/emailpreferences?uid=" + user.uid
    ),
    unsubscribeLink: encodeURI(
      "https://binder-211420.appspot.com/emailunsubscribe?uid=" + user.uid
    )
  });
}

exports.send = function(templateId, uid, placeholders, onSuccess, onFail) {
  var template = EMAIL_TEMPLATES[templateId];
  if (!template) {
    return onFail(404, "Invalid templateId!");
  } else {
    fs.readFile(template.html, (err, content) => {
      if (err) return onFail(500, "Failed to load email template.");
      var user = udb.getUserWithUID(uid);
      EMAIL_TRANSPORTER.sendMail(
        {
          from: template.from,
          to: user.email,
          subject: template.subject,
          html: content
        },
        (error, info) => {
          if (error) return onFail(500, error);
          onSuccess();
        }
      );
      // var send = createTransporter().templateSender(
      //   {
      //     subject: template.subject,
      //     html: content
      //   },
      //   {
      //     from: template.from
      //   }
      // );
      // send(
      //   {
      //     to: user.email
      //   },
      //   qualifyPlaceholders(placeholders, user),
      //   (error, info) => {
      //     if (error) return onFail(500, error);
      //     onSuccess();
      //   }
      // );
    });
  }
};
