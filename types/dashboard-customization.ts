import { DefaultTab } from "../enums/dasboard-enum";

export interface DashboardCustomization {
	defaultTab: string;
  }
  
export const DEFAULT_DASHBOARD_CUSTOMIZATION: DashboardCustomization = {
	defaultTab: DefaultTab.daily
  };
  