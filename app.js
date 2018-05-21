var app = angular.module("app", []);

var appStage = {
  login: {
    enabled: true,
    onSubmit: function() {

    }
  },
  dashboard: false
};

var navButtons = [
  {
    url: "test.html",
    text: "Test Page"
  }
];

class User {
  constructor(username, password) {
    this.username = username;
    this.password = password;
  }
}
var user = new User("admin", "admin");

class Source {
  constructor(name, desc) {
    this.name = name;
    this.desc = desc;
  }
}
var sources = [
  new Source("Dropbox", "Who even uses dropbox?"),
  new Source("Google Drive", "What are you trying to be?"),
  new Source("Mediafire", "MAy your soul rest in peace"),
  new Source("Mega", "Seriously bro?"),
  {
    name: "Dropbox",
    desc: "Who even uses dropbox?"
  },
  {
    name: "Google Drive",
    desc: "What are you trying to be?"
  },
  {
    name: "Mediafire",
    desc: "May your soul rest in peace"
  },
  {
    name: "Mega",
    desc: "Seriously bro?"
  }
];
