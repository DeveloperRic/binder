class Source {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.connected = false;
  }

  static fromJSON(data) {
    return new Source(data.id, data.name);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name
    };
  }
}

if (module && module.exports) {
  module.exports = Source;
}
