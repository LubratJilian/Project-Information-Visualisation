/**
 * DataPipeline class for loading, transforming, and processing data.
 *
 * @author G2
 */
class DataPipeline {
    /**
     * Initialize the DataPipeline with optional initial data.
     * @param data
     */
    constructor(data = []) {
        this.data = data;
        this.operations = new Map();
    }

    /**
     * Load data from a specified path and type.
     * @param path {string}
     * @param type {string}
     * @returns {Promise<DataPipeline>} The DataPipeline instance for chaining.
     */
    async load(path, type) {
        let raw;
        if (type === "csv") raw = await d3.csv(path);
        else throw new Error("Unsupported data type : " + type);
        this.data = raw.features ? raw.features : raw;
        return this;
    }

    /**
     * Add an operation to the pipeline.
     * @param name {string}
     * @param op {function}
     * @returns {DataPipeline} The DataPipeline instance for chaining.
     */
    addOperation(name, op) {
        this.operations.set(name, op);
        return this;
    }

    /**
     * Remove an operation from the pipeline by name.
     * @param name {string}
     * @returns {DataPipeline} The DataPipeline instance for chaining.
     */
    removeOperation(name) {
        this.operations.delete(name);
        return this;
    }

    /**
     * Clear all operations from the pipeline.
     * @returns {DataPipeline} The DataPipeline instance for chaining.
     */
    clearOperations() {
        this.operations.clear();
        return this;
    }

    /**
     * Filter data using the provided function.
     * @param name {string} Name of the operation.
     * @param fn {function} Filtering function.
     * @returns {DataPipeline} The DataPipeline instance for chaining.
     */
    filter(name, fn) {
        return this.addOperation(name, data => d3.filter(data, fn));
    }

    /**
     * Limit the number of items in the data array.
     * @param name {string}
     * @param key {string|number}
     * @returns {DataPipeline} The DataPipeline instance for chaining.
     */
    limit(name, key) {
        return this.addOperation(name, data => {
            if (!Array.isArray(data)) return data;
            const n = Number(key);
            if (!Number.isFinite(n) || n <= 0) return [];
            return data.slice(0, n);
        });
    }

    /**
     * Map data using the provided function.
     * @param name {string}
     * @param fn {function}
     * @returns {DataPipeline} The DataPipeline instance for chaining.
     */
    map(name, fn) {
        return this.addOperation(name, data => data.map(fn));
    }

    /**
     * Join data with geographical data from a GeoJSON file.
     * @param name {string}
     * @param geoPath {string}
     * @param key {string}
     * @param geoKey {string}
     * @param mergeFn {function}
     * @returns {Promise<DataPipeline>} The DataPipeline instance for chaining.
     */
    async joinGeo(name, geoPath, key, geoKey = key, mergeFn = (a, b) => ({...a, ...b})) {
        const geoData = await d3.json(geoPath);
        const features = geoData.features || geoData;

        return this.addOperation(name, data => {
            const map = d3.index(features, d => d.properties?.[geoKey] || d[geoKey]);
            return d3.filter(
                data.map(d => {
                    const match = map.get(d[key]);
                    return match ? mergeFn(d, match) : null;
                }),
                Boolean);
        });
    }

    /**
     * Sort data by the specified key.
     * @param name {string} Name of the operation.
     * @param key {string} Key to sort by.
     * @param ascending {boolean} Whether to sort in ascending order. Default is true.
     * @returns {DataPipeline} The DataPipeline instance for chaining.
     */
    sortBy(name, key, ascending = true) {
        return this.addOperation(name, data =>
            d3.sort(data, d => ascending ? d[key] : -d[key]));
    }

    /**
     * Group data by the specified key.
     * @param name {string} Name of the operation.
     * @param key {string} Key to group by.
     * @returns {DataPipeline} The DataPipeline instance for chaining.
     */
    groupBy(name, key) {
        return this.addOperation(name, data => d3.group(data, d => d[key]));
    }

    /**
     * Aggregate grouped data using the provided reducer function.
     * @param name {string} Name of the operation.
     * @param reducer {function} Function to reduce the grouped values.
     * @returns {DataPipeline} The DataPipeline instance for chaining.
     */
    aggregate(name, reducer) {
        return this.addOperation(name, grouped => {
            if (!(grouped instanceof Map)) {
                console.warn("aggregate() doit être appelé après groupBy()");
                return grouped;
            }
            return Array.from(grouped, ([key, values]) => ({
                key,
                value: reducer(values)
            }));
        });

    }

    /**
     * Execute the pipeline, optionally discarding some operations.
     * @param discarded {string[]|null} Names of operations to discard. If null, all operations are applied.
     * @returns {any} The processed data after applying the pipeline operations.
     */
    run(discarded = null) {
        if (discarded !== null && !Array.isArray(discarded)) throw new Error("Parameter 'discarded' must be an array or null");

        let ops;
        if (discarded === null) ops = Array.from(this.operations.values());
        else ops = Array.from(this.operations.entries())
            .map(([name, op]) => (discarded.includes(name)) ? null : op)
            .filter(Boolean);

        return ops.reduce((result, op) => op(result), this.data);
    }
}

export default DataPipeline;
