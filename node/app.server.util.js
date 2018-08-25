const request = require("request");
const mammoth = require("mammoth");

exports.docxToHtml = function(url, buffer, onSuccess, onFail) {
  var convertBuffer = buffer => {
    mammoth.convertToHtml({ path: "html/testDoc.docx" }).then(function(result) {
      onSuccess({ html: result.value, messages: result.messages });
    });
  };
  if (!!buffer) {
    convertBuffer(buffer);
  } else {
    request.get(url, (error, response, body) => {
      if (!!error) {
        onFail(error);
      } else {
        convertBuffer(new Buffer(body, "binary"));
      }
    });
  }
};
