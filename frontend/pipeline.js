class DataPipeline {
  constructor(data = []) {
    this.data = data;    
    this.operations = [];
  }

  async load(path, type) {
    let raw;
    if (type === "csv") raw = await d3.csv(path);
    else throw new Error("Type non supporté : " + type);
    this.data = raw.features ? raw.features : raw;
    return this;
  }

  filter(fn) {
    this.operations.push(data => d3.filter(data, fn));
    return this;
  }

  map(fn) {
    this.operations.push(data => data.map(fn));
    return this;
  }

  async joinGeo(geoPath, key, geoKey = key, mergeFn = (a, b) => ({ ...a, ...b })) {
    const geoData = await d3.json(geoPath);
    const features = geoData.features || geoData;
    
    this.operations.push(data => {
      const map = d3.index(features, d => d.properties?.[geoKey] || d[geoKey]);
      return d3.filter(
        data.map(d => {
          const match = map.get(d[key]);
          return match ? mergeFn(d, match) : null;
        }),
        Boolean
      );
    });
    return this;
  }

  sortBy(key, ascending = true) {
    this.operations.push(data =>
      d3.sort(data, d => ascending ? d[key] : -d[key])
    );
    return this;
  }

  groupBy(key) {
    this.operations.push(data => d3.group(data, d => d[key]));
    return this;
  }

  aggregate(reducer) {
    this.operations.push(grouped => {
      if (!(grouped instanceof Map)) {
        console.warn("⚠️ aggregate() doit être appelé après groupBy()");
        return grouped;
      }
      return Array.from(grouped, ([key, values]) => ({
        key,
        value: reducer(values)
      }));
    });
    return this;
  }

  run() {
    return this.operations.reduce((result, op) => op(result), this.data);
  }
}


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