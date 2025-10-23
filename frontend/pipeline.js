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

  aggregate(reducer, asMap = false) {
    this.operations.push(grouped => {
      if (!(grouped instanceof Map)) {
        console.warn("aggregate() doit être appelé après groupBy()");
        return grouped;
      }
      const entries = Array.from(grouped, ([key, values]) => [key, reducer(values)]);
      return asMap ? new Map(entries) : entries.map(([key, value]) => ({ key, value }));
    });
    return this;
  }
  
  setPipeline(pipeline){
    this.operations = pipeline;
    return this;
  }

  getPipeline(){
    return this.operations
  }

  resetPipeline(){
    this.operations = [];
    return this;
  }

  convertMap(attribut) {
    this.operations.push(data => {
      const map = new Map()
      data.forEach(item => {
        map.set(item[attribut], item)
      })
      return map
    })
    return this // Pour chaînage
  }

  run() {
    return this.operations.reduce((result, op) => op(result), this.data);
  }
}

export default DataPipeline

/*
Exemple d'utilisation:
    const pipeline = new DataPipeline();
    await pipeline
    .load("./gdp.csv", "csv")
    .filter(d => d.gdp > 1000000)
    .sortBy("gdp", false);

    const result = pipeline.run();
*/
