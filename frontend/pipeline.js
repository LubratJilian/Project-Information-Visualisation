class DataPipeline {
    constructor(data = []) {
        this.data = data;
        this.operations = new Map();
    }

    async load(path, type) {
        let raw;
        if (type === "csv") raw = await d3.csv(path); else throw new Error("Type non supporté : " + type);
        this.data = raw.features ? raw.features : raw;
        return this;
    }

    addOperation(name, op) {
        this.operations.set(name, op);
        return this;
    }

    clearOperations() {
        this.operations.clear();
        return this;
    }

    filter(name, fn) {
        return this.addOperation(name, data => d3.filter(data, fn));
    }

    limit(name, key) {
        return this.addOperation(name, data => {
            if (!Array.isArray(data)) return data;
            const n = Number(key);
            if (!Number.isFinite(n) || n <= 0) return [];
            return data.slice(0, n);
        });
    }

    map(name, fn) {
        return this.addOperation(name, data => data.map(fn));
    }

    async joinGeo(name, geoPath, key, geoKey = key, mergeFn = (a, b) => ({...a, ...b})) {
        const geoData = await d3.json(geoPath);
        const features = geoData.features || geoData;
        return this.addOperation(name, data => {
            const map = d3.index(features, d => d.properties?.[geoKey] || d[geoKey]);
            return d3.filter(data.map(d => {
                const match = map.get(d[key]);
                return match ? mergeFn(d, match) : null;
            }), Boolean);
        });
    }

    sortBy(name, key, ascending = true) {
        return this.addOperation(name, data => d3.sort(data, d => ascending ? d[key] : -d[key]));
    }

    groupBy(name, key) {
        return this.addOperation(name, data => d3.group(data, d => d[key]));
    }

    aggregate(name, reducer) {
        return this.addOperation(name, grouped => {
            if (!(grouped instanceof Map)) {
                console.warn("aggregate() doit être appelé après groupBy()");
                return grouped;
            }
            return Array.from(grouped, ([key, values]) => ({
                key, value: reducer(values)
            }));
        });
    }

    run(selected = null) {
        if (selected !== null && !Array.isArray(selected)) throw new Error("Paramètre 'selected' doit être null ou un tableau de noms");

        let ops;
        if (selected === null) ops = Array.from(this.operations.values());
        else ops = selected.map(name => {
            const op = this.operations.get(name);
            if (!op) console.warn(`Opération introuvable: ${name}`);
            return op;
        }).filter(Boolean);

        return ops.reduce((result, op) => op(result), this.data);
    }
}

export default DataPipeline;

/*
Exemple d'utilisation:
    const pipeline = new DataPipeline();
    await pipeline
    .load("./gdp.csv", "csv")
    .joinGeo("./countries.geojson", "country_code", "ISO_A3")
    .filter(d => d.gdp > 1000000)
    .sortBy("gdp", false);

    const result = pipeline.run();
*/
