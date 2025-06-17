// src/types.ts
export interface Route {
  id: number;
  start_location: string;
  end_location: string;
  // …any other fields you need
}

export interface Schedule {
  id: number;
  trip_type: 'trip' | 'stop';
  from_location: string;
  to_location: string;
  stop_station?: string;
  start_time: string;   // e.g. "06:50:00"
  end_time: string;     // e.g. "07:50:00"
  date: string;         // "YYYY-MM-DD"
  stop_label?: string;
  trip_label?: string;
  // …etc
}
