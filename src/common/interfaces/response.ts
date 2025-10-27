export interface ApiResponse<T = any> {
  success?: boolean;
  status?: number;
  totalUpdated?: number[];
  error?: string;
}
