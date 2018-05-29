class User {
  constructor(uid, email, password, connectedSources) {
    this.uid = uid;
    this.email = email;
    this.password = password;
    this.connectedSources = connectedSources;
  }

  toJSON() {
    return {
      uid: this.uid,
      email: this.email,
      password: this.password,
      connectedSources: this.connectedSources
    };
  }
}

if (module && module.exports) {
  module.exports = User;
}
