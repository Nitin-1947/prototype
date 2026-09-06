import axios from "axios";

const API = axios.create({ baseURL: "http://localhost:8000" });

export const getSampleConfig = (vendor) =>
  API.get(`/api/samples/${vendor}`).then((r) => r.data);

export const uploadConfig = (vendor, config_text, device_name) =>
  API.post("/api/upload", { vendor, config_text, device_name }).then((r) => r.data);

export const analyzeDevice = (device_id) =>
  API.post(`/api/analyze/${device_id}`).then((r) => r.data);

export const analyzeAll = () =>
  API.post("/api/analyze-all").then((r) => r.data);

export const getAllResults = () =>
  API.get("/api/results").then((r) => r.data);

export const getDriftReport = () =>
  API.get("/api/drift").then((r) => r.data);

export const nlQuery = (question) =>
  API.post("/api/query", { question }).then((r) => r.data);

export const resetAll = () =>
  API.delete("/api/reset").then((r) => r.data);


export const simulateFix = (device_id, rule_id) =>
  API.post(`/api/simulate-fix/${device_id}/${rule_id}`).then((r) => r.data);

export const simulateApply = (device_id, rule_id) =>
  API.post(`/api/simulate-apply/${device_id}/${rule_id}`).then((r) => r.data);

export const getFixState = (device_id) =>
  API.get(`/api/fix-state/${device_id}`).then((r) => r.data);
