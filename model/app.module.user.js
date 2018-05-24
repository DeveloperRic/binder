class User {
  constructor(uid, email, password) {
    this.uid = uid;
    this.email = email;
    this.password = password;
  }

  static fromJSON(userdata) {
    return new User(userdata.uid, userdata.email, userdata.password);
  }

  toJSON() {
    return {
      uid: this.uid,
      email: this.email,
      password: this.password
    };
  }
}

if (module && module.exports) {
  module.exports = User;
}
