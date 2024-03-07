import { TemperatureUnit } from "../enums/metrics-enum";

export interface MetricPreference {
	temperature: string;
  }

export const DEFAULT_METRIC_PREFERENCE: MetricPreference = {
	temperature: TemperatureUnit.Celsius
  };