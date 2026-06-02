import BaseModel from "./base_model.js";

class RandomForestClassifier extends BaseModel {
  constructor(params = {}, options = {}) {
    const defaults = {
      n_estimators: "100",
      criterion: "gini",
      random_state: "42"
    };
    super("RandomForestClassifier", { ...defaults, ...params }, options);
  }
}

export default RandomForestClassifier;
