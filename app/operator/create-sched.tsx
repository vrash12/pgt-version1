import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Route, Schedule } from './types';

export default function ScheduleManager(): React.ReactElement {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState<'trip' | 'stop'>('trip');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [trips, setTrips] = useState<Schedule[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Schedule | null>(null);

  useEffect(() => {
    axios.get<Route[]>('/api/routes/').then(res => setRoutes(res.data));
    axios
      .get<Schedule[]>('/api/schedules/', { params: { date } })
      .then(res => {
        const all = res.data;
        setTrips(all.filter((s) => s.trip_type === 'trip'));
        if (all.length > 0) setSelectedTrip(all[0]);
      });
  }, [date]);

  const refreshSchedules = () => {
    axios
      .get<Schedule[]>('/api/schedules/', { params: { date } })
      .then(res => setTrips(res.data.filter((s) => s.trip_type === 'trip')));
  };

  return (
    <div className="max-w-md mx-auto p-4">
      {/* ...header and date picker... */}
      <div className="flex space-x-2 mb-4">
        <button onClick={() => setTab('trip')} className={tab === 'trip' ? 'bg-green-200' : 'bg-gray-200'}>Set Route</button>
        <button onClick={() => setTab('stop')} className={tab === 'stop' ? 'bg-green-200' : 'bg-gray-200'}>Fixed Schedule</button>
      </div>

      {tab === 'trip' ? (
        <TripSection
          routes={routes}
          trips={trips}
          onCreated={refreshSchedules}
        />
      ) : (
        <StopSection
          trips={trips}
          selectedTrip={selectedTrip}
          setSelectedTrip={setSelectedTrip}
          onCreated={refreshSchedules}
        />
      )}
    </div>
  );
}

type TripSectionProps = {
  routes: Route[];
  trips: Schedule[];
  onCreated: () => void;
};

function TripSection({ routes, trips, onCreated }: TripSectionProps): React.ReactElement {
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');

  const handleAddTrip = () => {
    axios
      .post<Schedule>('/api/schedules/', {
        trip_type: 'trip',
        from_location: from,
        to_location: to,
        start_time: startTime,
        end_time: endTime,
        date: new Date().toISOString().slice(0, 10),
      })
      .then(() => onCreated());
  };

  return (
    <>
      {/* …form inputs for from/to/times… */}
      {trips.map((trip) => (
        <div key={trip.id}>
          {trip.from_location} → {trip.to_location}
          <button onClick={() => axios.delete(`/api/schedules/${trip.id}/`).then(onCreated)}>Delete</button>
        </div>
      ))}
    </>
  );
}

type StopSectionProps = {
  trips: Schedule[];
  selectedTrip: Schedule | null;
  setSelectedTrip: React.Dispatch<React.SetStateAction<Schedule | null>>;
  onCreated: () => void;
};

function StopSection({ trips, selectedTrip, setSelectedTrip, onCreated }: StopSectionProps): React.ReactElement {
  const [station, setStation] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [departureTime, setDepartureTime] = useState<string>('');

  const handleAddStop = () => {
    if (!selectedTrip) return;
    axios
      .post<Schedule>('/api/schedules/', {
        trip_type: 'stop',
        stop_station: station,
        stop_label: 'Stop',
        from_location: selectedTrip.from_location,
        to_location: selectedTrip.to_location,
        start_time: startTime,
        end_time: departureTime,
        date: selectedTrip.date,
      })
      .then(onCreated);
  };

  return (
    <>
      {/* …select for trips, inputs for station/times… */}
    </>
  );
}