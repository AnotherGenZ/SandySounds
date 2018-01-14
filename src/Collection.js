class Collection extends Map {

    constructor(baseObject, limit) {
        super();
        this.baseObject = baseObject;
        this.limit = limit;
    }


    add(obj, extra, replace) {
        if (this.limit === 0) {
            return (obj instanceof this.baseObject || obj.constructor.name === this.baseObject.name) ? obj : new this.baseObject(obj, extra);
        }
        if (obj.id == null) {
            throw new Error("Missing object id");
        }
        var existing = this.get(obj.id);
        if (existing && !replace) {
            return existing;
        }
        if (!(obj instanceof this.baseObject || obj.constructor.name === this.baseObject.name)) {
            obj = new this.baseObject(obj, extra);
        }

        this.set(obj.id, obj);

        if (this.limit && this.size > this.limit) {
            var iter = this.keys();
            while (this.size > this.limit) {
                this.delete(iter.next().value);
            }
        }
        return obj;
    }


    find(func) {
        for (var item of this.values()) {
            if (func(item)) {
                return item;
            }
        }
        return undefined;
    }


    random() {
        if (!this.size) {
            return undefined;
        }
        return Array.from(this.values())[Math.floor(Math.random() * this.size)];
    }


    filter(func) {
        var arr = [];
        for (var item of this.values()) {
            if (func(item)) {
                arr.push(item);
            }
        }
        return arr;
    }


    map(func) {
        var arr = [];
        for (var item of this.values()) {
            arr.push(func(item));
        }
        return arr;
    }


    update(obj, extra, replace) {
        if (!obj.id && obj.id !== 0) {
            throw new Error("Missing object id");
        }
        var item = this.get(obj.id);
        if (!item) {
            return this.add(obj, extra, replace);
        }
        item.update(obj, extra);
        return item;
    }


    remove(obj) {
        var item = this.get(obj.id);
        if (!item) {
            return null;
        }
        this.delete(obj.id);
        return item;
    }

    toString() {
        return `[Collection<${this.baseObject.name}>]`;
    }
}

module.exports = Collection;