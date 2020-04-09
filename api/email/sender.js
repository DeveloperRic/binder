const fs = require("fs");
const udb = require("../user/udb");

const EMAIL_ADDRESSES = {
  noReply: "do-not-reply@victorolaitan.xyz",
};
const EMAIL_TEMPLATES = {
  emailChanged: {
    from: EMAIL_ADDRESSES.noReply,
    subject: "Your email address was changed",
    html: "html/app.email.emailchanged.html",
  },
};
// const EMAIL_TRANSPORTER = nodemailer.createTransport({
//   host: "smtp.zoho.com",
//   port: 465,
//   secure: true,
//   auth: {
//     user: "do-not-reply@victorolaitan.xyz",
//     pass: "do-not-reply"
//   }
// });

function qualifyPlaceholders(localPlaceholders, user) {
  return Object.assign(localPlaceholders, {
    profileName: user.profile.firstname,
    emailAddressResetLink: encodeURI(
      "https://binder-211420.appspot.com/emailreset?uid=" + user.uid
    ),
    twoFactorSetupLink: encodeURI("https://binder-211420.appspot.com/security"),
    supportEmailAddress: "support@mail.binder.victorolaitan.xyz",
    updateEmailPreferencesLink: encodeURI(
      "https://binder-211420.appspot.com/emailpreferences?uid=" + user.uid
    ),
    unsubscribeLink: encodeURI(
      "https://binder-211420.appspot.com/emailunsubscribe?uid=" + user.uid
    ),
  });
}

function insertPlaceholderValues(emailContent, placeholders) {
  for (let key in placeholders) {
    emailContent = emailContent.replace("{{" + key + "}}", placeholders[key]);
  }
  return emailContent;
}

function send(templateId, uid, placeholders) {
  return new Promise((resolve, reject) => {
    var template = EMAIL_TEMPLATES[templateId];
    if (!template) {
      return reject(404, "Invalid templateId!");
    } else {
      fs.readFile(template.html, (err, content) => {
        if (err) return reject(500, "Failed to load email template.");
        udb
          .getUserWithUID(uid)
          .then(user => {
            // EMAIL_TRANSPORTER.sendMail(
            //   {
            //     from: template.from,
            //     to: user.email,
            //     subject: template.subject,
            //     html: content
            //   },
            //   (error, info) => {
            //     if (error) return onFail(500, error);
            //     onSuccess();
            //   }
            // );
            const send = createTransporter().templateSender(
              {
                subject: template.subject,
                html: insertPlaceholderValues(
                  content,
                  qualifyPlaceholders(placeholders, user)
                ),
              },
              {
                from: template.from,
              }
            );
            send(
              {
                to: user.email,
              },
              qualifyPlaceholders(placeholders, user),
              (error, info) => {
                if (error) return reject([500, error]);
                resolve();
              }
            );
          })
          .catch(reject);
      });
    }
  });
}

function viewOnline(templateId, uid) {
  return new Promise((resolve, reject) => {
    fs.readFile(
      "html/app.email." + templateId + ".html",
      "utf8",
      (err, content) => {
        if (err) return reject(500, "Failed to load email template.");
        udb
          .getUserWithUID(uid)
          .then(user =>
            resolve(
              insertPlaceholderValues(content, qualifyPlaceholders({}, user))
            )
          )
          .catch(reject);
      }
    );
  });
}

module.exports = { send, viewOnline };
